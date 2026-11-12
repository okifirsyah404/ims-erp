import { domainPlugin } from '@http/plugin';
import { errorEnvelope, ok, okPaginated } from '@http/response';
import { translator } from '@providers/i18n/translator';
import { container } from 'tsyringe';
import { z } from 'zod';
import { DOCUMENT_SERVICE_TOKEN } from '../constants/di';
import {
	createDocumentTemplateSchema,
	documentListQuerySchema,
	issueDocumentSchema,
} from '../contracts/document.contract';
import { DocumentNotFoundError, DocumentNotVoidableError } from '../errors/document.errors';

const documentIdParamsSchema = z.object({ id: z.uuid() });

const templateQuerySchema = z.object({ organizationId: z.string().min(1).max(64).nullish() });

/**
 * REST controller for the document registry (`/documents`).
 *
 * @remarks
 * Reading needs `document:read`; issuing, voiding and template changes need
 * `document:update`. Codes come from the numbering authority, never from the
 * client.
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
				if (error instanceof DocumentNotFoundError) {
					set.status = 404;
					return errorEnvelope(404, t('common.notFound'), [{ message: t(error.key) }]);
				}
				if (error instanceof DocumentNotVoidableError) {
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
			.get('/:id', async ({ params, erp }) => ok(await service.get(params.id, erp.session.user.id)), {
				params: documentIdParamsSchema,
				erp: { permission: ['document:read'] },
				detail: { description: 'One document; reading it appends an access-trail row' },
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
			);
	}
}
