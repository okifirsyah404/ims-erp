import { domainPlugin } from '@http/plugin';
import { ok, okPaginated } from '@http/response';
import { container } from 'tsyringe';
import { WHATSAPP_SERVICE_TOKEN } from '../constants/di';
import { conversationListQuerySchema, idParamSchema, replyBodySchema } from '../contracts/whatsapp.contract';

/**
 * WhatsApp inbox (`/automation/whatsapp`, M04 stage 2): conversations, the
 * handoff queue and admin replies. Reading needs `whatsapp:read`; replying,
 * handing back to the assistant, closing and resending `whatsapp:reply`.
 */
export class WhatsappController {
	static plugin() {
		const service = container.resolve(WHATSAPP_SERVICE_TOKEN);
		const id = (params: unknown) => idParamSchema.parse(params).id;

		return domainPlugin({ name: 'automation-whatsapp', prefix: '/automation/whatsapp', tags: ['WhatsApp'], guards: 'erp' })
			.get('/status', async () => ok(await service.status()), {
				erp: { permission: ['whatsapp:read'] },
				detail: { description: 'Which parts are configured (WAHA, webhook key, AI) and chats per status' },
			})
			.get('/conversations', async ({ query }) => okPaginated(await service.list(conversationListQuerySchema.parse(query))), {
				erp: { permission: ['whatsapp:read'] },
				detail: { description: 'Chats, latest first' },
			})
			.get('/conversations/:id', async ({ params }) => ok(await service.get(id(params))), {
				erp: { permission: ['whatsapp:read'] },
				detail: { description: 'One chat with its messages' },
			})
			.post(
				'/conversations/:id/reply',
				async ({ params, body, erp }) => ok(await service.reply(erp.session.user.id, id(params), replyBodySchema.parse(body).text)),
				{ erp: { permission: ['whatsapp:reply'] }, detail: { description: 'Sends an admin reply; the admin takes the chat over' } },
			)
			.post('/conversations/:id/resume', async ({ params }) => ok(await service.resume(id(params))), {
				erp: { permission: ['whatsapp:reply'] },
				detail: { description: 'Lets the assistant answer the chat again' },
			})
			.post('/conversations/:id/close', async ({ params }) => ok(await service.close(id(params))), {
				erp: { permission: ['whatsapp:reply'] },
				detail: { description: 'Closes the chat' },
			})
			.post('/messages/:id/retry', async ({ params }) => ok(await service.retry(id(params))), {
				erp: { permission: ['whatsapp:reply'] },
				detail: { description: 'Sends a failed outbound message again' },
			});
	}
}
