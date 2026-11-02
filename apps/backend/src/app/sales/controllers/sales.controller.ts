import { Elysia } from 'elysia';
import { z } from 'zod';
import { container } from 'tsyringe';
import { translator } from '@providers/i18n/translator';
import { domainPlugin } from '@http/plugin';
import { errorEnvelope, ok, okPaginated } from '@http/response';
import { SALES_SERVICE_TOKEN } from '../constants/di';
import {
	ReferencedQuotationNotFoundError,
	SalesService,
	SalesStateError,
} from '../services/sales.service';

/** Body schema for creating a quotation. */
const createQuotationSchema = z.object({
	code: z.string().min(1).max(50),
	title: z.string().min(1).max(200),
	amount: z.number().int().min(0),
});

/** Body schema for partial quotation updates; at least one field required. */
const updateQuotationSchema = z
	.object({
		title: z.string().min(1).max(200).optional(),
		amount: z.number().int().min(0).optional(),
	})
	.refine((v) => v.title !== undefined || v.amount !== undefined, {
		message: 'At least one field is required',
	});

/** Pagination query for list endpoints, capped at 100 per page. */
const listQuerySchema = z.object({
	page: z.coerce.number().int().min(1).default(1),
	limit: z.coerce.number().int().min(1).max(100).default(20),
});

/** Path parameter shared by all id-targeted routes. */
const idParamSchema = z.object({ id: z.string().min(1) });

/** Body schema for creating a payment against a quotation. */
const createPaymentSchema = z.object({
	quotationId: z.string().min(1),
	amount: z.number().int().min(0),
});

/**
 * Sales routes. Every endpoint is protected through the `erp` macro; the
 * guard resolves session, organization, membership, and permissions BEFORE
 * the handler runs.
 *
 * actorUserId and actorRoles always come from `ctx.erp` (server-derived),
 * never from the request body.
 *
 * @remarks
 * The shared {@link domainPlugin} error hook maps validation failures to
 * `400`, {@link SalesStateError} onto its declared `status`, and
 * {@link ReferencedQuotationNotFoundError} to the quotation-specific `404`
 * message.
 */
