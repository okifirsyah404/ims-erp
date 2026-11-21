import { codeNumberingController } from '@shared/numbering/controller';
import { container } from 'tsyringe';
import { FINANCE_NUMBERING_SERVICE_TOKEN } from '../constants/di';

/** `/finance/code-numberings`: the `finance.code_numberings` settings. */
export class FinanceCodeNumberingController {
	static plugin() {
		return codeNumberingController({
			name: 'finance-code-numbering',
			prefix: '/finance',
			tag: 'Finance',
			service: container.resolve(FINANCE_NUMBERING_SERVICE_TOKEN),
		});
	}
}
