import type { SerialStatus } from '@drizzle/schemas/inventory.schema';

/**
 * Where a serial unit may move from each status (ADR-0009, ERP-0065).
 *
 * @remarks
 * Moved out of the Drizzle schema file: a transition table is a business rule,
 * not a persistence contract. The schema keeps the status vocabulary and its
 * CHECK; this table says which edges the service allows.
 */
export const SERIAL_STATUS_TRANSITIONS: Record<SerialStatus, SerialStatus[]> = {
	pre_order: ['in_stock', 'lost'],
	in_stock: ['sold', 'applied_warranty', 'lost', 'returned', 'damaged', 'issued'],
	lost: [],
	// ERP-0065: a customer return brings a sold unit back, sellable or not.
	sold: ['in_stock', 'damaged'],
	applied_warranty: ['in_stock', 'lost'],
	returned: [],
	damaged: ['in_stock', 'returned', 'lost'],
	// B-29: a manual stock issue takes a unit out; a manual receipt brings it back.
	issued: ['in_stock', 'lost'],
};
