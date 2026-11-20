import type { CustomerAddressKind, TCustomerAddressSelect } from '@drizzle/schemas/crm.schema';
import { z } from 'zod';

/** Customer addresses (ERP-0075). The portal manages kind `site`. */

export const CUSTOMER_SITE_MAX = 30;

const text = (max: number) => z.string().trim().min(1).max(max);
const phone = z
	.string()
	.trim()
	.min(6)
	.max(30)
	.regex(/^[0-9+()\-\s]+$/, 'Phone may only contain digits, spaces, +, -, ( )');

/** An installation site as the customer portal saves it (`CompanySite` without `id`). */
export const customerSiteSchema = z.object({
	name: text(120),
	address: text(500),
	picName: text(120),
	picPhone: phone,
	primary: z.boolean().optional(),
});

export type TCustomerSiteInput = z.output<typeof customerSiteSchema>;

export type TAddressWrite = {
	kind: CustomerAddressKind;
	label: string;
	addressLine: string;
	contactName: string;
	contactPhone: string;
	isPrimary: boolean;
};

export interface ICustomerAddressRepository {
	list(customerId: string, kind?: CustomerAddressKind): Promise<TCustomerAddressSelect[]>;
	/** Inserts; a primary one clears the other primaries of the same kind (one transaction). */
	create(customerId: string, data: TAddressWrite): Promise<TCustomerAddressSelect>;
	/** `null` when the address is not the customer's or is gone. */
	update(customerId: string, id: string, data: TAddressWrite): Promise<TCustomerAddressSelect | null>;
	/** `false` when the address is not the customer's or is gone. */
	softDelete(customerId: string, id: string): Promise<boolean>;
}
