import { DOCUMENT_SERVICE_TOKEN } from '@app/document/constants/di';
import type { TSourceDocument } from '@app/document/contracts/document.contract';
import type { DocumentService } from '@app/document/services/document.service';
import type { TDocumentSelect } from '@drizzle/schemas/document.schema';
import type { TEmployeeSelect } from '@drizzle/schemas/human-resource.schema';
import { inject, injectable } from 'tsyringe';
import { AGREEMENT_PDF_QUEUE_TOKEN, HR_PEOPLE_SERVICE_TOKEN } from '../constants/di';
import {
	EMPLOYEE_DOCUMENT_MODULE,
	EMPLOYEE_DOCUMENT_SOURCE,
	EMPLOYEE_DOCUMENT_TITLES,
	EMPLOYMENT_AGREEMENT,
	type IAgreementPdfQueue,
	type TEmployeeDocumentCreate,
} from '../contracts/employee-document.contract';
import type { THrScope } from '../contracts/hr-records.contract';
import { EmployeeDocumentError, HrNotFoundError } from '../errors/hr.errors';
import type { HrPeopleService } from './people.service';

const source = (employeeId: string) => ({ module: EMPLOYEE_DOCUMENT_MODULE, sourceType: EMPLOYEE_DOCUMENT_SOURCE, sourceId: employeeId });
const isLiveAgreement = (row: TDocumentSelect) => row.documentType === EMPLOYMENT_AGREEMENT && row.status !== 'void';

/**
 * Documents of an employee (ERP-0121, grill-me Q6/Q11/Q13/Q14): the
 * employment agreement opened on every invite plus whatever HR adds (KTP,
 * NPWP, CV, certificates). The document module owns the rows and the files;
 * this service scopes them to employees the caller sees and keeps them on
 * the employee (`module = human_resource`, `source_type = employee`).
 */
@injectable()
export class EmployeeDocumentService {
	constructor(
		@inject(DOCUMENT_SERVICE_TOKEN)
		private readonly documents: Pick<
			DocumentService,
			'createDraft' | 'listBySource' | 'find' | 'uploadFile' | 'downloadFile' | 'void'
		>,
		@inject(HR_PEOPLE_SERVICE_TOKEN) private readonly employees: Pick<HrPeopleService, 'require'>,
		@inject(AGREEMENT_PDF_QUEUE_TOKEN) private readonly pdfQueue: IAgreementPdfQueue,
	) {}

	/**
	 * The live employment agreement of an employee, opened as a draft when
	 * there is none (the invite, a retried invite, the "create agreement"
	 * button). Errors propagate: the invite rolls back on them (Q12).
	 */
	async ensureAgreement(employee: Pick<TEmployeeSelect, 'id' | 'fullName' | 'organizationId'>): Promise<TDocumentSelect> {
		const existing = (await this.documents.listBySource(EMPLOYEE_DOCUMENT_MODULE, EMPLOYEE_DOCUMENT_SOURCE, employee.id)).find(isLiveAgreement);
		if (existing) return existing;
		return this.documents.createDraft({
			...source(employee.id),
			documentType: EMPLOYMENT_AGREEMENT,
			title: `${EMPLOYEE_DOCUMENT_TITLES.employment_agreement} - ${employee.fullName}`,
			organizationId: employee.organizationId,
		});
	}

	/** Queues the agreement PDF of an employee, when the employee has one (after the claim). */
	async queueAgreementPdf(employeeId: string): Promise<void> {
		const agreement = (await this.documents.listBySource(EMPLOYEE_DOCUMENT_MODULE, EMPLOYEE_DOCUMENT_SOURCE, employeeId)).find(isLiveAgreement);
		if (agreement) await this.pdfQueue.enqueue(agreement.id);
	}

	list(scope: THrScope, employeeId: string): Promise<TSourceDocument[]> {
		return this.employees.require(scope, employeeId).then(() => this.documents.listBySource(EMPLOYEE_DOCUMENT_MODULE, EMPLOYEE_DOCUMENT_SOURCE, employeeId));
	}

	async create(scope: THrScope, employeeId: string, body: TEmployeeDocumentCreate): Promise<TDocumentSelect> {
		const employee = await this.employees.require(scope, employeeId);
		if (body.documentType === EMPLOYMENT_AGREEMENT) {
			// One live agreement per employee; a new one starts its PDF right away.
			const agreement = await this.ensureAgreement(employee);
			if (agreement.status === 'draft') await this.pdfQueue.enqueue(agreement.id);
			return agreement;
		}
		return this.documents.createDraft({
			...source(employee.id),
			documentType: body.documentType,
			title: body.title ?? `${EMPLOYEE_DOCUMENT_TITLES[body.documentType]} - ${employee.fullName}`,
			organizationId: employee.organizationId,
		});
	}

	/** The document, when it belongs to this employee and the caller sees the employee. */
	private async requireDocument(scope: THrScope, employeeId: string, documentId: string): Promise<TDocumentSelect> {
		await this.employees.require(scope, employeeId);
		const document = await this.documents.find(documentId);
		const owned =
			document?.module === EMPLOYEE_DOCUMENT_MODULE && document.sourceType === EMPLOYEE_DOCUMENT_SOURCE && document.sourceId === employeeId;
		if (!document || !owned) throw new HrNotFoundError('document');
		return document;
	}

	async upload(scope: THrScope, employeeId: string, documentId: string, body: unknown, actorUserId: string) {
		await this.requireDocument(scope, employeeId, documentId);
		return this.documents.uploadFile(documentId, body, actorUserId);
	}

	async download(scope: THrScope, employeeId: string, documentId: string, fileId: string, actorUserId: string) {
		await this.requireDocument(scope, employeeId, documentId);
		return this.documents.downloadFile(documentId, fileId, actorUserId);
	}

	async void(scope: THrScope, employeeId: string, documentId: string, actorUserId: string): Promise<TDocumentSelect> {
		await this.requireDocument(scope, employeeId, documentId);
		return this.documents.void(documentId, actorUserId);
	}

	/** "Regenerate PDF": only the agreement has a generated PDF (Q20). */
	async regeneratePdf(scope: THrScope, employeeId: string, documentId: string): Promise<{ queued: true }> {
		const document = await this.requireDocument(scope, employeeId, documentId);
		if (!isLiveAgreement(document)) throw new EmployeeDocumentError('notAgreement');
		await this.pdfQueue.enqueue(document.id);
		return { queued: true };
	}
}
