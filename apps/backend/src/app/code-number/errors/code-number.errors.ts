/**
 * Domain errors surfaced by the code-number service.
 *
 * @remarks
 * Each error carries a locale **key** rather than translated prose; the
 * controller resolves it against the request's `Accept-Language`.
 */
import { AppError } from '@http/errors';
import type { ApiKey } from '@providers/i18n/translator';
import type { TPatternProblem } from '../domain/code-number';

/** Numbers need the company profile (its document code). */
export class CompanyProfileRequiredError extends AppError {
	constructor() {
		super(422, 'company.profileRequired', 'Fill in the company profile first');
	}
}

/** The code type has no numbering series. */
export class UnknownCodeTypeError extends AppError {
	constructor() {
		super(404, 'numbering.unknownCodeType', 'Unknown code type');
	}
}

/** A numbering pattern the owner typed is not valid (first problem reported). */
export class NumberingPatternError extends AppError {
	constructor(problem: TPatternProblem) {
		super(
			422,
			`numbering.pattern.${problem.code}` as ApiKey,
			`Invalid numbering pattern: ${problem.code}`,
			problem.params,
		);
	}
}
