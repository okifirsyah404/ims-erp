import { container } from 'tsyringe';
import { z } from 'zod';
import { AppError } from '@http/errors';
import { domainPlugin } from '@http/plugin';
import { ok } from '@http/response';
import { QUOTATION_DELIVERY_SERVICE_TOKEN } from '../constants/di';

class RenderNotFoundError extends AppError {
	constructor() {
		super(404, 'common.notFound', 'Not found');
	}
}

/**
 * Data for the public SPH print view the PDF renderer opens
 * (`/public/v1/render/quotations/:id?token=…`, ERP-0067).
 *
 * @remarks
 * No session: the short-lived render token (2 minutes, one quotation, signed
 * with the app secret) is the only credential. A missing, wrong or expired
 * token answers 404.
 */
export class QuotationRenderController {
	/**
	 * @param prefix - The mount path: `/sales/public/v1/render/quotations`.
	 */
	static plugin(prefix = '/sales/public/v1/render/quotations') {
		const service = container.resolve(QUOTATION_DELIVERY_SERVICE_TOKEN);
		return domainPlugin({ name: `quotation-render:${prefix}`, prefix, tags: ['Sale'] }).get(
			'/:id',
			async ({ params, query }) => {
				const { id } = z.object({ id: z.uuid() }).parse(params);
				const { token } = z.object({ token: z.string().min(1).max(200) }).parse(query);
				const data = await service.renderData(id, token);
				if (!data) throw new RenderNotFoundError();
				return ok(data);
			},
			{ detail: { description: 'Quotation and company profile for the SPH print view (render token, no session)' } },
		);
	}
}
