import { domainPlugin } from '@http/plugin';
import { created, ok } from '@http/response';
import { container } from 'tsyringe';
import { z } from 'zod';
import { AGREEMENT_PDF_SERVICE_TOKEN, EMPLOYEE_DOCUMENT_SERVICE_TOKEN } from '../constants/di';
import {
	employeeDocumentCreateSchema,
	employeeDocumentFileParamSchema,
	employeeDocumentParamSchema,
} from '../contracts/employee-document.contract';
import { recordIdParamSchema } from '../contracts/hr-records.contract';
import { HrNotFoundError } from '../errors/hr.errors';
import { hrContext } from './hr-context';

/**
 * The Documents tab of an employee (ERP-0121). Reading and downloading need
 * `employee:read`; adding, uploading, voiding and regenerating the agreement
 * PDF `employee:update`. Only employees the caller sees (ERP-0034 scope);
 * the files themselves stay with the document module.
 */
export class EmployeeDocumentController {
	static plugin() {
		const service = container.resolve(EMPLOYEE_DOCUMENT_SERVICE_TOKEN);
		const context = hrContext();

		return domainPlugin({ name: 'hr-employee-documents', prefix: '/human-resources/employees', tags: ['Human Resource'], guards: 'erp' })
			.get(
				'/:id/documents',
				async ({ params, erp }) => ok(await service.list((await context(erp)).scope, recordIdParamSchema.parse(params).id)),
				{ erp: { permission: ['employee:read'] }, detail: { description: 'Documents of the employee with their files' } },
			)
			.post(
				'/:id/documents',
				async ({ params, body, erp, status }) => {
					const ctx = await context(erp);
					return status(201, created(await service.create(ctx.scope, recordIdParamSchema.parse(params).id, employeeDocumentCreateSchema.parse(body))));
				},
				{ erp: { permission: ['employee:update'] }, detail: { description: 'Opens a draft document (one live employment agreement; its PDF is queued)' } },
			)
			.post(
				'/:id/documents/:documentId/files',
				async ({ params, body, erp }) => {
					const { id, documentId } = employeeDocumentParamSchema.parse(params);
					const ctx = await context(erp);
					return ok(await service.upload(ctx.scope, id, documentId, body, ctx.actorUserId));
				},
				{ erp: { permission: ['employee:update'] }, detail: { description: 'Attaches a PDF or image (multipart `file`, at most 10 MB)' } },
			)
			.get(
				'/:id/documents/:documentId/files/:fileId/download',
				async ({ params, erp }) => {
					const { id, documentId, fileId } = employeeDocumentFileParamSchema.parse(params);
					const ctx = await context(erp);
					return ok(await service.download(ctx.scope, id, documentId, fileId, ctx.actorUserId));
				},
				{ erp: { permission: ['employee:read'] }, detail: { description: 'A short-lived download URL of one file' } },
			)
			.post(
				'/:id/documents/:documentId/void',
				async ({ params, erp }) => {
					const { id, documentId } = employeeDocumentParamSchema.parse(params);
					const ctx = await context(erp);
					return ok(await service.void(ctx.scope, id, documentId, ctx.actorUserId));
				},
				{ erp: { permission: ['employee:update'] }, detail: { description: 'Voids a document (kept, never deleted)' } },
			)
			.post(
				'/:id/documents/:documentId/regenerate-pdf',
				async ({ params, erp }) => {
					const { id, documentId } = employeeDocumentParamSchema.parse(params);
					return ok(await service.regeneratePdf((await context(erp)).scope, id, documentId));
				},
				{ erp: { permission: ['employee:update'] }, detail: { description: 'Queues the employment agreement PDF again' } },
			);
	}
}

/**
 * Public render data of the employment agreement print view
 * (`/human-resources/public/v1/render/employment-agreements/:id?token=…`,
 * ERP-0121). The short-lived render token is the only credential; a missing,
 * wrong or expired token answers 404.
 */
export class AgreementRenderController {
	static plugin(prefix = '/human-resources/public/v1/render/employment-agreements') {
		const service = container.resolve(AGREEMENT_PDF_SERVICE_TOKEN);
		return domainPlugin({ name: `agreement-render:${prefix}`, prefix, tags: ['Human Resource'] }).get(
			'/:id',
			async ({ params, query }) => {
				const { id } = z.object({ id: z.uuid() }).parse(params);
				const { token } = z.object({ token: z.string().min(1).max(200) }).parse(query);
				const data = await service.renderData(id, token);
				if (!data) throw new HrNotFoundError('document');
				return ok(data);
			},
			{ detail: { description: 'Employment agreement data for the print view (render token, no session)' } },
		);
	}
}
