/**
 * Request schemas for the serial-unit routes (ADR-0026).
 *
 * @remarks
 * The unit rows stayed in `inventory` (`item_serials`) while the product
 * master moved to `product`, so the unit bodies and filters moved here with
 * them. The routes are still nested under the product they describe.
 */
import { z } from 'zod';
import { SERIAL_STATUSES } from '@drizzle/schemas/inventory.schema';
import { inventoryPaginationSchema } from './pagination.contract';

/** List filter for units. */
export const unitListQuerySchema = inventoryPaginationSchema.extend({
	productId: z.uuid().optional(),
	status: z.enum(SERIAL_STATUSES).optional(),
	warehouseId: z.uuid().optional(),
});

/** Body for registering a unit. */
export const createUnitSchema = z
	.object({
		serialNumber: z.string().min(1),
		organizationId: z.string().min(1).nullable().optional(),
		status: z.enum(SERIAL_STATUSES).default('in_stock'),
		warehouseId: z.uuid().nullable().optional(),
		binId: z.uuid().nullable().optional(),
		assetTag: z.string().nullable().optional(),
		acquiredOn: z.iso.date().nullable().optional(),
		warrantyExpiresOn: z.iso.date().nullable().optional(),
		notes: z.string().nullable().optional(),
	})
	.strict();

/** Body for replacing a provisional serial. */
export const replaceSerialSchema = z
	.object({ serialNumber: z.string().min(1) })
	.strict();
