import type { TLetterheadSelect } from '@drizzle/schemas/company.schema';
import { documentImageUrl, storeDocumentImage } from '@providers/s3/document-image';
import { type IObjectStorage, OBJECT_STORAGE_TOKEN } from '@providers/s3/object-storage';
import { inject, injectable } from 'tsyringe';
import { LETTERHEAD_REPOSITORY_TOKEN } from '../constants/di';
import type { ILetterheadRepository } from '../contracts/company.repository.interface';
import {
	LETTERHEAD_IMAGE_MAX_PX,
	type TLetterheadCreate,
	type TLetterheadImageKind,
	type TLetterheadPatch,
	type TLetterheadView,
} from '../contracts/letterhead.contract';
import { LetterheadNotFoundError } from '../errors/company.errors';

/** Stores one letterhead image under a fresh key (`company/letterhead/<uuid>.webp`). */
export function storeLetterheadImage(storage: IObjectStorage, file: File): Promise<string> {
	return storeDocumentImage(storage, 'company/letterhead', file, { maxSize: LETTERHEAD_IMAGE_MAX_PX });
}

export function toLetterheadView(row: TLetterheadSelect, storage: IObjectStorage): TLetterheadView {
	return {
		id: row.id,
		name: row.name,
		isDefault: row.isDefault,
		headerUrl: documentImageUrl(storage, row.headerObjectKey),
		footerUrl: documentImageUrl(storage, row.footerObjectKey),
		updatedAt: row.updatedAt,
	};
}

/**
 * Letterhead (kop surat) template use cases (ERP-0165).
 *
 * @remarks
 * Readable by every organization member, like the company profile, because
 * every print needs it; managed with `company:update`. Images get a fresh
 * key on every upload and old objects are kept, so a document printed with an
 * earlier image, or with a letterhead deleted since, still prints. The first
 * letterhead becomes the default. Other modules go through
 * `ExportedCompanyService`, never this class.
 */
@injectable()
export class LetterheadService {
	constructor(
		@inject(LETTERHEAD_REPOSITORY_TOKEN)
		private readonly letterheads: ILetterheadRepository,
		@inject(OBJECT_STORAGE_TOKEN)
		private readonly storage: IObjectStorage,
	) {}

	private view(row: TLetterheadSelect): TLetterheadView {
		return toLetterheadView(row, this.storage);
	}

	async list(): Promise<TLetterheadView[]> {
		return (await this.letterheads.findAll()).map((row) => this.view(row));
	}

	/** @throws {LetterheadNotFoundError} */
	async get(id: string): Promise<TLetterheadView> {
		const row = await this.letterheads.findLive(id);
		if (!row) throw new LetterheadNotFoundError();
		return this.view(row);
	}

	/** Uploads a new letterhead; the first one is the default whatever was asked. */
	async create(
		input: TLetterheadCreate,
		images: { header: File; footer: File | null },
		actorUserId: string,
	): Promise<TLetterheadView> {
		const [headerObjectKey, footerObjectKey] = await Promise.all([
			storeLetterheadImage(this.storage, images.header),
			images.footer ? storeLetterheadImage(this.storage, images.footer) : null,
		]);
		const isDefault = input.isDefault || !(await this.letterheads.findDefault());
		const row = await this.letterheads.create({
			name: input.name,
			headerObjectKey,
			footerObjectKey,
			isDefault,
			updatedBy: actorUserId,
		});
		return this.view(row);
	}

	/**
	 * Renames it or makes it the default. `isDefault: false` on the default is
	 * allowed and leaves no default: prints then use the generated header.
	 *
	 * @throws {LetterheadNotFoundError}
	 */
	async update(id: string, patch: TLetterheadPatch, actorUserId: string): Promise<TLetterheadView> {
		const row = await this.letterheads.update(id, { ...patch, updatedBy: actorUserId });
		if (!row) throw new LetterheadNotFoundError();
		return this.view(row);
	}

	/**
	 * Replaces the header or footer image, or (`null`) removes the footer. The
	 * header cannot be removed: a letterhead without one is not a letterhead.
	 *
	 * @throws {LetterheadNotFoundError}
	 */
	async setImage(id: string, kind: TLetterheadImageKind, file: File | null, actorUserId: string): Promise<TLetterheadView> {
		if (!(await this.letterheads.findLive(id))) throw new LetterheadNotFoundError();
		const key = file ? await storeLetterheadImage(this.storage, file) : null;
		const row = await this.letterheads.update(
			id,
			kind === 'header' ? { headerObjectKey: key!, updatedBy: actorUserId } : { footerObjectKey: key, updatedBy: actorUserId },
		);
		if (!row) throw new LetterheadNotFoundError();
		return this.view(row);
	}

	/** Soft-deletes it; documents that picked it still print with it. @throws {LetterheadNotFoundError} */
	async remove(id: string, actorUserId: string): Promise<void> {
		if (!(await this.letterheads.softDelete(id, actorUserId))) throw new LetterheadNotFoundError();
	}
}
