/**
 * Injection tokens for the project module (ADR-0024 P2/P6).
 *
 * @remarks
 * Leads and the website inquiry surface arrived in P2 (Q12); projects,
 * handovers, warranties and licensing moved in with P6. One repository per
 * table; every token carries an `InjectionToken<T>` annotation so registrations
 * and resolutions type-check against the contract.
 */
import type { InjectionToken } from 'tsyringe';
import type { IApiKeyIssuer } from '../adapters/better-auth-api-keys';
import type { IHandoverRepository } from '../contracts/handover.repository.interface';
import type {
	ILeadActivityRepository,
	ILeadAttachmentRepository,
	ILeadRepository,
} from '../contracts/lead.repository.interface';
import type { ILicenseApiRepository } from '../contracts/license-api.contract';
import type { ILicensingRepository } from '../contracts/licensing.contract';
import type { IProjectRepository } from '../contracts/project.repository.interface';
import type { IWarrantyRepository } from '../contracts/warranty.contract';
import type { ProjectCodeNumberingRepository } from '../repositories/code-numbering.repository';
import type { HandoverService } from '../services/handover.service';
import type { LeadService } from '../services/lead.service';
import type { LicenseApiService } from '../services/license-api.service';
import type { LicensingService } from '../services/licensing.service';
import type { ProjectLookupService } from '../services/project-lookup.service';
import type { ProjectNumberingService } from '../services/project-numbering.service';
import type { ProjectPortalService } from '../services/project-portal.service';
import type { ProjectService } from '../services/project.service';
import type { WarrantyService } from '../services/warranty.service';
import type { WebsiteInquiryService } from '../services/website-inquiry.service';

/* --------------------------------- leads --------------------------------- */

export const LEAD_REPOSITORY_TOKEN: InjectionToken<ILeadRepository> = Symbol('LEAD_REPOSITORY');
export const LEAD_ACTIVITY_REPOSITORY_TOKEN: InjectionToken<ILeadActivityRepository> =
	Symbol('LEAD_ACTIVITY_REPOSITORY');
export const LEAD_ATTACHMENT_REPOSITORY_TOKEN: InjectionToken<ILeadAttachmentRepository> =
	Symbol('LEAD_ATTACHMENT_REPOSITORY');
export const LEAD_SERVICE_TOKEN: InjectionToken<LeadService> = Symbol('LEAD_SERVICE');
export const WEBSITE_INQUIRY_SERVICE_TOKEN: InjectionToken<WebsiteInquiryService> =
	Symbol('WEBSITE_INQUIRY_SERVICE');

/* ------------------------- projects and handovers ------------------------ */

export const PROJECT_REPOSITORY_TOKEN: InjectionToken<IProjectRepository> = Symbol('PROJECT_REPOSITORY_TOKEN');
export const PROJECT_SERVICE_TOKEN: InjectionToken<ProjectService> = Symbol('PROJECT_SERVICE_TOKEN');
/** Projects contract for Sale: "does this order still have a live project?". */
export const PROJECT_LOOKUP_SERVICE_TOKEN: InjectionToken<ProjectLookupService> = Symbol(
	'PROJECT_LOOKUP_SERVICE_TOKEN',
);
export const HANDOVER_REPOSITORY_TOKEN: InjectionToken<IHandoverRepository> = Symbol('HANDOVER_REPOSITORY_TOKEN');
export const HANDOVER_SERVICE_TOKEN: InjectionToken<HandoverService> = Symbol('HANDOVER_SERVICE_TOKEN');
/** Customer-portal view of projects (ERP-0022): the contract the portal uses. */
export const PROJECT_PORTAL_SERVICE_TOKEN: InjectionToken<ProjectPortalService> = Symbol(
	'PROJECT_PORTAL_SERVICE_TOKEN',
);

/* ------------------------------- warranties ------------------------------ */

export const WARRANTY_REPOSITORY_TOKEN: InjectionToken<IWarrantyRepository> = Symbol('WARRANTY_REPOSITORY_TOKEN');
export const WARRANTY_SERVICE_TOKEN: InjectionToken<WarrantyService> = Symbol('WARRANTY_SERVICE_TOKEN');

/* -------------------------------- licensing ------------------------------ */

export const LICENSING_REPOSITORY_TOKEN: InjectionToken<ILicensingRepository> = Symbol('LICENSING_REPOSITORY_TOKEN');
export const LICENSING_SERVICE_TOKEN: InjectionToken<LicensingService> = Symbol('LICENSING_SERVICE_TOKEN');
export const LICENSE_API_REPOSITORY_TOKEN: InjectionToken<ILicenseApiRepository> = Symbol(
	'LICENSE_API_REPOSITORY_TOKEN',
);
export const LICENSE_API_SERVICE_TOKEN: InjectionToken<LicenseApiService> = Symbol('LICENSE_API_SERVICE_TOKEN');
/** The machine-key port (Better Auth API keys). */
export const API_KEY_ISSUER_TOKEN: InjectionToken<IApiKeyIssuer> = Symbol('API_KEY_ISSUER_TOKEN');

/* -------------------------------- numbering ------------------------------ */

export const PROJECT_CODE_NUMBERING_REPOSITORY_TOKEN: InjectionToken<ProjectCodeNumberingRepository> =
	Symbol('PROJECT_CODE_NUMBERING_REPOSITORY');
export const PROJECT_NUMBERING_SERVICE_TOKEN: InjectionToken<ProjectNumberingService> =
	Symbol('PROJECT_NUMBERING_SERVICE');
