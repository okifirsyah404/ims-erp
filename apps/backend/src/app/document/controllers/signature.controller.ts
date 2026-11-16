import { domainPlugin } from '@http/plugin';
import { errorEnvelope, ok, okPaginated } from '@http/response';
import { documentImageFrom, storeDocumentImage } from '@providers/s3/document-image';
import { OBJECT_STORAGE_TOKEN } from '@providers/s3/object-storage';
import { translator } from '@providers/i18n/translator';
import { container } from 'tsyringe';
import { z } from 'zod';
import { SIGNATURE_SERVICE_TOKEN } from '../constants/di';
import {
	createSignatureRequestsSchema,
	declineSignatureRequestSchema,
	signatureListQuerySchema,
	signatureRequestListQuerySchema,
	signRequestSchema,
	userImagesSchema,
} from '../contracts/signature.contract';
import {
	NotRequestOwnerError,
	NotRequestSignerError,
	SignatureImageNotFoundError,
	SignaturePdfInvalidError,
	SignaturePdfStateError,
	SignatureRequestNotFoundError,
	SignatureRequestStateError,
} from '../errors/signature.errors';

const requestParamsSchema = z.object({ id: z.uuid() });

const documentParamsSchema = z.object({ id: z.uuid() });

/**
 * REST controller for the signature flow (`/documents/signatures`,
 * ERP-0048/ERP-0049).
 *
 * @remarks
 * Reading the register needs `document:signature_read`; asking others to sign
 * needs `document:signature_request`; acting on a request addressed to the
 * caller (sign, decline, upload one's image) needs `document:signature_sign`.
 * Ownership and state are re-checked in the service — the guard is the first
 * gate, never the only one.
 */
