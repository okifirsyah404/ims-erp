import { container } from 'tsyringe';
import { requireGlobalAdmin } from '@authorization/require-global-admin';
import { domainPlugin } from '@http/plugin';
import { created } from '@http/response';
import { createOrganizationSchema } from '../contracts/organization.contract';
import { ORGANIZATION_SERVICE_TOKEN } from '../constants/di';
import { OrganizationService } from '../services/organization.service';

/**
 * Organization creation boundary.
 *
 * @remarks
 * Split from
 * {@link import('./organization.controller').OrganizationController} because
 * creation must work WITHOUT an organization context: an application admin who
 * belongs to no organization has to be able to bootstrap the first one.
 * `erpGuard` would reject that caller with 403 before any role check, so this
 * plugin rides `sessionGuard` (session only) plus the
 * {@link requireGlobalAdmin} policy.
 *
 * Better Auth independently enforces the same rule through
 * `allowUserToCreateOrganization` and, because caller headers are forwarded,
 * activates the new organization for the creating session.
 *
 * @throws 400 When the body fails validation
 * @throws 401 When unauthenticated
 * @throws 403 When the caller is not an application administrator
 * @throws 409 When the slug is already taken
 */
export class OrganizationBootstrapController {
	/**
	 * Builds the Elysia plugin mounting `POST /organizations`.
	 *
	 * @returns An Elysia instance sharing the `/organizations` prefix
	 */
	static plugin() {
		const organizationService = container.resolve<OrganizationService>(
			ORGANIZATION_SERVICE_TOKEN,
		);

		return domainPlugin({
			name: 'organizations-bootstrap',
			prefix: '/organizations',
			tags: ['Organization'],
			guards: 'session',
		}).post(
			'',
			async ({ request, body, erp, status }) => {
				const result = await organizationService.createOrganization(
					request.headers,
					{ ...body, creatorUserId: erp.session.user.id },
					{
						userId: erp.session.user.id,
						email: erp.session.user.email,
						ip: request.headers.get('x-forwarded-for'),
						userAgent: request.headers.get('user-agent'),
					},
					erp.session.user.email,
				);
				return status(201, created(result));
			},
			{
				body: createOrganizationSchema,
				erpSession: { policy: requireGlobalAdmin },
				detail: {
					description:
						'Creates an organization owned by the calling application administrator. Multiple organizations are supported. Nested `users` attach at creation: existing active users join directly, unknown emails are invited (per-item isolated outcomes in the response).',
				},
			},
		);
	}
}
