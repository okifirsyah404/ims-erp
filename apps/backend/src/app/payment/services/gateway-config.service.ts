import { appConfig } from '@config/providers/config';
import type { TGatewayInsert, TGatewaySelect } from '@drizzle/schemas/payment.schema';
import { inject, injectable } from 'tsyringe';
import { GATEWAY_REPOSITORY_TOKEN } from '../constants/di';
import type { IGatewayRepository, TGatewayData } from '../contracts/gateway.repository.interface';
import type { IPaymentGateway } from '../contracts/payment-gateway.contract';
import { FakePaymentGateway } from '../adapters/fake-payment-gateway';
import { SingapayPaymentGateway } from '../adapters/singapay-payment-gateway';
import { XenditPaymentGateway } from '../adapters/xendit-payment-gateway';
import { GatewayNotFoundError, GatewaySecretKeyMissingError } from '../errors/payment-gateway.errors';
import { last4, openSecret, paymentSecretKey, sealSecret } from '../utils/secret-cipher';

/** A gateway as the API shows it: never the ciphertext, never the plaintext. */
export type TGatewayView = Omit<
	TGatewaySelect,
	'secretCiphertext' | 'secretIv' | 'secretTag' | 'webhookTokenCiphertext' | 'webhookTokenIv' | 'webhookTokenTag' | 'deletedAt'
> & {
	/** Whether an API secret is loaded, and its last four characters. */
	hasSecret: boolean;
	hasWebhookToken: boolean;
};

const toView = (row: TGatewaySelect): TGatewayView => {
	const {
		secretCiphertext,
		secretIv,
		secretTag,
		webhookTokenCiphertext,
		webhookTokenIv,
		webhookTokenTag,
		deletedAt: _deleted,
		...rest
	} = row;
	return {
		...rest,
		hasSecret: Boolean(secretCiphertext && secretIv && secretTag),
		hasWebhookToken: Boolean(webhookTokenCiphertext && webhookTokenIv && webhookTokenTag),
	};
};

/** What staff may set on a gateway; secrets are separate, write-only fields. */
export type TGatewayInput = {
	provider: 'xendit' | 'singapay' | 'fake';
	code: string;
	name: string;
	mode: 'sandbox' | 'live';
	config?: Record<string, unknown> | null;
	isActive?: boolean;
	/** Write-only: encrypted with `PAYMENT_SECRET_KEY` before it is stored. */
	secret?: string | null;
	/** Write-only: the provider's webhook verification token. */
	webhookToken?: string | null;
};

/**
 * Provider configuration of the payment gateways (ADR-0024 Q18).
 *
 * @remarks
 * Secrets are **write-only**: they enter here in clear text, are sealed with
 * AES-256-GCM under `PAYMENT_SECRET_KEY` and never leave again - the view
 * exposes `hasSecret` and `secretLast4` only. Adapters are built per row, so a
 * second gateway of the same provider (sandbox beside live) has its own
 * credentials. Nothing is read from the environment except the key itself.
 */
@injectable()
export class GatewayConfigService {
	constructor(@inject(GATEWAY_REPOSITORY_TOKEN) private readonly gateways: IGatewayRepository) {}

	private key(): Buffer {
		const raw = process.env.PAYMENT_SECRET_KEY;
		if (!raw) throw new GatewaySecretKeyMissingError();
		return paymentSecretKey(raw);
	}

	list(organizationId: string): Promise<TGatewayView[]> {
		return this.gateways.list(organizationId).then((rows) => rows.map(toView));
	}

	async get(organizationId: string, id: string): Promise<TGatewayView> {
		const row = await this.gateways.findById(organizationId, id);
		if (!row) throw new GatewayNotFoundError();
		return toView(row);
	}

