import { projectContextFor } from '@app/projects/utils/project-context';
import { type IPermissionResolver, PERMISSION_RESOLVER_TOKEN } from '@authorization/permission-resolver';
import { container } from 'tsyringe';
import { domainPlugin } from '@http/plugin';
import { ok } from '@http/response';
import { WARRANTY_SERVICE_TOKEN } from '../constants/di';
import { warrantyBodySchema, warrantyProjectParamSchema } from '../contracts/warranty.contract';

/**
 * REST controller for warranty certificates
 * (`/warranty-certificates/projects/:projectId`, ADR-0011 step 6b).
 * Reading follows the project (`project:read` + project visibility);
 * saving needs `project:update`.
 */
export class WarrantyController {
	static plugin() {
		const service = container.resolve(WARRANTY_SERVICE_TOKEN);
		const permissions = container.resolve<IPermissionResolver>(PERMISSION_RESOLVER_TOKEN);
		const projectId = (params: unknown) => warrantyProjectParamSchema.parse(params).projectId;

		return domainPlugin({ name: 'aftersales-warranty', prefix: '/warranty-certificates', tags: ['After-Sales'], guards: 'erp' })
			.get(
				'/projects/:projectId',
				async ({ params, erp }) => ok(await service.get(await projectContextFor(permissions, erp), projectId(params))),
				{ erp: { permission: ['project:read'] }, detail: { description: "The project's warranty certificate (or null)" } },
			)
			.get(
				'/projects/:projectId/draft',
				async ({ params, erp }) => ok(await service.draft(await projectContextFor(permissions, erp), projectId(params))),
				{ erp: { permission: ['project:update'] }, detail: { description: 'Prefilled fields of a new certificate' } },
			)
			.put(
				'/projects/:projectId',
				async ({ params, body, erp }) =>
					ok(await service.save(await projectContextFor(permissions, erp), projectId(params), warrantyBodySchema.parse(body))),
				{ erp: { permission: ['project:update'] }, detail: { description: 'Creates (numbers) or updates the certificate' } },
			);
	}
}
