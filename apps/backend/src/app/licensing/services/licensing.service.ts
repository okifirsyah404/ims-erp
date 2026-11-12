import { OUTBOX_SERVICE_TOKEN } from '@app/automation/constants/di';
import type { OutboxService } from '@app/automation/services/outbox.service';
import { CUSTOMER_SERVICE_TOKEN } from '@app/crm/constants/di';
import type { CustomerService } from '@app/crm/services/customer.service';
import { INVOICE_LOOKUP_SERVICE_TOKEN } from '@app/sales/constants/di';
import type { InvoiceLookupService } from '@app/sales/services/invoice-lookup.service';
import { NUMBERING_SERVICE_TOKEN } from '@app/organization/constants/di';
import type { NumberingService } from '@app/organization/services/numbering.service';
import { SALES_FULFILMENT_SERVICE_TOKEN } from '@app/sales/constants/di';
import type { SalesFulfilmentService } from '@app/sales/services/sales-fulfilment.service';
import { isUniqueViolation } from '@drizzle/errors';
import type {
	LicenseEventType,
	TLicensableApplicationSelect,
	TLicenseActivationSelect,
	TLicenseContractSelect,
	TLicenseKeySelect,
} from '@drizzle/schemas/licensing.schema';
import { businessDateOf } from '@utils/business-date.util';
import type { TPaginationResult } from '@ims-erp/common';
import { type ITransactionRunner, TRANSACTION_RUNNER_TOKEN } from '@providers/database/transaction-runner';
import { pinoLogger } from '@providers/logger/logger';
import { inject, injectable } from 'tsyringe';
import { LICENSE_API_REPOSITORY_TOKEN, LICENSING_REPOSITORY_TOKEN } from '../constants/di';
import type { ILicenseApiRepository, TEventRow } from '../contracts/license-api.contract';
import type {
	ILicensingRepository,
	TApplicationBody,
	TContractBody,
	TContractListQuery,
	TContractRow,
	TKeyBody,
} from '../contracts/licensing.contract';
import {
	ApplicationCodeTakenError,
	ContractInvalidError,
	ContractStateError,
	LicenseKeyError,
	LicensingNotFoundError,
} from '../errors/licensing.errors';
import {
	addDays,
	contractTiming,
	dueNoticeThreshold,
	GRACE_DAYS,
	generateLicenseKey,
	maskLicenseKey,
	renewalPeriod,
	type TContractTiming,
} from '../utils/license';

/** Server-derived caller context (see the controller). */
export type TLicenseContext = {
	actorUserId: string;
	/** `license:read_key`: keys are shown in full, otherwise masked. */
	canReadKeys: boolean;
};

export type TContractView = TContractRow & TContractTiming & { graceEndsOn: string | null };
export type TKeyView = TLicenseKeySelect & { masked: boolean; activations: TLicenseActivationSelect[] };
export type TContractDetail = TContractView & {
	keys: TKeyView[];
	renewedFrom: { id: string; code: string } | null;
	renewal: { id: string; code: string; status: string; salesOrderId: string | null } | null;
	events: TEventRow[];
};
export type TLicenseSummary = { endingWithinDays: number; endingSoon: number; ended: number };

/** Days ahead the due list and the dashboard look by default. */
export const DUE_WITHIN_DAYS = 30;

/**
 * The license register (M03, decisions of 2026-11-06).
 *
 * @remarks
 * A contract records what a customer licenses (a third-party vendor's or
 * the company's own application), its period and value. Billing stays in
 * the sales flow (SPH → SO → invoice); a contract may point to its sales
 * order. `draft → active ⇄ suspended → terminated`; renewing creates a
 * draft for the next period, and activating it marks the old contract
 * `renewed` and moves its keys (with their seats) to the renewal. A draft
 * renewal whose sales order is paid in full activates by itself (stage 2):
 * checked whenever the register is read and whenever its key is validated,
 * so no background job is needed. "Due", "expired" and the grace period are
 * derived from the end date. Staff overrides are written to the license
 * event log with the actor.
 */
