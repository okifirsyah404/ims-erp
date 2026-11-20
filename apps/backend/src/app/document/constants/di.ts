/**
 * Injection tokens for the document module.
 *
 * @remarks
 * Kept in a standalone constants module so services and the composition root
 * can both import them without a circular dependency.
 */
import type { InjectionToken } from 'tsyringe';
import type { DocumentCodeNumberingRepository } from '../repositories/code-numbering.repository';
import type { DocumentNumberingService } from '../services/document-numbering.service';
import type { IDocumentRepository } from '../contracts/document.repository.interface';
import type { ISignatureRepository } from '../contracts/signature.repository.interface';
import type { DocumentService } from '../services/document.service';
import type { SignatureService } from '../services/signature.service';

/** Token resolving to the {@link IDocumentRepository} implementation. */
export const DOCUMENT_REPOSITORY_TOKEN: InjectionToken<IDocumentRepository> =
	Symbol('DOCUMENT_REPOSITORY_TOKEN');

/**
 * Token resolving to the {@link DocumentService} — the exported API other
 * modules use to issue documents.
 */
export const DOCUMENT_SERVICE_TOKEN: InjectionToken<DocumentService> =
	Symbol('DOCUMENT_SERVICE_TOKEN');

/** Token resolving to the {@link ISignatureRepository} implementation. */
export const SIGNATURE_REPOSITORY_TOKEN: InjectionToken<ISignatureRepository> =
	Symbol('SIGNATURE_REPOSITORY_TOKEN');

/** Token resolving to the {@link SignatureService} use cases (ERP-0048). */
export const SIGNATURE_SERVICE_TOKEN: InjectionToken<SignatureService> =
	Symbol('SIGNATURE_SERVICE_TOKEN');

/** Token resolving to the repository of `document.code_numberings`. */
export const DOCUMENT_CODE_NUMBERING_REPOSITORY_TOKEN: InjectionToken<DocumentCodeNumberingRepository> =
	Symbol('DOCUMENT_CODE_NUMBERING_REPOSITORY');

/** Token resolving to the {@link DocumentNumberingService}. */
export const DOCUMENT_NUMBERING_SERVICE_TOKEN: InjectionToken<DocumentNumberingService> =
	Symbol('DOCUMENT_NUMBERING_SERVICE');
