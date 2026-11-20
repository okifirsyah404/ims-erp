/**
 * Public website inquiry payloads. Shapes follow the website's fixed
 * contracts (`packages/api-client/src/services/
 * website.ts` and `rfq.ts`); the ERP adapts to them, not the reverse (ported unchanged in ADR-0011
 * step 3b).
 * Limits mirror the website's own form validation, so a valid website
 * submission always passes here.
 */
import { z } from 'zod';

const text = (max: number) => z.string().trim().min(1).max(max);
const optional = (max: number) =>
	z
		.string()
		.trim()
		.max(max)
		.optional()
		.transform((v) => (v ? v : undefined));
const phone = z
	.string()
	.trim()
	.min(6)
	.max(30)
	.regex(/^[0-9+()\-\s]+$/, 'Phone may only contain digits, spaces, +, -, ( )');
const email = z.email().max(254).transform((v) => v.toLowerCase());

export const RFQ_PROJECT_TYPES = [
	'new-installation',
	'upgrade',
	'multi-site',
	'government',
] as const;

export const rfqSubmissionSchema = z
	.object({
		company: z.object({
			name: optional(200),
			contactName: text(120),
			email,
			phone,
		}),
		project: z.object({
			siteName: optional(160),
			siteLocation: text(160),
			targetInstallation: optional(80),
			budgetRange: optional(120),
			type: z.enum(RFQ_PROJECT_TYPES),
		}),
		items: z
			.array(
				z.object({
					productSlug: text(120),
					quantity: z.number().int().min(1).max(999),
					options: z.record(z.string().max(120), z.string().max(500)).optional(),
				}),
			)
			.max(50),
		solutions: z.array(text(60)).max(6).optional(),
		notes: optional(2000),
		sendCopyToPortal: z.boolean().default(false),
		source: z.literal('web'),
	})
	.refine((v) => v.items.length > 0 || (v.solutions?.length ?? 0) > 0, {
		message: 'Add at least one product or software solution',
		path: ['items'],
	});

export const CONTACT_TOPICS = ['sales', 'support', 'partnership', 'careers'] as const;

export const contactMessageSchema = z.object({
	topic: z.enum(CONTACT_TOPICS),
	name: text(120),
	company: optional(160),
	email,
	phone: phone.optional(),
	message: text(3000),
	source: z.literal('web'),
});

export const DEMO_FORMATS = ['online', 'onsite', 'showroom'] as const;

export const demoRequestSchema = z.object({
	name: text(120),
	jobTitle: optional(120),
	email,
	whatsapp: phone,
	organisation: text(160),
	industry: optional(80),
	interests: z.array(text(60)).max(12).default([]),
	sites: optional(60),
	dailyEntries: optional(60),
	format: z.enum(DEMO_FORMATS),
	/** Business date (Asia/Jakarta), `YYYY-MM-DD`. */
	date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
	/** WIB, `HH:mm`. */
	time: z.string().regex(/^\d{2}:\d{2}$/),
	source: z.literal('web'),
});

/** Website limits: up to 10 files, 25 MB each, PDF / DWG / JPG / PNG. */
export const RFQ_ATTACHMENT_LIMITS = {
	maxFiles: 10,
	maxBytes: 25 * 1024 * 1024,
	extensions: /\.(pdf|dwg|jpe?g|png)$/i,
} as const;

/** Same rule as the website's idempotency keys (UUIDs in practice). */
export const idempotencyKeySchema = z
	.string()
	.trim()
	.min(8)
	.max(100)
	.regex(/^[A-Za-z0-9._:-]+$/);

export type TRfqSubmission = z.infer<typeof rfqSubmissionSchema>;
export type TContactMessage = z.infer<typeof contactMessageSchema>;
export type TDemoRequest = z.infer<typeof demoRequestSchema>;
