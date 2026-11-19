import type { DependencyContainer } from 'tsyringe';
import {
	LEAD_ACTIVITY_REPOSITORY_TOKEN,
	LEAD_ATTACHMENT_REPOSITORY_TOKEN,
	LEAD_REPOSITORY_TOKEN,
	LEAD_SERVICE_TOKEN,
	PROJECT_CODE_NUMBERING_REPOSITORY_TOKEN,
	PROJECT_NUMBERING_SERVICE_TOKEN,
	WEBSITE_INQUIRY_SERVICE_TOKEN,
} from './constants/di';
import { ProjectCodeNumberingRepository } from './repositories/code-numbering.repository';
import { LeadActivityRepository } from './repositories/lead-activity.repository';
import { LeadAttachmentRepository } from './repositories/lead-attachment.repository';
import { LeadRepository } from './repositories/lead.repository';
import { LeadService } from './services/lead.service';
import { ProjectNumberingService } from './services/project-numbering.service';
import { WebsiteInquiryService } from './services/website-inquiry.service';

export * from './constants/di';

/**
 * Registers the project module's repositories and services.
 *
 * @remarks
 * Only the lead pipeline and website inquiries are in this module so far
 * (ADR-0024 Q12, moved from `crm`); projects, handovers, warranties and
 * licensing join in P6. Requires the `customer` and `company` modules to be
 * registered (lead conversion, the `{COMPANY}` numbering token).
 */
export function registerProject(container: DependencyContainer): void {
	container.register(LEAD_REPOSITORY_TOKEN, { useClass: LeadRepository });
	container.register(LEAD_ACTIVITY_REPOSITORY_TOKEN, { useClass: LeadActivityRepository });
	container.register(LEAD_ATTACHMENT_REPOSITORY_TOKEN, { useClass: LeadAttachmentRepository });
	container.register(PROJECT_CODE_NUMBERING_REPOSITORY_TOKEN, { useClass: ProjectCodeNumberingRepository });
	container.register(PROJECT_NUMBERING_SERVICE_TOKEN, { useClass: ProjectNumberingService });
	container.register(LEAD_SERVICE_TOKEN, { useClass: LeadService });
	container.register(WEBSITE_INQUIRY_SERVICE_TOKEN, { useClass: WebsiteInquiryService });
}
