import { domainPlugin } from '@http/plugin';
import { ok, okPaginated } from '@http/response';
import { container } from 'tsyringe';
import { OUTBOX_SERVICE_TOKEN } from '../constants/di';
import { idParamSchema, outboxListQuerySchema } from '../contracts/outbox.contract';

/**
 * The n8n event log (`/automation/outbox`, M04). Reading needs
 * `automation:read_log`; sending an event again `automation:execute`.
 */
export class OutboxController {
	static plugin() {
		const service = container.resolve(OUTBOX_SERVICE_TOKEN);

		return domainPlugin({ name: 'automation-outbox', prefix: '/automation/outbox', tags: ['Automation'], guards: 'erp' })
			.get('', async ({ query }) => okPaginated(await service.list(outboxListQuerySchema.parse(query))), {
				erp: { permission: ['automation:read_log'] },
				detail: { description: 'ERP events sent to n8n, newest first' },
			})
			.get('/summary', async () => ok(await service.summary()), {
				erp: { permission: ['automation:read_log'] },
				detail: { description: 'Counts per status and whether the webhook is configured' },
			})
			.post('/:id/retry', async ({ params }) => ok(await service.retry(idParamSchema.parse(params).id)), {
				erp: { permission: ['automation:execute'] },
				detail: { description: 'Sends an event again now' },
			});
	}
}
