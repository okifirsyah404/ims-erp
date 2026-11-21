import { codeNumberingController } from '@shared/numbering/controller';
import { container } from 'tsyringe';
import { CUSTOMER_NUMBERING_SERVICE_TOKEN } from '../constants/di';

/** `/customers/code-numberings`: the `customer.code_numberings` settings. */
export class CustomerCodeNumberingController {
	static plugin() {
		return codeNumberingController({
			name: 'customer-code-numbering',
			prefix: '/customers',
			tag: 'Customer',
			service: container.resolve(CUSTOMER_NUMBERING_SERVICE_TOKEN),
		});
	}
}
