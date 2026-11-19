import type { InventoryDocumentType, TInventoryDocumentSelect } from '@drizzle/schemas/inventory.schema';
import { type IObjectStorage, OBJECT_STORAGE_TOKEN } from '@providers/s3/object-storage';
import { inject, injectable } from 'tsyringe';
import { SYSTEM_AUDIT_ACTOR, type TInventoryAuditActor } from '../constants/audit-actor';
import { INVENTORY_DOCUMENT_REPOSITORY_TOKEN, ITEM_REPOSITORY_TOKEN } from '../constants/di';
import type { IInventoryDocumentRepository } from '../contracts/item-operations.repository.interface';
import type { IItemRepository } from '../contracts/item.repository.interface';
import { ItemNotFoundError, ItemRuleViolationError } from '../errors/item.errors';
import { InventoryAuditWriter } from './inventory-audit.writer';

/** Largest file one document may carry. */
export const ITEM_DOCUMENT_MAX_BYTES = 25 * 1024 * 1024;

/** Download links live this long (seconds). */
const DOWNLOAD_URL_SECONDS = 300;

/** A stored document as a client sees it; the object key never leaves the server. */
export type TItemDocumentView = Omit<TInventoryDocumentSelect, 'objectKey' | 'deletedAt'> & {
	/** Short-lived signed download URL. */
	url: string;
};

/**
 * Files of an item unit (photo, manual, datasheet, certificate, invoice,
 * contract), stored by inventory itself (ADR-0024 Q25: `inventory.documents`
 * replaces the old logical `asset_documents` reference).
 *
 * @remarks
 * The row names exactly one owner (`item_id` here; the product side is served by
 * the product module). The object key embeds a fresh UUID, so a re-upload never
 * overwrites a file an earlier document still points at.
 */
@injectable()
export class ItemDocumentService {
	constructor(
		@inject(ITEM_REPOSITORY_TOKEN)
		private readonly itemRepository: Pick<IItemRepository, 'findById'>,
		@inject(INVENTORY_DOCUMENT_REPOSITORY_TOKEN)
		private readonly documents: IInventoryDocumentRepository,
		@inject(OBJECT_STORAGE_TOKEN)
		private readonly storage: Pick<IObjectStorage, 'put' | 'presignGet'>,
		private readonly audit: InventoryAuditWriter,
	) {}

	/**
	 * Stores a file against an item.
	 *
	 * @throws {ItemNotFoundError} When the unit is absent or in another tenant
	 * @throws {ItemRuleViolationError} When the file is empty or too large
	 */
	async upload(
		itemId: string,
		organizationId: string,
		file: File,
		documentType: InventoryDocumentType,
		actor: TInventoryAuditActor = SYSTEM_AUDIT_ACTOR,
	): Promise<TItemDocumentView> {
		const item = await this.itemRepository.findById(itemId);
		if (!item || item.organizationId !== organizationId) throw new ItemNotFoundError();
		if (file.size === 0) throw new ItemRuleViolationError('document_empty');
		if (file.size > ITEM_DOCUMENT_MAX_BYTES) throw new ItemRuleViolationError('document_too_large');

		const extension = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') ?? '';
		const objectKey = `inventory/items/${itemId}/${Bun.randomUUIDv7()}${extension ? `.${extension}` : ''}`;
		const mimeType = file.type || 'application/octet-stream';
		await this.storage.put(objectKey, file, mimeType);

		const row = await this.documents.create({
			organizationId,
			itemId,
			productId: null,
			documentType,
			objectKey,
			fileName: file.name.slice(-255),
			mimeType,
			sizeBytes: file.size,
			createdBy: actor.userId,
			createdAt: new Date(),
		});
		await this.audit.record({
			actor,
			action: 'asset.updated',
			targetType: 'asset_document',
			targetId: row.id,
			organizationId,
			meta: { itemId, documentType, fileName: row.fileName },
		});
		return this.view(row);
	}

	async list(itemId: string, organizationId: string): Promise<TItemDocumentView[]> {
		return (await this.documents.listByItem(itemId, organizationId)).map((row) => this.view(row));
	}

	private view({ objectKey, deletedAt: _deleted, ...rest }: TInventoryDocumentSelect): TItemDocumentView {
		return {
			...rest,
			url: this.storage.presignGet(objectKey, {
				fileName: rest.fileName,
				expiresIn: DOWNLOAD_URL_SECONDS,
			}),
		};
	}
}
