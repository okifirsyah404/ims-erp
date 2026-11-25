import { EXPORTED_HUMAN_RESOURCE_SERVICE_TOKEN } from '@app/human-resource/constants/di';
import type { ExportedEmployeeService } from '@app/human-resource/services/exported-employee.service';
import type { TEmployeeAdvanceSelect, TExpenseSettlementSelect } from '@drizzle/schemas/finance.schema';
import type { TTx } from '@drizzle/types';
import type { TPaginationResult } from '@ims-erp/common';
import { type ITransactionRunner, TRANSACTION_RUNNER_TOKEN } from '@providers/database/transaction-runner';
import { inject, injectable } from 'tsyringe';
import {
	CHART_OF_ACCOUNT_REPOSITORY_TOKEN,
	EMPLOYEE_ADVANCE_REPOSITORY_TOKEN,
	FINANCE_NUMBERING_SERVICE_TOKEN,
	POSTING_RULE_SERVICE_TOKEN,
	POSTING_SERVICE_TOKEN,
} from '../constants/di';
import type { IChartOfAccountRepository } from '../contracts/chart-of-account.repository.interface';
import type {
	IEmployeeAdvanceRepository,
	TAdvanceCreate,
	TAdvanceListQuery,
	TSettlementCreate,
	TSettlementDetail,
} from '../contracts/employee-advance.contract';
import {
	AdvanceSameActorError,
	AdvanceStateError,
	EmployeeAdvanceNotFoundError,
	ExpenseSettlementNotFoundError,
	SettlementAdvanceError,
} from '../errors/advance.errors';
import { ExpenseClaimAccountError, ExpenseClaimEmployeeError } from '../errors/expense.errors';
import type { FinanceNumberingService } from './finance-numbering.service';
import type { PostingRuleService } from './posting-rule.service';
import type { PostingService } from './posting.service';

export type TAdvanceContext = { organizationId: string; actorUserId: string };

const OPEN_SETTLEMENT = ['draft', 'submitted', 'verified'];

/**
 * Employee advances and their settlements (ERP-0144, grill decisions on
 * advances).
 *
 * @remarks
 * Advance: draft -> submitted -> approved (by someone other than the
 * requester) -> disbursed (a payment allocation `employee_advance` executes:
 * Dr Uang Muka Karyawan / Cr cash) -> settled once `settled_amount` reaches
 * the amount. Settlement of a disbursed advance: draft -> submitted ->
 * verified -> approved, each step by a different user than the previous one.
 * Approval posts Dr expenses (with the advance's project on every expense
 * line) and PPN input / Cr Uang Muka Karyawan up to the advance's open
 * balance / Cr claims payable for the rest, which a payment allocation
 * `expense_settlement` pays out. Cash the employee hands back is a receipt
 * allocated to the advance.
 */
@injectable()
export class EmployeeAdvanceService {
	constructor(
		@inject(EMPLOYEE_ADVANCE_REPOSITORY_TOKEN) private readonly repo: IEmployeeAdvanceRepository,
		@inject(TRANSACTION_RUNNER_TOKEN) private readonly transactions: ITransactionRunner,
		@inject(FINANCE_NUMBERING_SERVICE_TOKEN) private readonly numbering: Pick<FinanceNumberingService, 'next'>,
		@inject(CHART_OF_ACCOUNT_REPOSITORY_TOKEN) private readonly accounts: Pick<IChartOfAccountRepository, 'findAccountByCode'>,
		@inject(POSTING_RULE_SERVICE_TOKEN) private readonly rules: Pick<PostingRuleService, 'resolveAccountId'>,
		@inject(POSTING_SERVICE_TOKEN) private readonly posting: Pick<PostingService, 'post'>,
		@inject(EXPORTED_HUMAN_RESOURCE_SERVICE_TOKEN) private readonly employees: Pick<ExportedEmployeeService, 'findEmployeeById'>,
	) {}

	private async assertEmployee(organizationId: string, employeeId: string): Promise<void> {
		const employee = await this.employees.findEmployeeById(employeeId);
		if (!employee || employee.employmentStatus === 'terminated') throw new ExpenseClaimEmployeeError();
		if (employee.organizationId && employee.organizationId !== organizationId) throw new ExpenseClaimEmployeeError();
	}

