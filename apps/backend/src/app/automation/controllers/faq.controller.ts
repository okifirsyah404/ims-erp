import { domainPlugin } from '@http/plugin';
import { created, ok } from '@http/response';
import { container } from 'tsyringe';
import { FAQ_SERVICE_TOKEN } from '../constants/di';
import { faqBodySchema, idParamSchema } from '../contracts/whatsapp.contract';

/**
 * FAQ base of the WhatsApp assistant (`/automation/faq`, M04 stage 2).
 * Reading needs `whatsapp:read`; changes `whatsapp:manage_faq`.
 */
export class FaqController {
	static plugin() {
		const service = container.resolve(FAQ_SERVICE_TOKEN);
		const id = (params: unknown) => idParamSchema.parse(params).id;

		return domainPlugin({ name: 'automation-faq', prefix: '/automation/faq', tags: ['WhatsApp'], guards: 'erp' })
			.get('', async () => ok(await service.list()), {
				erp: { permission: ['whatsapp:read'] },
				detail: { description: 'FAQ entries, active and inactive' },
			})
			.post(
				'',
				async ({ body, erp, status }) => status(201, created(await service.create(erp.session.user.id, faqBodySchema.parse(body)))),
				{ erp: { permission: ['whatsapp:manage_faq'] }, detail: { description: 'Adds an FAQ entry' } },
			)
			.put('/:id', async ({ params, body, erp }) => ok(await service.update(erp.session.user.id, id(params), faqBodySchema.parse(body))), {
				erp: { permission: ['whatsapp:manage_faq'] },
				detail: { description: 'Edits an FAQ entry' },
			})
			.delete(
				'/:id',
				async ({ params }) => {
					await service.remove(id(params));
					return ok({ removed: true });
				},
				{ erp: { permission: ['whatsapp:manage_faq'] }, detail: { description: 'Removes an FAQ entry' } },
			);
	}
}
