/**
 * Injection tokens for the project module.
 *
 * @remarks
 * The project module is being assembled in steps (ADR-0024 P2/P6): leads and
 * the website inquiry surface arrived first (Q12); projects, handovers,
 * warranties and licensing move in with P6. One repository per table.
 */
import type { InjectionToken } from 'tsyringe';
import type {
	ILeadActivityRepository,
	ILeadAttachmentRepository,
	ILeadRepository,
} from '../contracts/lead.repository.interface';
import type { ProjectCodeNumberingRepository } from '../repositories/code-numbering.repository';
import type { LeadService } from '../services/lead.service';
import type { ProjectNumberingService } from '../services/project-numbering.service';
import type { WebsiteInquiryService } from '../services/website-inquiry.service';

export const LEAD_REPOSITORY_TOKEN: InjectionToken<ILeadRepository> = Symbol('LEAD_REPOSITORY');
export const LEAD_ACTIVITY_REPOSITORY_TOKEN: InjectionToken<ILeadActivityRepository> =
	Symbol('LEAD_ACTIVITY_REPOSITORY');
export const LEAD_ATTACHMENT_REPOSITORY_TOKEN: InjectionToken<ILeadAttachmentRepository> =
	Symbol('LEAD_ATTACHMENT_REPOSITORY');
export const PROJECT_CODE_NUMBERING_REPOSITORY_TOKEN: InjectionToken<ProjectCodeNumberingRepository> =
	Symbol('PROJECT_CODE_NUMBERING_REPOSITORY');
export const PROJECT_NUMBERING_SERVICE_TOKEN: InjectionToken<ProjectNumberingService> =
	Symbol('PROJECT_NUMBERING_SERVICE');
export const LEAD_SERVICE_TOKEN: InjectionToken<LeadService> = Symbol('LEAD_SERVICE');
export const WEBSITE_INQUIRY_SERVICE_TOKEN: InjectionToken<WebsiteInquiryService> =
	Symbol('WEBSITE_INQUIRY_SERVICE');
