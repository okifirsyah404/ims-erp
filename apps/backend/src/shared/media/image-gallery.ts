/**
 * Multi-image gallery shared by `product`, `inventory` (assets) and
 * `warehouse`.
 *
 * @remarks
 * Each owning module keeps its own `<owner>_images` table and repository (one
 * schema per module, ADR-0024); this file holds the rules they share:
 *
 * - at most {@link MAX_GALLERY_IMAGES} live images per owner;
 * - the first live image (lowest `sort_order`) is the **cover**; its object
 *   key is mirrored into the owner's legacy `image_object_key` column so
 *   quotations, stock rows and the public catalog keep reading one key;
 * - removal is a soft delete, and every upload gets a fresh key, so an issued
 *   document that snapshotted a key keeps printing its picture.
 */
import { AppError } from '@http/errors';
import { documentImageUrl, storeDocumentImage } from '@providers/s3/document-image';
import type { IObjectStorage } from '@providers/s3/object-storage';
import { z } from 'zod';

export const MAX_GALLERY_IMAGES = 10;

/** The owner already holds {@link MAX_GALLERY_IMAGES} live images. */
export class GalleryLimitError extends AppError {
	constructor() {
		super(422, 'common.imageLimit', `Upload at most ${MAX_GALLERY_IMAGES} images`, {
			max: MAX_GALLERY_IMAGES,
		});
	}
}

/** The image does not exist on this owner (or was removed). */
export class GalleryImageNotFoundError extends AppError {
	constructor() {
		super(404, 'common.imageNotFound', 'Image not found');
	}
}

/** A reorder request that does not list every live image exactly once. */
export class GalleryOrderInvalidError extends AppError {
	constructor() {
		super(422, 'common.imageOrderInvalid', 'Send every current image id exactly once');
	}
}

/** Path params of the nested image routes (`/:id/images/:imageId`). */
export const galleryImageParamSchema = z.object({ id: z.uuid(), imageId: z.uuid() });

/** `PATCH /:id/images/:imageId` body. */
export const galleryCaptionSchema = z.object({
	caption: z
		.string()
		.trim()
		.max(200)
		.nullable()
		.transform((value) => (value ? value : null)),
});

/** `PUT /:id/images/order` body: the full new order, cover first. */
export const galleryOrderSchema = z.object({
	imageIds: z.array(z.uuid()).max(MAX_GALLERY_IMAGES),
});

/** The optional multipart `caption` field of an upload. */
export function galleryCaptionFrom(body: unknown): string | null {
	const raw = body && typeof body === 'object' ? (body as { caption?: unknown }).caption : undefined;
	return galleryCaptionSchema.parse({ caption: typeof raw === 'string' ? raw : null }).caption;
}

/** One stored gallery row, as the repositories return it. */
export type TGalleryImageRow = {
	id: string;
	objectKey: string;
	caption: string | null;
	sortOrder: number;
};

/** What the API exposes for one image. */
export type TGalleryImage = {
	id: string;
	url: string | null;
	caption: string | null;
	sortOrder: number;
};

/** Persistence port every `<owner>_images` repository implements. */
export interface IGalleryImageRepository {
	/** Live images of an owner, cover first. */
	list(ownerId: string): Promise<TGalleryImageRow[]>;
	add(
		ownerId: string,
		data: { objectKey: string; caption: string | null; sortOrder: number },
	): Promise<TGalleryImageRow>;
	updateCaption(ownerId: string, imageId: string, caption: string | null): Promise<TGalleryImageRow | null>;
	/** Soft delete. */
	remove(ownerId: string, imageId: string): Promise<boolean>;
	/** Rewrites `sort_order` to the position in `orderedIds`. */
	reorder(ownerId: string, orderedIds: string[]): Promise<void>;
}

/**
 * Gallery use cases over one owner type.
 *
 * @remarks
 * The caller verifies the owner exists (and the tenant) before calling; this
 * class only trusts the `ownerId` it is handed.
 */
