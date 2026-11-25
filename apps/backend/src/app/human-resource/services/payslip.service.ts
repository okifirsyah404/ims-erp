import { COMPANY_SERVICE_TOKEN } from '@app/company/constants/di';
import type { CompanyService } from '@app/company/services/company.service';
import { DOCUMENT_SERVICE_TOKEN } from '@app/document/constants/di';
import type { TSourceDocument } from '@app/document/contracts/document.contract';
import type { DocumentService } from '@app/document/services/document.service';
import { EXPORTED_FINANCE_SERVICE_TOKEN } from '@app/finance/constants/di';
import type { ExportedFinanceService } from '@app/finance/services/exported-finance.service';
import { EXPORTED_NOTIFICATION_SERVICE_TOKEN } from '@app/notification/constants/di';
import type { ExportedNotificationService } from '@app/notification/services/exported-notification.service';
import { EXPORTED_USER_SERVICE_TOKEN } from '@app/user/constants/di';
import type { ExportedUserService } from '@app/user/services/exported-user.service';
import { appConfig } from '@config/providers/config';
import type { TEmployeeSalaryRecordSelect } from '@drizzle/schemas/human-resource.schema';
import { type IPdfRenderer, PDF_RENDERER_TOKEN } from '@providers/pdf/pdf-renderer';
import { createRenderToken, verifyRenderToken } from '@providers/pdf/render-token';
import JSZip from 'jszip';
import { inject, injectable } from 'tsyringe';
import { EMPLOYEE_REPOSITORY_TOKEN, HR_PEOPLE_SERVICE_TOKEN, PAYSLIP_QUEUE_TOKEN, SALARY_REPOSITORY_TOKEN } from '../constants/di';
import type { IEmployeeRepository } from '../contracts/employee.repository.interface';
import { EMPLOYEE_DOCUMENT_MODULE } from '../contracts/employee-document.contract';
import type { THrScope } from '../contracts/hr-records.contract';
import type { ISalaryRepository } from '../contracts/hr-records.repository.interface';
import { type IPayslipQueue, PAYSLIP_DOCUMENT_TYPE, PAYSLIP_SOURCE, type TMyPayslip } from '../contracts/payslip.contract';
import { HrNotFoundError, PayslipError } from '../errors/hr.errors';
import { maskTail } from '../utils/hr';
import type { HrPeopleService } from './people.service';

/** Render-token kind of the payslip print view. */
export const PAYSLIP_RENDER_KIND = 'payslip';

/** Everything the payslip print view shows (grill-me Q34). */
export type TPayslipRenderData = {
	document: { id: string; code: string; title: string };
	record: Pick<TEmployeeSalaryRecordSelect, 'period' | 'baseSalary' | 'allowances' | 'overtimePay' | 'bonus' | 'deductions' | 'netPay' | 'notes'> & {
		approvedAt: string | null;
		approvedByName: string | null;
	};
	employee: { employeeCode: string; fullName: string; employmentType: string };
	/** Masked to the last four digits (`••••••7890`). */
	payee: { bankName: string | null; accountNumber: string | null; accountHolder: string | null } | null;
	profile: unknown;
};

/** The web-admin origin the print views are served from (no trailing slash). */
const renderBase = () => (appConfig.pdf.renderBaseUrl ?? '').replace(/\/+$/, '');

const isLive = (row: TSourceDocument) => row.documentType === PAYSLIP_DOCUMENT_TYPE && row.status !== 'void';

/**
 * Payslips (ERP-0122, grill-me Q32-Q37).
 *
 * @remarks
 * Approving a payroll period queues one job per approved record. The job
 * registers an `issued` `payslip` document on the record, renders the
 * web-admin print view `/print/payslips/:id?token=…` in Chromium, attaches the
 * PDF and tells the employee (in-app, when they have a login). Approved
 * records are locked, so a payslip never changes: "regenerate" only runs a
 * failed render again. Holders of `payroll:read` download one or all (ZIP);
 * an employee downloads only their own (ownership from the session).
 */
