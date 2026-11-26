import { z } from 'zod';

/**
 * Letterhead (kop surat) templates (ERP-0165): uploaded header and optional
 * footer images that printed documents use in place of the generated header.
 */

/** Largest upload, in MB. A full-width banner is bigger than a logo. */
export const MAX_LETTERHEAD_IMAGE_MB = 5;

/** Longest side kept after normalising to WebP: A4 width at 300 dpi. */
export const LETTERHEAD_IMAGE_MAX_PX = 2480;

/** Images of a letterhead. */
export const LETTERHEAD_IMAGE_KINDS = ['header', 'footer'] as const;
export type TLetterheadImageKind = (typeof LETTERHEAD_IMAGE_KINDS)[number];

/** Multipart booleans arrive as text. */
const flag = z
	.union([z.boolean(), z.enum(['true', 'false'])])
	.transform((value) => value === true || value === 'true');

/** Text fields of the multipart create body; the images are read separately. */
export const letterheadCreateSchema = z.object({
	name: z.string().trim().min(1).max(100),
	isDefault: flag.optional().default(false),
});

export const letterheadPatchSchema = z
	.object({
		name: z.string().trim().min(1).max(100).optional(),
		isDefault: z.boolean().optional(),
	})
	.refine((value) => value.name !== undefined || value.isDefault !== undefined, 'Nothing to change');

export const letterheadIdParamsSchema = z.object({ id: z.uuid() });
export const letterheadImageParamsSchema = z.object({
	id: z.uuid(),
	kind: z.enum(LETTERHEAD_IMAGE_KINDS),
});

export type TLetterheadCreate = z.output<typeof letterheadCreateSchema>;
export type TLetterheadPatch = z.output<typeof letterheadPatchSchema>;

/** A letterhead as clients see it: inline image URLs, never object keys. */
export type TLetterheadView = {
	id: string;
	name: string;
	isDefault: boolean;
	/** Short-lived inline URL of the header image. */
	headerUrl: string | null;
	/** Short-lived inline URL of the footer image; `null` when there is none. */
	footerUrl: string | null;
	updatedAt: Date;
};

/**
 * What another module prints with: the images of a letterhead, even one that
 * was deleted after a document picked it.
 */
export type TLetterheadPrint = {
	id: string;
	name: string;
	headerUrl: string | null;
	footerUrl: string | null;
};
