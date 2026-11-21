import { codeNumberingController } from '@shared/numbering/controller';
import { container } from 'tsyringe';
import { DOCUMENT_NUMBERING_SERVICE_TOKEN } from '../constants/di';

/** `/documents/code-numberings`: the `document.code_numberings` settings. */
export class DocumentCodeNumberingController {
	static plugin() {
		return codeNumberingController({
			name: 'document-code-numbering',
			prefix: '/documents',
			tag: 'Document',
			service: container.resolve(DOCUMENT_NUMBERING_SERVICE_TOKEN),
		});
	}
}
