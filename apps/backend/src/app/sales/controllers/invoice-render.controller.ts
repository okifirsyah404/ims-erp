import { container } from 'tsyringe';
import { z } from 'zod';
import { AppError } from '@http/errors';
import { domainPlugin } from '@http/plugin';
import { ok } from '@http/response';
import { INVOICE_RENDER_SERVICE_TOKEN } from '../constants/ar-di';

class RenderNotFoundError extends AppError {
	constructor() {
		super(404, 'common.notFound', 'Not found');
	}
}

/**
 * Data for the public invoice print view the PDF renderer opens
 * (`/public/v1/render/invoices/:id?org=…&token=…`, ERP-0079). No session: the
 * short-lived render token (2 minutes, one invoice of one organization) is the
 * only credential; a missing, wrong or expired token answers 404.
 */
export class InvoiceRenderController {
	static plugin() {
		const service = container.resolve(INVOICE_RENDER_SERVICE_TOKEN);
		return domainPlugin({ name: 'invoice-render', prefix: '/public/v1/render/invoices', tags: ['Sales'] }).get(
			'/:id',
			async ({ params, query }) => {
				const { id } = z.object({ id: z.uuid() }).parse(params);
				const { org, token } = z.object({ org: z.string().min(1).max(64), token: z.string().min(1).max(200) }).parse(query);
				const data = await service.renderData(org, id, token);
				if (!data) throw new RenderNotFoundError();
				return ok(data);
			},
			{ detail: { description: 'Invoice detail and company profile for the invoice print view (render token, no session)' } },
		);
	}
}
