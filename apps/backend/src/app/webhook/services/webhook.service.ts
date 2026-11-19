import { EXPORTED_PAYMENT_WEBHOOK_SERVICE_TOKEN } from '@app/payment/constants/di';
import { EXPORTED_WHATSAPP_WEBHOOK_SERVICE_TOKEN } from '@app/automation/constants/di';
import { inject, injectable } from 'tsyringe';
import type {
	TWebhookDelivery,
	TWebhookHandler,
	TWebhookOutcome,
	WebhookProvider,
} from '../contracts/webhook.contract';

/**
 * Dispatches an inbound provider call to the module that owns it (ADR-0024
 * Q38).
 *
 * @remarks
 * A leaf by construction: it depends on two exported webhook facades and
 * nothing depends on it, so no service cycle can form. It does not verify
 * signatures, read tables or interpret a payload - each owning module does
 * that with its own secret and returns `accepted | duplicate | rejected |
 * ignored`, which the controller maps to HTTP.
 */
@injectable()
export class WebhookService {
	private readonly handlers: Record<WebhookProvider, TWebhookHandler>;

	constructor(
		@inject(EXPORTED_PAYMENT_WEBHOOK_SERVICE_TOKEN)
		private readonly payments: { handle(delivery: TWebhookDelivery): Promise<TWebhookOutcome> },
		@inject(EXPORTED_WHATSAPP_WEBHOOK_SERVICE_TOKEN)
		private readonly whatsapp: { handle(delivery: TWebhookDelivery): Promise<TWebhookOutcome> },
	) {
		this.handlers = {
			xendit: (delivery) => this.payments.handle({ ...delivery, provider: 'xendit' }),
			singapay: (delivery) => this.payments.handle({ ...delivery, provider: 'singapay' }),
			whatsapp: (delivery) => this.whatsapp.handle(delivery),
		};
	}

	/** Whether this deployment knows the provider. */
	known(provider: string): provider is WebhookProvider {
		return provider in this.handlers;
	}

	/** Hands one delivery to its owner. */
	handle(provider: WebhookProvider, delivery: TWebhookDelivery): Promise<TWebhookOutcome> {
		return this.handlers[provider](delivery);
	}
}
