import {
	DOCUMENT_TYPES,
	type DocumentType,
	type ResetPolicy,
	type TDocumentSequenceSelect,
} from '@drizzle/schemas/organization.schema';
import type { TTx } from '@drizzle/types';
import { inject, injectable } from 'tsyringe';
import { COMPANY_PROFILE_REPOSITORY_TOKEN, DOCUMENT_SEQUENCE_REPOSITORY_TOKEN } from '../constants/di';
import type { ICompanyProfileRepository } from '../contracts/company-profile.repository.interface';
import type { IDocumentSequenceRepository } from '../contracts/document-sequence.repository.interface';
import {
	DOCUMENT_TYPE_CODES,
	DOCUMENT_TYPE_MODULES,
	PREVIEW_CONTEXT,
	type TNumberContext,
	defaultPattern,
	defaultResetPolicy,
	periodKey,
	renderNumber,
	validatePattern,
} from '../domain/document-number';
import {
	CompanyProfileRequiredError,
	NumberingPatternError,
	UnknownDocumentTypeError,
} from '../errors/organization.errors';

/** One numbering series as the settings page shows it. */
export type TNumberingSetting = {
	documentType: DocumentType;
	typeCode: string;
	pattern: string;
	resetPolicy: ResetPolicy;
	/** True when no override is stored (code defaults apply). */
	isDefault: boolean;
	/** The number the next document would get (not reserved). */
	nextNumber: string;
};

/** Effective pattern and reset policy of a series. */
function effective(documentType: DocumentType, row: TDocumentSequenceSelect | null) {
	return {
		pattern: row?.pattern ?? defaultPattern(documentType),
		resetPolicy: (row?.resetPolicy as ResetPolicy | null) ?? defaultResetPolicy(documentType),
		isDefault: !row?.pattern && !row?.resetPolicy,
	};
}

/**
 * Document numbering: pattern-driven, collision-safe series, one per
 * document type for the whole company (ADR-0011 §2).
 *
 * @remarks
 * Exported API for other modules: {@link NumberingService.next}. Issued
 * numbers are never recomputed, so editing a pattern only affects numbers
 * issued afterwards. Callers that must be gap-free (invoices, receipts)
 * call `next` only when the document is issued, inside their transaction.
 */
@injectable()
export class NumberingService {
	constructor(
		@inject(DOCUMENT_SEQUENCE_REPOSITORY_TOKEN)
		private readonly sequences: IDocumentSequenceRepository,
		@inject(COMPANY_PROFILE_REPOSITORY_TOKEN)
		private readonly profiles: Pick<ICompanyProfileRepository, 'findProfile'>,
	) {}

	private assertType(documentType: string): asserts documentType is DocumentType {
		if (!(DOCUMENT_TYPES as readonly string[]).includes(documentType)) {
			throw new UnknownDocumentTypeError();
		}
	}

	private assertValid(pattern: string, documentType: DocumentType) {
		const [problem] = validatePattern(pattern, documentType);
		if (problem) throw new NumberingPatternError(problem);
	}

	private async companyCode(tx?: TTx): Promise<string> {
		const profile = await this.profiles.findProfile(tx);
		if (!profile) throw new CompanyProfileRequiredError();
		return profile.documentCode;
	}

	/**
	 * Reserves and returns the next number of a document.
	 *
	 * @param tx - The caller's transaction, so a failed document rolls back
	 * its number too
	 * @param context - Document tokens ({SUPPLIER}, {CATEGORY}, {CUSTOMER})
	 */
	async next(
		documentType: DocumentType,
		options: { date?: Date; context?: TNumberContext; tx?: TTx } = {},
	): Promise<string> {
		const date = options.date ?? new Date();
		const row = await this.sequences.findByType(documentType, options.tx);
		const { pattern, resetPolicy } = effective(documentType, row);
		const companyCode = await this.companyCode(options.tx);
		const seq = await this.sequences.allocate(
			DOCUMENT_TYPE_MODULES[documentType],
			documentType,
			periodKey(resetPolicy, date),
			options.tx,
		);
		return renderNumber(pattern, {
			seq,
			typeCode: DOCUMENT_TYPE_CODES[documentType],
			companyCode,
			date,
			context: options.context,
		});
	}

	/** Renders what the next number would be, without reserving it. */
	private render(
		documentType: DocumentType,
		config: { pattern: string; resetPolicy: ResetPolicy },
		row: TDocumentSequenceSelect | null,
		companyCode: string,
		date = new Date(),
	): string {
		const key = periodKey(config.resetPolicy, date);
		return renderNumber(config.pattern, {
			seq: row && row.periodKey === key ? row.nextNumber : 1,
			typeCode: DOCUMENT_TYPE_CODES[documentType],
			companyCode,
			date,
			context: PREVIEW_CONTEXT,
		});
	}

	/** Previews a pattern the owner is typing (validated, nothing saved). */
	async preview(documentType: string, config: { pattern: string; resetPolicy: ResetPolicy }): Promise<string> {
		this.assertType(documentType);
		this.assertValid(config.pattern, documentType);
		const row = await this.sequences.findByType(documentType);
		return this.render(documentType, config, row, await this.companyCode());
	}

	async listSettings(): Promise<TNumberingSetting[]> {
		const rows = new Map((await this.sequences.findAll()).map((row) => [row.documentType, row]));
		const companyCode = await this.companyCode();
		return DOCUMENT_TYPES.map((documentType) => {
			const row = rows.get(documentType) ?? null;
			const config = effective(documentType, row);
			return {
				documentType,
				typeCode: DOCUMENT_TYPE_CODES[documentType],
				...config,
				nextNumber: this.render(documentType, config, row, companyCode),
			};
		});
	}

	async updateSetting(
		documentType: string,
		input: { pattern: string; resetPolicy: ResetPolicy },
		actorUserId: string,
	): Promise<TNumberingSetting> {
		this.assertType(documentType);
		const pattern = input.pattern.trim();
		this.assertValid(pattern, documentType);
		const companyCode = await this.companyCode();
		const row = await this.sequences.saveSettings(
			{
				module: DOCUMENT_TYPE_MODULES[documentType],
				documentType,
				pattern,
				resetPolicy: input.resetPolicy,
				updatedBy: actorUserId,
			},
			periodKey(input.resetPolicy, new Date()),
		);
		const config = { pattern, resetPolicy: input.resetPolicy };
		return {
			documentType,
			typeCode: DOCUMENT_TYPE_CODES[documentType],
			...config,
			isDefault: false,
			nextNumber: this.render(documentType, config, row, companyCode),
		};
	}
}
