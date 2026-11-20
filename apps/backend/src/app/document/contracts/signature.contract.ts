import {
	DOCUMENT_SIGNATURE_METHODS,
	SIGNATURE_REQUEST_STATUSES,
} from '@drizzle/schemas/document.schema';
import { z } from 'zod';

const optionalText = (max: number) =>
	z
		.string()
		.trim()
		.max(max)
		.nullish()
		.transform((value) => (value ? value : null));

/** Query of the signature evidence register. */
export const signatureListQuerySchema = z.object({
	page: z.coerce.number().int().min(1).default(1),
	limit: z.coerce.number().int().min(1).max(100).default(20),
	documentId: z.uuid().nullish(),
	method: z.enum(DOCUMENT_SIGNATURE_METHODS).nullish(),
});

export type TSignatureListQuery = z.output<typeof signatureListQuerySchema>;

/** Create signature requests: one row per signer, inserted as a batch. */
export const createSignatureRequestsSchema = z.object({
	documentId: z.uuid(),
	signerUserIds: z.array(z.string().min(1).max(64)).min(1).max(20),
	/** Message to every signer. */
	note: optionalText(1000).default(null),
	/** Overrides the `document.signature_request_expiry_days` setting; omit for none. */
	expiresAt: z.coerce.date().nullish(),
});

export type TCreateSignatureRequestsInput = z.output<typeof createSignatureRequestsSchema>;

/** Sign a request addressed to the caller. */
export const signRequestSchema = z.object({
	method: z.enum(DOCUMENT_SIGNATURE_METHODS).default('electronic'),
});

export type TSignSignatureRequestInput = z.output<typeof signRequestSchema>;

/** Decline a request addressed to the caller. */
export const declineSignatureRequestSchema = z.object({
	reason: z.string().trim().min(1).max(1000),
});

export type TDeclineSignatureRequestInput = z.output<typeof declineSignatureRequestSchema>;

/** Query of the requests addressed to or created by the caller. */
export const signatureRequestListQuerySchema = z.object({
	page: z.coerce.number().int().min(1).default(1),
	limit: z.coerce.number().int().min(1).max(100).default(20),
	/** `true` only returns live pending rows (expiry applied). */
	pendingOnly: z.coerce.boolean().nullish(),
});

export type TSignatureRequestListQuery = z.output<typeof signatureRequestListQuerySchema>;

/** Batch lookup of signers' images for the print layouts (D12). */
export const userImagesSchema = z.object({
	userIds: z.array(z.string().min(1).max(64)).min(1).max(50),
});

export type TUserImagesInput = z.output<typeof userImagesSchema>;

/** One signature request as the client sees it. */
export type TSignatureRequestView = {
	id: string;
	documentId: string;
	documentCode: string | null;
	documentTitle: string | null;
	documentType: string | null;
	/** Null when the requester was never recorded (ADR-0014). */
	requestedByUserId: string | null;
	requestedByName: string | null;
	/** Null when the signer was never recorded (ADR-0014); nobody can sign it. */
	signerUserId: string | null;
	signerName: string;
	status: (typeof SIGNATURE_REQUEST_STATUSES)[number];
	/** `pending` past `expiresAt` reads as `expired` without a write. */
	effectiveStatus: (typeof SIGNATURE_REQUEST_STATUSES)[number];
	note: string | null;
	declineReason: string | null;
	expiresAt: string | null;
	respondedAt: string | null;
	createdAt: string;
	/** Presigned snapshot of the signer's image, set when they signed with one. */
	signatureImageUrl?: string | null;
	/** The PDF the signature was placed on, once placement happened. */
	sourceFileId?: string | null;
	hasSignedPdf?: boolean;
};

/** One signature evidence row as the client sees it. */
export type TSignatureView = {
	id: string;
	documentId: string;
	documentCode: string | null;
	documentTitle: string | null;
	signerUserId: string | null;
	signerType: string;
	signerName: string;
	signedAt: string;
	method: (typeof DOCUMENT_SIGNATURE_METHODS)[number];
	ipAddress: string | null;
	/** Presigned signature image snapshot, or null when the user had none. */
	signatureImageUrl: string | null;
	/** The PDF this signature was placed on, when placement happened. */
	sourceFileId: string | null;
	/** True once the signed PDF artifact exists; placement is final. */
	hasSignedPdf: boolean;
};

/** Attach the signed PDF: the multipart `file` plus the source PDF id. */
export const attachSignedPdfSchema = z.object({
	sourceFileId: z.uuid(),
});

export type TAttachSignedPdfInput = z.output<typeof attachSignedPdfSchema>;

/** The Signatures tab of the document detail screen. */
export type TDocumentSignatureSection = {
	signatures: TSignatureView[];
	requests: TSignatureRequestView[];
};
