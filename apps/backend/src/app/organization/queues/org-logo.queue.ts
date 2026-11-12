import { Queue } from 'bullmq';
import { queueConnection } from '@providers/queue/queue.connection';

/** BullMQ queue name shared by the org-logo queue and its worker. */
export const ORG_LOGO_QUEUE_NAME = 'org-logo';

/** Payload for an organization-logo generation job. */
export type OrgLogoJobData = {
	organizationId: string;
	/** Slug; seed for the initials avatar. */
	slug: string;
};

/**
 * Organization logo generation queue. Dispatched after a successful
 * organization creation so every org gets a deterministic DiceBear initials
 * image unless a real logo is uploaded later (ERP-0041).
 *
 * Deterministic job id (`org-logo-<organizationId>`) deduplicates
 * replays/retries: an organization's fallback logo is generated at most once
 * per attempt cycle.
 */
export const orgLogoQueue = new Queue<OrgLogoJobData>(ORG_LOGO_QUEUE_NAME, {
	connection: queueConnection,
	defaultJobOptions: {
		attempts: 3,
		backoff: { type: 'exponential', delay: 2_000 },
		removeOnComplete: { age: 3_600, count: 1_000 },
		removeOnFail: { age: 86_400 },
	},
});

/** Enqueue logo generation; fire-and-forget (never blocks org creation). */
export async function dispatchOrgLogoGeneration(org: {
	id: string;
	slug: string;
}): Promise<void> {
	await orgLogoQueue.add(
		'generate',
		{ organizationId: org.id, slug: org.slug },
		// BullMQ reserves ':' in job ids; a dash keeps the key format safe.
		{ jobId: `org-logo-${org.id}` },
	);
}
