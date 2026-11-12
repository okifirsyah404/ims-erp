import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { appConfig } from '@config/providers/config';
import { Worker } from 'bullmq';
import { container } from 'tsyringe';
import { queueConnection } from '@providers/queue/queue.connection';
import type { QueueWorker } from '@providers/queue/worker-registry';
import { s3Client } from '@providers/s3/s3';
import { organizationImageObjectKey } from '../constants/image-keys';
import { ORGANIZATION_REPOSITORY_TOKEN } from '../constants/di';
import type { IOrganizationRepository } from '../contracts/organization.repository.interface';
import { ORG_LOGO_QUEUE_NAME, type OrgLogoJobData } from './org-logo.queue';

/** Rendered logo size in pixels (square; larger than the 72px user avatar). */
const LOGO_SIZE = 256;
/** DiceBear HTTP API style, format, and major version (same as user avatars). */
const LOGO_STYLE_PATH = '10.x/initials/webp';
/** Per-request ceiling so a hung API socket cannot pin a worker slot. */
const LOGO_REQUEST_TIMEOUT_MS = 10_000;
/** ponytail: repo-local temp dir; move to OS temp / env when multi-node. */
const TMP_DIR = path.resolve(process.cwd(), '.tmp/org-logos');

/**
 * Builds the DiceBear HTTP API URL for one organization logo.
 *
 * @remarks
 * Pure and deterministic: the seed (the org slug) is the only variable, so
 * the same slug always yields the same image. No background parameter — the
 * style's seed-derived default applies (DiceBear v10 rejects the legacy
 * `transparent` value, verified for user avatars 2026-11-03).
 */
export function orgLogoApiUrl(apiBaseUrl: string, seed: string, size: number = LOGO_SIZE): string {
	const base = apiBaseUrl.replace(/\/+$/, '');
	const query = new URLSearchParams({ seed, size: String(size) });
	return `${base}/${LOGO_STYLE_PATH}?${query.toString()}`;
}

/**
 * Renders the deterministic initials WebP for an organization by calling the
 * DiceBear HTTP API. No S3, no DB.
 *
 * @throws When the API answers with a non-2xx status or times out; BullMQ
 * retries the job with exponential backoff.
 */
export async function generateOrgLogoWebp(slug: string): Promise<Buffer> {
	const url = orgLogoApiUrl(appConfig.app.avatarApiUrl, slug);
	const response = await fetch(url, {
		signal: AbortSignal.timeout(LOGO_REQUEST_TIMEOUT_MS),
	});
	if (!response.ok) {
		throw new Error(`org logo API responded ${response.status} ${response.statusText} for ${url}`);
	}
	return Buffer.from(await response.arrayBuffer());
}

/**
 * Generates the logo WebP, uploads it to S3 as
 * `organizations/<orgId>/logo.webp`, and stores the object key (NOT a URL) in
 * `auth.organizations.logo` through the organization repository — but ONLY
 * when the organization still has no logo: a real uploaded image (or an
 * org that has been deleted meanwhile) always wins over the fallback.
 */
export async function processOrgLogoJob(
	repository: IOrganizationRepository,
	job: { data: OrgLogoJobData },
): Promise<void> {
	const { organizationId, slug } = job.data;
	const existing = await repository.findById(organizationId);
	if (!existing || existing.deletedAt || existing.logo) return;

	const buffer = await generateOrgLogoWebp(slug);

	await mkdir(TMP_DIR, { recursive: true });
	const tmpPath = path.join(TMP_DIR, `${organizationId}.webp`);
	try {
		await writeFile(tmpPath, buffer);
		await s3Client.write(organizationImageObjectKey(organizationId), Bun.file(tmpPath));
	} finally {
		await rm(tmpPath, { force: true });
	}

	await repository.setLogo(organizationId, organizationImageObjectKey(organizationId));
}

/**
 * Handle the composition root uses to supervise the org-logo worker.
 * Structurally the shared `QueueWorker` contract — same spirit as the user
 * avatar worker: the module owns its lifecycle, the composition root only
 * starts and stops it.
 */
export type OrgLogoWorkerHandle = QueueWorker;

/**
 * Starts the org-logo worker. Call once at bootstrap. Processes up to 2 jobs
 * concurrently. Queue shutdown is intentionally NOT wired here: the
 * connection is a shared provider, not this module's to close.
 */
export function startOrgLogoWorker(): OrgLogoWorkerHandle {
	const repository = container.resolve<IOrganizationRepository>(
		ORGANIZATION_REPOSITORY_TOKEN,
	);

	const worker = new Worker<OrgLogoJobData>(
		ORG_LOGO_QUEUE_NAME,
		async (job) => processOrgLogoJob(repository, job),
		{
			connection: queueConnection,
			concurrency: 2,
		},
	);

	return {
		onError: (listener) => {
			worker.on('error', listener);
		},
		close: () => worker.close(),
	};
}
