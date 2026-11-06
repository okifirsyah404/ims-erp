import { CUSTOMER_SERVICE_TOKEN } from '@app/crm/constants/di';
import type { CustomerService } from '@app/crm/services/customer.service';
import { NUMBERING_SERVICE_TOKEN } from '@app/organization/constants/di';
import type { NumberingService } from '@app/organization/services/numbering.service';
import { SALES_FULFILMENT_SERVICE_TOKEN } from '@app/sales/constants/di';
import type { SalesFulfilmentService } from '@app/sales/services/sales-fulfilment.service';
import { isUniqueViolation } from '@drizzle/errors';
import type { TLicensableApplicationSelect, TLicenseKeySelect } from '@drizzle/schemas/licensing.schema';
import { businessDateOf, type TPaginationResult } from '@ims-erp/common';
import { type ITransactionRunner, TRANSACTION_RUNNER_TOKEN } from '@providers/database/transaction-runner';
import { inject, injectable } from 'tsyringe';
import { LICENSING_REPOSITORY_TOKEN } from '../constants/di';
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
import { addDays, contractTiming, generateLicenseKey, maskLicenseKey, renewalPeriod, type TContractTiming } from '../utils/license';

/** Server-derived caller context (see the controller). */
export type TLicenseContext = {
	actorUserId: string;
	/** `license:read_key`: keys are shown in full, otherwise masked. */
	canReadKeys: boolean;
};

export type TContractView = TContractRow & TContractTiming;
export type TKeyView = TLicenseKeySelect & { masked: boolean };
export type TContractDetail = TContractView & {
	keys: TKeyView[];
	renewedFrom: { id: string; code: string } | null;
	renewal: { id: string; code: string; status: string } | null;
};
export type TLicenseSummary = { endingWithinDays: number; endingSoon: number; ended: number };

/** Days ahead the due list and the dashboard look by default. */
export const DUE_WITHIN_DAYS = 30;

/**
 * The license register (M03 stage 1, decisions of 2026-11-06).
 *
 * @remarks
 * A contract records what a customer licenses (a third-party vendor's or
 * the company's own application), its period and value. Billing stays in
 * the sales flow (SPH → SO → invoice); a contract may point to its sales
 * order. `draft → active ⇄ suspended → terminated`; renewing creates a
 * draft for the next period, and activating it marks the old contract
 * `renewed`. "Due" and "expired" are derived from the end date.
 */
@injectable()
export class LicensingService {
	constructor(
		@inject(LICENSING_REPOSITORY_TOKEN) private readonly repository: ILicensingRepository,
		@inject(CUSTOMER_SERVICE_TOKEN) private readonly customers: Pick<CustomerService, 'getActiveCustomer'>,
		@inject(SALES_FULFILMENT_SERVICE_TOKEN) private readonly sales: Pick<SalesFulfilmentService, 'getLiveOrder'>,
		@inject(NUMBERING_SERVICE_TOKEN) private readonly numbering: Pick<NumberingService, 'next'>,
		@inject(TRANSACTION_RUNNER_TOKEN) private readonly transactions: ITransactionRunner,
	) {}

	// Applications -----------------------------------------------------------

	listApplications(includeRetired = false): Promise<TLicensableApplicationSelect[]> {
		return this.repository.listApplications(includeRetired);
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
		return { ...row, ...contractTiming(row, today, DUE_WITHIN_DAYS) };
	}

	private keyView(ctx: TLicenseContext, key: TLicenseKeySelect): TKeyView {
		return ctx.canReadKeys ? { ...key, masked: false } : { ...key, licenseKey: maskLicenseKey(key.licenseKey), masked: true };
	}

	private async require(id: string): Promise<TContractRow> {
		const contract = await this.repository.findContract(id);
		if (!contract) throw new LicensingNotFoundError('contract');
		return contract;
	}

	async list(query: TContractListQuery): Promise<TPaginationResult<TContractView>> {
		const today = businessDateOf();
		const dueBefore = query.dueWithinDays === undefined ? undefined : addDays(today, query.dueWithinDays);
		const result = await this.repository.paginateContracts({ ...query, dueBefore });
		return { meta: result.meta, data: result.data.map((row) => this.timed(row, today)) };
	}

	async get(ctx: TLicenseContext, id: string): Promise<TContractDetail> {
		const contract = await this.require(id);
		const [keys, renewal, renewedFrom] = await Promise.all([
			this.repository.listKeys(id),
			this.repository.findOpenRenewal(id),
			contract.renewedFromContractId ? this.repository.findContract(contract.renewedFromContractId) : null,
		]);
		return {
			...this.timed(contract),
			keys: keys.map((key) => this.keyView(ctx, key)),
			renewedFrom: renewedFrom ? { id: renewedFrom.id, code: renewedFrom.code } : null,
			renewal: renewal ? { id: renewal.id, code: renewal.code, status: renewal.status } : null,
		};
	}

	/** Counts for the dashboard widget. */
	async summary(): Promise<TLicenseSummary> {
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

	/** Draft → active; a renewal also closes the contract it renews. */
	async activate(ctx: TLicenseContext, id: string): Promise<TContractView> {
		const current = await this.require(id);
		if (current.status !== 'draft') throw new ContractStateError('activate');
		if (!current.startDate) throw new ContractInvalidError('startRequired');
		await this.transactions.run(async (tx) => {
			const activated = await this.repository.transition(
				id,
				['draft'],
				{ status: 'active', activatedBy: ctx.actorUserId, activatedAt: new Date() },
				tx,
			);
			if (!activated) throw new ContractStateError('activate');
			if (current.renewedFromContractId) {
				await this.repository.transition(current.renewedFromContractId, ['active', 'suspended'], { status: 'renewed' }, tx);
			}
		});
		return this.timed(await this.require(id));
	}

	async suspend(id: string): Promise<TContractView> {
		if (!(await this.repository.transition(id, ['active'], { status: 'suspended' }))) throw await this.stateError(id, 'suspend');
		return this.timed(await this.require(id));
	}

	async reactivate(id: string): Promise<TContractView> {
		if (!(await this.repository.transition(id, ['suspended'], { status: 'active' }))) throw await this.stateError(id, 'reactivate');
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

	async revokeKey(ctx: TLicenseContext, contractId: string, keyId: string, reason: string): Promise<TKeyView> {
		await this.require(contractId);
		const key = await this.repository.revokeKey(contractId, keyId, ctx.actorUserId, reason);
		if (!key) throw new LicensingNotFoundError('key');
		return this.keyView(ctx, key);
	}
}
