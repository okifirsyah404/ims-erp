import { container } from 'tsyringe';
import { z } from 'zod';
import { AppError } from '@http/errors';
import { domainPlugin } from '@http/plugin';
import { ok } from '@http/response';
import { WARRANTY_RENDER_SERVICE_TOKEN } from '../constants/di';

class RenderNotFoundError extends AppError {
	constructor() {
		super(404, 'common.notFound', 'Not found');
	}
}

/**
 * Data for the public warranty-certificate print view the PDF renderer opens
 * (`/public/v1/render/warranties/:id?token=…`, ERP-0079). No session: the
 * short-lived render token is the only credential; otherwise 404.
 */
export class WarrantyRenderController {
	static plugin() {
		const service = container.resolve(WARRANTY_RENDER_SERVICE_TOKEN);
		return domainPlugin({ name: 'warranty-render', prefix: '/public/v1/render/warranties', tags: ['After-Sales'] }).get(
			'/:id',
			async ({ params, query }) => {
				const { id } = z.object({ id: z.uuid() }).parse(params);
				const { token } = z.object({ token: z.string().min(1).max(200) }).parse(query);
				const data = await service.renderData(id, token);
				if (!data) throw new RenderNotFoundError();
				return ok(data);
			},
			{ detail: { description: 'Warranty certificate and company profile for its print view (render token, no session)' } },
		);
	}
}
