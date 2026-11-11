import { Queue } from 'bullmq';
import { queueConnection } from '@providers/queue/queue.connection';
import { isMailEnabled, type MailPayload } from './mailer.transport';
import { pinoLogger } from '@providers/logger/logger';

/** BullMQ queue name shared by the mail queue and its worker. */
export const MAIL_QUEUE_NAME = 'mail';

/** Payload for an email-delivery job. */
export type MailJobData = MailPayload;

/**
 * Email-delivery queue. Every outgoing email goes through here — Better Auth
 * (verification, password reset) and future module mails alike dispatch jobs
 * instead of touching SMTP directly, so slow/broken mail servers can never
 * block a request or hook.
 */
export const mailQueue = new Queue<MailJobData>(MAIL_QUEUE_NAME, {
	connection: queueConnection,
	defaultJobOptions: {
		attempts: 5,
		backoff: { type: 'exponential', delay: 2_000 },
		removeOnComplete: { age: 3_600, count: 1_000 },
		removeOnFail: { age: 86_400 },
	},
});

/**
 * Enqueue an email for delivery.
 *
 * When no transport is configured (dev/test without SMTP) the payload is
 * logged and dropped — mirroring the scheduler's disabled mode so booting
 * with no mail server keeps working.
 */
export async function dispatchMail(payload: MailPayload): Promise<void> {
	if (!isMailEnabled()) {
		pinoLogger.info(
			{ to: payload.to, subject: payload.subject },
			'mail disabled — dropping outgoing email (SMTP/Resend not configured)',
		);
		return;
	}

	await mailQueue.add('send', payload);
}
