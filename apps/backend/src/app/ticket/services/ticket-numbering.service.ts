import { EXPORTED_COMPANY_SERVICE_TOKEN } from '@app/company/constants/di';
import type { ExportedCompanyService } from '@app/company/services/exported-company.service';
import type { TTx } from '@drizzle/types';
import type { CodeType } from '@shared/numbering';
import { inject, injectable } from 'tsyringe';
import { TICKET_CODE_NUMBERING_REPOSITORY_TOKEN } from '../constants/di';
import type { TicketCodeNumberingRepository } from '../repositories/code-numbering.repository';

/** Issues the ticket codes (`ticket`) from `ticket.code_numberings`. */
@injectable()
export class TicketNumberingService {
	constructor(
		@inject(TICKET_CODE_NUMBERING_REPOSITORY_TOKEN)
		private readonly numberings: Pick<TicketCodeNumberingRepository, 'next'>,
		@inject(EXPORTED_COMPANY_SERVICE_TOKEN)
		private readonly company: Pick<ExportedCompanyService, 'requireDocumentCode'>,
	) {}

	/**
	 * @throws {CompanyProfileRequiredError} Before the company profile was first saved
	 */
	async next(codeType: CodeType, tx?: TTx, date: Date = new Date()): Promise<string> {
		return this.numberings.next(codeType, await this.company.requireDocumentCode(tx), date, tx);
	}
}
