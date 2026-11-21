import { codeNumberingController } from '@shared/numbering/controller';
import { container } from 'tsyringe';
import { HUMAN_RESOURCE_NUMBERING_SERVICE_TOKEN } from '../constants/di';

/** `/human-resources/code-numberings`: the `human_resource.code_numberings` settings. */
export class HumanResourceCodeNumberingController {
	static plugin() {
		return codeNumberingController({
			name: 'human-resource-code-numbering',
			prefix: '/human-resources',
			tag: 'Human Resource',
			service: container.resolve(HUMAN_RESOURCE_NUMBERING_SERVICE_TOKEN),
		});
	}
}
