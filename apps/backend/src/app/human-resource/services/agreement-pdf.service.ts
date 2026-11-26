import { COMPANY_SERVICE_TOKEN } from '@app/company/constants/di';
import type { CompanyService } from '@app/company/services/company.service';
import { DOCUMENT_SERVICE_TOKEN } from '@app/document/constants/di';
import type { DocumentService } from '@app/document/services/document.service';
import { EXPORTED_LOCATION_SERVICE_TOKEN } from '@app/location/constants/di';
import type { ExportedLocationService } from '@app/location/services/exported-location.service';
import { USER_PERSONAL_FIELDS_PORT_TOKEN } from '@app/user/constants/di';
import type { IUserPersonalFieldsPort } from '@app/user/contracts/user-personal-fields.port';
import { appConfig } from '@config/providers/config';
import { type IPdfRenderer, PDF_RENDERER_TOKEN } from '@providers/pdf/pdf-renderer';
import { createRenderToken, verifyRenderToken } from '@providers/pdf/render-token';
import { businessDateOf } from '@utils/business-date.util';
import { inject, injectable } from 'tsyringe';
import { EMPLOYEE_ADDRESS_REPOSITORY_TOKEN, EMPLOYEE_REPOSITORY_TOKEN } from '../constants/di';
import { EMPLOYEE_DOCUMENT_MODULE, EMPLOYMENT_AGREEMENT, type IEmployeeAddressRepository } from '../contracts/employee-document.contract';
import type { IEmployeeRepository } from '../contracts/employee.repository.interface';

/** Render-token kind of the employment agreement print view. */
export const AGREEMENT_RENDER_KIND = 'employment-agreement';

/** Everything the agreement print view shows (grill-me Q21: no salary). */
export type TAgreementRenderData = {
	document: { id: string; code: string; title: string; status: string };
	employee: {
		employeeCode: string;
		fullName: string;
		nationalId: string | null;
		email: string | null;
		phone: string | null;
		employmentType: string;
		workType: string;
		hireDate: string | null;
		gender: string | null;
		birthPlace: string | null;
		birthDate: string | null;
		maritalStatus: string | null;
	};
	address: {
		addressLine: string;
		postalCode: string | null;
		villageName: string | null;
		districtName: string | null;
		regencyName: string | null;
		provinceName: string | null;
	} | null;
	profile: unknown;
};

/**
 * The employment agreement PDF (ERP-0121, grill-me Q20/Q21).
 *
 * @remarks
 * The same render path as the quotation SPH (ERP-0067): the worker opens the
 * web-admin print view `/print/employment-agreements/:id?token=…` in headless
 * Chromium; the view reads {@link AgreementPdfService.renderData} with the
 * short-lived render token (the only credential) and the resulting PDF is
 * attached to the draft document. The document stays `draft` until signed.
 */
@injectable()
export class AgreementPdfService {
	constructor(
		@inject(DOCUMENT_SERVICE_TOKEN) private readonly documents: Pick<DocumentService, 'find' | 'attachGeneratedFileTo'>,
		@inject(EMPLOYEE_REPOSITORY_TOKEN) private readonly employees: Pick<IEmployeeRepository, 'findById'>,
		@inject(EMPLOYEE_ADDRESS_REPOSITORY_TOKEN) private readonly addresses: Pick<IEmployeeAddressRepository, 'findPrimary'>,
		@inject(USER_PERSONAL_FIELDS_PORT_TOKEN) private readonly personal: IUserPersonalFieldsPort,
		@inject(EXPORTED_LOCATION_SERVICE_TOKEN) private readonly locations: Pick<ExportedLocationService, 'resolveVillagePath'>,
		@inject(COMPANY_SERVICE_TOKEN) private readonly company: Pick<CompanyService, 'get'>,
		@inject(PDF_RENDERER_TOKEN) private readonly renderer: IPdfRenderer,
	) {}

	/** The print data, or `null` for a bad token, a missing or non-agreement document. */
	async renderData(documentId: string, token: string): Promise<TAgreementRenderData | null> {
		if (!verifyRenderToken(AGREEMENT_RENDER_KIND, documentId, token)) return null;
		const document = await this.documents.find(documentId);
		if (!document || document.module !== EMPLOYEE_DOCUMENT_MODULE || document.documentType !== EMPLOYMENT_AGREEMENT || !document.sourceId) {
			return null;
		}
		const employee = await this.employees.findById(document.sourceId);
		if (!employee) return null;
		const [fields, address, profile] = await Promise.all([
			employee.userId ? this.personal.get(employee.userId) : Promise.resolve(null),
			this.addresses.findPrimary(employee.id),
			this.company.get(),
		]);
		const [path] = address?.villageId ? await this.locations.resolveVillagePath([address.villageId]) : [];
		return {
			document: { id: document.id, code: document.code, title: document.title, status: document.status },
			employee: {
				employeeCode: employee.employeeCode,
				fullName: employee.fullName,
				nationalId: employee.nationalId,
				email: employee.email,
				phone: employee.phone,
				employmentType: employee.employmentType,
				workType: employee.workType,
				hireDate: employee.hireDate ? businessDateOf(employee.hireDate) : null,
				gender: fields?.gender ?? null,
				birthPlace: fields?.birthPlace ?? null,
				birthDate: fields?.birthDate ? businessDateOf(fields.birthDate) : null,
				maritalStatus: fields?.maritalStatus ?? null,
			},
			address: address
				? {
						addressLine: address.addressLine,
						postalCode: address.postalCode,
						villageName: path?.villageName ?? null,
						districtName: path?.districtName ?? null,
						regencyName: path?.regencyName ?? null,
						provinceName: path?.provinceName ?? null,
					}
				: null,
			profile,
		};
	}

	/**
	 * Renders and attaches the PDF. `skipped` when Chromium or the render base
	 * URL is not configured (nothing to retry); throws on a render failure so
	 * the queue retries it.
	 */
	async render(documentId: string): Promise<'attached' | 'skipped' | 'missing'> {
		// `configured` already requires Chromium and a render base URL (ChromiumPdfRenderer).
		if (!this.renderer.configured) return 'skipped';
		const document = await this.documents.find(documentId);
		if (!document || document.status === 'void' || document.documentType !== EMPLOYMENT_AGREEMENT) return 'missing';
		const token = createRenderToken(AGREEMENT_RENDER_KIND, documentId);
		const url = `${(appConfig.pdf.renderBaseUrl ?? '').replace(/\/+$/, '')}/print/employment-agreements/${documentId}?token=${encodeURIComponent(token)}`;
		const bytes = await this.renderer.render(url);
		// The stored name comes from the document title (`document.service`), so a
		// placeholder here is fine.
		const attached = await this.documents.attachGeneratedFileTo(
			documentId,
			new File([new Uint8Array(bytes)], 'agreement.pdf', { type: 'application/pdf' }),
			null,
		);
		return attached ? 'attached' : 'missing';
	}
}
