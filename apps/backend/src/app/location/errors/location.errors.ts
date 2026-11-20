/**
 * Domain errors surfaced by the exported location service.
 *
 * @remarks
 * Carries a locale key rather than translated prose; the caller's controller
 * resolves it per request.
 */
import { AppError } from '@http/errors';

/** A `village_id` handed to an address write does not resolve. */
export class VillageNotFoundError extends AppError {
	constructor(villageId: string) {
		super(404, 'location.villageNotFound', 'Village not found', { villageId });
	}
}
