/**
 * Public entry point of the supplier module.
 *
 * @remarks
 * Exports the composition-root registration and the exported service contract
 * so consumers only import from `@app/supplier`.
 */
import Elysia from 'elysia';

import { SupplierController } from './controllers/supplier.controller';

export { registerSupplier } from './container';
export { ExportedSupplierService } from './services/exported-supplier.service';
export type { TPurchaseSnapshot } from './services/exported-supplier.service';
export { EXPORTED_SUPPLIER_SERVICE_TOKEN } from './constants/di';

/** Elysia instance mounting the supplier controller. */
export function supplierModule() {
	return new Elysia({ name: 'supplier' }).use(SupplierController.plugin());
}

export { SupplierController };
