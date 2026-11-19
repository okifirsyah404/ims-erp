import { EXPORTED_COMPANY_SERVICE_TOKEN } from '@app/company/constants/di';
import type { ExportedCompanyService } from '@app/company/services/exported-company.service';
import type { TTx } from '@drizzle/types';
import type { CodeType } from '@shared/numbering';
import { inject, injectable } from 'tsyringe';
import { PAYMENT_CODE_NUMBERING_REPOSITORY_TOKEN } from '../constants/di';
import type { PaymentCodeNumberingRepository } from '../repositories/code-numbering.repository';

/** Issues the payment codes (`payment`) from `payment.code_numberings`. */
@injectable()
export class PaymentNumberingService {
	constructor(
		@inject(PAYMENT_CODE_NUMBERING_REPOSITORY_TOKEN)
		private readonly numberings: Pick<PaymentCodeNumberingRepository, 'next'>,
		@inject(EXPORTED_COMPANY_SERVICE_TOKEN)
		private readonly company: Pick<ExportedCompanyService, 'requireDocumentCode'>,
	) {}

	/**
	 * @throws {CompanyProfileRequiredError} Before the company profile was first saved
	 */
	async next(codeType: CodeType, options: { date?: Date; tx?: TTx } = {}): Promise<string> {
		return this.numberings.next(
			codeType,
			await this.company.requireDocumentCode(options.tx),
			options.date ?? new Date(),
			options.tx,
		);
	}
}
