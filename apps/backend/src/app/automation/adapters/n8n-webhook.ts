import { createHmac } from 'node:crypto';
import { appConfig } from '@config/providers/config';
import type { IWebhookClient, TDeliveryResult, TOutboxEnvelope } from '../contracts/outbox.contract';

const TIMEOUT_MS = 10_000;

/** `sha256=<hex>` of `<timestamp>.<body>` with the shared secret. */
export function signature(secret: string, timestamp: string, body: string): string {
	return `sha256=${createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex')}`;
}

/**
 * POSTs ERP events to the n8n webhook (M04). Headers: `X-Erp-Event-Id`
 * (dedupe key), `X-Erp-Event-Type`, `X-Erp-Timestamp` (unix ms) and
 * `X-Erp-Signature` (`sha256=` HMAC of `timestamp.body`). The URL and the
 * secret come from server config and are never logged.
 */
export class N8nWebhookClient implements IWebhookClient {
	constructor(
		private readonly config: { url: string | null; secret: string | null } = {
			url: appConfig.integrations.n8nWebhookUrl,
			secret: appConfig.integrations.n8nWebhookSecret,
		},
		private readonly fetcher: typeof fetch = fetch,
	) {}

	get configured(): boolean {
		return Boolean(this.config.url && this.config.secret);
	}

	async deliver(envelope: TOutboxEnvelope): Promise<TDeliveryResult> {
		const { url, secret } = this.config;
		if (!url || !secret) return { kind: 'notConfigured' };
		const body = JSON.stringify(envelope);
		const timestamp = String(Date.now());
		try {
			const response = await this.fetcher(url, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'X-Erp-Event-Id': envelope.id,
					'X-Erp-Event-Type': envelope.topic,
					'X-Erp-Timestamp': timestamp,
					'X-Erp-Signature': signature(secret, timestamp, body),
				},
				body,
				signal: AbortSignal.timeout(TIMEOUT_MS),
			});
			if (response.ok) return { kind: 'delivered', status: response.status };
			const text = (await response.text().catch(() => '')).slice(0, 300);
			return { kind: 'rejected', status: response.status, error: text || response.statusText };
		} catch (error) {
			// Never echo the URL: it may carry a token.
			const name = error instanceof Error ? error.name : 'Error';
			return { kind: 'unreachable', error: name === 'TimeoutError' ? 'Timed out after 10 s' : `${name}: the webhook could not be reached` };
		}
	}
}