	/* ------------------------------- advances ------------------------------- */

	listAdvances(organizationId: string, query: TAdvanceListQuery): Promise<TPaginationResult<TEmployeeAdvanceSelect>> {
		return this.repo.paginateAdvances(organizationId, query);
	}

	async getAdvance(organizationId: string, id: string, tx?: TTx): Promise<TEmployeeAdvanceSelect> {
		const advance = await this.repo.findAdvance(organizationId, id, tx);
		if (!advance) throw new EmployeeAdvanceNotFoundError();
		return advance;
	}

	async createAdvance(ctx: TAdvanceContext, input: TAdvanceCreate): Promise<TEmployeeAdvanceSelect> {
		await this.assertEmployee(ctx.organizationId, input.employeeId);
		return this.transactions.run(async (tx) => {
			const code = await this.numbering.next('employee_advance', { date: new Date(`${input.requestDate}T12:00:00+07:00`), tx });
			return this.repo.insertAdvance(
				{
					organizationId: ctx.organizationId,
					code,
					employeeId: input.employeeId,
					projectId: input.projectId,
					amount: input.amount,
					settledAmount: 0,
					currencyCode: 'IDR',
					requestDate: input.requestDate,
					purpose: input.purpose,
					status: 'draft',
					requestedBy: ctx.actorUserId,
				},
				tx,
			);
		});
	}

	private async moveAdvance(
		ctx: TAdvanceContext,
		id: string,
		from: string[],
		to: string,
		patch: (advance: TEmployeeAdvanceSelect) => Partial<TEmployeeAdvanceSelect>,
	): Promise<TEmployeeAdvanceSelect> {
		const advance = await this.getAdvance(ctx.organizationId, id);
		if (!from.includes(advance.status)) throw new AdvanceStateError(advance.status, to);
		return (await this.repo.updateAdvance(ctx.organizationId, id, { status: to, ...patch(advance) })) ?? advance;
	}

	submitAdvance(ctx: TAdvanceContext, id: string) {
		return this.moveAdvance(ctx, id, ['draft'], 'submitted', () => ({ submittedAt: new Date() }));
	}

	approveAdvance(ctx: TAdvanceContext, id: string) {
		return this.moveAdvance(ctx, id, ['submitted'], 'approved', (advance) => {
			if (advance.requestedBy === ctx.actorUserId) throw new AdvanceSameActorError();
			return { approvedBy: ctx.actorUserId, approvedAt: new Date() };
		});
	}

	/** Rejecting or cancelling before disbursement ends the advance. */
	cancelAdvance(ctx: TAdvanceContext, id: string) {
		return this.moveAdvance(ctx, id, ['draft', 'submitted', 'approved'], 'cancelled', () => ({}));
	}

	/* ------------------------------ settlements ------------------------------ */

	listSettlements(organizationId: string, query: TAdvanceListQuery): Promise<TPaginationResult<TExpenseSettlementSelect>> {
		return this.repo.paginateSettlements(organizationId, query);
	}

	async getSettlement(organizationId: string, id: string, tx?: TTx): Promise<TSettlementDetail> {
		const settlement = await this.repo.findSettlement(organizationId, id, tx);
		if (!settlement) throw new ExpenseSettlementNotFoundError();
		return { ...settlement, items: await this.repo.listSettlementItems(organizationId, id, tx) };
	}

	private async expenseAccountId(organizationId: string, code: string): Promise<string> {
		const account = await this.accounts.findAccountByCode(organizationId, code);
		if (!account || account.accountType !== 'expense' || !account.isActive || !account.isPostable) throw new ExpenseClaimAccountError(code);
		return account.id;
	}

