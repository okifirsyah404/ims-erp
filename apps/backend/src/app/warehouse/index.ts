import Elysia from 'elysia';

import { WarehouseCodeNumberingController } from './controllers/code-numbering.controller';
import { WarehouseController } from './controllers/warehouse.controller';

export { registerWarehouse } from './container';

/**
 * Elysia instance mounting every warehouse controller.
 *
 * @remarks
 * `/warehouses/linked` mounts before the admin CRUD: both prefixes start
 * with `/warehouses`, and the linked read needs the `erp` guard, not the
 * session guard. Static segments win, but mounting first keeps the intent
 * obvious.
 */
export function warehouseModule() {
	return new Elysia({ name: 'warehouse' })
		// Static `/code-numberings` routes: settings of this module's series.
		.use(WarehouseCodeNumberingController.plugin())
		.use(WarehouseController.linkedPlugin())
		.use(WarehouseController.plugin());
}