@injectable()
export class LicensingService {
	constructor(
		@inject(LICENSING_REPOSITORY_TOKEN) private readonly repository: ILicensingRepository,
		@inject(CUSTOMER_SERVICE_TOKEN) private readonly customers: Pick<CustomerService, 'getActiveCustomer'>,
		@inject(SALES_FULFILMENT_SERVICE_TOKEN) private readonly sales: Pick<SalesFulfilmentService, 'getLiveOrder'>,
		@inject(NUMBERING_SERVICE_TOKEN) private readonly numbering: Pick<NumberingService, 'next'>,
		@inject(TRANSACTION_RUNNER_TOKEN) private readonly transactions: ITransactionRunner,
		@inject(LICENSE_API_REPOSITORY_TOKEN)
		private readonly api: Pick<ILicenseApiRepository, 'insertEvent' | 'listActivations' | 'paginateEvents'>,
		@inject(INVOICE_LOOKUP_SERVICE_TOKEN) private readonly invoices: Pick<InvoiceLookupService, 'paidTotal'>,
		@inject(OUTBOX_SERVICE_TOKEN) private readonly outbox: Pick<OutboxService, 'publish'>,
	) {}

	// Applications -----------------------------------------------------------

	listApplications(includeRetired = false): Promise<TLicensableApplicationSelect[]> {
		return this.repository.listApplications(includeRetired);
	}

	async getApplication(id: string): Promise<TLicensableApplicationSelect> {
		const application = await this.repository.findApplication(id);
		if (!application) throw new LicensingNotFoundError('application');
		return application;
	}

	async createApplication(ctx: TLicenseContext, body: TApplicationBody): Promise<TLicensableApplicationSelect> {
		try {
			return await this.repository.createApplication({ ...body, createdBy: ctx.actorUserId });
		} catch (error) {
			if (isUniqueViolation(error)) throw new ApplicationCodeTakenError();
			throw error;
		}
	}

	async updateApplication(id: string, body: TApplicationBody): Promise<TLicensableApplicationSelect> {
		try {
			const updated = await this.repository.updateApplication(id, body);
			if (!updated) throw new LicensingNotFoundError('application');
			return updated;
		} catch (error) {
			if (isUniqueViolation(error)) throw new ApplicationCodeTakenError();
			throw error;
		}
	}

	/** Retired applications stay on their contracts but cannot be picked for new ones. */
	async setApplicationStatus(id: string, status: 'active' | 'retired'): Promise<TLicensableApplicationSelect> {
		const updated = await this.repository.updateApplication(id, { status });
		if (!updated) throw new LicensingNotFoundError('application');
		return updated;
	}

	// Contracts --------------------------------------------------------------

	private timed(row: TContractRow, today = businessDateOf()): TContractView {
		const timing = contractTiming(row, today, DUE_WITHIN_DAYS);
		return { ...row, ...timing, graceEndsOn: row.endDate ? addDays(row.endDate, GRACE_DAYS) : null };
	}

	private keyView(ctx: TLicenseContext, key: TLicenseKeySelect, activations: TLicenseActivationSelect[] = []): TKeyView {
		const shown = ctx.canReadKeys ? key : { ...key, licenseKey: maskLicenseKey(key.licenseKey) };
		return { ...shown, masked: !ctx.canReadKeys, activations };
	}

	private async require(id: string): Promise<TContractRow> {
		const contract = await this.repository.findContract(id);
		if (!contract) throw new LicensingNotFoundError('contract');
		return contract;
	}

	private event(
		type: LicenseEventType,
		contractId: string,
		actorUserId: string | null,
		description: string | null,
		licenseKeyId: string | null = null,
	) {
		return this.api.insertEvent({
			eventType: type,
			result: 'ok',
			licenseContractId: contractId,
			licenseKeyId,
			actorUserId,
			description,
			eventAt: new Date(),
		});
	}

	async list(query: TContractListQuery): Promise<TPaginationResult<TContractView>> {
		await this.activatePaidRenewals();
		const today = businessDateOf();
		const dueBefore = query.dueWithinDays === undefined ? undefined : addDays(today, query.dueWithinDays);
		const result = await this.repository.paginateContracts({ ...query, dueBefore });
		return { meta: result.meta, data: result.data.map((row) => this.timed(row, today)) };
	}