export class ImageGallery {
	constructor(
		private readonly repository: IGalleryImageRepository,
		private readonly storage: IObjectStorage,
		/** Object-key prefix, e.g. `inventory/products`; the owner id is appended. */
		private readonly keyPrefix: string,
		/** Mirrors the cover key into the owner's `image_object_key`. */
		private readonly writeCover: (ownerId: string, objectKey: string | null) => Promise<void>,
	) {}

	private view(row: TGalleryImageRow): TGalleryImage {
		return {
			id: row.id,
			url: documentImageUrl(this.storage, row.objectKey),
			caption: row.caption,
			sortOrder: row.sortOrder,
		};
	}

	/** Live images, cover first. */
	async list(ownerId: string): Promise<TGalleryImage[]> {
		return (await this.repository.list(ownerId)).map((row) => this.view(row));
	}

	/** Appends an image; it becomes the cover when the gallery was empty. */
	async add(ownerId: string, file: File, caption: string | null): Promise<TGalleryImage> {
		const rows = await this.repository.list(ownerId);
		if (rows.length >= MAX_GALLERY_IMAGES) throw new GalleryLimitError();
		const objectKey = await storeDocumentImage(this.storage, `${this.keyPrefix}/${ownerId}`, file);
		const row = await this.repository.add(ownerId, {
			objectKey,
			caption,
			sortOrder: rows.length ? rows[rows.length - 1].sortOrder + 1 : 0,
		});
		if (rows.length === 0) await this.writeCover(ownerId, objectKey);
		return this.view(row);
	}

	/** @throws {GalleryImageNotFoundError} When the image is not live on this owner */
	async updateCaption(ownerId: string, imageId: string, caption: string | null): Promise<TGalleryImage> {
		const row = await this.repository.updateCaption(ownerId, imageId, caption);
		if (!row) throw new GalleryImageNotFoundError();
		return this.view(row);
	}

	/** Soft-deletes an image; the next image becomes the cover when the cover goes. */
	async remove(ownerId: string, imageId: string): Promise<void> {
		const rows = await this.repository.list(ownerId);
		if (!rows.some((row) => row.id === imageId)) throw new GalleryImageNotFoundError();
		await this.repository.remove(ownerId, imageId);
		await this.writeCover(ownerId, rows.find((row) => row.id !== imageId)?.objectKey ?? null);
	}

	/**
	 * Applies a new order; the first id becomes the cover.
	 *
	 * @throws {GalleryOrderInvalidError} When the ids are not exactly the live set
	 */
	async reorder(ownerId: string, imageIds: string[]): Promise<TGalleryImage[]> {
		const rows = await this.repository.list(ownerId);
		const live = new Set(rows.map((row) => row.id));
		if (
			imageIds.length !== live.size ||
			new Set(imageIds).size !== live.size ||
			!imageIds.every((id) => live.has(id))
		) {
			throw new GalleryOrderInvalidError();
		}
		if (imageIds.length) {
			await this.repository.reorder(ownerId, imageIds);
			await this.writeCover(ownerId, rows.find((row) => row.id === imageIds[0])?.objectKey ?? null);
		}
		return this.list(ownerId);
	}

	/**
	 * Single-photo compatibility for the original `PUT /:id/image`: the upload
	 * replaces the cover (the old cover is soft-deleted), other images stay.
	 */
	async replaceCover(ownerId: string, file: File): Promise<TGalleryImage> {
		const rows = await this.repository.list(ownerId);
		const objectKey = await storeDocumentImage(this.storage, `${this.keyPrefix}/${ownerId}`, file);
		const [cover, ...rest] = rows;
		if (cover) await this.repository.remove(ownerId, cover.id);
		const row = await this.repository.add(ownerId, {
			objectKey,
			caption: cover?.caption ?? null,
			sortOrder: rest.length ? rest[rest.length - 1].sortOrder + 1 : 0,
		});
		await this.repository.reorder(ownerId, [row.id, ...rest.map((r) => r.id)]);
		await this.writeCover(ownerId, objectKey);
		return this.view(row);
	}

	/** Single-photo compatibility for `DELETE /:id/image`: drops the cover. */
	async removeCover(ownerId: string): Promise<void> {
		const [cover] = await this.repository.list(ownerId);
		if (cover) await this.remove(ownerId, cover.id);
	}
}
