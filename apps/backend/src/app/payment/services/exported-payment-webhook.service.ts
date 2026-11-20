import { inject, injectable } from 'tsyringe';
import { GATEWAY_CHECKOUT_SERVICE_TOKEN } from '../constants/di';
import type { TWebhookDelivery, TWebhookOutcome } from '../contracts/payment-gateway.contract';
import type { GatewayCheckoutService } from './gateway-checkout.service';

/**
 * Payment's published webhook contract for the `webhook` module (ADR-0024 Q38).
 *
 * @remarks
 * The `webhook` module owns `/webhooks/<provider>`: it captures the raw body,
 * answers fast and maps the outcome to HTTP. It never decrypts a secret, never
 * reads a table and never decides a business outcome - that stays here. This
 * facade is allowed to depend on the full service because `webhook` is a leaf
 * (nothing depends on it).
 */
@injectable()
export class ExportedPaymentWebhookService {
	constructor(@inject(GATEWAY_CHECKOUT_SERVICE_TOKEN) private readonly checkouts: GatewayCheckoutService) {}

	/** Verifies and applies one provider notification; idempotent on replay. */
	handle(delivery: TWebhookDelivery): Promise<TWebhookOutcome> {
		return this.checkouts.handleWebhook(delivery);
	}
}
