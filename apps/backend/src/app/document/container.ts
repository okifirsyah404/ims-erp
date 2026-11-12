import type { DependencyContainer } from 'tsyringe';
import { DocumentRepository } from './repositories/document.repository';
import { DocumentService } from './services/document.service';
import { DOCUMENT_REPOSITORY_TOKEN, DOCUMENT_SERVICE_TOKEN } from './constants/di';

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
	container.register(DOCUMENT_REPOSITORY_TOKEN, { useClass: DocumentRepository });
	container.register(DOCUMENT_SERVICE_TOKEN, { useClass: DocumentService });
}
