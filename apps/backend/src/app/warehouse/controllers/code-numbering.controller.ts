import { codeNumberingController } from '@shared/numbering/controller';
import { container } from 'tsyringe';
import { WAREHOUSE_NUMBERING_SERVICE_TOKEN } from '../constants/di';

/** `/warehouses/code-numberings`: the `warehouse.code_numberings` settings. */
export class WarehouseCodeNumberingController {
	static plugin() {
		return codeNumberingController({
			name: 'warehouse-code-numbering',
			prefix: '/warehouses',
			tag: 'Warehouse',
			service: container.resolve(WAREHOUSE_NUMBERING_SERVICE_TOKEN),
			// Warehouses are application-admin-only (ADR-0008), so are their codes.
			appAdminOnly: true,
		});
	}
}
