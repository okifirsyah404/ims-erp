import { z } from 'zod';

/**
 * Purchase term templates (ERP-0165): reusable payment terms, purchase terms
 * and notes that prefill a purchase order. The text may hold
 * `{{placeholders}}` (`@ims-erp/common` `PO_PLACEHOLDERS`).
 */

const optionalText = (max: number) =>
	z
		.string()
		.trim()
		.max(max)
		.nullish()
		.transform((value) => (value ? value : null));

/** Limits match the purchase order fields the template fills. */
export const purchaseTermTemplateBodySchema = z.object({
	name: z.string().trim().min(1).max(100),
	paymentTerms: optionalText(500),
	terms: optionalText(8000),
	notes: optionalText(4000),
	isDefault: z.boolean().optional().default(false),
});

export const purchaseTermTemplateParamsSchema = z.object({ id: z.uuid() });

export type TPurchaseTermTemplateBody = z.output<typeof purchaseTermTemplateBodySchema>;
