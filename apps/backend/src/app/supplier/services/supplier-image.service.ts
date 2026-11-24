import type { TSupplierCompanySelect } from '@drizzle/schemas/supplier.schema';
import {
	documentImageUrl,
	storeDocumentImage,
} from '@providers/s3/document-image';
import { type IObjectStorage, OBJECT_STORAGE_TOKEN } from '@providers/s3/object-storage';
import { inject, injectable } from 'tsyringe';
import { SUPPLIER_COMPANY_REPOSITORY_TOKEN } from '../constants/di';
import type { ISupplierCompanyRepository } from '../contracts/supplier.repository.interface';
import { SupplierCompanyNotFoundError } from '../errors/supplier.errors';

/** A supplier company row with its photo as a signed URL (or `null`). */
export type TWithSupplierImage<T extends { imageObjectKey: string | null }> = T & {
	imageUrl: string | null;
};

/**
 * The single photo of a supplier company.
 *
 * @remarks
 * `companies.image_object_key` holds the object key; every read derives a
 * short-lived presigned URL from it. Uploads are normalised to WebP by
 * `storeDocumentImage`, and a replacement leaves the old key orphaned rather
 * than overwritten, so nothing that snapshotted it breaks.
 */
@injectable()
export class SupplierImageService {
	constructor(
		@inject(SUPPLIER_COMPANY_REPOSITORY_TOKEN)
		private readonly companies: Pick<
			ISupplierCompanyRepository,
			'findById' | 'setImageObjectKey'
		>,
		@inject(OBJECT_STORAGE_TOKEN)
		private readonly storage: IObjectStorage,
	) {}

	/** Replaces the row's photo with its signed URL. */
	withImageUrl<T extends { imageObjectKey: string | null }>(
		row: T,
	): TWithSupplierImage<T> {
		return {
			...row,
			imageUrl: documentImageUrl(this.storage, row.imageObjectKey),
		};
	}

	/**
	 * Uploads (`file`) or removes (`null`) the photo.
	 *
	 * @throws {SupplierCompanyNotFoundError} When the company is absent or archived
	 */
	async setImage(
		id: string,
		file: File | null,
	): Promise<TWithSupplierImage<TSupplierCompanySelect>> {
		if (!(await this.companies.findById(id))) {
			throw new SupplierCompanyNotFoundError();
		}
		const objectKey = file
			? await storeDocumentImage(this.storage, 'supplier/companies', file)
			: null;
		const row = await this.companies.setImageObjectKey(id, objectKey);
		if (!row) throw new SupplierCompanyNotFoundError();
		return this.withImageUrl(row);
	}
}
