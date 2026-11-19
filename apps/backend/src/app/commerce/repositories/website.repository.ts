import { DRIZZLE_TOKEN } from '@di/provider';
import { webMenuItems, webMenus, webSites } from '@drizzle/schemas/commerce.schema';
import { and, asc, eq, inArray, isNull } from 'drizzle-orm';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { inject, injectable } from 'tsyringe';
import type { IWebsiteRepository, TMenuTreeWrite } from '../contracts/website.contract';

/** Drizzle implementation of {@link IWebsiteRepository} (ERP-0071 stage 1). */
@injectable()
export class WebsiteRepository implements IWebsiteRepository {
	constructor(@inject(DRIZZLE_TOKEN) private readonly database: BunSQLDatabase) {}

	async findSite(siteKey: string) {
		const [row] = await this.database
			.select()
			.from(webSites)
			.where(and(eq(webSites.siteKey, siteKey), isNull(webSites.deletedAt)))
			.limit(1);
		return row ?? null;
	}

	async upsertSite(siteKey: string, data: Parameters<IWebsiteRepository['upsertSite']>[1]) {
		const now = new Date();
		const existing = await this.findSite(siteKey);
		if (existing) {
			const [row] = await this.database.update(webSites).set({ ...data, updatedAt: now }).where(eq(webSites.id, existing.id)).returning();
			return row!;
		}
		const [row] = await this.database.insert(webSites).values({ ...data, siteKey, createdAt: now, updatedAt: now }).returning();
		return row!;
	}

	async findMenuTree(code: string) {
		const [root] = await this.database
			.select()
			.from(webMenus)
			.where(and(eq(webMenus.code, code), isNull(webMenus.parentMenuId), isNull(webMenus.deletedAt)))
			.limit(1);
		if (!root) return null;
		const children = await this.database
			.select()
			.from(webMenus)
			.where(and(eq(webMenus.parentMenuId, root.id), isNull(webMenus.deletedAt)))
			.orderBy(asc(webMenus.position), asc(webMenus.createdAt));
		const menuIds = [root.id, ...children.map((child) => child.id)];
		const items = await this.database
			.select()
			.from(webMenuItems)
			.where(and(inArray(webMenuItems.webMenuId, menuIds), isNull(webMenuItems.deletedAt)))
			.orderBy(asc(webMenuItems.position), asc(webMenuItems.createdAt));
		return { root, children, items };
	}

	async replaceMenuTree(tree: TMenuTreeWrite): Promise<void> {
		const now = new Date();
		await this.database.transaction(async (tx) => {
			let [root] = await tx
				.select()
				.from(webMenus)
				.where(and(eq(webMenus.code, tree.root.code), isNull(webMenus.parentMenuId), isNull(webMenus.deletedAt)))
				.limit(1)
				.for('update');
			if (root) {
				await tx.update(webMenus).set({ name: tree.root.name, updatedAt: now }).where(eq(webMenus.id, root.id));
			} else {
				[root] = await tx
					.insert(webMenus)
					.values({ code: tree.root.code, name: tree.root.name, position: 0, createdAt: now, updatedAt: now })
					.returning();
			}
			const rootId = root!.id;
			// Soft-delete the previous children and every item of the tree.
			const oldChildren = await tx
				.select({ id: webMenus.id })
				.from(webMenus)
				.where(and(eq(webMenus.parentMenuId, rootId), isNull(webMenus.deletedAt)));
			const oldMenuIds = [rootId, ...oldChildren.map((child) => child.id)];
			await tx
				.update(webMenuItems)
				.set({ deletedAt: now, updatedAt: now })
				.where(and(inArray(webMenuItems.webMenuId, oldMenuIds), isNull(webMenuItems.deletedAt)));
			if (oldChildren.length > 0) {
				await tx
					.update(webMenus)
					.set({ deletedAt: now, updatedAt: now })
					.where(inArray(webMenus.id, oldChildren.map((child) => child.id)));
			}
			if (tree.items.length > 0) {
				await tx.insert(webMenuItems).values(
					tree.items.map((item, position) => ({ webMenuId: rootId, ...item, position, createdAt: now, updatedAt: now })),
				);
			}
			for (const [position, child] of tree.children.entries()) {
				// Child codes are internal (`<root>-<n>`); live-unique like every code.
				const [menu] = await tx
					.insert(webMenus)
					.values({
						code: `${tree.root.code}-${position + 1}-${now.getTime().toString(36)}`.slice(0, 32),
						name: child.name,
						parentMenuId: rootId,
						position,
						isActive: child.isActive,
						createdAt: now,
						updatedAt: now,
					})
					.returning();
				if (child.items.length > 0) {
					await tx.insert(webMenuItems).values(
						child.items.map((item, itemPosition) => ({ webMenuId: menu!.id, ...item, position: itemPosition, createdAt: now, updatedAt: now })),
					);
				}
			}
		});
	}
}