	async get(ctx: TLicenseContext, id: string): Promise<TContractDetail> {
		const before = await this.require(id);
		// Its own renewal, or itself when it is a paid draft renewal.
		await this.activatePaidRenewals(before.status === 'draft' && before.renewedFromContractId ? before.renewedFromContractId : id);
		const contract = await this.require(id);
		const [keys, renewal, renewedFrom, events] = await Promise.all([
			this.repository.listKeys(id),
			this.repository.findOpenRenewal(id),
			contract.renewedFromContractId ? this.repository.findContract(contract.renewedFromContractId) : null,
			this.api.paginateEvents({ page: 1, limit: 30, contractId: id }),
		]);
		const activations = await this.api.listActivations(keys.map((key) => key.id));
		return {
			...this.timed(contract),
			keys: keys.map((key) =>
				this.keyView(
					ctx,
					key,
					activations.filter((activation) => activation.licenseKeyId === key.id),
				),
			),
			renewedFrom: renewedFrom ? { id: renewedFrom.id, code: renewedFrom.code } : null,
			renewal: renewal ? { id: renewal.id, code: renewal.code, status: renewal.status, salesOrderId: renewal.salesOrderId } : null,
			events: events.data,
		};
	}

	/** Counts for the dashboard widget. */
	async summary(): Promise<TLicenseSummary> {
		await this.activatePaidRenewals();
		const today = businessDateOf();
		const counts = await this.repository.countDue(today, addDays(today, DUE_WITHIN_DAYS));
		return { endingWithinDays: DUE_WITHIN_DAYS, ...counts };
	}

	/** Customer, application and sales order checked; returns the stored snapshot fields. */
	private async references(body: TContractBody, currentApplicationId?: string) {
		const customer = await this.customers.getActiveCustomer(body.customerId);
		if (!customer) throw new ContractInvalidError('customer');
		const application = await this.repository.findApplication(body.licensableApplicationId);
		// A retired application may stay on a draft that already had it.
		if (!application || (application.status !== 'active' && application.id !== currentApplicationId)) {
			throw new ContractInvalidError('application');
		}
		if (body.salesOrderId) {
			const order = await this.sales.getLiveOrder(body.salesOrderId);
			if (!order || order.customerId !== customer.id) throw new ContractInvalidError('order');
		}
		if (body.startDate && body.endDate && body.endDate < body.startDate) throw new ContractInvalidError('dates');
		return { customerName: customer.name };
	}

	async create(ctx: TLicenseContext, body: TContractBody): Promise<TContractView> {
		const { customerName } = await this.references(body);
		const code = await this.numbering.next('license_contract', { date: new Date() });
		const created = await this.repository.createContract({
			...body,
			salesOrderId: body.salesOrderId ?? null,
			startDate: body.startDate ?? null,
			endDate: body.endDate ?? null,
			code,
			customerName,
			status: 'draft',
			createdBy: ctx.actorUserId,
		});
		return this.timed(await this.require(created.id));
	}

	async update(id: string, body: TContractBody): Promise<TContractView> {
		const current = await this.require(id);
		if (current.status !== 'draft') throw new ContractStateError('edit');
		const { customerName } = await this.references(body, current.licensableApplicationId);
		const updated = await this.repository.updateDraft(id, {
			...body,
			salesOrderId: body.salesOrderId ?? null,
			startDate: body.startDate ?? null,
			endDate: body.endDate ?? null,
			customerName,
		});
		if (!updated) throw new ContractStateError('edit');
		return this.timed(await this.require(id));
	}

