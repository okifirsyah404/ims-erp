/**
 * Shared service base for the per-module numbering services (ADR-0024 Q6).
 *
 * @remarks
 * Not a module and not injectable on its own: each module's
 * `<Module>NumberingService` extends it, injects its own
 * `<schema>.code_numberings` repository and passes it up. That keeps the
 * request flow controller -> module service -> module repository while the
 * settings rules (validation, preview, effective pattern) exist once. The
 * company and organization collaborators are structural so this file never
 * imports another module.
 */
import type { TTx } from '@drizzle/types';

import {
	CODE_MAX_LENGTH,
	CODE_TYPE_CODES,
	CODE_TYPES_BY_SCHEMA,
	type CodeNumberingSchema,
	type CodeType,
	defaultPattern,
	defaultResetPolicy,
	PREVIEW_CONTEXT,
	PREVIEW_ORGANIZATION_CODE,
	periodKey,
	type ResetPolicy,
	renderNumber,
	type TNumberContext,
	usesOrganizationToken,
	validatePattern,
} from './domain';
import { NumberingPatternError, UnknownCodeTypeError } from './errors';
import type { CodeNumberingRepositoryBase } from './repository-base';

/** The repository surface the base needs. */
export type TCodeNumberingStore = Pick<
	CodeNumberingRepositoryBase,
	'next' | 'findAll' | 'findByType' | 'saveSettings'
>;

/** Reads the `{COMPANY}` token (the company module's exported facade). */
export type TCompanyCodeSource = {
	requireDocumentCode(tx?: TTx): Promise<string>;
};

/** Reads the `{ORG}` token (the organization module's exported facade). */
export type TOrganizationCodeSource = {
	requireOrganizationCode(organizationId: string): Promise<string>;
};

/** Pattern and reset policy an owner saves for one series. */
export type TCodeNumberConfig = { pattern: string; resetPolicy: ResetPolicy };

/** One numbering series as the settings page shows it. */
export type TCodeNumberSetting = {
	codeType: CodeType;
	/** The `{TYPE}` value, e.g. `QT`. */
	typeCode: string;
	pattern: string;
	resetPolicy: ResetPolicy;
	/** True when no override is stored (code defaults apply). */
	isDefault: boolean;
	/** The number the next document would get (not reserved). */
	nextNumber: string;
	/** Column length the rendered code must fit, when it is limited. */
	maxLength: number | null;
};

/** Options of {@link CodeNumberingServiceBase.issue}. */
export type TIssueOptions = {
	date?: Date;
	tx?: TTx;
	context?: TNumberContext;
	/** Issuing organization; required when the pattern uses `{ORG}`. */
	organizationId?: string | null;
};

type TRow = NonNullable<Awaited<ReturnType<TCodeNumberingStore['findByType']>>> | null;

function effective(codeType: CodeType, row: TRow) {
	return {
		pattern: row?.pattern ?? defaultPattern(codeType),
		resetPolicy: (row?.resetPolicy as ResetPolicy | null) ?? defaultResetPolicy(codeType),
		isDefault: !row?.pattern && !row?.resetPolicy,
	};
}

/**
 * Issuing plus the settings use cases of one `<schema>.code_numberings`.
 *
 * @remarks
 * Issued numbers are never recomputed, so a pattern change only affects
 * numbers issued afterwards. Previews never reserve a number.
 */
export abstract class CodeNumberingServiceBase {
	/** The schema whose code types this service owns. */
	protected abstract readonly schema: CodeNumberingSchema;

	constructor(
		protected readonly numberings: TCodeNumberingStore,
		protected readonly companyCodes: TCompanyCodeSource,
		protected readonly organizationCodes?: TOrganizationCodeSource,
	) {}

	/** The code types of this schema, in display order. */
	codeTypes(): readonly CodeType[] {
		return CODE_TYPES_BY_SCHEMA[this.schema];
	}

	/**
	 * Allocates and renders the next number of `codeType`.
	 *
	 * @throws {CompanyProfileRequiredError} Before the company profile was first saved
	 * @throws {OrganizationRequiredForCodeError} The pattern uses `{ORG}` without an organization
	 * @throws {GeneratedCodeTooLongError} The code does not fit its column
	 */
	protected async issue(codeType: CodeType, options: TIssueOptions = {}): Promise<string> {
		const { tx, organizationId } = options;
		return this.numberings.next(
			codeType,
			await this.companyCodes.requireDocumentCode(tx),
			options.date ?? new Date(),
			tx,
			options.context,
			organizationId && this.organizationCodes
				? () => this.organizationCodes!.requireOrganizationCode(organizationId)
				: undefined,
		);
	}

