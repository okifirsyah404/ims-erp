import { z } from 'zod';

/**
 * Request schema for BAST documents (`/projects/:id/basts`, ADR-0011 step
 * 6b). Business dates are Jakarta `YYYY-MM-DD` strings.
 */

const name = (max: number) => z.string().trim().min(1).max(max);
const optionalText = (max: number) =>
	z
		.string()
		.trim()
		.max(max)
		.nullish()
		.transform((value) => (value ? value : null));

export const documentItemSchema = z.object({
	description: z.string().trim().min(1).max(500),
	volume: z.string().trim().max(60),
	remarks: z.string().trim().max(300),
});

export const bastBodySchema = z.object({
	bastDate: z.iso.date(),
	firstPartyCompany: name(200),
	firstPartyName: name(120),
	firstPartyTitle: name(120),
	secondPartyCompany: name(200),
	secondPartyName: name(120),
	secondPartyTitle: name(120),
	contractNumber: optionalText(120),
	workTitle: name(300),
	projectName: optionalText(200),
	items: z.array(documentItemSchema).min(1).max(100),
	scope: z.array(name(300)).max(20),
});

export const bastParamSchema = z.object({ id: z.uuid(), handoverId: z.uuid() });

export type TBastBodyRequest = z.output<typeof bastBodySchema>;
