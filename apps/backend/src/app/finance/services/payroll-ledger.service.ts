import type { TTx } from '@drizzle/types';
import { inject, injectable } from 'tsyringe';
import { POSTING_SERVICE_TOKEN } from '../constants/di';
import type { PostingService } from './posting.service';

/** Totals of the salary records one approval locks (IDR minor units). */
export type TPayrollTotals = {
	/** Base salary + allowances + overtime + bonus. */
	pay: number;
	/** Other deductions (loans, advances): back to Piutang Karyawan. */
	deductions: number;
	/** May be negative when a last-month reconciliation refunds. */
	pph21: number;
	bpjsEmployee: number;
	bpjsCompany: number;
	net: number;
};

/**
 * The payroll journal (ERP-0138): finance's contract for the Human Resource
 * module, posted inside HR's approval transaction.
 *
 * @remarks
 * Kept apart from `ExportedFinanceService`, which stays repository-only so
 * finance can read HR's facade without a service cycle. Dr salary expense
 * (pay) and BPJS expense (company share) / Cr salaries payable (net), Utang
 * PPh 21, Utang BPJS (both shares) and Piutang Karyawan (other deductions).
 * One journal per approval; the idempotency key carries the period and the
 * first approved record, so a later approval of new drafts posts its own.
 */
@injectable()
export class PayrollLedgerService {
	constructor(@inject(POSTING_SERVICE_TOKEN) private readonly posting: Pick<PostingService, 'postBusinessEvent'>) {}

	async postPayroll(
		tx: TTx,
		input: {
			organizationId: string;
			actorUserId: string;
			period: string;
			entryDate: string;
			recordIds: string[];
			totals: TPayrollTotals;
		},
	): Promise<string | null> {
		const t = input.totals;
		const lines = [
			{ role: 'salary_expense', debit: t.pay, credit: 0 },
			{ role: 'bpjs_expense', debit: t.bpjsCompany, credit: 0 },
			{ role: 'salary_payable', debit: 0, credit: t.net },
			t.pph21 >= 0 ? { role: 'pph21_payable', debit: 0, credit: t.pph21 } : { role: 'pph21_payable', debit: -t.pph21, credit: 0 },
			{ role: 'bpjs_payable', debit: 0, credit: t.bpjsEmployee + t.bpjsCompany },
			{ role: 'employee_receivable', debit: 0, credit: t.deductions },
		].filter((line) => line.debit > 0 || line.credit > 0);
		if (lines.length === 0) return null;
		const first = [...input.recordIds].sort()[0];
		const { entry } = await this.posting.postBusinessEvent(tx, {
			organizationId: input.organizationId,
			entryDate: input.entryDate,
			sourceModule: 'human_resource',
			sourceType: 'payroll_period',
			sourceId: input.period,
			idempotencyKey: `payroll:${input.period}:${first}`,
			eventType: 'payroll.approved',
			description: `Payroll ${input.period}`,
			actorUserId: input.actorUserId,
			lines,
		});
		return entry.id;
	}
}