	/** Creates a gateway; the first one of an organization becomes its default. */
	async create(organizationId: string, input: TGatewayInput, actorUserId: string): Promise<TGatewayView> {
		const sealed = input.secret ? sealSecret(input.secret, this.key()) : null;
		const token = input.webhookToken ? sealSecret(input.webhookToken, this.key()) : null;
		const existing = await this.gateways.list(organizationId);
		const data: TGatewayData = {
			organizationId,
			provider: input.provider,
			code: input.code,
			name: input.name,
			mode: input.mode,
			config: input.config ?? null,
			isActive: input.isActive ?? true,
			isDefault: existing.length === 0,
			secretCiphertext: sealed?.ciphertext ?? null,
			secretIv: sealed?.iv ?? null,
			secretTag: sealed?.tag ?? null,
			secretLast4: input.secret ? last4(input.secret) : null,
			webhookTokenCiphertext: token?.ciphertext ?? null,
			webhookTokenIv: token?.iv ?? null,
			webhookTokenTag: token?.tag ?? null,
			createdBy: actorUserId,
		};
		return toView(await this.gateways.create(data));
	}

	/** Updates the non-secret fields; secrets only change when a new one is given. */
	async update(organizationId: string, id: string, input: Partial<TGatewayInput>): Promise<TGatewayView> {
		const current = await this.gateways.findById(organizationId, id);
		if (!current) throw new GatewayNotFoundError();
		const patch: Partial<TGatewayInsert> = {
			name: input.name,
			mode: input.mode,
			config: input.config,
			isActive: input.isActive,
		};
		if (input.secret) {
			const sealed = sealSecret(input.secret, this.key());
			Object.assign(patch, {
				secretCiphertext: sealed.ciphertext,
				secretIv: sealed.iv,
				secretTag: sealed.tag,
				secretLast4: last4(input.secret),
				rotatedAt: new Date(),
			});
		}
		if (input.webhookToken) {
			const token = sealSecret(input.webhookToken, this.key());
			Object.assign(patch, {
				webhookTokenCiphertext: token.ciphertext,
				webhookTokenIv: token.iv,
				webhookTokenTag: token.tag,
			});
		}
		const row = await this.gateways.update(organizationId, id, patch);
		if (!row) throw new GatewayNotFoundError();
		return toView(row);
	}

	async setDefault(organizationId: string, id: string): Promise<TGatewayView> {
		const row = await this.gateways.setDefault(organizationId, id);
		if (!row) throw new GatewayNotFoundError();
		return toView(row);
	}

	/**
	 * Builds the live adapter of a gateway row.
	 *
	 * @throws {GatewaySecretKeyMissingError} When `PAYMENT_SECRET_KEY` is absent
	 */
	adapterOf(row: TGatewaySelect): IPaymentGateway {
		if (!row.secretCiphertext || !row.secretIv || !row.secretTag) throw new GatewaySecretKeyMissingError();
		const key = this.key();
		const secret = openSecret(
			{ ciphertext: row.secretCiphertext, iv: row.secretIv, tag: row.secretTag },
			key,
		);
		const webhookToken =
			row.webhookTokenCiphertext && row.webhookTokenIv && row.webhookTokenTag
				? openSecret(
						{
							ciphertext: row.webhookTokenCiphertext,
							iv: row.webhookTokenIv,
							tag: row.webhookTokenTag,
						},
						key,
					)
				: null;
		const config = (row.config ?? {}) as Record<string, string>;
		const baseUrl = config.baseUrl ?? appConfig.app.url ?? '';
		if (row.provider === 'xendit') {
			return new XenditPaymentGateway({
				baseUrl: baseUrl || 'https://api.xendit.co',
				secretKey: secret,
				callbackToken: webhookToken ?? '',
			});
		}
		if (row.provider === 'singapay') {
			return new SingapayPaymentGateway({
				baseUrl: baseUrl || 'https://sandbox-payment-b2b.singapay.id',
				partnerId: config.partnerId ?? '',
				clientId: config.clientId ?? '',
				clientSecret: secret,
				accountId: config.accountId ?? '',
				webhookPath: config.webhookPath ?? '/webhooks/singapay',
			});
		}
		return new FakePaymentGateway(secret);
	}

	/** The default active gateway of an organization, as a row. */
	findDefault(organizationId: string): Promise<TGatewaySelect | null> {
		return this.gateways.findDefault(organizationId);
	}

	/** The active gateway of a provider, for an inbound webhook. */
	findActiveByProvider(organizationId: string | null, provider: string): Promise<TGatewaySelect | null> {
		return this.gateways.findActiveByProvider(organizationId, provider);
	}
}
