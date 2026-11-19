import type { DependencyContainer } from 'tsyringe';
import { WebhookService } from './services/webhook.service';

export * from './contracts/webhook.contract';

/**
 * Registers the webhook module (ADR-0024 Q38).
 *
 * @remarks
 * No table, no repository: the module owns the HTTP edge for provider calls
 * and hands each one to `payment` or `automation`. Both must be registered
 * before this in `src/index.ts`.
 */
export function registerWebhook(container: DependencyContainer): void {
	container.register(WebhookService, { useClass: WebhookService });
}
