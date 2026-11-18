import type { ErpContext } from '@authorization/elysia-auth';
import { type IPermissionResolver, PERMISSION_RESOLVER_TOKEN } from '@authorization/permission-resolver';
import { domainPlugin } from '@http/plugin';
import { created, ok, okPaginated } from '@http/response';
import { container } from 'tsyringe';
import { z } from 'zod';
import { LICENSE_API_SERVICE_TOKEN, LICENSING_SERVICE_TOKEN } from '../constants/di';
import { activationParamSchema, apiKeyBodySchema, apiKeyParamSchema, eventListQuerySchema } from '../contracts/license-api.contract';
import {
	applicationBodySchema,
	contractBodySchema,
	contractListQuerySchema,
	idParamSchema,
	keyBodySchema,
	keyParamSchema,
	reasonSchema,
} from '../contracts/licensing.contract';
import type { TLicenseContext } from '../services/licensing.service';

const applicationListQuerySchema = z.object({ includeRetired: z.stringbool().default(false) });
const optionalReasonSchema = z.object({ reason: z.string().trim().max(1000).optional() }).default({});

/**
 * REST controller for the license register (`/licenses`, M03 stage 1).
 * Reading needs `license:read` (full keys also `license:read_key`);
 * creating contracts, applications and keys `license:create`; activating,
 * suspending and reactivating `license:activate`; terminating and revoking
 * keys `license:revoke`; renewing `license:extend`. Stage 2: the machine
 * keys of own applications need `license:manage_api`; releasing a seat
 * `license:revoke`; the call log `license:read`.
 */