@injectable()
export class PayslipService {
	constructor(
		@inject(SALARY_REPOSITORY_TOKEN) private readonly records: Pick<ISalaryRepository, 'findById' | 'listPeriod' | 'listApprovedForEmployee'>,
		@inject(EMPLOYEE_REPOSITORY_TOKEN) private readonly employees: Pick<IEmployeeRepository, 'findById' | 'findByUserId'>,
		@inject(HR_PEOPLE_SERVICE_TOKEN) private readonly people: Pick<HrPeopleService, 'require'>,
		@inject(DOCUMENT_SERVICE_TOKEN)
		private readonly documents: Pick<DocumentService, 'issueForSource' | 'listBySource' | 'find' | 'attachGeneratedFileTo' | 'downloadFile' | 'readFile'>,
		@inject(EXPORTED_FINANCE_SERVICE_TOKEN) private readonly finance: Pick<ExportedFinanceService, 'findPrimaryEmployeeBankAccount'>,
		@inject(EXPORTED_USER_SERVICE_TOKEN) private readonly users: Pick<ExportedUserService, 'summary'>,
		@inject(COMPANY_SERVICE_TOKEN) private readonly company: Pick<CompanyService, 'get'>,
		@inject(PDF_RENDERER_TOKEN) private readonly renderer: IPdfRenderer,
		@inject(EXPORTED_NOTIFICATION_SERVICE_TOKEN) private readonly notifications: Pick<ExportedNotificationService, 'notify'>,
		@inject(PAYSLIP_QUEUE_TOKEN) private readonly queue: IPayslipQueue,
	) {}

	private async payslipOf(recordId: string): Promise<TSourceDocument | null> {
		return (await this.documents.listBySource(EMPLOYEE_DOCUMENT_MODULE, PAYSLIP_SOURCE, recordId)).find(isLive) ?? null;
	}

	/**
	 * The queue job: register, render, attach, notify. Idempotent — a payslip
	 * that already has its PDF is left alone. `skipped` without Chromium.
	 */
	async render(recordId: string): Promise<'attached' | 'exists' | 'skipped' | 'missing'> {
		const record = await this.records.findById(recordId);
		if (!record || record.status !== 'approved') return 'missing';
		const employee = await this.employees.findById(record.employeeId);
		let payslip = await this.payslipOf(recordId);
		if (payslip?.files.length) return 'exists';
		if (!payslip) {
			const issued = await this.documents.issueForSource(
				{
					documentType: PAYSLIP_DOCUMENT_TYPE,
					title: `Slip Gaji ${record.employeeName} - ${record.period}`,
					module: EMPLOYEE_DOCUMENT_MODULE,
					sourceType: PAYSLIP_SOURCE,
					sourceId: record.id,
					organizationId: employee?.organizationId ?? null,
				},
				record.approvedBy,
			);
			payslip = { ...issued, files: [] };
		}
		// `configured` already requires Chromium and a render base URL (ChromiumPdfRenderer).
		if (!this.renderer.configured) return 'skipped';
		const token = createRenderToken(PAYSLIP_RENDER_KIND, payslip.id);
		const url = `${renderBase()}/print/payslips/${payslip.id}?token=${encodeURIComponent(token)}`;
		const bytes = await this.renderer.render(url);
		const attached = await this.documents.attachGeneratedFileTo(
			payslip.id,
			new File([new Uint8Array(bytes)], 'payslip.pdf', { type: 'application/pdf' }),
			null,
		);
		if (!attached) return 'missing';
		if (employee?.userId) {
			await this.notifications.notify({
				userIds: [employee.userId],
				templateCode: 'hr.payslip_ready',
				variables: { period: record.period },
				sourceType: 'payslip',
				// Deterministic per payslip: a rerun never doubles the notice.
				sourceId: payslip.id,
				metadata: { href: '/accounts?section=payslips' },
			});
		}
		return 'attached';
	}

