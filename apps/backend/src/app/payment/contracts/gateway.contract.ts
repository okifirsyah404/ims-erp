import { z } from 'zod';
import { GATEWAY_MODES, GATEWAY_PROVIDERS } from '@drizzle/schemas/payment.schema';

/** Admin contracts of the payment gateways (`/admin/payments/gateways`, ADR-0024 Q18). */

const secretText = z.string().min(8).max(512);

export const gatewayCreateSchema = z.object({
	provider: z.enum(GATEWAY_PROVIDERS),
	code: z
		.string()
		.trim()
		.min(2)
		.max(32)
		.regex(/^[A-Za-z0-9_-]+$/, 'Letters, digits, dash and underscore only'),
	name: z.string().trim().min(2).max(120),
	mode: z.enum(GATEWAY_MODES).default('sandbox'),
	config: z.record(z.string(), z.unknown()).nullish().transform((v) => v ?? null),
	isActive: z.boolean().default(true),
	/** Write-only; encrypted with `PAYMENT_SECRET_KEY` before it is stored. */
	secret: secretText.optional(),
	/** Write-only; the provider's webhook verification token. */
	webhookToken: secretText.optional(),
});

export const gatewayUpdateSchema = z.object({
	name: z.string().trim().min(2).max(120).optional(),
	mode: z.enum(GATEWAY_MODES).optional(),
	config: z.record(z.string(), z.unknown()).nullish().optional(),
	isActive: z.boolean().optional(),
	secret: secretText.optional(),
	webhookToken: secretText.optional(),
});

export const gatewayIdParamSchema = z.object({ id: z.uuid() });

export type TGatewayCreateInput = z.output<typeof gatewayCreateSchema>;
export type TGatewayUpdateInput = z.output<typeof gatewayUpdateSchema>;
