import { codeNumberingController } from '@shared/numbering/controller';
import { container } from 'tsyringe';
import { TAX_NUMBERING_SERVICE_TOKEN } from '../constants/di';

/** `/taxes/code-numberings`: the `tax.code_numberings` settings. */
export class TaxCodeNumberingController {
	static plugin() {
		return codeNumberingController({
			name: 'tax-code-numbering',
			prefix: '/taxes',
			tag: 'Tax',
			service: container.resolve(TAX_NUMBERING_SERVICE_TOKEN),
		});
	}
}