	/**
	 * Draft → active in one transaction; a renewal also marks the contract it
	 * renews `renewed` and takes over its keys. `actorUserId` null = activated
	 * by full payment.
	 */
	private async activateDraft(current: TLicenseContractSelect, actorUserId: string | null, description: string | null) {
		if (current.status !== 'draft') throw new ContractStateError('activate');
		if (!current.startDate) throw new ContractInvalidError('startRequired');
		await this.transactions.run(async (tx) => {
			const activated = await this.repository.transition(
				current.id,
				['draft'],
				{ status: 'active', activatedBy: actorUserId, activatedAt: new Date() },
				tx,
			);
			if (!activated) throw new ContractStateError('activate');
			if (!current.renewedFromContractId) return;
			const old = await this.repository.transition(current.renewedFromContractId, ['active', 'suspended'], { status: 'renewed' }, tx);
			if (!old) return;
			const moved = await this.repository.moveKeys(old.id, current.id, old.endDate, current.endDate, tx);
			await this.api.insertEvent(
				{
					eventType: 'renewed',
					result: 'ok',
					licenseContractId: current.id,
					actorUserId,
					description: `${description ?? 'Renewal activated'}: renews ${old.code}, ${moved.length} key(s) moved`,
					eventAt: new Date(),
				},
				tx,
			);
		});
	}

	async activate(ctx: TLicenseContext, id: string): Promise<TContractView> {
		const current = await this.require(id);
		await this.activateDraft(current, ctx.actorUserId, null);
		return this.timed(await this.require(id));
	}

	/**
	 * Activates draft renewals whose sales order is paid in full (owner
	 * decision 2026-11-06). Idempotent: activation is guarded on `draft`, so
	 * a payment renews once however often this runs. Failures are logged and
	 * never break the read that triggered the check.
	 */
	async activatePaidRenewals(renewedFromContractId?: string): Promise<number> {
		const candidates = await this.repository.listRenewalCandidates(renewedFromContractId);
		let activated = 0;
		for (const draft of candidates) {
			try {
				const order = await this.sales.getLiveOrder(draft.salesOrderId!);
				if (!order || order.customerId !== draft.customerId || order.grandTotal <= 0) continue;
				const paid = await this.invoices.paidTotal(order.id);
				if (paid < order.grandTotal) continue;
				await this.activateDraft(draft, null, `Paid in full (${order.code})`);
				activated += 1;
			} catch (error) {
				pinoLogger.warn({ err: error, contractId: draft.id }, 'license renewal auto-activation skipped');
			}
		}
		return activated;
	}

	/**
	 * Daily `license.due` reminders to n8n (M04 stage 2): active contracts
	 * ending within 30 days, within 7 days, or ended and still in grace.
	 * Each (contract, end date, threshold) is published once — the outbox
	 * skips a repeated dedupe key — so the job is safe to run any number of
	 * times. Paid renewals are activated first, so a renewed license is not
	 * reminded.
	 */
	async publishDueNotices(today = businessDateOf()): Promise<{ processed: number; skipped: number }> {
		await this.activatePaidRenewals();
		let processed = 0;
		let skipped = 0;
		for (let page = 1; ; page += 1) {
			const result = await this.repository.paginateContracts({ page, limit: 100, dueBefore: addDays(today, DUE_WITHIN_DAYS) });
			for (const row of result.data) {
				const contract = this.timed(row, today);
				const threshold = dueNoticeThreshold(contract.daysLeft);
				if (threshold === null || contract.status !== 'active' || !contract.endDate) {
					skipped += 1;
					continue;
				}
				const customer = await this.customers.getActiveCustomer(contract.customerId);
				const message = await this.outbox.publish(
					'license.due',
					{ type: 'license_contract', id: contract.id },
					{
						contractId: contract.id,
						code: contract.code,
						threshold,
						stage: threshold === 0 ? 'ended' : 'ending',
						daysLeft: contract.daysLeft,
						endDate: contract.endDate,
						graceEndsOn: contract.graceEndsOn,
						application: { code: contract.applicationCode, name: contract.applicationName },
						packageName: contract.packageName,
						salesOrderId: contract.salesOrderId,
						customer: {
							id: contract.customerId,
							name: contract.customerName,
							email: customer?.email ?? null,
							phone: customer?.phone ?? null,
							whatsapp: customer?.whatsapp ?? null,
						},
					},
					{ dedupeKey: `license.due:${contract.id}:${contract.endDate}:${threshold}` },
				);
				if (message) processed += 1;
				else skipped += 1;
			}
			if (page >= result.meta.totalPages) break;
		}
		return { processed, skipped };
	}

