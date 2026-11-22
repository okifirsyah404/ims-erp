import { inject, injectable } from 'tsyringe';
import { PRODUCT_COMPONENT_REPOSITORY_TOKEN, PRODUCT_REPOSITORY_TOKEN } from '../constants/di';
import type {
	IProductComponentRepository,
	TProductComponentLine,
	TProductComponentRow,
} from '../contracts/product-component.repository.interface';
import type { IProductRepository } from '../contracts/product.repository.interface';
import { ProductComponentInvalidError, ProductCompositionParentError, ProductNotFoundError } from '../errors/product.errors';

/**
 * Composition (bill of materials) of a product: the components and materials
 * it is made of, with the quantity needed per unit.
 *
 * @remarks
 * Informational only: nothing here moves stock or derives a cost. The list is
 * replaced as a whole, so the editor in the form saves once.
 */
@injectable()
export class ProductComponentService {
	constructor(
		@inject(PRODUCT_REPOSITORY_TOKEN)
		private readonly products: Pick<IProductRepository, 'findById'>,
		@inject(PRODUCT_COMPONENT_REPOSITORY_TOKEN)
		private readonly components: IProductComponentRepository,
	) {}

	/** @throws {ProductNotFoundError} When the product is absent or archived */
	async list(productId: string): Promise<TProductComponentRow[]> {
		if (!(await this.products.findById(productId))) throw new ProductNotFoundError();
		return this.components.list(productId);
	}

	/**
	 * Replaces the whole list.
	 *
	 * @throws {ProductNotFoundError} When the product is absent or archived
	 * @throws {ProductCompositionParentError} When the product is itself a component or material
	 * @throws {ProductComponentInvalidError} When a line is missing, archived, the wrong kind, or invisible to the product's organization
	 */
	async replace(productId: string, lines: TProductComponentLine[]): Promise<TProductComponentRow[]> {
		const product = await this.products.findById(productId);
		if (!product) throw new ProductNotFoundError();
		if (product.productKind !== 'product') throw new ProductCompositionParentError();

		const found = new Map(
			(await this.components.findLiveByIds(lines.map((line) => line.componentId))).map((c) => [c.id, c]),
		);
		for (const line of lines) {
			const candidate = found.get(line.componentId);
			const usable =
				candidate !== undefined &&
				(candidate.productKind === 'component' || candidate.productKind === 'material') &&
				// A tenant product may use its own or global items; a global product only global ones.
				(candidate.organizationId === null || candidate.organizationId === product.organizationId);
			if (!usable) throw new ProductComponentInvalidError();
		}

		await this.components.replace(productId, lines);
		return this.components.list(productId);
	}
}
