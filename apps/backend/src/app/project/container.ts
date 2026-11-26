import type { DependencyContainer } from 'tsyringe';
import {
	API_KEY_ISSUER_TOKEN,
	HANDOVER_REPOSITORY_TOKEN,
	HANDOVER_SERVICE_TOKEN,
	LEAD_ACTIVITY_REPOSITORY_TOKEN,
	LEAD_ATTACHMENT_REPOSITORY_TOKEN,
	LEAD_REPOSITORY_TOKEN,
	LEAD_SERVICE_TOKEN,
	LICENSE_API_REPOSITORY_TOKEN,
	LICENSE_API_SERVICE_TOKEN,
	LICENSING_REPOSITORY_TOKEN,
	LICENSING_SERVICE_TOKEN,
	PROJECT_CODE_NUMBERING_REPOSITORY_TOKEN,
	PROJECT_LOOKUP_SERVICE_TOKEN,
	PROJECT_NUMBERING_SERVICE_TOKEN,
	PROJECT_PORTAL_SERVICE_TOKEN,
	PROJECT_REPOSITORY_TOKEN,
	PROJECT_SERVICE_TOKEN,
	PORTAL_PROJECT_SERVICE_TOKEN,
	SITE_ATTENDANCE_REPOSITORY_TOKEN,
	SITE_ATTENDANCE_SERVICE_TOKEN,
	WARRANTY_REPOSITORY_TOKEN,
	WARRANTY_SERVICE_TOKEN,
	WEBSITE_INQUIRY_SERVICE_TOKEN,
} from './constants/di';
import { BetterAuthApiKeyIssuer } from './adapters/better-auth-api-keys';
import { ProjectCodeNumberingRepository } from './repositories/code-numbering.repository';
import { HandoverRepository } from './repositories/handover.repository';
import { LeadActivityRepository } from './repositories/lead-activity.repository';
import { LeadAttachmentRepository } from './repositories/lead-attachment.repository';
import { LeadRepository } from './repositories/lead.repository';
import { LicenseApiRepository } from './repositories/license-api.repository';
import { LicensingRepository } from './repositories/licensing.repository';
import { ProjectRepository } from './repositories/project.repository';
import { WarrantyRepository } from './repositories/warranty.repository';
import { HandoverService } from './services/handover.service';
import { LeadService } from './services/lead.service';
import { LicenseApiService } from './services/license-api.service';
import { LicensingService } from './services/licensing.service';
import { ProjectLookupService } from './services/project-lookup.service';
import { ProjectNumberingService } from './services/project-numbering.service';
import { ProjectPortalService } from './services/project-portal.service';
import { ProjectService } from './services/project.service';
import { PortalProjectService } from './services/portal-project.service';
import { SiteAttendanceService } from './services/site-attendance.service';
import { SiteAttendanceRepository } from './repositories/site-attendance.repository';
import { WarrantyService } from './services/warranty.service';
import { WebsiteInquiryService } from './services/website-inquiry.service';

export * from './constants/di';

/**
 * Registers the project module's repositories and services (ADR-0024 Q12, P6).
 *
 * @remarks
 * Leads and website inquiries came from `crm` (P2); projects, handovers,
 * warranties and licensing joined in P6. Requires the `customer`, `company`
 * and `sale` modules to be registered (lead conversion, the `{COMPANY}`
 * numbering token, `ExportedOrderService`).
 */
export function registerProject(container: DependencyContainer): void {
	// Leads and the website inquiry surface.
	container.register(LEAD_REPOSITORY_TOKEN, { useClass: LeadRepository });
	container.register(LEAD_ACTIVITY_REPOSITORY_TOKEN, { useClass: LeadActivityRepository });
	container.register(LEAD_ATTACHMENT_REPOSITORY_TOKEN, { useClass: LeadAttachmentRepository });
	container.register(LEAD_SERVICE_TOKEN, { useClass: LeadService });
	container.register(WEBSITE_INQUIRY_SERVICE_TOKEN, { useClass: WebsiteInquiryService });

	// Projects and handovers.
	container.register(PROJECT_REPOSITORY_TOKEN, { useClass: ProjectRepository });
	container.register(PROJECT_SERVICE_TOKEN, { useClass: ProjectService });
	container.register(PORTAL_PROJECT_SERVICE_TOKEN, { useClass: PortalProjectService });
	container.register(SITE_ATTENDANCE_REPOSITORY_TOKEN, { useClass: SiteAttendanceRepository });
	container.register(SITE_ATTENDANCE_SERVICE_TOKEN, { useClass: SiteAttendanceService });
	container.register(PROJECT_LOOKUP_SERVICE_TOKEN, { useClass: ProjectLookupService });
	container.register(PROJECT_PORTAL_SERVICE_TOKEN, { useClass: ProjectPortalService });
	container.register(HANDOVER_REPOSITORY_TOKEN, { useClass: HandoverRepository });
	container.register(HANDOVER_SERVICE_TOKEN, { useClass: HandoverService });

	// Warranties (moved from aftersales).
	container.register(WARRANTY_REPOSITORY_TOKEN, { useClass: WarrantyRepository });
	container.register(WARRANTY_SERVICE_TOKEN, { useClass: WarrantyService });

	// Licensing (moved from its own module).
	container.register(LICENSING_REPOSITORY_TOKEN, { useClass: LicensingRepository });
	container.register(LICENSING_SERVICE_TOKEN, { useClass: LicensingService });
	container.register(LICENSE_API_REPOSITORY_TOKEN, { useClass: LicenseApiRepository });
	container.register(LICENSE_API_SERVICE_TOKEN, { useClass: LicenseApiService });
	container.register(API_KEY_ISSUER_TOKEN, { useClass: BetterAuthApiKeyIssuer });

	// Numbering (`project.code_numberings`).
	container.register(PROJECT_CODE_NUMBERING_REPOSITORY_TOKEN, { useClass: ProjectCodeNumberingRepository });
	container.register(PROJECT_NUMBERING_SERVICE_TOKEN, { useClass: ProjectNumberingService });
}

