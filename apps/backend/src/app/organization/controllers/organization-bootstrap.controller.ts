import { container } from 'tsyringe';
import { requireGlobalAdmin } from '@authorization/require-global-admin';
import { domainPlugin } from '@http/plugin';
import { errorEnvelope, created } from '@http/response';
import { translator } from '@providers/i18n/translator';
import { createOrganizationSchema } from '../contracts/organization.contract';
import { ORGANIZATION_SERVICE_TOKEN } from '../constants/di';
import { OrganizationAlreadyExistsError } from '../errors/organization.errors';
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
 * @throws 409 Always: the ERP uses a single company (K12, M12-2)
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
		})
			.onError({ as: 'local' }, (ctx) => {
				const { error, set } = ctx;
				if (error instanceof OrganizationAlreadyExistsError) {
					const t = translator(ctx);
					set.status = 409;
					return errorEnvelope(409, t('common.conflict'), [
						{ message: t(error.key) },
					]);
				}
				return undefined;
			})
			.post(
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
							'Closed route. This ERP uses a single company (K12), so creating an organization always answers 409; the first organization is provisioned by the seeder.',
					},
				},
			);
	}
}