export class LicensingController {
	static plugin() {
		const service = container.resolve(LICENSING_SERVICE_TOKEN);
		const api = container.resolve(LICENSE_API_SERVICE_TOKEN);
		const permissions = container.resolve<IPermissionResolver>(PERMISSION_RESOLVER_TOKEN);
		const context = async (erp: ErpContext): Promise<TLicenseContext> => {
			const roles = erp.member.role.split(',').map((role) => role.trim());
			const canReadKeys = await permissions.hasPermission(erp.organizationId, roles, { license: ['read_key'] });
			return { actorUserId: erp.session.user.id, canReadKeys };
		};
		const id = (params: unknown) => idParamSchema.parse(params).id;

		return domainPlugin({ name: 'licensing', prefix: '/licenses', tags: ['Licensing'], guards: 'erp' })
			.get(
				'/applications',
				async ({ query }) => ok(await service.listApplications(applicationListQuerySchema.parse(query).includeRetired)),
				{ erp: { permission: ['license:read'] }, detail: { description: 'Licensable applications (active, or all)' } },
			)
			.post(
				'/applications',
				async ({ body, erp, status }) =>
					status(201, created(await service.createApplication(await context(erp), applicationBodySchema.parse(body)))),
				{ erp: { permission: ['license:create'] }, detail: { description: 'Adds a licensable application' } },
			)
			.put('/applications/:id', async ({ params, body }) => ok(await service.updateApplication(id(params), applicationBodySchema.parse(body))), {
				erp: { permission: ['license:create'] },
				detail: { description: 'Edits a licensable application' },
			})
			.post('/applications/:id/retire', async ({ params }) => ok(await service.setApplicationStatus(id(params), 'retired')), {
				erp: { permission: ['license:create'] },
				detail: { description: 'Retires an application (no new contracts)' },
			})
			.post('/applications/:id/restore', async ({ params }) => ok(await service.setApplicationStatus(id(params), 'active')), {
				erp: { permission: ['license:create'] },
				detail: { description: 'Makes a retired application available again' },
			})
			.get(
				'/applications/:id/api-keys',
				async ({ params, erp }) => ok(await api.listApiKeys(erp.organizationId, id(params))),
				{ erp: { permission: ['license:manage_api'] }, detail: { description: "An own application's machine keys (secrets never returned)" } },
			)
			.post(
				'/applications/:id/api-keys',
				async ({ params, body, erp, status }) =>
					status(
						201,
						created(
							await api.issueApiKey(
								{ actorUserId: erp.session.user.id, organizationId: erp.organizationId },
								id(params),
								apiKeyBodySchema.parse(body).name,
							),
						),
					),
				{ erp: { permission: ['license:manage_api'] }, detail: { description: 'Issues a machine key; the secret is in this response only' } },
			)
			.post(
				'/applications/:id/api-keys/:apiKeyId/revoke',
				async ({ params, erp }) => {
					const { id: applicationId, apiKeyId } = apiKeyParamSchema.parse(params);
					return ok(await api.revokeApiKey({ actorUserId: erp.session.user.id, organizationId: erp.organizationId }, applicationId, apiKeyId));
				},
				{ erp: { permission: ['license:manage_api'] }, detail: { description: 'Revokes a machine key for good' } },
			)
			.get('/events', async ({ query }) => okPaginated(await api.listEvents(eventListQuerySchema.parse(query))), {
				erp: { permission: ['license:read'] },
				detail: { description: 'License API calls and staff overrides, newest first' },
			})
			.get('/summary', async () => ok(await service.summary()), {
				erp: { permission: ['license:read'] },
				detail: { description: 'Active contracts ending soon and already ended (dashboard)' },
			})
			.get('', async ({ query }) => okPaginated(await service.list(contractListQuerySchema.parse(query))), {
				erp: { permission: ['license:read'] },
				detail: { description: 'License contracts; dueWithinDays lists the renewals due' },
			})
			.get('/:id', async ({ params, erp }) => ok(await service.get(await context(erp), id(params))), {
				erp: { permission: ['license:read'] },
				detail: { description: 'One contract with its keys (masked without license:read_key)' },
			})
			.post(
				'',
				async ({ body, erp, status }) => status(201, created(await service.create(await context(erp), contractBodySchema.parse(body)))),
				{ erp: { permission: ['license:create'] }, detail: { description: 'Creates a draft contract' } },
			)
			.put('/:id', async ({ params, body }) => ok(await service.update(id(params), contractBodySchema.parse(body))), {
				erp: { permission: ['license:create'] },
				detail: { description: 'Edits a draft contract' },
			})
			.post('/:id/activate', async ({ params, erp }) => ok(await service.activate(await context(erp), id(params))), {
				erp: { permission: ['license:activate'] },
				detail: { description: 'draft → active (a renewal marks the old contract renewed)' },
			})
			.post(
				'/:id/suspend',
				async ({ params, body, erp }) => ok(await service.suspend(await context(erp), id(params), optionalReasonSchema.parse(body ?? {}).reason ?? null)),
				{
					erp: { permission: ['license:activate'] },
					detail: { description: 'active → suspended (optional reason, logged)' },
				},
			)
			.post('/:id/reactivate', async ({ params, erp }) => ok(await service.reactivate(await context(erp), id(params))), {
				erp: { permission: ['license:activate'] },
				detail: { description: 'suspended → active' },
			})
			.post(
				'/:id/terminate',
				async ({ params, body, erp }) => ok(await service.terminate(await context(erp), id(params), reasonSchema.parse(body).reason)),
				{ erp: { permission: ['license:revoke'] }, detail: { description: 'Terminates with a reason' } },
			)
			.post('/:id/renew', async ({ params, erp, status }) => status(201, created(await service.renew(await context(erp), id(params)))), {
				erp: { permission: ['license:extend'] },
				detail: { description: 'Drafts the renewal for the next period' },
			})
			.post(
				'/:id/keys',
				async ({ params, body, erp, status }) =>
					status(201, created(await service.addKey(await context(erp), id(params), keyBodySchema.parse(body)))),
				{ erp: { permission: ['license:create'] }, detail: { description: 'Adds a key (generated for own applications when empty)' } },
			)
			.post(
				'/:id/activations/:activationId/release',
				async ({ params, erp }) => {
					const { id: contractId, activationId } = activationParamSchema.parse(params);
					return ok(await api.releaseSeat(erp.session.user.id, contractId, activationId));
				},
				{ erp: { permission: ['license:revoke'] }, detail: { description: "Releases an installation's seat" } },
			)
			.post(
				'/:id/keys/:keyId/revoke',
				async ({ params, body, erp }) => {
					const { id: contractId, keyId } = keyParamSchema.parse(params);
					return ok(await service.revokeKey(await context(erp), contractId, keyId, reasonSchema.parse(body).reason));
				},
				{ erp: { permission: ['license:revoke'] }, detail: { description: 'Revokes a key with a reason' } },
			);
	}
}
