import { z } from 'zod';
import { container } from 'tsyringe';
import { translator } from '@providers/i18n/translator';
import { domainPlugin } from '@http/plugin';
import { errorEnvelope, ok } from '@http/response';
import { SALES_SERVICE_TOKEN } from '../constants/di';
import {
	ReferencedQuotationNotFoundError,
	SalesService,
} from '../services/sales.service';

/** Path parameter shared by all id-targeted routes. */
const idParamSchema = z.object({ id: z.string().min(1) });

/** Body schema for creating a payment against a quotation. */
const createPaymentSchema = z.object({
	quotationId: z.string().min(1),
	amount: z.number().int().min(0),
});

/**
 * Transitional payment routes (`/sales/payments`, scaffold until S7, when
 * `finance.payments` replaces them). Quotations live in
 * `QuotationController`. Every endpoint is protected through the `erp` macro; the
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
