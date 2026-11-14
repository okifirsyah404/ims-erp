import type { TGatewayProvider } from '@drizzle/schemas/sales.schema';
import { appConfig } from '@config/providers/config';
import { isProdLikeEnv } from '@config/providers/env';
import type { TPaymentGatewayConfig } from '@config/schemas/config.schema';
import { pinoLogger } from '@providers/logger/logger';
import type { IPaymentGateway, IPaymentGatewayRegistry } from '../contracts/payment-gateway.contract';
import { FakePaymentGateway } from './fake-payment-gateway';
import { SingapayPaymentGateway } from './singapay-payment-gateway';
import { XenditPaymentGateway } from './xendit-payment-gateway';

/**
 * The configured payment gateways (ERP-0020, ADR-0019). Every provider with
 * credentials is built so webhooks of checkouts opened before a provider
 * switch still settle; only `config.provider` opens new checkouts. The fake
 * provider is never built in production.
 */
export class PaymentGatewayRegistry implements IPaymentGatewayRegistry {
	private readonly gateways = new Map<TGatewayProvider, IPaymentGateway>();
	private readonly activeProvider: TGatewayProvider | null;
	readonly checkout: { expiryHours: number; successRedirectUrl: string | null };

	constructor(
		config: TPaymentGatewayConfig = appConfig.paymentGateway,
		env: string = appConfig.instance.env,
		fetcher: typeof fetch = fetch,
	) {
		if (config.xendit) this.gateways.set('xendit', new XenditPaymentGateway(config.xendit, fetcher));
		if (config.singapay) this.gateways.set('singapay', new SingapayPaymentGateway(config.singapay, fetcher));
		if (config.fake && !isProdLikeEnv(env)) this.gateways.set('fake', new FakePaymentGateway(config.fake.secret));
		this.activeProvider = config.provider ?? null;
		this.checkout = { expiryHours: config.expiryHours, successRedirectUrl: config.successRedirectUrl ?? null };
		if (this.activeProvider && !this.gateways.has(this.activeProvider))
			pinoLogger.warn(
				{ provider: this.activeProvider },
				'[payment-gateway] provider selected without credentials (or fake in production); online payment is off',
			);
	}

	active(): IPaymentGateway | null {
		return this.activeProvider ? (this.gateways.get(this.activeProvider) ?? null) : null;
	}

	get(provider: TGatewayProvider): IPaymentGateway | null {
		return this.gateways.get(provider) ?? null;
	}
}
