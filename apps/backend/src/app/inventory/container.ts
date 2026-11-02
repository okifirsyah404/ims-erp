import type { DependencyContainer } from 'tsyringe';
import { ItemRepository } from './repositories/item.repository';
import { SerialUnitRepository } from './repositories/serial-unit.repository';
import { ItemService } from './services/item.service';
import {
	ITEM_REPOSITORY_TOKEN,
	ITEM_SERVICE_TOKEN,
	SERIAL_UNIT_REPOSITORY_TOKEN,
} from './constants/di';

export * from './constants/di';

/**
 * Registers the inventory module's repositories and services.
 *
 * @remarks
 * Explicit `container.register` calls, matching every other domain in this
 * codebase — there is no decorator-based auto-registration.
 *
 * @param container - The tsyringe container to populate
 */
export function registerInventory(container: DependencyContainer): void {
	container.register(ITEM_REPOSITORY_TOKEN, { useClass: ItemRepository });
	container.register(SERIAL_UNIT_REPOSITORY_TOKEN, {
		useClass: SerialUnitRepository,
	});
	container.register(ITEM_SERVICE_TOKEN, { useClass: ItemService });
}
