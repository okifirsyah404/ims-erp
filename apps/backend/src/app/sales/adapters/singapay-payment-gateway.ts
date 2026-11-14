import type { TGatewayPaymentStatus } from '@drizzle/schemas/sales.schema';
import { pinoLogger } from '@providers/logger/logger';
import { businessDateOf } from '@utils/business-date.util';
import type {
	IPaymentGateway,
	TCheckout,
	TCheckoutRequest,
	TGatewayEvent,
	TWebhookRequest,
} from '../contracts/payment-gateway.contract';
import { GatewayProviderError, GatewayWebhookUnauthorizedError } from '../errors/payment-gateway.errors';
import { canonicalJson, hmacHex, rupiahToMinor, safeEqual, sha256Hex } from '../utils/gateway-signature';

export type TSingapayConfig = {
	baseUrl: string;
	partnerId: string;
	clientId: string;
	clientSecret: string;
	accountId: string;
	webhookPath: string;
};

/** Webhooks older or newer than this are refused (replay window). */
export const SINGAPAY_WEBHOOK_TOLERANCE_MS = 5 * 60 * 1000;

type TEnvelope<T> = { status?: number; success?: boolean; data?: T; error?: { code?: number; message?: string } };

type TPaymentLinkWebhook = {
	data?: {
		transaction?: { reff_no?: string; status?: string; amount?: { value?: string | number } };
		payment?: { method?: string; additional_info?: { payment_link?: { reff_no?: string } } };
	};
};

function statusOf(status: string | undefined): TGatewayPaymentStatus {
	if (status === 'paid') return 'paid';
	if (status === 'expired') return 'expired';
	if (status === 'failed') return 'failed';
	return 'pending';
}

/**
 * SingaPay adapter (Payment Gateway API): Payment Link v2 as the hosted
 * checkout. Requests carry `X-PARTNER-ID` and a Bearer token from
 * `POST /api/v1.1/access-token/b2b` (signed HMAC-SHA512 over
 * `client_id_client_secret_YYYYMMDD`, Jakarta date), cached until shortly
 * before it expires. Webhooks are verified with HMAC-SHA512 over
 * `POST:path:token:sha256(key-sorted body):timestamp`, keyed with the client
 * secret, within a 5-minute window.
 */
export class SingapayPaymentGateway implements IPaymentGateway {
	readonly provider = 'singapay' as const;
	private token: { value: string; until: number } | null = null;

	constructor(
		private readonly config: TSingapayConfig,
		private readonly fetcher: typeof fetch = fetch,
		private readonly now: () => number = Date.now,
	) {}

	private async call<T>(path: string, init: { headers: Record<string, string>; body: unknown }): Promise<T> {
		let response: Response;
		try {
			response = await this.fetcher(`${this.config.baseUrl}${path}`, {
				method: 'POST',
				headers: {
					'X-PARTNER-ID': this.config.partnerId,
					Accept: 'application/json',
					'Content-Type': 'application/json',
					...init.headers,
				},
				body: JSON.stringify(init.body),
			});
		} catch (error) {
			pinoLogger.warn({ provider: 'singapay', error: String(error) }, '[payment-gateway] request failed');
			throw new GatewayProviderError();
		}
		const envelope = (await response.json().catch(() => ({}))) as TEnvelope<T>;
		if (!response.ok || envelope.success === false || !envelope.data) {
			pinoLogger.warn(
				{ provider: 'singapay', status: response.status, code: envelope.error?.code },
				'[payment-gateway] request refused',
			);
			throw new GatewayProviderError();
		}
		return envelope.data;
	}

	private async accessToken(): Promise<string> {
		if (this.token && this.token.until > this.now()) return this.token.value;
		const { clientId, clientSecret } = this.config;
		const day = businessDateOf(this.now()).replaceAll('-', '');
		const data = await this.call<{ access_token?: string; expires_in?: string | number }>(
			'/api/v1.1/access-token/b2b',
			{
				headers: {
					'X-CLIENT-ID': clientId,
					'X-Signature': hmacHex('sha512', clientSecret, `${clientId}_${clientSecret}_${day}`),
				},
				body: { grant_type: 'client_credentials' },
			},
		);
		if (!data.access_token) throw new GatewayProviderError();
		const seconds = Number(data.expires_in ?? 3600);
		// Renew a minute early so a request never carries an expiring token.
		this.token = { value: data.access_token, until: this.now() + Math.max(60, seconds - 60) * 1000 };
		return data.access_token;
	}

	async createCheckout(request: TCheckoutRequest): Promise<TCheckout> {
		const token = await this.accessToken();
		const data = await this.call<{ id?: number | string; payment_url?: string; expired_at?: string | null }>(
			`/api/v2.0/payment-link/${encodeURIComponent(this.config.accountId)}`,
			{
				headers: { Authorization: `Bearer ${token}` },
				body: {
					reff_no: request.reference,
					payment_link_type: 'total',
					total_amount: request.amountRupiah,
					description: request.description.slice(0, 255),
					expired_at: request.expiresAt.toISOString(),
					...(request.customer.name ? { customer_name: request.customer.name.slice(0, 100) } : {}),
					...(request.customer.email ? { customer_email: request.customer.email } : {}),
					...(request.customer.phone ? { customer_phone: request.customer.phone } : {}),
					...(request.successRedirectUrl ? { success_redirect_url: request.successRedirectUrl } : {}),
				},
			},
		);
		if (data.id == null || !data.payment_url) throw new GatewayProviderError();
		return {
			providerReference: String(data.id),
			paymentUrl: data.payment_url,
			expiresAt: data.expired_at ? new Date(data.expired_at) : request.expiresAt,
		};
	}

	/** The expected `X-Signature` of a webhook (exported for tests and the fake sender). */
	signWebhook(token: string, body: unknown, timestamp: string, method = 'POST'): string {
		const stringToSign = `${method}:${this.config.webhookPath}:${token}:${sha256Hex(canonicalJson(body))}:${timestamp}`;
		return hmacHex('sha512', this.config.clientSecret, stringToSign);
	}

	async parseWebhook(request: TWebhookRequest): Promise<TGatewayEvent | null> {
		const timestamp = request.headers.get('x-timestamp') ?? '';
		const token = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
		const seconds = Number(timestamp);
		if (
			!/^\d+$/.test(timestamp) ||
			Math.abs(this.now() - seconds * 1000) > SINGAPAY_WEBHOOK_TOLERANCE_MS ||
			!safeEqual(request.headers.get('x-signature'), this.signWebhook(token, request.body, timestamp, request.method.toUpperCase()))
		)
			throw new GatewayWebhookUnauthorizedError();

		const data = (request.body as TPaymentLinkWebhook | null)?.data;
		const reference = data?.payment?.additional_info?.payment_link?.reff_no;
		// Only payment-link events carry our reference; others share the URL.
		if (data?.payment?.method !== 'payment_link' || !reference || !data.transaction) return null;
		const status = statusOf(data.transaction.status);
		const paidMinor = status === 'paid' ? rupiahToMinor(data.transaction.amount?.value) : null;
		return {
			reference,
			status,
			paidAmountRupiah: paidMinor == null ? null : paidMinor / 100,
			// The payload's timestamps carry no zone; the verified delivery time is used.
			paidAt: status === 'paid' ? new Date(this.now()) : null,
			channel: null,
			method: 'bank_transfer',
			providerTransactionId: data.transaction.reff_no ?? null,
			raw: request.body,
		};
	}
}
