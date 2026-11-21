import { codeNumberingController } from '@shared/numbering/controller';
import { container } from 'tsyringe';
import { INVENTORY_NUMBERING_SERVICE_TOKEN } from '../constants/di';

/** `/inventory/code-numberings`: the `inventory.code_numberings` settings. */
export class InventoryCodeNumberingController {
	static plugin() {
		return codeNumberingController({
			name: 'inventory-code-numbering',
			prefix: '/inventory',
			tag: 'Inventory',
			service: container.resolve(INVENTORY_NUMBERING_SERVICE_TOKEN),
		});
	}
}
