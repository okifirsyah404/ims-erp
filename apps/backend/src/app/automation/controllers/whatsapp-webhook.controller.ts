import { domainPlugin } from '@http/plugin';
import { ok } from '@http/response';
import { container } from 'tsyringe';
import { WHATSAPP_SERVICE_TOKEN } from '../constants/di';

/**
 * Inbound WAHA webhook (`POST /integrations/whatsapp/webhook`, M04 stage 2).
 * No session: WAHA proves itself with `X-Webhook-Hmac` (HMAC-SHA512 of the
 * raw body). Answers at once; the assistant runs on the queue.
 */
export class WhatsappWebhookController {
	static plugin() {
		const service = container.resolve(WHATSAPP_SERVICE_TOKEN);

		return domainPlugin({ name: 'whatsapp-webhook', prefix: '/integrations/whatsapp', tags: ['WhatsApp'] }).post(
			'/webhook',
			async ({ body, request }) => ok(await service.receive(typeof body === 'string' ? body : '', request.headers.get('x-webhook-hmac'))),
			{ parse: 'text', detail: { description: 'WAHA message webhook (signed)' } },
		);
	}
}
