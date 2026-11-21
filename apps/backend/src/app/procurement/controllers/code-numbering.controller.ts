import { codeNumberingController } from '@shared/numbering/controller';
import { container } from 'tsyringe';
import { PROCUREMENT_NUMBERING_SERVICE_TOKEN } from '../constants/di';

/** `/procurement/code-numberings`: the `procurement.code_numberings` settings. */
export class ProcurementCodeNumberingController {
	static plugin() {
		return codeNumberingController({
			name: 'procurement-code-numbering',
			prefix: '/procurement',
			tag: 'Procurement',
			service: container.resolve(PROCUREMENT_NUMBERING_SERVICE_TOKEN),
		});
	}
}
