/**
 * Producer contract: one job per recipient, duplicates collapsed, and a queue
 * outage logged — never thrown into the caller (D7, Phase 5 exit criterion).
 *
 * @remarks
 * The dispatcher is a constructor seam, not a module mock: `mock.module` on
 * the queue would leak into every other test file in the same `bun test` run
 * (it did, replacing `notificationJobId` for the worker test).
 */
import { beforeEach, describe, expect, test } from 'bun:test';
import type { NotificationSendJobData } from '../../src/app/notification/queues/notification.queue';
import {
	ExportedNotificationService,
	toNotificationSendJob,
} from '../../src/app/notification/services/exported-notification.service';

const dispatched: NotificationSendJobData[] = [];
let failingUserIds = new Set<string>();

async function dispatch(data: NotificationSendJobData): Promise<void> {
	if (failingUserIds.has(data.userId)) throw new Error('redis down');
	dispatched.push(data);
}

const INPUT = {
	templateCode: 'org.member_added' as const,
	variables: { organizationName: 'Entragate', role: 'member' },
	tags: ['Entragate'],
	sourceType: 'organization_member',
	sourceId: 'member-1',
};

beforeEach(() => {
	dispatched.length = 0;
	failingUserIds = new Set();
});

describe('toNotificationSendJob', () => {
	test('fills defaults so the job payload is always complete', () => {
		expect(
			toNotificationSendJob(
				{ userIds: ['u-1'], templateCode: 'org.org_created' },
				'u-1',
			),
		).toEqual({
			userId: 'u-1',
			templateCode: 'org.org_created',
			variables: {},
			tags: [],
			sourceType: null,
			sourceId: null,
			metadata: null,
		});
	});
});

describe('ExportedNotificationService.notify', () => {
	test('enqueues one job per recipient', async () => {
		await new ExportedNotificationService(dispatch).notify({
			...INPUT,
			userIds: ['u-1', 'u-2'],
		});

		expect(dispatched.map((job) => job.userId)).toEqual(['u-1', 'u-2']);
		expect(dispatched[0]).toMatchObject({
			templateCode: 'org.member_added',
			variables: { organizationName: 'Entragate', role: 'member' },
			tags: ['Entragate'],
			sourceId: 'member-1',
		});
	});

	test('collapses duplicate and blank recipients', async () => {
		await new ExportedNotificationService(dispatch).notify({
			...INPUT,
			userIds: ['u-1', 'u-1', '', 'u-2'],
		});

		expect(dispatched.map((job) => job.userId)).toEqual(['u-1', 'u-2']);
	});

	test('an empty recipient list enqueues nothing', async () => {
		await new ExportedNotificationService(dispatch).notify({
			...INPUT,
			userIds: [],
		});

		expect(dispatched).toHaveLength(0);
	});

	test('a queue outage is swallowed, so the producer write still succeeds', async () => {
		failingUserIds = new Set(['u-1']);

		await expect(
			new ExportedNotificationService(dispatch).notify({
				...INPUT,
				userIds: ['u-1'],
			}),
		).resolves.toBeUndefined();
		expect(dispatched).toHaveLength(0);
	});

	test('one failing recipient does not drop the others', async () => {
		failingUserIds = new Set(['u-1']);

		await new ExportedNotificationService(dispatch).notify({
			...INPUT,
			userIds: ['u-1', 'u-2'],
		});

		expect(dispatched.map((job) => job.userId)).toEqual(['u-2']);
	});
});
