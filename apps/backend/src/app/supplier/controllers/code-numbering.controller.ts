import { codeNumberingController } from '@shared/numbering/controller';
import { container } from 'tsyringe';
import { SUPPLIER_NUMBERING_SERVICE_TOKEN } from '../constants/di';

/** `/suppliers/code-numberings`: the `supplier.code_numberings` settings. */
export class SupplierCodeNumberingController {
	static plugin() {
		return codeNumberingController({
			name: 'supplier-code-numbering',
			prefix: '/suppliers',
			tag: 'Supplier',
			service: container.resolve(SUPPLIER_NUMBERING_SERVICE_TOKEN),
		});
	}
}
