import { businessDateOf } from '@utils/business-date.util';
import { container } from 'tsyringe';
import { publicApiGuard } from '@authorization/public-api-auth';
import { requestBodyDoc } from '@http/openapi';
import { domainPlugin } from '@http/plugin';
import { ok } from '@http/response';
import { resolveLanguage, translator } from '@providers/i18n/translator';
import { PUBLIC_TRACKING_SERVICE_TOKEN } from '../constants/di';
import { portalOrderNumberParamSchema, publicTrackSchema } from '../contracts/portal.contract';
import { PortalNotFoundError, PublicTrackingRateLimitedError } from '../errors/portal.errors';
import type { TPresenter } from '../utils/portal-presenter';
import { publicOrderStatus, publicTracking } from '../utils/tracking-presenter';

function presenter(ctx: unknown): TPresenter {
	const { request } = ctx as { request: Request };
	return { t: translator(ctx), language: resolveLanguage(request.headers.get('accept-language')), today: businessDateOf(), now: new Date() };
}

/** Sales order numbers contain `/`; the caller URL-encodes them. */
function orderNumberOf(params: unknown): string {
	const parsed = portalOrderNumberParamSchema.safeParse(params);
	if (!parsed.success) throw new PortalNotFoundError();
	try {
		return decodeURIComponent(parsed.data.orderNumber);
	} catch {
		throw new PortalNotFoundError();
	}
}

/**
 * Public order tracking (`/public/v1/orders`, ERP-0073).
 *
 * - `GET /:orderNumber/status` - the customer portal's sign-in-free lookup:
 *   no key, minimal status only (no customer, prices or addresses), 30
 *   lookups per 10 minutes per client address.
 * - `POST /track` - the website's tracking page, with the website key: the
 *   full status when the email or phone matches the order; an unknown order
 *   and a wrong contact both answer 404.
 */
export class PublicTrackingController {
	static plugin() {
		const tracking = container.resolve(PUBLIC_TRACKING_SERVICE_TOKEN);

		return domainPlugin({ name: 'public-tracking', prefix: '/public/v1/orders', tags: ['Public Website'] })
			.get(
				'/:orderNumber/status',
				async (ctx) => {
					const client =
						ctx.request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || ctx.server?.requestIP(ctx.request)?.address || 'unknown';
					if (!(await tracking.allow(client))) throw new PublicTrackingRateLimitedError();
					const found = await tracking.lookup(orderNumberOf(ctx.params));
					if (!found) throw new PortalNotFoundError();
					return ok(publicOrderStatus(presenter(ctx), found));
				},
				{
					detail: {
						summary: 'Order status by number (portal)',
						description:
							'Minimal status of a sales order (URL-encoded number) for the customer portal sign-in-free lookup: no customer, prices or addresses. 404 unknown; 429 after 30 lookups in 10 minutes from one address.',
					},
				},
			)
			.use(publicApiGuard())
			.post(
				'/track',
				async (ctx) => {
					const input = publicTrackSchema.parse(ctx.body);
					const found = await tracking.track(input.orderNumber, input.contact);
					if (!found) throw new PortalNotFoundError();
					return ok(publicTracking(presenter(ctx), found));
				},
				{
					publicApi: true,
					detail: {
						summary: 'Track an order (website)',
						description:
							'Full status, timeline, items, totals and shipping of a sales order when contact is the email or the whole phone number on the order (website key). 404 for an unknown order and for a wrong contact alike.',
						...requestBodyDoc(publicTrackSchema),
					},
				},
			);
	}
}
