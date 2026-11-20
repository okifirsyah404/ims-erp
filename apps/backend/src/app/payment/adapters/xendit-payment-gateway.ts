import type { PaymentMethod } from '@drizzle/schemas/payment.schema';
import { pinoLogger } from '@providers/logger/logger';
import type {
	IPaymentGateway,
	TGatewayEventStatus,
	TCheckout,
	TCheckoutRequest,
	TGatewayEvent,
	TWebhookRequest,
} from '../contracts/payment-gateway.contract';
import { GatewayProviderError, GatewayWebhookUnauthorizedError } from '../errors/payment-gateway.errors';
import { safeEqual } from '../utils/gateway-signature';

export type TXenditConfig = { baseUrl: string; secretKey: string; callbackToken: string };

type TXenditInvoice = { id?: string; invoice_url?: string; expiry_date?: string };

type TXenditCallback = {
	id?: string;
	external_id?: string;
	status?: string;
	paid_amount?: number;
	paid_at?: string;
	payment_method?: string;
	payment_channel?: string;
	payment_id?: string;
};

/** Xendit `payment_method` → receipt method. */
const METHOD: Record<string, PaymentMethod> = {
	CREDIT_CARD: 'card',
	EWALLET: 'e_wallet',
	QR_CODE: 'e_wallet',
	RETAIL_OUTLET: 'cash',
};

/** Xendit invoice status → gateway payment status. */
function statusOf(status: string | undefined): TGatewayEventStatus {
	if (status === 'PAID' || status === 'SETTLED') return 'paid';
	if (status === 'EXPIRED') return 'expired';
	return 'pending';
}

/**
 * Xendit adapter: Invoice API (`POST /v2/invoices`, Basic auth with the secret
 * key) for the hosted checkout; invoice callbacks are authenticated by the
 * dashboard verification token Xendit echoes in `x-callback-token`.
 */
export class XenditPaymentGateway implements IPaymentGateway {
	readonly provider = 'xendit' as const;

	constructor(
		private readonly config: TXenditConfig,
		private readonly fetcher: typeof fetch = fetch,
	) {}

	async createCheckout(request: TCheckoutRequest): Promise<TCheckout> {
		const seconds = Math.max(60, Math.round((request.expiresAt.getTime() - Date.now()) / 1000));
		const body = {
			external_id: request.reference,
			amount: request.amountRupiah,
			currency: 'IDR',
			description: request.description,
			invoice_duration: seconds,
			...(request.customer.email ? { payer_email: request.customer.email } : {}),
			customer: {
				...(request.customer.name ? { given_names: request.customer.name } : {}),
				...(request.customer.email ? { email: request.customer.email } : {}),
				...(request.customer.phone ? { mobile_number: request.customer.phone } : {}),
			},
			...(request.successRedirectUrl ? { success_redirect_url: request.successRedirectUrl } : {}),
		};
		let response: Response;
		try {
			response = await this.fetcher(`${this.config.baseUrl}/v2/invoices`, {
				method: 'POST',
				headers: {
					Authorization: `Basic ${Buffer.from(`${this.config.secretKey}:`).toString('base64')}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(body),
			});
		} catch (error) {
			pinoLogger.warn({ provider: 'xendit', error: String(error) }, '[payment-gateway] request failed');
			throw new GatewayProviderError();
		}
		const data = (await response.json().catch(() => ({}))) as TXenditInvoice & { error_code?: string };
		if (!response.ok || !data.id || !data.invoice_url) {
			pinoLogger.warn({ provider: 'xendit', status: response.status, code: data.error_code }, '[payment-gateway] checkout refused');
			throw new GatewayProviderError();
		}
		return {
			providerReference: data.id,
			paymentUrl: data.invoice_url,
			expiresAt: data.expiry_date ? new Date(data.expiry_date) : null,
		};
	}

	async parseWebhook(request: TWebhookRequest): Promise<TGatewayEvent | null> {
		if (!safeEqual(request.headers.get('x-callback-token'), this.config.callbackToken))
			throw new GatewayWebhookUnauthorizedError();
		const body = (request.body ?? {}) as TXenditCallback;
		if (!body.external_id || !body.status) return null;
		const status = statusOf(body.status);
		return {
			reference: body.external_id,
			status,
			paidAmountRupiah: status === 'paid' ? (body.paid_amount ?? null) : null,
			paidAt: body.paid_at ? new Date(body.paid_at) : null,
			channel: body.payment_channel ?? null,
			method: METHOD[body.payment_method ?? ''] ?? 'bank_transfer',
			providerTransactionId: body.payment_id ?? body.id ?? null,
			raw: body,
		};
	}
}
