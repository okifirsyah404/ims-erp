import { appConfig } from '@config/providers/config';
import type { IWhatsappGateway } from '../contracts/whatsapp.contract';

const TIMEOUT_MS = 15_000;

/**
 * Sends WhatsApp text messages through WAHA (`POST /api/sendText`, M04 stage
 * 2). WAHA runs outside the ERP; its URL and API key come from server config
 * and are never logged or echoed in errors.
 */
export class WahaClient implements IWhatsappGateway {
	constructor(
		private readonly config: { url: string | null; apiKey: string | null; session: string } = {
			url: appConfig.integrations.wahaUrl,
			apiKey: appConfig.integrations.wahaApiKey,
			session: appConfig.integrations.wahaSession,
		},
		private readonly fetcher: typeof fetch = fetch,
	) {}

	get configured(): boolean {
		return Boolean(this.config.url && this.config.apiKey);
	}

	async sendText(chatId: string, text: string) {
		const { url, apiKey, session } = this.config;
		if (!url || !apiKey) return { ok: false as const, error: 'WAHA is not configured' };
		try {
			const response = await this.fetcher(`${url.replace(/\/+$/, '')}/api/sendText`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', 'X-Api-Key': apiKey },
				body: JSON.stringify({ session, chatId, text }),
				signal: AbortSignal.timeout(TIMEOUT_MS),
			});
			if (!response.ok) {
				const detail = (await response.text().catch(() => '')).slice(0, 200);
				return { ok: false as const, error: `WAHA answered ${response.status}${detail ? `: ${detail}` : ''}` };
			}
			const sent = (await response.json().catch(() => null)) as { id?: unknown; key?: { id?: unknown } } | null;
			const id = typeof sent?.id === 'string' ? sent.id : typeof sent?.key?.id === 'string' ? sent.key.id : null;
			return { ok: true as const, externalId: id ? id.slice(0, 128) : null };
		} catch (error) {
			const name = error instanceof Error ? error.name : 'Error';
			return { ok: false as const, error: name === 'TimeoutError' ? 'WAHA timed out after 15 s' : `${name}: WAHA could not be reached` };
		}
	}
}