	/** The print data, or `null` for a bad token or a document that is not a payslip. */
	async renderData(documentId: string, token: string): Promise<TPayslipRenderData | null> {
		if (!verifyRenderToken(PAYSLIP_RENDER_KIND, documentId, token)) return null;
		const document = await this.documents.find(documentId);
		if (!document || document.documentType !== PAYSLIP_DOCUMENT_TYPE || document.sourceType !== PAYSLIP_SOURCE || !document.sourceId) return null;
		const record = await this.records.findById(document.sourceId);
		if (!record) return null;
		const [employee, payee, approver, profile] = await Promise.all([
			this.employees.findById(record.employeeId),
			this.finance.findPrimaryEmployeeBankAccount(record.employeeId),
			record.approvedBy ? this.users.summary(record.approvedBy) : Promise.resolve(null),
			this.company.get(),
		]);
		return {
			document: { id: document.id, code: document.code, title: document.title },
			record: {
				period: record.period,
				baseSalary: record.baseSalary,
				allowances: record.allowances,
				overtimePay: record.overtimePay,
				bonus: record.bonus,
				deductions: record.deductions,
				netPay: record.netPay,
				notes: record.notes,
				approvedAt: record.approvedAt?.toISOString() ?? null,
				approvedByName: approver?.name ?? null,
			},
			employee: {
				employeeCode: employee?.employeeCode ?? '',
				fullName: employee?.fullName ?? record.employeeName,
				employmentType: employee?.employmentType ?? '',
			},
			payee: payee ? { bankName: payee.bankName, accountNumber: maskTail(payee.accountNumber), accountHolder: payee.accountHolder } : null,
			profile,
		};
	}

	/** The record, if its employee is visible to the caller. */
	private async requireRecord(scope: THrScope, recordId: string): Promise<TEmployeeSalaryRecordSelect> {
		const record = await this.records.findById(recordId);
		if (!record || !(await this.people.require(scope, record.employeeId).catch(() => null))) throw new HrNotFoundError('salary');
		return record;
	}

	private async downloadOf(record: TEmployeeSalaryRecordSelect, actorUserId: string) {
		const payslip = await this.payslipOf(record.id);
		const file = payslip?.files[0];
		if (!payslip || !file) throw new PayslipError('notReady');
		return this.documents.downloadFile(payslip.id, file.id, actorUserId);
	}

	/** One payslip for `payroll:read` (a short-lived download URL). */
	async download(scope: THrScope, recordId: string, actorUserId: string) {
		return this.downloadOf(await this.requireRecord(scope, recordId), actorUserId);
	}

	/** Queues a render again (the "regenerate PDF" button after a failed job). */
	async regenerate(scope: THrScope, recordId: string): Promise<{ queued: true }> {
		const record = await this.requireRecord(scope, recordId);
		if (record.status !== 'approved') throw new PayslipError('notApproved');
		await this.queue.enqueue(record.id);
		return { queued: true };
	}

	/** Every ready payslip of a period in the caller's scope, as one ZIP. */
	async zip(scope: THrScope, period: string, actorUserId: string): Promise<Uint8Array> {
		const records = (await this.records.listPeriod(period, scope)).filter((row) => row.status === 'approved');
		const archive = new JSZip();
		let added = 0;
		for (const record of records) {
			const payslip = await this.payslipOf(record.id);
			const file = payslip?.files[0];
			if (!payslip || !file) continue;
			const { fileName, bytes } = await this.documents.readFile(payslip.id, file.id, actorUserId);
			archive.file(fileName, bytes);
			added += 1;
		}
		if (added === 0) throw new PayslipError('notReady');
		return archive.generateAsync({ type: 'uint8array' });
	}

	/** The signed-in user's own payslips (self-service; empty without an employee). */
	async mine(userId: string): Promise<TMyPayslip[]> {
		const employee = await this.employees.findByUserId(userId);
		if (!employee) return [];
		const records = await this.records.listApprovedForEmployee(employee.id);
		return Promise.all(
			records.map(async (record) => ({
				recordId: record.id,
				period: record.period,
				netPay: record.netPay,
				ready: !!(await this.payslipOf(record.id))?.files.length,
			})),
		);
	}

	/** One of the signed-in user's own payslips; anyone else's answers 404. */
	async downloadMine(userId: string, recordId: string) {
		const employee = await this.employees.findByUserId(userId);
		const record = employee ? await this.records.findById(recordId) : null;
		if (!employee || !record || record.employeeId !== employee.id || record.status !== 'approved') throw new HrNotFoundError('salary');
		return this.downloadOf(record, userId);
	}
}
