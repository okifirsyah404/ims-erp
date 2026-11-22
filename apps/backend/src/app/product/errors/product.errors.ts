/**
 * Product domain errors.
 *
 * @remarks
 * Each extends {@link AppError} so the shared `onError` arm in `@http/plugin`
 * maps it without a per-module arm. Keys resolve through
 * `@providers/i18n/translator` (`product` namespace), so this module owns no
 * English prose.
 */
import { AppError } from '@http/errors';
import type { ApiKey } from '@providers/i18n/translator';

/** The requested product does not exist (or is soft-deleted). */
export class ProductNotFoundError extends AppError {
	constructor() {
		super(404, 'product.notFound', 'Product not found');
	}
}

/** The SKU is already used within this scope. */
export class ProductSkuTakenError extends AppError {
	constructor() {
		super(409, 'product.skuTaken', 'A product with this SKU already exists');
	}
}

/** A product with live serial units cannot be archived. */
export class ProductHasSerialsError extends AppError {
	constructor(count: number) {
		super(
			422,
			'product.hasUnits',
			`Cannot archive a product that still has ${count} live unit(s)`,
			{ count },
		);
	}
}

/**
 * A product rule the business does not allow.
 *
 * @remarks
 * 422 rather than 409: the request is well-formed and the record exists, but
 * the combination is forbidden by policy (a serialized product that is not
 * stock-tracked, an unknown kind).
 */
export class ProductRuleViolationError extends AppError {
	constructor(rule: string, key: ApiKey = 'product.ruleViolation', message = rule) {
		super(422, key, message, { rule });
	}
}

/** Only a `product` has a composition; components and materials do not. */
export class ProductCompositionParentError extends AppError {
	constructor() {
		super(422, 'product.compositionParentKind', 'Only a product can have components and materials');
	}
}

/** A composition line points at something that cannot be used. */
export class ProductComponentInvalidError extends AppError {
	constructor() {
		super(
			422,
			'product.componentNotUsable',
			"Every line must be a live component or material visible to this product's organization",
		);
	}
}

/** The requested product category does not exist (or is archived). */
export class ProductCategoryNotFoundError extends AppError {
	constructor() {
		super(404, 'product.categoryNotFound', 'Product category not found');
	}
}

/** A live category already uses this slug. */
export class ProductCategorySlugTakenError extends AppError {
	constructor() {
		super(409, 'product.categorySlugTaken', 'A product category with this slug already exists');
	}
}

/** A category with live products cannot be archived (deactivate it instead). */
export class ProductCategoryHasProductsError extends AppError {
	constructor(count: number) {
		super(
			409,
			'product.categoryHasProducts',
			`Cannot archive a category that still has ${count} live product(s)`,
			{ count },
		);
	}
}

/** A product names a category that does not exist, is archived, or is inactive. */
export class ProductCategoryUnavailableError extends AppError {
	constructor() {
		super(422, 'product.categoryUnavailable', 'The product category is not available');
	}
}
