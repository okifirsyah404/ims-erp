import { EXPORTED_NOTIFICATION_SERVICE_TOKEN } from '@app/notification/constants/di';
import type { ExportedNotificationService } from '@app/notification/services/exported-notification.service';
import type { NotificationTemplateCode } from '@drizzle/schemas/notification.schema';
import { pinoLogger } from '@providers/logger/logger';
import { inject, injectable } from 'tsyringe';
import { PORTAL_IDENTITY_REPOSITORY_TOKEN } from '../constants/di';
import type { IPortalIdentityRepository } from '../contracts/portal-account.contract';

/** What a customer-facing event tells the customer's portal logins (ERP-0077). */
export type TCustomerNotice = {
	customerId: string | null | undefined;
	templateCode: Extract<NotificationTemplateCode, `portal.${string}`>;
	variables: Record<string, string>;
	sourceType: 'quotation' | 'sales_order' | 'invoice' | 'service_ticket' | 'project';
	sourceId: string;
	tags?: string[];
	/** One event of a source with many (a message of a ticket); see `TNotifyInput.dedupeKey`. */
	dedupeKey?: string;
};

/**
 * Sends an in-app notification to every **active** customer-portal login of
 * a customer (ERP-0077), through the shared notification pipeline. Identity
 * owns who those logins are; the producing module (Sales, After-sales) owns
 * the event. Never fails the producer: a customer without logins is a no-op,
 * and an enqueue failure is logged.
 */
@injectable()
export class CustomerPortalNotifier {
	constructor(
		@inject(PORTAL_IDENTITY_REPOSITORY_TOKEN) private readonly identities: Pick<IPortalIdentityRepository, 'listLiveByCustomer'>,
		@inject(EXPORTED_NOTIFICATION_SERVICE_TOKEN) private readonly notifications: Pick<ExportedNotificationService, 'notify'>,
	) {}

	async notify(notice: TCustomerNotice): Promise<void> {
		if (!notice.customerId) return;
		try {
			const logins = await this.identities.listLiveByCustomer(notice.customerId);
			const userIds = logins.filter((identity) => identity.status === 'active' && identity.portalType === 'customer').map((identity) => identity.userId);
			if (userIds.length === 0) return;
			await this.notifications.notify({
				userIds,
				templateCode: notice.templateCode,
				variables: notice.variables,
				tags: notice.tags ?? [],
				sourceType: notice.sourceType,
				sourceId: notice.sourceId,
				...(notice.dedupeKey ? { dedupeKey: notice.dedupeKey } : {}),
			});
		} catch (error) {
			pinoLogger.error({ err: error, templateCode: notice.templateCode, sourceId: notice.sourceId }, 'customer portal notification failed');
		}
	}
}
