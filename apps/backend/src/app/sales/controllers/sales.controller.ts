import { Elysia } from 'elysia';
import { z } from 'zod';
import { container } from 'tsyringe';
import { erpGuard } from '@authorization/elysia-auth';
import { translator } from '@providers/i18n/translator';
import { SALES_SERVICE_TOKEN } from '../constants/di';
import {
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
 * Builds the standard success envelope (empty `errors` list).
 */
function envelope(status: number, message: string, data: unknown = null) {
	return {
		requestId: crypto.randomUUID(),
		status,
		message,
		timestamp: Date.now(),
		data,
		errors: [] as { message: string }[],
	};
}

/**
 * Builds the standard error envelope for a failed request.
 */
function errorEnvelope(
	status: number,
	message: string,
	errors: { message: string }[] = [],
) {
	return {
		requestId: crypto.randomUUID(),
		status,
		message,
		timestamp: Date.now(),
		data: null,
		errors,
	};
}

/**
 * Sales routes. Every endpoint is protected through the `erp` macro; the
 * guard resolves session, organization, membership, and permissions BEFORE
 * the handler runs.
 *
 * actorUserId and actorRoles always come from `ctx.erp` (server-derived),
 * never from the request body.
 *
 * @remarks
 * The local `onError` hook maps validation failures to `400` and
 * {@link SalesStateError} onto its declared `status` (403/404/409/422).
 */
export class SalesController {
	/**
	 * Builds the Elysia plugin mounting all sales routes.
	 *
	 * @returns An Elysia instance with the `/sales` route group mounted
	 */
	static plugin() {
		const salesService = container.resolve<SalesService>(SALES_SERVICE_TOKEN);

		return new Elysia({ prefix: '/sales', name: 'sales', tags: ['Sales'] })
			.use(erpGuard())
			.onError({ as: 'local' }, (ctx) => {
				const { code, error, set } = ctx;
				const t = translator(ctx);
				if (code === 'VALIDATION' || error instanceof z.ZodError) {
					set.status = 400;
					return errorEnvelope(400, t('common.validationFailed'), [
						{
							message:
								error instanceof z.ZodError
									? error.issues.map((i) => i.message).join('; ')
									: String(error),
						},
					]);
				}
				if (error instanceof SalesStateError) {
					set.status = error.status;
					return errorEnvelope(error.status, error.message);
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
					return status(201, envelope(201, 'Created', row));
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
					return {
						...envelope(200, 'OK'),
						pagination: {
							page: query.page,
							limit: query.limit,
							total: result.total,
							totalPages: Math.max(1, Math.ceil(result.total / query.limit)),
						},
						data: result.data,
					};
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
						return status(404, errorEnvelope(404, t('sales.quotationNotFound')));
					}
					return envelope(200, 'OK', row);
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
						return status(404, errorEnvelope(404, t('sales.quotationNotFound')));
					}
					return envelope(200, 'Updated', row);
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
						return status(404, errorEnvelope(404, t('sales.quotationNotFound')));
					}
					return envelope(200, 'Submitted', row);
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
						return status(404, errorEnvelope(404, t('sales.quotationNotFound')));
					}
					return envelope(200, body.decision === 'approve' ? 'Approved' : 'Rejected', row);
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
					const t = translator(ctx);
					try {
						const row = await salesService.createPayment(body, {
							organizationId: erp.organizationId,
							actorUserId: erp.session.user.id,
							actorRoles: erp.member.role.split(','),
						});
						return status(201, envelope(201, 'Created', row));
					} catch (error) {
						if (error instanceof SalesStateError && error.status === 404) {
							return status(404, errorEnvelope(404, t('sales.quotationNotFound')));
						}
						throw error;
					}
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
						return status(404, errorEnvelope(404, t('sales.paymentNotFound')));
					}
					return envelope(200, 'OK', row);
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
						return status(404, errorEnvelope(404, t('sales.paymentNotFound')));
					}
					return envelope(200, 'Approved', row);
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
						return status(404, errorEnvelope(404, t('sales.paymentNotFound')));
					}
					return envelope(200, 'Executed', row);
				},
				{
					erp: { permission: ['payment:execute'] },
					params: idParamSchema,
				},
			);
	}
}
