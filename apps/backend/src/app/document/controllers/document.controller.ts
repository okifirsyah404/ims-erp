import { domainPlugin } from '@http/plugin';
import { errorEnvelope, ok, okPaginated } from '@http/response';
import { translator } from '@providers/i18n/translator';
import { container } from 'tsyringe';
import { z } from 'zod';
import { DOCUMENT_SERVICE_TOKEN } from '../constants/di';
import {
	createDocumentShareSchema,
	createDocumentTemplateSchema,
	documentListQuerySchema,
	issueDocumentSchema,
} from '../contracts/document.contract';
import {
	DocumentFileNotFoundError,
	DocumentFileStateError,
	DocumentNotFoundError,
	DocumentNotVoidableError,
	DocumentShareNotFoundError,
} from '../errors/document.errors';

const documentIdParamsSchema = z.object({ id: z.uuid() });

const documentFileParamsSchema = z.object({ id: z.uuid(), fileId: z.uuid() });

const documentShareParamsSchema = z.object({ id: z.uuid(), shareId: z.uuid() });

const templateQuerySchema = z.object({ organizationId: z.string().min(1).max(64).nullish() });

/**
 * REST controller for the document registry (`/documents`).
 *
 * @remarks
 * Reading needs `document:read`; issuing, voiding, uploading, sharing and
 * template changes need `document:update`; downloads need `document:download`
 * and always append a row to the access trail. Codes come from the numbering
 * authority, never from the client.
 */
export class DocumentController {
	static plugin() {
		const service = container.resolve(DOCUMENT_SERVICE_TOKEN);

		return domainPlugin({
			name: 'documents',
			prefix: '/documents',
			tags: ['Document'],
			guards: 'erp',
		})
			.onError({ as: 'local' }, (ctx) => {
				const { error, set } = ctx;
				const t = translator(ctx);
				if (error instanceof DocumentNotFoundError || error instanceof DocumentFileNotFoundError) {
					set.status = 404;
					return errorEnvelope(404, t('common.notFound'), [{ message: t(error.key) }]);
				}
				if (error instanceof DocumentShareNotFoundError) {
					set.status = 404;
					return errorEnvelope(404, t('common.notFound'), [{ message: t(error.key) }]);
				}
				if (error instanceof DocumentNotVoidableError || error instanceof DocumentFileStateError) {
					set.status = 409;
					return errorEnvelope(409, t('common.conflict'), [{ message: t(error.key) }]);
				}
				return undefined;
			})
			.get('', async ({ query }) => okPaginated(await service.list(query)), {
				query: documentListQuerySchema,
				erp: { permission: ['document:read'] },
				detail: { description: 'The document registry, newest first' },
			})
			// Templates first: a static path must win over `/:id`.
			.get(
				'/templates',
				async ({ query }) => ok(await service.listTemplates(query.organizationId ?? null)),
				{
					query: templateQuerySchema,
					erp: { permission: ['document:read'] },
					detail: { description: 'Company-wide and tenant document templates' },
				},
			)
			.post(
				'/templates',
				async ({ body }) => ok(await service.createTemplate(createDocumentTemplateSchema.parse(body))),
				{
					erp: { permission: ['document:update'] },
					detail: { description: 'Creates a document template version' },
				},
			)
			.get('/:id', async ({ params, erp }) => ok(await service.detail(params.id, erp.session.user.id)), {
				params: documentIdParamsSchema,
				erp: { permission: ['document:read'] },
				detail: {
					description: 'One document with its files, share links and access trail (appends a view row)',
				},
			})
			.post(
				'',
				async ({ body, erp }) =>
					ok(await service.issue(issueDocumentSchema.parse(body), erp.session.user.id)),
				{
					erp: { permission: ['document:update'] },
					detail: { description: 'Issues a document and allocates its code' },
				},
			)
			.post(
				'/:id/void',
				async ({ params, erp }) => ok(await service.void(params.id, erp.session.user.id)),
				{
					params: documentIdParamsSchema,
					erp: { permission: ['document:update'] },
					detail: { description: 'Voids a document (the row is kept)' },
				},
			)
			.post(
				'/:id/files',
				async ({ params, body, erp }) =>
					ok(await service.uploadFile(params.id, body, erp.session.user.id)),
				{
					params: documentIdParamsSchema,
					erp: { permission: ['document:update'] },
					detail: { description: 'Attaches a PDF or image (multipart `file`, at most 10 MB)' },
				},
			)
			.delete(
				'/:id/files/:fileId',
				async ({ params, erp }) => {
					const { id, fileId } = documentFileParamsSchema.parse(params);
					await service.deleteFile(id, fileId, erp.session.user.id);
					return ok(null);
				},
				{
					params: documentFileParamsSchema,
					erp: { permission: ['document:update'] },
					detail: { description: 'Removes a file (soft delete, kept for the trail)' },
				},
			)
			.get(
				'/:id/files/:fileId/download',
				async ({ params, erp, request }) => {
					const { id, fileId } = documentFileParamsSchema.parse(params);
					return ok(
						await service.downloadFile(id, fileId, erp.session.user.id, {
							ipAddress: request.headers.get('x-forwarded-for'),
							userAgent: request.headers.get('user-agent'),
						}),
					);
				},
				{
					params: documentFileParamsSchema,
					erp: { permission: ['document:download'] },
					detail: { description: 'A short-lived download URL (appends a download row)' },
				},
			)
			.post(
				'/:id/shares',
				async ({ params, body, erp }) => {
					const input = createDocumentShareSchema.parse(body ?? {});
					return ok(await service.createShare(params.id, input.expiresInDays, erp.session.user.id));
				},
				{
					params: documentIdParamsSchema,
					erp: { permission: ['document:update'] },
					detail: { description: 'Creates a revocable public link with a mandatory expiry' },
				},
			)
			.delete(
				'/:id/shares/:shareId',
				async ({ params }) => {
					const { id, shareId } = documentShareParamsSchema.parse(params);
					return ok(await service.revokeShare(id, shareId));
				},
				{
					params: documentShareParamsSchema,
					erp: { permission: ['document:update'] },
					detail: { description: 'Revokes a public link (the row is kept)' },
				},
			);
	}
}

const shareTokenParamsSchema = z.object({ token: z.uuid() });

/**
 * Anonymous public share links (`/public/v1/documents/:token`).
 *
 * @remarks
 * The token is the only credential, so the response is a narrow projection:
 * code, type, title, issue date, status and files. No session, no
 * organization, no access trail.
 */
export class PublicDocumentController {
	static plugin() {
		const service = container.resolve(DOCUMENT_SERVICE_TOKEN);

		return domainPlugin({
			name: 'public-documents',
			prefix: '/public/v1/documents',
			tags: ['Document'],
		}).get('/:token', async ({ params }) => ok(await service.resolvePublicShare(params.token)), {
			params: shareTokenParamsSchema,
			detail: { description: 'A shared document by its public token (no session)' },
		});
	}
}