export class SalesController {
	/**
	 * Builds the Elysia plugin mounting all sales routes.
	 *
	 * @returns An Elysia instance with the `/sales` route group mounted
	 */
	static plugin() {
		const salesService = container.resolve<SalesService>(SALES_SERVICE_TOKEN);

		return domainPlugin({
			name: 'sales',
			prefix: '/sales',
			tags: ['Sales'],
			guards: 'erp',
		})
			.onError({ as: 'local' }, (ctx) => {
				const { error, set } = ctx;
				if (error instanceof ReferencedQuotationNotFoundError) {
					set.status = 404;
					const t = translator(ctx);
					return errorEnvelope(404, t('sales.quotationNotFound'), [
						{ message: t('sales.quotationNotFound') },
					]);
				}
				return undefined;
			})
			// Quotations
			.post(
				'/quotations',
				async ({ body, erp, status }) => {
					const row = await salesService.createQuotation(body, {
						organizationId: erp.organizationId,
						actorUserId: erp.session.user.id,
						actorRoles: erp.member.role.split(','),
					});
					return status(201, ok(row));
				},
				{
					erp: { permission: ['quotation:create'] },
					body: createQuotationSchema,
				},
			)
			.get(
				'/quotations',
				async ({ query, erp }) => {
					const result = await salesService.listQuotations(
						erp.organizationId,
						{ page: query.page, limit: query.limit },
					);
					return okPaginated(result);
				},
				{
					erp: { permission: ['quotation:read'] },
					query: listQuerySchema,
				},
			)
			.get(
				'/quotations/:id',
				async (ctx) => {
					const { params, erp, status } = ctx;
					const t = translator(ctx);
					const row = await salesService.getQuotation(erp.organizationId, params.id);
					if (!row) {
						// 404: prevent existence disclosure across tenants.
						return status(
							404,
							errorEnvelope(404, t('sales.quotationNotFound'), [
								{ message: t('sales.quotationNotFound') },
							]),
						);
					}
					return ok(row);
				},
				{
					erp: { permission: ['quotation:read'] },
					params: idParamSchema,
				},
			)
			.patch(
				'/quotations/:id',
				async (ctx) => {
					const { params, body, erp, status } = ctx;
					const t = translator(ctx);
					const row = await salesService.updateQuotation(
						erp.organizationId,
						params.id,
						body,
					);
					if (!row) {
						return status(
							404,
							errorEnvelope(404, t('sales.quotationNotFound'), [
								{ message: t('sales.quotationNotFound') },
							]),
						);
					}
					return ok(row);
				},
				{
					erp: { permission: ['quotation:update'] },
					params: idParamSchema,
					body: updateQuotationSchema,
				},
			)
			.post(
				'/quotations/:id/submit',
				async (ctx) => {
					const { params, erp, status } = ctx;
					const t = translator(ctx);
					const row = await salesService.submitQuotation(
						erp.organizationId,
						params.id,
						{
							organizationId: erp.organizationId,
							actorUserId: erp.session.user.id,
							actorRoles: erp.member.role.split(','),
						},
					);
					if (!row) {
						return status(
							404,
							errorEnvelope(404, t('sales.quotationNotFound'), [
								{ message: t('sales.quotationNotFound') },
							]),
						);
					}
					return ok(row);
				},
				{
					erp: { permission: ['quotation:submit'] },
					params: idParamSchema,
				},
			)
			.post(
				'/quotations/:id/decision',
				async (ctx) => {
					const { params, body, erp, status } = ctx;
					const t = translator(ctx);
					const row = await salesService.decideQuotation(
						erp.organizationId,
						params.id,
						body.decision,
						{
							organizationId: erp.organizationId,
							actorUserId: erp.session.user.id,
							actorRoles: erp.member.role.split(','),
						},
					);
					if (!row) {
						return status(
							404,
							errorEnvelope(404, t('sales.quotationNotFound'), [
								{ message: t('sales.quotationNotFound') },
							]),
						);
					}
					return ok(row);
				},
				{
					// Approval requires BOTH approve and reject-adjacent vocabulary
					// declared; only `approve` is granted to approvers.
					erp: { permission: ['quotation:approve'] },
					params: idParamSchema,
					body: z.object({ decision: z.enum(['approve', 'reject']) }),
				},
			)
			// Payments
			.post(
				'/payments',
				async (ctx) => {
					const { body, erp, status } = ctx;
					// A missing referenced quotation is mapped to the
					// quotation-specific 404 by the local onError arm above:
					// no try/catch re-translation here.
					const row = await salesService.createPayment(body, {
						organizationId: erp.organizationId,
						actorUserId: erp.session.user.id,
						actorRoles: erp.member.role.split(','),
					});
					return status(201, ok(row));
				},
				{
					erp: { permission: ['payment:create'] },
					body: createPaymentSchema,
				},
			)
			.get(
				'/payments/:id',
				async (ctx) => {
					const { params, erp, status } = ctx;
					const t = translator(ctx);
					const row = await salesService.getPayment(erp.organizationId, params.id);
					if (!row) {
						return status(
							404,
							errorEnvelope(404, t('sales.paymentNotFound'), [
								{ message: t('sales.paymentNotFound') },
							]),
						);
					}
					return ok(row);
				},
				{
					erp: { permission: ['payment:read'] },
					params: idParamSchema,
				},
			)
			.post(
				'/payments/:id/approve',
				async (ctx) => {
					const { params, erp, status } = ctx;
					const t = translator(ctx);
					const row = await salesService.approvePayment(
						erp.organizationId,
						params.id,
						{
							organizationId: erp.organizationId,
							actorUserId: erp.session.user.id,
							actorRoles: erp.member.role.split(','),
						},
					);
					if (!row) {
						return status(
							404,
							errorEnvelope(404, t('sales.paymentNotFound'), [
								{ message: t('sales.paymentNotFound') },
							]),
						);
					}
					return ok(row);
				},
				{
					erp: { permission: ['payment:approve'] },
					params: idParamSchema,
				},
			)
			.post(
				'/payments/:id/execute',
				async (ctx) => {
					const { params, erp, status } = ctx;
					const t = translator(ctx);
					const row = await salesService.executePayment(
						erp.organizationId,
						params.id,
						{
							organizationId: erp.organizationId,
							actorUserId: erp.session.user.id,
							actorRoles: erp.member.role.split(','),
						},
					);
					if (!row) {
						return status(
							404,
							errorEnvelope(404, t('sales.paymentNotFound'), [
								{ message: t('sales.paymentNotFound') },
							]),
						);
					}
					return ok(row);
				},
				{
					erp: { permission: ['payment:execute'] },
					params: idParamSchema,
				},
			);
	}
}
