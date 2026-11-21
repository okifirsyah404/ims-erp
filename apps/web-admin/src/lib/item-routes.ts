import type { TProductKind } from './inventory-api';

/**
 * Where each product kind lives in the web app.
 *
 * @remarks
 * Detail and edit sit under the kind's own list route (`/products/$productId`,
 * `/inventory/components/$productId`, `/inventory/materials/$productId`), so the
 * sidebar highlights the right menu and the breadcrumb and route guard resolve
 * the right section without any special casing. Every link to an item goes
 * through these helpers.
 */

/** The list route of a kind. */
export function itemListLink(kind: TProductKind) {
	switch (kind) {
		case 'component':
			return { to: '/inventory/components' } as const;
		case 'material':
			return { to: '/inventory/materials' } as const;
		default:
			return { to: '/products' } as const;
	}
}

/** The detail route of an item. */
export function itemDetailLink(kind: TProductKind, productId: string) {
	switch (kind) {
		case 'component':
			return { to: '/inventory/components/$productId', params: { productId } } as const;
		case 'material':
			return { to: '/inventory/materials/$productId', params: { productId } } as const;
		default:
			return { to: '/products/$productId', params: { productId } } as const;
	}
}

/** The edit route of an item. */
export function itemEditLink(kind: TProductKind, productId: string) {
	switch (kind) {
		case 'component':
			return { to: '/inventory/components/$productId/edit', params: { productId } } as const;
		case 'material':
			return { to: '/inventory/materials/$productId/edit', params: { productId } } as const;
		default:
			return { to: '/products/$productId/edit', params: { productId } } as const;
	}
}
