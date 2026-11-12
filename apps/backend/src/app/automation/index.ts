/**
 * Public entry point of the automation module (M04: ERP events to n8n).
 * `src/app/app.ts` mounts `.use(automationModule())`.
 */
import Elysia from 'elysia';

import { OutboxController } from './controllers/outbox.controller';

export { registerAutomation } from './container';
export { startOutboxWorker } from './queues/outbox.worker';

/** Elysia instance mounting every automation controller, in route order. */
export function automationModule() {
	return new Elysia({ name: 'automation' }).use(OutboxController.plugin());
}
