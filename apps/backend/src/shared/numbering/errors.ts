/**
 * Domain errors of the shared code-numbering rules (ADR-0024 Q6).
 *
 * @remarks
 * Every module that owns a `<schema>.code_numberings` table raises these, so
 * they live beside the shared rules rather than in one module's `errors/`.
 * Each carries a locale key; the controller resolves it per request.
 */
import { AppError } from '@http/errors';
import type { ApiKey } from '@providers/i18n/translator';
import type { TPatternProblem } from './domain';

/** The code type is not one of the schema's numbering series. */
export class UnknownCodeTypeError extends AppError {
	constructor() {
		super(404, 'numbering.unknownCodeType', 'Unknown code type');
	}
}

/** A numbering pattern is not valid (the first problem is reported). */
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

/** The pattern uses `{ORG}` but the number is issued without an organization. */
export class OrganizationRequiredForCodeError extends AppError {
	constructor() {
		super(
			422,
			'numbering.organizationRequired',
			'The numbering pattern uses {ORG} but no organization was given',
		);
	}
}

/** The rendered code does not fit the column it is stored in. */
export class GeneratedCodeTooLongError extends AppError {
	constructor(code: string, max: number) {
		super(422, 'numbering.codeTooLong', `Generated code exceeds ${max} characters`, {
			code,
			max,
		});
	}
}
