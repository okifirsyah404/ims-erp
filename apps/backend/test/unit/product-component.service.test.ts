import { describe, expect, test } from 'bun:test';
import type {
	IProductComponentRepository,
	TComponentCandidate,
	TProductComponentLine,
	TProductComponentRow,
} from '../../src/app/product/contracts/product-component.repository.interface';
import {
	ProductComponentInvalidError,
	ProductCompositionParentError,
	ProductNotFoundError,
} from '../../src/app/product/errors/product.errors';
import { ProductComponentService } from '../../src/app/product/services/product-component.service';

const PRODUCT = 'p1';
const ORG = 'org-1';

/** In-memory repository: `candidates` is what exists and is live. */
function setup(parent: { productKind: string; organizationId: string | null } | null, candidates: TComponentCandidate[]) {
	let saved: TProductComponentLine[] | null = null;
	const repo: IProductComponentRepository = {
		list: async () =>
			(saved ?? []).map(
				(line, index): TProductComponentRow => ({
					id: `row-${index}`,
					componentId: line.componentId,
					code: 'CMP-1',
					name: 'x',
					productKind: 'component',
					unitLabel: 'pcs',
					quantity: line.quantity.toFixed(3),
					sortOrder: index,
					isArchived: false,
				}),
			),
		findLiveByIds: async (ids) => candidates.filter((c) => ids.includes(c.id)),
		replace: async (_id, lines) => {
			saved = lines;
		},
	};
	const service = new ProductComponentService(
		{ findById: async () => (parent ? ({ id: PRODUCT, ...parent } as never) : null) },
		repo,
	);
	return { service, saved: () => saved };
}

const comp = (id: string, kind: 'component' | 'material' | 'product', organizationId: string | null = ORG): TComponentCandidate => ({
	id,
	organizationId,
	productKind: kind,
});

describe('ProductComponentService', () => {
	test('saves components and materials in list order', async () => {
		const { service, saved } = setup({ productKind: 'product', organizationId: ORG }, [comp('c1', 'component'), comp('m1', 'material', null)]);
		const rows = await service.replace(PRODUCT, [
			{ componentId: 'm1', quantity: 3 },
			{ componentId: 'c1', quantity: 1 },
		]);
		expect(saved()?.map((l) => l.componentId)).toEqual(['m1', 'c1']);
		expect(rows.map((r) => r.sortOrder)).toEqual([0, 1]);
	});

	test('an empty list clears the composition', async () => {
		const { service, saved } = setup({ productKind: 'product', organizationId: ORG }, []);
		await service.replace(PRODUCT, []);
		expect(saved()).toEqual([]);
	});

	test('unknown product is a 404 on read and write', async () => {
		const { service } = setup(null, []);
		await expect(service.list(PRODUCT)).rejects.toBeInstanceOf(ProductNotFoundError);
		await expect(service.replace(PRODUCT, [])).rejects.toBeInstanceOf(ProductNotFoundError);
	});

	test('a component or material cannot have a composition', async () => {
		const { service } = setup({ productKind: 'component', organizationId: ORG }, []);
		await expect(service.replace(PRODUCT, [])).rejects.toBeInstanceOf(ProductCompositionParentError);
	});

	test('rejects missing, archived, wrong-kind and foreign-tenant lines', async () => {
		const { service } = setup({ productKind: 'product', organizationId: ORG }, [
			comp('prod', 'product'),
			comp('other', 'component', 'org-2'),
		]);
		for (const componentId of ['gone', 'prod', 'other']) {
			await expect(service.replace(PRODUCT, [{ componentId, quantity: 1 }])).rejects.toBeInstanceOf(
				ProductComponentInvalidError,
			);
		}
	});

	test('a global product may only use global items', async () => {
		const { service } = setup({ productKind: 'product', organizationId: null }, [
			comp('tenant', 'component', ORG),
			comp('global', 'component', null),
		]);
		await expect(service.replace(PRODUCT, [{ componentId: 'tenant', quantity: 1 }])).rejects.toBeInstanceOf(
			ProductComponentInvalidError,
		);
		await service.replace(PRODUCT, [{ componentId: 'global', quantity: 1 }]);
	});
});