	async createSettlement(ctx: TAdvanceContext, input: TSettlementCreate): Promise<TSettlementDetail> {
		for (const item of input.items) await this.expenseAccountId(ctx.organizationId, item.categoryCode);
		return this.transactions.run(async (tx) => {
			const advance = await this.getAdvance(ctx.organizationId, input.employeeAdvanceId, tx);
			const open = (await this.repo.listSettlementsForAdvance(ctx.organizationId, advance.id, tx)).some((row) =>
				OPEN_SETTLEMENT.includes(row.status),
			);
			if (advance.status !== 'disbursed' || open) throw new SettlementAdvanceError();
			const code = await this.numbering.next('expense_settlement', { date: new Date(`${input.settlementDate}T12:00:00+07:00`), tx });
			const settlement = await this.repo.insertSettlement(
				{
					organizationId: ctx.organizationId,
					code,
					employeeId: advance.employeeId,
					projectId: advance.projectId,
					settlementType: 'advance',
					employeeAdvanceId: advance.id,
					totalAmount: input.items.reduce((sum, item) => sum + item.amount + item.taxAmount, 0),
					currencyCode: 'IDR',
					settlementDate: input.settlementDate,
					status: 'draft',
					notes: input.notes,
				},
				tx,
			);
			await this.repo.insertSettlementItems(
				input.items.map((item) => ({
					organizationId: ctx.organizationId,
					expenseSettlementId: settlement.id,
					expenseDate: item.expenseDate,
					categoryCode: item.categoryCode,
					description: item.description,
					amount: item.amount,
					taxAmount: item.taxAmount,
					currencyCode: 'IDR',
					isAdvanceOffset: true,
					projectId: advance.projectId,
				})),
				tx,
			);
			return this.getSettlement(ctx.organizationId, settlement.id, tx);
		});
	}

	private async moveSettlement(
		ctx: TAdvanceContext,
		id: string,
		from: string[],
		to: string,
		patch: (settlement: TExpenseSettlementSelect) => Partial<TExpenseSettlementSelect>,
	): Promise<TExpenseSettlementSelect> {
		const settlement = await this.repo.findSettlement(ctx.organizationId, id);
		if (!settlement) throw new ExpenseSettlementNotFoundError();
		if (!from.includes(settlement.status)) throw new AdvanceStateError(settlement.status, to);
		return (await this.repo.updateSettlement(ctx.organizationId, id, { status: to, ...patch(settlement) })) ?? settlement;
	}

	submitSettlement(ctx: TAdvanceContext, id: string) {
		return this.moveSettlement(ctx, id, ['draft'], 'submitted', () => ({ submittedBy: ctx.actorUserId, submittedAt: new Date() }));
	}

	verifySettlement(ctx: TAdvanceContext, id: string) {
		return this.moveSettlement(ctx, id, ['submitted'], 'verified', (settlement) => {
			if (settlement.submittedBy === ctx.actorUserId) throw new AdvanceSameActorError();
			return { verifiedBy: ctx.actorUserId, verifiedAt: new Date() };
		});
	}

	rejectSettlement(ctx: TAdvanceContext, id: string) {
		return this.moveSettlement(ctx, id, ['submitted', 'verified'], 'rejected', () => ({}));
	}

	cancelSettlement(ctx: TAdvanceContext, id: string) {
		return this.moveSettlement(ctx, id, ['draft'], 'cancelled', () => ({}));
	}