export class SignatureController {
	static plugin() {
		const service = container.resolve(SIGNATURE_SERVICE_TOKEN);
		const storage = container.resolve(OBJECT_STORAGE_TOKEN);

		return domainPlugin({
			name: 'document-signatures',
			prefix: '/documents/signatures',
			tags: ['Document'],
			guards: 'erp',
		})
			.onError({ as: 'local' }, (ctx) => {
				const { error, set } = ctx;
				const t = translator(ctx);
				if (error instanceof SignaturePdfInvalidError) {
					set.status = 422;
					return errorEnvelope(422, t(error.key), [{ message: t(error.key) }]);
				}
				if (
					error instanceof SignatureRequestNotFoundError ||
					error instanceof SignatureImageNotFoundError
				) {
					set.status = 404;
					return errorEnvelope(404, t(error.key), [{ message: t(error.key) }]);
				}
				if (error instanceof NotRequestSignerError || error instanceof NotRequestOwnerError) {
					set.status = 403;
					return errorEnvelope(403, t(error.key), [{ message: t(error.key) }]);
				}
				if (
					error instanceof SignatureRequestStateError ||
					error instanceof SignaturePdfStateError
				) {
					set.status = 409;
					return errorEnvelope(409, t(error.key), [{ message: t(error.key) }]);
				}
				return undefined;
			})
			.get('', async ({ query }) => okPaginated(await service.listSignatures(query)), {
				query: signatureListQuerySchema,
				erp: { permission: ['document:signature_read'] },
				detail: { description: 'The signature evidence register' },
			})
			.get(
				'/requests/incoming',
				async ({ query, erp }) =>
					okPaginated(await service.listIncoming(erp.session.user.id, query)),
				{
					query: signatureRequestListQuerySchema,
					erp: { permission: ['document:signature_sign'] },
					detail: { description: 'Requests addressed to the caller' },
				},
			)
			.get(
				'/requests/outgoing',
				async ({ query, erp }) =>
					okPaginated(await service.listOutgoing(erp.session.user.id, query)),
				{
					query: signatureRequestListQuerySchema,
					erp: { permission: ['document:signature_request'] },
					detail: { description: 'Requests the caller created' },
				},
			)
			.post(
				'/requests',
				async ({ body, erp }) => {
					const input = createSignatureRequestsSchema.parse(body);
					return ok(await service.createRequests(input, erp.session.user.id));
				},
				{
					erp: { permission: ['document:signature_request'] },
					detail: { description: 'Asks one or more internal users to sign a document' },
				},
			)
			.post(
				'/requests/:id/sign',
				async ({ params, body, erp, request }) => {
					const input = signRequestSchema.parse(body ?? {});
					return ok(
						await service.sign(
							params.id,
							erp.session.user.id,
							request.headers.get('x-forwarded-for'),
							input.method,
						),
					);
				},
				{
					params: requestParamsSchema,
					erp: { permission: ['document:signature_sign'] },
					detail: { description: 'Signs a request addressed to the caller (writes the evidence row)' },
				},
			)
			.post(
				'/requests/:id/decline',
				async ({ params, body, erp }) => {
					const input = declineSignatureRequestSchema.parse(body);
					return ok(await service.decline(params.id, erp.session.user.id, input.reason));
				},
				{
					params: requestParamsSchema,
					erp: { permission: ['document:signature_sign'] },
					detail: { description: 'Declines a request addressed to the caller, with a reason' },
				},
			)
			.post(
				'/requests/:id/cancel',
				async ({ params, erp }) =>
					ok(await service.cancel(params.id, erp.session.user.id)),
				{
					params: requestParamsSchema,
					erp: { permission: ['document:signature_request'] },
					detail: { description: 'Cancels a pending request the caller created' },
				},
			)
			.put(
				'/requests/:id/signed-pdf',
				async ({ params, body, erp }) =>
					ok(await service.attachSignedPdf(params.id, body, erp.session.user.id)),
				{
					params: requestParamsSchema,
					erp: { permission: ['document:signature_sign'] },
					detail: {
						description:
							'Records the signed PDF (multipart `file`) on the caller signature; placement is final',
					},
				},
			)
			.get(
				'/requests/:id/signed-pdf',
				async ({ params, erp, request }) =>
					ok(
						await service.signedPdfUrl(params.id, erp.session.user.id, {
							ipAddress: request.headers.get('x-forwarded-for'),
							userAgent: request.headers.get('user-agent'),
						}),
					),
				{
					params: requestParamsSchema,
					erp: { permission: ['document:signature_sign'] },
					detail: { description: 'A presigned URL for the signed PDF artifact' },
				},
			)
			.get('/my-image', async ({ erp }) => ok(await service.myImage(erp.session.user.id)), {
				erp: { permission: ['document:signature_sign'] },
				detail: { description: 'The caller signature image URL, or null' },
			})
			.put(
				'/my-image',
				async ({ body, erp }) => {
					const image = documentImageFrom(body);
					const key = await storeDocumentImage(storage, `signatures/${erp.session.user.id}`, image);
					await service.uploadImage(erp.session.user.id, key);
					return ok(await service.myImage(erp.session.user.id));
				},
				{
					erp: { permission: ['document:signature_sign'] },
					detail: { description: 'Uploads or replaces the caller signature image (multipart `file`)' },
				},
			)
			.delete(
				'/my-image',
				async ({ erp }) => {
					await service.deleteImage(erp.session.user.id);
					return ok(null);
				},
				{
					erp: { permission: ['document:signature_sign'] },
					detail: { description: 'Removes the caller signature image (soft delete)' },
				},
			)
			.post(
				'/user-images',
				async ({ body }) => {
					const input = userImagesSchema.parse(body);
					const urls = await service.userImages(input.userIds);
					return ok(
						input.userIds.map((userId) => ({ userId, imageUrl: urls.get(userId) ?? null })),
					);
				},
				{
					erp: { permission: ['document:signature_sign'] },
					detail: { description: 'Presigned signature images of many users (print layouts)' },
				},
			);
	}
}

/**
 * The Signatures tab of one document (`/documents/:id/signatures`).
 *
 * @remarks
 * Mounted on its own so the registry prefix stays untouched; the guard is the
 * same `document:signature_read` action as the register.
 */
export class DocumentSignatureController {
	static plugin() {
		const service = container.resolve(SIGNATURE_SERVICE_TOKEN);

		return domainPlugin({
			name: 'document-signature-section',
			prefix: '/documents',
			tags: ['Document'],
			guards: 'erp',
		}).get('/:id/signatures', async ({ params }) => ok(await service.documentSection(params.id)), {
			params: documentParamsSchema,
			erp: { permission: ['document:signature_read'] },
			detail: { description: 'Signature evidence and requests of one document' },
		});
	}
}
