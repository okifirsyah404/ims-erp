import type { TGatewayPaymentStatus } from '@drizzle/schemas/payment.schema';
import type { ReceiptMethod } from '@drizzle/schemas/sales.schema';
import type {
	IPaymentGateway,
	TCheckout,
	TCheckoutRequest,
	TGatewayEvent,
	TWebhookRequest,
} from '../contracts/payment-gateway.contract';
import { GatewayWebhookUnauthorizedError } from '../errors/payment-gateway.errors';
import { canonicalJson, hmacHex, safeEqual } from '../utils/gateway-signature';

/** Body of a fake webhook: what a local tester posts. */
export type TFakeWebhookBody = {
	reference: string;
	status: TGatewayPaymentStatus;
	/** Whole rupiah. */
	amount?: number;
	channel?: string;
	method?: ReceiptMethod;
};

/**
 * Local stand-in provider (no sandbox accounts yet, 2026-11-14). Opens no
 * real checkout; its webhook is authenticated by `x-fake-signature` =
 * HMAC-SHA256(secret, key-sorted body). The registry refuses it in production.
 */
export class FakePaymentGateway implements IPaymentGateway {
	readonly provider = 'fake' as const;

	constructor(private readonly secret: string) {}

	async createCheckout(request: TCheckoutRequest): Promise<TCheckout> {
		return {
			providerReference: `fake-${request.reference}`,
			paymentUrl: `https://checkout.fake.invalid/${request.reference}`,
			expiresAt: request.expiresAt,
		};
	}

	sign(body: unknown): string {
		return hmacHex('sha256', this.secret, canonicalJson(body));
	}

	async parseWebhook(request: TWebhookRequest): Promise<TGatewayEvent | null> {
		if (!safeEqual(request.headers.get('x-fake-signature'), this.sign(request.body)))
			throw new GatewayWebhookUnauthorizedError();
		const body = request.body as Partial<TFakeWebhookBody> | null;
		if (!body?.reference || !body.status) return null;
		return {
			reference: body.reference,
			status: body.status,
			paidAmountRupiah: body.status === 'paid' ? (body.amount ?? null) : null,
			paidAt: body.status === 'paid' ? new Date() : null,
			channel: body.channel ?? null,
			method: body.method ?? 'bank_transfer',
			providerTransactionId: `fake-tx-${body.reference}`,
			raw: body,
		};
	}
}
