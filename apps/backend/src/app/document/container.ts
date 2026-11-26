import type { DependencyContainer } from 'tsyringe';
import { DocumentCodeNumberingRepository } from './repositories/code-numbering.repository';
import { DocumentNumberingService } from './services/document-numbering.service';
import { DocumentRepository } from './repositories/document.repository';
import { DocumentService } from './services/document.service';
import { SignatureRepository } from './repositories/signature.repository';
import { SignatureService } from './services/signature.service';
import { MyDocumentRepository } from './repositories/my-document.repository';
import { EmployeeDocumentPortalService } from './services/employee-document-portal.service';
import {
	DOCUMENT_CODE_NUMBERING_REPOSITORY_TOKEN,
	DOCUMENT_NUMBERING_SERVICE_TOKEN,
	DOCUMENT_REPOSITORY_TOKEN,
	DOCUMENT_SERVICE_TOKEN,
	SIGNATURE_REPOSITORY_TOKEN,
	SIGNATURE_SERVICE_TOKEN,
	MY_DOCUMENT_REPOSITORY_TOKEN,
	EMPLOYEE_DOCUMENT_PORTAL_SERVICE_TOKEN,
} from './constants/di';

export * from './constants/di';

/**
 * Registers the document module's repository and service.
 *
 * @remarks
 * Called from the composition root (`src/index.ts`) after the code-number
 * module: issuing a document allocates its code through
 * {@link CODE_NUMBER_SERVICE_TOKEN}.
 */
export function registerDocument(container: DependencyContainer): void {
	container.register(DOCUMENT_CODE_NUMBERING_REPOSITORY_TOKEN, { useClass: DocumentCodeNumberingRepository });
	container.register(DOCUMENT_NUMBERING_SERVICE_TOKEN, { useClass: DocumentNumberingService });
	container.register(DOCUMENT_REPOSITORY_TOKEN, { useClass: DocumentRepository });
	container.register(DOCUMENT_SERVICE_TOKEN, { useClass: DocumentService });
	container.register(SIGNATURE_REPOSITORY_TOKEN, { useClass: SignatureRepository });
	container.register(SIGNATURE_SERVICE_TOKEN, { useClass: SignatureService });
	// Employee portal (Phase C): the caller's own documents and signature requests.
	container.register(MY_DOCUMENT_REPOSITORY_TOKEN, { useClass: MyDocumentRepository });
	container.register(EMPLOYEE_DOCUMENT_PORTAL_SERVICE_TOKEN, { useClass: EmployeeDocumentPortalService });
}

