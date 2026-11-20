import { injectable, inject } from 'tsyringe';
import { pinoLogger } from '@providers/logger/logger';
import type { NotificationTemplateCode } from '@drizzle/schemas/notification.schema';
import { NOTIFICATION_DISPATCHER_TOKEN } from '../constants/di';
import {
	dispatchNotification,
	type NotificationSendJobData,
} from '../queues/notification.queue';

/** What a producer may ask for. */
export type TNotifyInput = {
	/** Recipients; duplicates are collapsed. */
	userIds: string[];
	/** `module.event` code, e.g. `org.member_added`. */
	templateCode: NotificationTemplateCode;
	/** Values the template interpolates. */
	variables?: Record<string, string>;
	/** Display chips, e.g. `[organizationName]`. */
	tags?: string[];
	/** Producer entity type, for traceability only. */
	sourceType?: string;
	/** Producer entity id; also makes the job id deterministic. */
	sourceId?: string;
	/**
	 * One event of a source that has many (ERP-0092: one message of a ticket).
	 * Replaces `sourceId` in the job id, so a second message is not taken for a
	 * replay of the first.
	 */
	dedupeKey?: string;
	/** Navigation extras (deep link); never used for authorization. */
	metadata?: Record<string, unknown>;
};

/** Maps one producer call onto the job payload for one recipient. */
export function toNotificationSendJob(
	input: TNotifyInput,
	userId: string,
): NotificationSendJobData {
	return {
		userId,
		templateCode: input.templateCode,
		variables: input.variables ?? {},
		tags: input.tags ?? [],
		sourceType: input.sourceType ?? null,
		sourceId: input.sourceId ?? null,
		metadata: input.metadata ?? null,
		...(input.dedupeKey ? { dedupeKey: input.dedupeKey } : {}),
	};
}

/** The enqueue seam; injectable so a test never needs Redis. */
export type TNotificationDispatcher = (
	data: NotificationSendJobData,
) => Promise<void>;

/**
 * The **only** cross-module entry point of the notification module (D7).
 *
 * @remarks
 * Enqueue-only: it never touches the database and never throws into the
 * caller's business flow. A Redis outage is logged and the originating write
 * still succeeds — the same contract as the avatar queue hook and
 * `AuditService.record`.
 *
 * One job per recipient, so a failed render for one user cannot drop the
 * notification for the rest.
 *
 * The dispatcher is injected through `NOTIFICATION_DISPATCHER_TOKEN`
 * (registered as the real queue), so DI can construct this class; tests still
 * pass a double as the plain constructor argument.
 */
@injectable()
export class ExportedNotificationService {
	constructor(
		@inject(NOTIFICATION_DISPATCHER_TOKEN)
		private readonly dispatch: TNotificationDispatcher = dispatchNotification,
	) {}

	async notify(input: TNotifyInput): Promise<void> {
		const recipients = [...new Set(input.userIds.filter(Boolean))];
		if (recipients.length === 0) return;

		const failures: string[] = [];
		for (const userId of recipients) {
			try {
				await this.dispatch(toNotificationSendJob(input, userId));
			} catch (error) {
				failures.push(userId);
				pinoLogger.error(
					{ err: error, userId, templateCode: input.templateCode },
					'notification enqueue failed',
				);
			}
		}

		if (failures.length > 0) {
			pinoLogger.warn(
				{
					templateCode: input.templateCode,
					failed: failures.length,
					total: recipients.length,
				},
				'notification enqueue partially failed',
			);
		}
	}
}
