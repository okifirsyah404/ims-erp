import { codeNumberingController } from '@shared/numbering/controller';
import { container } from 'tsyringe';
import { PRODUCT_NUMBERING_SERVICE_TOKEN } from '../constants/di';

/** `/products/code-numberings`: the `product.code_numberings` settings. */
export class ProductCodeNumberingController {
	static plugin() {
		return codeNumberingController({
			name: 'product-code-numbering',
			prefix: '/products',
			tag: 'Product',
			service: container.resolve(PRODUCT_NUMBERING_SERVICE_TOKEN),
		});
	}
}
