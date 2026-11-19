import type { MovementType } from '@drizzle/schemas/inventory.schema';

/**
 * Movement types that **decrease** stock. Every other type increases it.
 *
 * @remarks
 * This is the single place the direction of a movement type is decided. It lives
 * in its own module because both the repository (which sums the ledger in SQL)
 * and the service (which decides which way to apply a delta) need it, and
 * importing one from the other would create a cycle.
 *
 * A movement row stores an **unsigned** quantity; direction is a property of its
 * type, never of the number's sign. That is what makes `movements_quantity_check`
 * (`quantity <> 0`) meaningful and what stops a negative quantity from smuggling
 * an outbound move past an inbound guard.
 */
const OUTBOUND_TYPES = [
	'issue',
	'transfer_out',
	'adjustment_out',
	'return_out',
	'consumption',
	] as const satisfies readonly MovementType[];

/**
 * The outbound movement types, for callers that need to enumerate them.
 *
 * @remarks
 * Exported so the ledger's SQL (`IN (...)`) and the service's direction
 * decision are built from the same list — a duplicated literal is how the two
 * silently drift apart.
 */
export { OUTBOUND_TYPES };

/**
 * Whether a movement type removes stock from its warehouse.
 *
 * @param type - The stored type; widened to `string` because the column is
 *   `text` and an unrecognised value must read as inbound rather than crash
 */
export function isOutbound(type: string): boolean {
	return (OUTBOUND_TYPES as readonly string[]).includes(type);
}
