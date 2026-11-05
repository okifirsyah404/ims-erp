import type { TItemCategorySelect } from '@drizzle/schemas/inventory.schema';
import { inject, injectable } from 'tsyringe';
import { ITEM_CATEGORY_REPOSITORY_TOKEN } from '../constants/di';
import type {
	TItemCategoryCreateInput,
	TItemCategoryUpdateInput,
} from '../contracts/item-category.contract';
import type { IItemCategoryRepository } from '../contracts/item-category.repository.interface';
import {
	ItemCategoryHasItemsError,
	ItemCategoryNotFoundError,
	ItemCategorySlugTakenError,
} from '../errors/inventory.errors';

/**
 * Item category use cases (ADR-0011): one level, company-wide.
 *
 * @remarks
 * The slug is fixed after creation because the public website links to it.
 * Archiving is refused while live items still use the category; deactivate
 * it instead to stop offering it.
 */
@injectable()
export class ItemCategoryService {
	constructor(
		@inject(ITEM_CATEGORY_REPOSITORY_TOKEN)
		private readonly repository: IItemCategoryRepository,
	) {}

	list(includeInactive = false): Promise<TItemCategorySelect[]> {
		return this.repository.list(includeInactive);
	}

	async get(id: string): Promise<TItemCategorySelect> {
		const category = await this.repository.findById(id);
		if (!category) throw new ItemCategoryNotFoundError();
		return category;
	}

	async create(data: TItemCategoryCreateInput): Promise<TItemCategorySelect> {
		if (await this.repository.findBySlug(data.slug)) throw new ItemCategorySlugTakenError();
		return this.repository.create(data);
	}

	async update(id: string, data: TItemCategoryUpdateInput): Promise<TItemCategorySelect> {
		const updated = await this.repository.update(id, data);
		if (!updated) throw new ItemCategoryNotFoundError();
		return updated;
	}

	async archive(id: string): Promise<TItemCategorySelect> {
		await this.get(id);
		const live = await this.repository.countLiveItems(id);
		if (live > 0) throw new ItemCategoryHasItemsError(live);
		const archived = await this.repository.archive(id);
		if (!archived) throw new ItemCategoryNotFoundError();
		return archived;
	}
}
