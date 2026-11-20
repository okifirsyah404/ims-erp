import { container } from 'tsyringe';
import type { ErpContext } from '@authorization/elysia-auth';
import { GLOBAL_ADMIN_ROLE, hasAppRole } from '@providers/better-auth/ac/admin-ac';
import { domainPlugin } from '@http/plugin';
import { created, noContent, ok, okPaginated } from '@http/response';
import {
	createProductSchema,
	idParamSchema,
	productListQuerySchema,
	updateProductSchema,
} from '../contracts/product.contract';
import { documentImageFrom } from '@providers/s3/document-image';
import { PRODUCT_IMAGE_SERVICE_TOKEN, PRODUCT_SERVICE_TOKEN } from '../constants/di';
import type { ProductService } from '../services/product.service';
import type { TAuditActor } from '@shared/audit';

/**
 * Audit actor derived from the guard-resolved session and request headers,
 * never from client input (house pattern — mirrors user-admin.controller).
 */
function auditActor(erp: ErpContext, request: Request): TAuditActor {
	return {
		userId: erp.session.user.id,
		email: erp.session.user.email,
		ip: request.headers.get('x-forwarded-for'),
		userAgent: request.headers.get('user-agent'),
	};
}

/**
 * REST controller for the item master and its serialized units.
 *
 * @remarks
 * HTTP concerns only: schema parsing, envelope mapping, `ctx.erp` unwrapping.
 * Authorization is declared per route through the `erp` macro
 * (`product:read|create|update|archive`) and enforced by `erpGuard` before
 * the handler runs, so nothing here reads the session for permission
 * evidence.
 *
 * `organizationId` comes from the guard-resolved context, never from the
 * request body, except where the plan allows a global (`null`) item — that is
 * decided by the caller's context below, not trusted blindly.
 */
export class ProductController {
	/**
	 * Builds the Elysia plugin mounting `/items`.
	 *
	 * @returns An Elysia instance with the guard and error mapping applied
	 */
	static plugin() {
		const productService = container.resolve<ProductService>(PRODUCT_SERVICE_TOKEN);
		const productImages = container.resolve(PRODUCT_IMAGE_SERVICE_TOKEN);

		return domainPlugin({
			name: 'products',
			prefix: '/products',
			tags: ['Product'],
			guards: 'erp',
		})
			.get(
				'',
				async ({ query }) =>
					okPaginated(
						await productService.paginate(productListQuerySchema.parse(query)).then((page) => ({
							...page,
							data: page.data.map((row) => productImages.withImageUrl(row)),
						})),
					),
				{
					erp: { permission: ['product:read'] },
					detail: { description: 'Paginated item master' },
				},
			)
			.get(
				'/:id',
				async ({ params }) =>
					ok(productImages.withImageUrl(await productService.getProduct(idParamSchema.parse(params).id))),
				{
					erp: { permission: ['product:read'] },
					detail: { description: 'One item by id' },
				},
			)
			.post(
				'',
				async ({ body, erp, request, status }) => {
					const parsed = createProductSchema.parse(body);
					const row = await productService.createProduct(
						{
							...parsed,
							// Tenant scope is the caller's organization; an
							// application admin may create a global item.
							organizationId: resolveOrganizationId(parsed.organizationId, erp),
							createdBy: erp.session.user.id,
						} as never,
						auditActor(erp, request),
					);
					return status(201, created(row));
				},
				{
					erp: { permission: ['product:create'] },
					detail: { description: 'Creates an item' },
				},
			)
			.patch(
				'/:id',
				async ({ params, body, erp, request }) => {
					const id = idParamSchema.parse(params).id;
					const row = await productService.updateProduct(
						id,
						updateProductSchema.parse(body),
						auditActor(erp, request),
					);
					return ok(row);
				},
				{
					erp: { permission: ['product:update'] },
					detail: { description: 'Updates an item' },
				},
			)
			.delete(
				'/:id',
				async ({ params, erp, request }) => {
					const id = idParamSchema.parse(params).id;
					await productService.archiveProduct(id, auditActor(erp, request));
					return noContent();
				},
				{
					erp: { permission: ['product:archive'] },
					detail: { description: 'Archives an item (soft delete)' },
				},
			)
			.put(
				'/:id/image',
				async ({ params, body }) =>
					ok(await productImages.setImage(idParamSchema.parse(params).id, documentImageFrom(body))),
				{
					erp: { permission: ['product:update'] },
					detail: { description: 'Uploads the photo printed on documents (multipart `file`)' },
				},
			)
			.delete(
				'/:id/image',
				async ({ params }) => ok(await productImages.setImage(idParamSchema.parse(params).id, null)),
				{
					erp: { permission: ['product:update'] },
					detail: { description: 'Removes the document photo' },
				},
			);
	}
}

/**
 * Resolves the tenant scope for a new row.
 *
 * @remarks
 * A client may only request a **global** row (`null`) when it is an
 * application administrator. Everyone else is pinned to their own
 * organization regardless of what the body asked for — the body is input,
 * never authorization evidence.
 *
 * @param requested - The `organizationId` the body asked for, if any
 * @param erp - The guard-resolved context
 */
function resolveOrganizationId(
	requested: string | null | undefined,
	erp: ErpContext,
): string | null {
	if (hasAppRole(erp.session.user.role, GLOBAL_ADMIN_ROLE)) {
		return requested ?? erp.organizationId;
	}
	if (requested && requested !== erp.organizationId) {
		// Silently coercing would hide a client bug; the guard already
		// established membership, so a mismatch is a bad request.
		return erp.organizationId;
	}
	return erp.organizationId;
}
