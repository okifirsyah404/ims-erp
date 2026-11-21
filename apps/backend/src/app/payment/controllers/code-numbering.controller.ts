import { codeNumberingController } from '@shared/numbering/controller';
import { container } from 'tsyringe';
import { PAYMENT_NUMBERING_SERVICE_TOKEN } from '../constants/di';

/** `/payments/code-numberings`: the `payment.code_numberings` settings. */
export class PaymentCodeNumberingController {
	static plugin() {
		return codeNumberingController({
			name: 'payment-code-numbering',
			prefix: '/payments',
			tag: 'Payment',
			service: container.resolve(PAYMENT_NUMBERING_SERVICE_TOKEN),
		});
	}
}
