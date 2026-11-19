/**
 * Public entry point of the document module.
 *
 * @remarks
 * Re-exports the composition-root registration, the controller and the
 * exported service so consumers only import from `@app/document`.
 */
import Elysia from 'elysia';

import { DocumentController, PublicDocumentController } from './controllers/document.controller';
import {
	DocumentSignatureController,
	SignatureController,
} from './controllers/signature.controller';

export * from './container';
export * from './controllers/document.controller';
export * from './controllers/signature.controller';
export type { DocumentService } from './services/document.service';
export type { SignatureService } from './services/signature.service';
export type {
	TDocumentDetail,
	TDocumentFileView,
	TDocumentShareView,
	TPublicDocumentView,
	TRegisterDocumentInput,
} from './contracts/document.contract';
export type {
	TSignatureRequestView,
	TSignatureView,
} from './contracts/signature.contract';

/** Elysia instance mounting the document controllers (registry + public links). */
export function documentModule() {
	return new Elysia({ name: 'document' })
		.use(DocumentController.plugin())
		.use(DocumentSignatureController.plugin())
		.use(SignatureController.plugin())
		.use(PublicDocumentController.plugin())
		// Alias: share links already sent to customers (ADR-0024 Q34).
		.use(PublicDocumentController.plugin('/public/v1/documents'));
}
