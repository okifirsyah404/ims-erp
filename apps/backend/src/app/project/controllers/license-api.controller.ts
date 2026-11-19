import { domainPlugin } from '@http/plugin';
import { ok } from '@http/response';
import { container } from 'tsyringe';
import { LICENSE_API_SERVICE_TOKEN } from '../constants/di';
import { activateBodySchema, deactivateBodySchema, validateBodySchema } from '../contracts/license-api.contract';

/** First address of `X-Forwarded-For` (set by the reverse proxy), else none. */
function clientIp(headers: Headers): string | null {
	return headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null;
}

/**
 * Machine license API for own applications (`/licensing/v1`, M03 stage 2).
 * Server-to-server: no session and no ERP role; every call sends the
 * application's key as `Authorization: Bearer elk_…` and can only reach keys
 * of that application. Validate always answers 200 with `valid` and
 * `status`; activate and deactivate refuse with 403 / 404 / 409.
 */
export class LicenseApiController {
	/**
	 * @param prefix - The machine API path: `/projects/api/v1/licenses` (primary) or the
	 * `/licensing/v1` alias installed apps still call (ADR-0024 Q34).
	 */
	static plugin(prefix = '/projects/api/v1/licenses') {
		const service = container.resolve(LICENSE_API_SERVICE_TOKEN);
		const client = (request: Request) => service.authenticate(request.headers.get('authorization'));

		return domainPlugin({ name: `licensing-api:${prefix}`, prefix, tags: ['License API'] })
			.post(
				'/validate',
				async ({ request, body }) =>
					ok(await service.validate(await client(request), validateBodySchema.parse(body), clientIp(request.headers))),
				{ detail: { description: 'Whether a license key may run (ok / grace = valid); with instanceId, also its seat' } },
			)
			.post(
				'/activate',
				async ({ request, body }) =>
					ok(await service.activate(await client(request), activateBodySchema.parse(body), clientIp(request.headers))),
				{ detail: { description: 'Takes a seat of the key for an installation (idempotent per instanceId)' } },
			)
			.post(
				'/deactivate',
				async ({ request, body }) =>
					ok(await service.deactivate(await client(request), deactivateBodySchema.parse(body), clientIp(request.headers))),
				{ detail: { description: "Releases the installation's seat" } },
			);
	}
}