	async suspend(ctx: TLicenseContext, id: string, reason: string | null): Promise<TContractView> {
		if (!(await this.repository.transition(id, ['active'], { status: 'suspended' }))) throw await this.stateError(id, 'suspend');
		await this.event('suspended', id, ctx.actorUserId, reason);
		return this.timed(await this.require(id));
	}

	async reactivate(ctx: TLicenseContext, id: string): Promise<TContractView> {
		if (!(await this.repository.transition(id, ['suspended'], { status: 'active' }))) throw await this.stateError(id, 'reactivate');
		await this.event('reactivated', id, ctx.actorUserId, null);
		return this.timed(await this.require(id));
	}

	async terminate(ctx: TLicenseContext, id: string, reason: string): Promise<TContractView> {
		const updated = await this.repository.transition(id, ['draft', 'active', 'suspended'], {
			status: 'terminated',
			terminatedBy: ctx.actorUserId,
			terminatedAt: new Date(),
			terminationReason: reason,
		});
		if (!updated) throw await this.stateError(id, 'terminate');
		await this.event('terminated', id, ctx.actorUserId, reason);
		return this.timed(await this.require(id));
	}

	/** A draft for the next period with the same terms; billed through a new SPH/SO. */
	async renew(ctx: TLicenseContext, id: string): Promise<TContractView> {
		const current = await this.require(id);
		if (current.status !== 'active' || (await this.repository.findOpenRenewal(id))) throw new ContractStateError('renew');
		const period = renewalPeriod(current, businessDateOf());
		const code = await this.numbering.next('license_contract', { date: new Date() });
		const created = await this.repository.createContract({
			code,
			customerId: current.customerId,
			customerName: current.customerName,
			licensableApplicationId: current.licensableApplicationId,
			packageName: current.packageName,
			salesOrderId: null,
			startDate: period.startDate,
			endDate: period.endDate,
			billingCycle: current.billingCycle,
			contractValue: current.contractValue,
			currencyCode: current.currencyCode,
			status: 'draft',
			renewedFromContractId: current.id,
			notes: current.notes,
			createdBy: ctx.actorUserId,
		});
		return this.timed(await this.require(created.id));
	}

	/** Not found, or the state error of the action. */
	private async stateError(id: string, action: ConstructorParameters<typeof ContractStateError>[0]) {
		await this.require(id);
		return new ContractStateError(action);
	}

	// Keys -------------------------------------------------------------------

	async addKey(ctx: TLicenseContext, contractId: string, body: TKeyBody): Promise<TKeyView> {
		const contract = await this.require(contractId);
		if (!['draft', 'active', 'suspended'].includes(contract.status)) throw new ContractStateError('keys');
		const own = contract.applicationSource === 'own';
		if (!own && !body.licenseKey) throw new LicenseKeyError('required');
		const licenseKey = body.licenseKey ?? generateLicenseKey();
		if (await this.repository.findKeyByValue(licenseKey)) throw new LicenseKeyError('taken');
		try {
			const key = await this.repository.createKey({
				licenseContractId: contractId,
				licenseKey,
				keySource: body.licenseKey ? 'vendor' : 'generated',
				maxActivations: body.maxActivations,
				expiresOn: body.expiresOn ?? contract.endDate,
				notes: body.notes,
				createdBy: ctx.actorUserId,
			});
			return this.keyView(ctx, key);
		} catch (error) {
			if (isUniqueViolation(error)) throw new LicenseKeyError('taken');
			throw error;
		}
	}

	/** Ids of the contract's live keys (seat release checks ownership). */
	async contractKeyIds(contractId: string): Promise<string[]> {
		await this.require(contractId);
		return (await this.repository.listKeys(contractId)).map((key) => key.id);
	}

	async revokeKey(ctx: TLicenseContext, contractId: string, keyId: string, reason: string): Promise<TKeyView> {
		await this.require(contractId);
		const key = await this.repository.revokeKey(contractId, keyId, ctx.actorUserId, reason);
		if (!key) throw new LicensingNotFoundError('key');
		await this.event('key_revoked', contractId, ctx.actorUserId, reason, keyId);
		return this.keyView(ctx, key);
	}
}
