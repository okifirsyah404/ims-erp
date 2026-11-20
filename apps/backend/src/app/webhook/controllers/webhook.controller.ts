import { domainPlugin } from '@http/plugin';
import { ok } from '@http/response';
import { container } from 'tsyringe';
import { WEBHOOK_PROVIDERS } from '../contracts/webhook.contract';
import type { TWebhookOutcome } from '../contracts/webhook.contract';
import { WebhookService } from '../services/webhook.service';

/**
 * HTTP status of each outcome. `accepted` and `duplicate` are 200 so the
 * provider stops retrying; `ignored` is 200 (an authentic event this
 * deployment does not handle); `rejected` is 401 (bad signature or token).
 */
const STATUS: Record<TWebhookOutcome, 200 | 401> = {
	accepted: 200,
	duplicate: 200,
	ignored: 200,
	rejected: 401,
};

/**
 * Inbound provider calls (`/webhooks/<provider>`, ADR-0024 Q38).
 *
 * @remarks
 * Public: no session; authenticity is the owning module's signature or token
 * check. The raw body is captured (`parse: 'text'`) because Xendit, SingaPay
 * and WAHA sign exactly what they sent.
 */
export class WebhookController {
	/** @param prefix - The mount path, `/webhooks` by default. */
	static plugin(prefix = '/webhooks') {
		const service = container.resolve(WebhookService);

		return domainPlugin({ name: `webhook:${prefix}`, prefix, tags: ['Webhook'] }).post(
			'/:provider',
			async ({ params, request, body, set }) => {
				const provider = (params as { provider: string }).provider;
				if (!WEBHOOK_PROVIDERS.includes(provider as never) || !service.known(provider)) {
					set.status = 404;
					return ok({ outcome: 'unknown' });
				}
				const url = new URL(request.url);
				const outcome = await service.handle(provider, {
					provider,
					method: request.method,
					path: `${url.pathname}${url.search}`,
					headers: request.headers,
					rawBody: body,
				});
				set.status = STATUS[outcome];
				return ok({ outcome });
			},
			{
				parse: 'text',
				detail: {
					description: 'Verified provider notification; a replay is acknowledged without a second effect',
				},
			},
		);
	}
}
