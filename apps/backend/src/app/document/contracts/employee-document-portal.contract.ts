import { z } from 'zod';

/**
 * Request schemas of the employee portal's document routes.
 *
 * @remarks
 * The portal never issues or edits documents: it lists the ones addressed to
 * the caller and lets them sign. Signing carries the optional signature image
 * and typed name the existing signature flow already accepts.
 */
const page = {
	page: z.coerce.number().int().min(1).default(1),
	limit: z.coerce.number().int().min(1).max(100).default(20),
};

export const myDocumentListQuerySchema = z.object({
	...page,
	search: z
		.string()
		.trim()
		.max(200)
		.optional()
		.transform((value) => (value ? value : undefined)),
});

export const mySignatureRequestsQuerySchema = z.object({
	...page,
	status: z.enum(['pending', 'signed', 'declined', 'cancelled']).optional(),
});

export const signMyRequestSchema = z.object({
	/** Typed name; the server falls back to the account name. */
	signatureText: z
		.string()
		.trim()
		.max(200)
		.nullish()
		.transform((value) => (value ? value : null)),
	/** Optional drawn/scanned signature image. */
	image: z.instanceof(File).nullish(),
});

export const declineMyRequestSchema = z.object({
	reason: z
		.string()
		.trim()
		.max(500)
		.nullish()
		.transform((value) => (value ? value : null)),
});

export type TMyDocumentListQuery = z.output<typeof myDocumentListQuerySchema>;
export type TMySignatureRequestsQuery = z.output<typeof mySignatureRequestsQuerySchema>;
export type TSignMyRequest = z.output<typeof signMyRequestSchema>;
export type TDeclineMyRequest = z.output<typeof declineMyRequestSchema>;
