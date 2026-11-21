import { codeNumberingController } from '@shared/numbering/controller';
import { container } from 'tsyringe';
import { SALE_NUMBERING_SERVICE_TOKEN } from '../constants/di';

/** `/sales/code-numberings`: the `sale.code_numberings` settings. */
export class SaleCodeNumberingController {
	static plugin() {
		return codeNumberingController({
			name: 'sale-code-numbering',
			prefix: '/sales',
			tag: 'Sales',
			service: container.resolve(SALE_NUMBERING_SERVICE_TOKEN),
		});
	}
}
