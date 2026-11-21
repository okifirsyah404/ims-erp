import { codeNumberingController } from '@shared/numbering/controller';
import { container } from 'tsyringe';
import { PROJECT_NUMBERING_SERVICE_TOKEN } from '../constants/di';

/** `/projects/code-numberings`: the `project.code_numberings` settings. */
export class ProjectCodeNumberingController {
	static plugin() {
		return codeNumberingController({
			name: 'project-code-numbering',
			prefix: '/projects',
			tag: 'Project',
			service: container.resolve(PROJECT_NUMBERING_SERVICE_TOKEN),
		});
	}
}