	/** verified -> approved: posts the settlement journal and offsets the advance. */
	async approveSettlement(ctx: TAdvanceContext, id: string): Promise<TExpenseSettlementSelect> {
		return this.transactions.run(async (tx) => {
			const settlement = await this.getSettlement(ctx.organizationId, id, tx);
			if (settlement.status !== 'verified') throw new AdvanceStateError(settlement.status, 'approved');
			if (settlement.verifiedBy === ctx.actorUserId) throw new AdvanceSameActorError();
			if (!settlement.employeeAdvanceId) throw new SettlementAdvanceError();
			const advance = await this.getAdvance(ctx.organizationId, settlement.employeeAdvanceId, tx);
			if (advance.status !== 'disbursed') throw new SettlementAdvanceError();

			const open = advance.amount - advance.settledAmount;
			const offset = Math.min(settlement.totalAmount, open);
			const payable = settlement.totalAmount - offset;
			const role = (name: string) =>
				this.rules.resolveAccountId(ctx.organizationId, { eventType: 'finance.advance_settled', role: name }, tx);
			const party = { partyType: 'employee', partyId: advance.employeeId };
			const byAccount = new Map<string, number>();
			let tax = 0;
			for (const item of settlement.items) {
				const accountId = await this.expenseAccountId(ctx.organizationId, item.categoryCode ?? '');
				byAccount.set(accountId, (byAccount.get(accountId) ?? 0) + item.amount);
				tax += item.taxAmount;
			}
			const lines = [
				...[...byAccount].map(([accountId, amount]) => ({ accountId, debit: amount, credit: 0, projectId: advance.projectId })),
				...(tax > 0 ? [{ accountId: await role('vat_input'), debit: tax, credit: 0 }] : []),
				...(offset > 0 ? [{ accountId: await role('employee_advance'), debit: 0, credit: offset, ...party }] : []),
				...(payable > 0 ? [{ accountId: await role('claim_payable'), debit: 0, credit: payable, ...party }] : []),
			].filter((line) => line.debit > 0 || line.credit > 0);
			const { entry } = await this.posting.post(tx, {
				organizationId: ctx.organizationId,
				entryDate: settlement.settlementDate ?? new Date().toISOString().slice(0, 10),
				sourceModule: 'finance',
				sourceType: 'expense_settlement',
				sourceId: settlement.id,
				idempotencyKey: `expense_settlement:${settlement.id}`,
				eventType: 'finance.advance_settled',
				description: `Advance settlement ${settlement.code}`,
				actorUserId: ctx.actorUserId,
				lines,
			});
			const settledAmount = advance.settledAmount + offset;
			await this.repo.updateAdvance(
				ctx.organizationId,
				advance.id,
				{ settledAmount, ...(settledAmount === advance.amount ? { status: 'settled' } : {}) },
				tx,
			);
			return (
				(await this.repo.updateSettlement(
					ctx.organizationId,
					id,
					{
						status: 'approved',
						approvedBy: ctx.actorUserId,
						approvedAt: new Date(),
						advanceOffsetAmount: offset,
						payableAmount: payable,
						journalEntryId: entry.id,
					},
					tx,
				)) ?? settlement
			);
		});
	}

	/* --------------------------- payment contract --------------------------- */

	/**
	 * What a payment may still allocate to an advance or a settlement
	 * (ERP-0144): an approved advance is disbursed in full; a disbursed
	 * advance takes back at most its open balance; an approved settlement pays
	 * out at most its unpaid payable.
	 */
	async payable(
		organizationId: string,
		type: 'employee_advance' | 'expense_settlement',
		id: string,
		direction: 'in' | 'out',
		tx?: TTx,
	): Promise<{ outstanding: number; exact: boolean; employeeId: string | null } | null> {
		if (type === 'employee_advance') {
			const advance = await this.repo.findAdvance(organizationId, id, tx);
			if (!advance) return null;
			if (direction === 'out') return advance.status === 'approved' ? { outstanding: advance.amount, exact: true, employeeId: advance.employeeId } : null;
			return advance.status === 'disbursed'
				? { outstanding: advance.amount - advance.settledAmount, exact: false, employeeId: advance.employeeId }
				: null;
		}
		const settlement = await this.repo.findSettlement(organizationId, id, tx);
		if (!settlement || direction !== 'out' || settlement.status !== 'approved') return null;
		const outstanding = settlement.payableAmount - settlement.paidAmount;
		return outstanding > 0 ? { outstanding, exact: false, employeeId: settlement.employeeId } : null;
	}

	/** Applies an executed payment allocation (inside the payment's transaction). */
	async applyPayment(
		organizationId: string,
		type: 'employee_advance' | 'expense_settlement',
		id: string,
		direction: 'in' | 'out',
		amount: number,
		paymentId: string,
		tx: TTx,
	): Promise<void> {
		if (type === 'employee_advance') {
			const advance = await this.getAdvance(organizationId, id, tx);
			if (direction === 'out') {
				await this.repo.updateAdvance(organizationId, id, { status: 'disbursed', disbursedAt: new Date(), paymentId }, tx);
				return;
			}
			const settledAmount = advance.settledAmount + amount;
			await this.repo.updateAdvance(
				organizationId,
				id,
				{ settledAmount, ...(settledAmount === advance.amount ? { status: 'settled' } : {}) },
				tx,
			);
			return;
		}
		const settlement = await this.repo.findSettlement(organizationId, id, tx);
		if (!settlement) throw new ExpenseSettlementNotFoundError();
		const paidAmount = settlement.paidAmount + amount;
		await this.repo.updateSettlement(
			organizationId,
			id,
			{ paidAmount, paymentId, ...(paidAmount === settlement.payableAmount ? { status: 'paid' } : {}) },
			tx,
		);
	}
}
