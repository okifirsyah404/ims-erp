import { domainPlugin } from '@http/plugin';
import { ok, okPaginated } from '@http/response';
import { z } from 'zod';
import { container } from 'tsyringe';
import { EMPLOYEE_DOCUMENT_PORTAL_SERVICE_TOKEN } from '../constants/di';
import {
	declineMyRequestSchema,
	myDocumentListQuerySchema,
	mySignatureRequestsQuerySchema,
} from '../contracts/employee-document-portal.contract';

const requestParamsSchema = z.object({ id: z.uuid() });
const documentFileParamsSchema = z.object({ id: z.uuid(), fileId: z.uuid() });

/**
 * Employee portal document routes (`/documents/me/*`, Phase C).
 *
 * @remarks
 * Behind the `employee-portal` guard, so the caller is always an employee of the
 * active organization and the user id comes from the session — no route carries
 * a userId. Two surfaces:
 *
 * - **Documents**: the ones issued to the caller's employee record plus the ones
 *   waiting for their signature, and a short-lived download URL per file.
 * - **Signature requests**: the inbox the signature module already computes
 *   (`listIncoming`), plus sign / decline and the caller's own signature image.
 *
 * Unknown ids answer 404 from the underlying services, never 403, so a probe
 * cannot learn whether a document exists.
 */
export class EmployeeDocumentController {
	static plugin() {
		const service = container.resolve(EMPLOYEE_DOCUMENT_PORTAL_SERVICE_TOKEN);

		return domainPlugin({
			name: 'document-employee-portal',
			prefix: '/documents/me',
			tags: ['Document'],
			guards: 'employee-portal',
		})
			.get('/documents', async ({ query, erp }) => okPaginated(await service.list(erp.session.user.id, myDocumentListQuerySchema.parse(query))), {
				employeePortal: {},
				detail: { description: "Documents issued to the caller's employee record or awaiting their signature" },
			})
			.get(
				'/documents/:id/files/:fileId/download',
				async ({ params, erp }) => {
					const { id, fileId } = documentFileParamsSchema.parse(params);
					return ok(await service.download(erp.session.user.id, id, fileId));
				},
				{ employeePortal: {}, detail: { description: 'Short-lived download URL of one file of a document the caller may read' } },
			)
			.get('/signature-requests', async ({ query, erp }) => okPaginated(await service.requests(erp.session.user.id, mySignatureRequestsQuerySchema.parse(query))), {
				employeePortal: {},
				detail: { description: 'Signature requests addressed to the caller' },
			})
			.post(
				'/signature-requests/:id/sign',
				async ({ params, erp, request }) => {
					const { id } = requestParamsSchema.parse(params);
					return ok(await service.sign(erp.session.user.id, id, { signatureText: null, image: null }, request.headers.get('x-forwarded-for')));
				},
				{ employeePortal: {}, detail: { description: 'Signs one request addressed to the caller' } },
			)
			.post(
				'/signature-requests/:id/decline',
				async ({ params, body, erp }) => {
					const { id } = requestParamsSchema.parse(params);
					return ok(await service.decline(erp.session.user.id, id, declineMyRequestSchema.parse(body ?? {})));
				},
				{ employeePortal: {}, detail: { description: 'Declines one request addressed to the caller, with a reason' } },
			)
			.get('/signature-image', async ({ erp }) => ok({ url: await service.myImage(erp.session.user.id) }), {
				employeePortal: {},
				detail: { description: "Presigned URL of the caller's own signature image" },
			})
			.put('/signature-image', async ({ body, erp }) => ok(await service.uploadImage(erp.session.user.id, body)), {
				employeePortal: {},
				detail: { description: "Uploads or replaces the caller's signature image (multipart `file`, WebP)" },
			})
			.delete('/signature-image', async ({ erp }) => ok(await service.removeImage(erp.session.user.id)), {
				employeePortal: {},
				detail: { description: "Removes the caller's signature image" },
			});
	}
}