	/**
	 * Every series of this schema with its next number.
	 *
	 * @param organizationId - Active organization, for the `{ORG}` preview
	 */
	async listSettings(organizationId?: string | null): Promise<TCodeNumberSetting[]> {
		const rows = new Map((await this.numberings.findAll()).map((row) => [row.codeType, row]));
		const companyCode = await this.companyCodes.requireDocumentCode();
		const settings: TCodeNumberSetting[] = [];
		for (const codeType of this.codeTypes()) {
			const row = rows.get(codeType) ?? null;
			const config = effective(codeType, row);
			settings.push({
				codeType,
				typeCode: CODE_TYPE_CODES[codeType],
				...config,
				maxLength: CODE_MAX_LENGTH[codeType] ?? null,
				nextNumber: await this.render(codeType, config, row, companyCode, organizationId),
			});
		}
		return settings;
	}

	/**
	 * Renders a pattern the owner is typing; validates it, saves nothing.
	 *
	 * @throws {UnknownCodeTypeError} The code type is not one of this schema's
	 * @throws {NumberingPatternError} The pattern is not valid
	 */
	async previewSetting(
		codeType: string,
		config: TCodeNumberConfig,
		organizationId?: string | null,
	): Promise<string> {
		const owned = this.assertOwned(codeType);
		const pattern = config.pattern.trim();
		this.assertValid(pattern, owned);
		const row = await this.numberings.findByType(owned);
		return this.render(
			owned,
			{ pattern, resetPolicy: config.resetPolicy },
			row,
			await this.companyCodes.requireDocumentCode(),
			organizationId,
		);
	}

	/**
	 * Saves the pattern and reset policy of one series.
	 *
	 * @throws {UnknownCodeTypeError} The code type is not one of this schema's
	 * @throws {NumberingPatternError} The pattern is not valid
	 */
	async updateSetting(
		codeType: string,
		config: TCodeNumberConfig,
		actorUserId: string,
		organizationId?: string | null,
	): Promise<TCodeNumberSetting> {
		const owned = this.assertOwned(codeType);
		const pattern = config.pattern.trim();
		this.assertValid(pattern, owned);
		const companyCode = await this.companyCodes.requireDocumentCode();
		const row = await this.numberings.saveSettings(
			{ codeType: owned, pattern, resetPolicy: config.resetPolicy, updatedBy: actorUserId },
			periodKey(config.resetPolicy, new Date()),
		);
		const saved = { pattern, resetPolicy: config.resetPolicy };
		return {
			codeType: owned,
			typeCode: CODE_TYPE_CODES[owned],
			...saved,
			isDefault: false,
			maxLength: CODE_MAX_LENGTH[owned] ?? null,
			nextNumber: await this.render(owned, saved, row, companyCode, organizationId),
		};
	}

	private assertOwned(codeType: string): CodeType {
		if (!(this.codeTypes() as readonly string[]).includes(codeType)) {
			throw new UnknownCodeTypeError();
		}
		return codeType as CodeType;
	}

	private assertValid(pattern: string, codeType: CodeType): void {
		const [problem] = validatePattern(pattern, codeType);
		if (problem) throw new NumberingPatternError(problem);
	}

	/** What the next number would be, without reserving it. */
	private async render(
		codeType: CodeType,
		config: TCodeNumberConfig,
		row: TRow,
		companyCode: string,
		organizationId?: string | null,
		date = new Date(),
	): Promise<string> {
		const key = periodKey(config.resetPolicy, date);
		let organizationCode: string | undefined;
		if (usesOrganizationToken(config.pattern)) {
			organizationCode =
				organizationId && this.organizationCodes
					? await this.organizationCodes.requireOrganizationCode(organizationId)
					: PREVIEW_ORGANIZATION_CODE;
		}
		return renderNumber(config.pattern, {
			seq: row && row.periodKey === key ? Number(row.nextNumber) : 1,
			typeCode: CODE_TYPE_CODES[codeType],
			companyCode,
			organizationCode,
			date,
			context: PREVIEW_CONTEXT,
		});
	}
}
