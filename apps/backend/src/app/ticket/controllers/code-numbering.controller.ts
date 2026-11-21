import { codeNumberingController } from '@shared/numbering/controller';
import { container } from 'tsyringe';
import { TICKET_NUMBERING_SERVICE_TOKEN } from '../constants/di';

/** `/tickets/code-numberings`: the `ticket.code_numberings` settings. */
export class TicketCodeNumberingController {
	static plugin() {
		return codeNumberingController({
			name: 'ticket-code-numbering',
			prefix: '/tickets',
			tag: 'Ticket',
			service: container.resolve(TICKET_NUMBERING_SERVICE_TOKEN),
		});
	}
}
