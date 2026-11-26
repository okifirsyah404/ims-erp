/**
 * Field attendance rules (employee portal Phase B).
 *
 * The phone cannot be trusted, so what matters here is that the server decides:
 *
 * 1. The radius verdict comes from the repository's PostGIS measurement (the
 *    fake returns one), and both the verdict and the distance are snapshotted.
 * 2. An out-of-range check-in is recorded (`out_of_range`), not rejected: the
 *    row is evidence a supervisor can review.
 * 3. One visit per employee per project per day.
 * 4. A selfie is mandatory; without it the coordinates are just a claim.
 * 5. A project without site coordinates cannot be measured -> 422.
 * 6. Another employee's visit is a 404, and an uninvolved project is a 404
 *    (existence is not disclosed).
 */
import { beforeEach, describe, expect, test } from 'bun:test';
import type { TSiteAttendanceSelect } from '@drizzle/schemas/project.schema';
import { SiteAttendanceService, type TPortalActor } from '../../src/app/project/services/site-attendance.service';
import {
	ProjectNotFoundError,
	ProjectSiteCoordinatesError,
	SiteAttendanceStateError,
	SiteSelfieError,
} from '../../src/app/project/errors/project.errors';

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
const selfie = () => new File([JPEG], 'selfie.jpg', { type: 'image/jpeg' });

const actor: TPortalActor = {
	employeeId: 'emp-1',
	userId: 'user-1',
	fullName: 'Budi',
	organizationId: 'org-1',
};

const project = {
	id: 'proj-1',
	title: 'Instalasi Gedung A',
	status: 'active',
	picUserId: 'pic-1',
} as never;

type TRow = TSiteAttendanceSelect;

function row(overrides: Partial<TRow> = {}): TRow {
	return {
		id: 'att-1',
		organizationId: 'org-1',
		projectId: 'proj-1',
		employeeId: 'emp-1',
		userId: 'user-1',
		businessDate: '2026-11-26',
		checkInAt: new Date(),
		checkOutAt: null,
		latitude: '-6.2',
		longitude: '106.8',
		accuracyMeters: null,
		checkOutLatitude: null,
		checkOutLongitude: null,
		distanceMeters: '12.00',
		radiusMeters: 100,
		status: 'verified',
		selfieKey: 'key.jpg',
		selfieContentType: 'image/jpeg',
		note: null,
		createdAt: new Date(),
		updatedAt: new Date(),
		deletedAt: null,
		...overrides,
	} as TRow;
}

function service(options: {
	existing?: TRow | null;
	measured?: { distanceMeters: number; within: boolean } | null;
	involved?: boolean;
	picUserId?: string | null;
	openRow?: TRow | null;
} = {}) {
	let created: Record<string, unknown> | null = null;
	let notified: unknown[] = [];
	const instance = new SiteAttendanceService(
		{
			findSitePoint: async () => ({ latitude: -6.2, longitude: 106.8, label: 'Site' }),
			radiusMeters: async () => 100,
			measure: async () => (options.measured === undefined ? { distanceMeters: 12, within: true } : options.measured),
			findDay: async () => options.existing ?? null,
			findById: async () => options.openRow ?? null,
			create: async (data: Record<string, unknown>) => {
				created = data;
				return row(data as Partial<TRow>);
			},
			checkOut: async () => row({ checkOutAt: new Date() }),
			paginateForEmployee: async () => ({ meta: { page: 1, limit: 20, total: 0, totalPages: 0 }, data: [] }),
			paginateForProject: async () => ({ meta: { page: 1, limit: 20, total: 0, totalPages: 0 }, data: [] }),
		} as never,
		{
			findById: async () => ({ ...(project as object), picUserId: options.picUserId === undefined ? 'pic-1' : options.picUserId }),
			isInvolved: async () => options.involved ?? true,
		} as never,
		{ put: async () => undefined, presignGet: () => 'https://signed/selfie.jpg' } as never,
		{
			notify: async (input: unknown) => {
				notified = [...notified, input];
			},
		} as never,
	);
	return { instance, created: () => created, notified: () => notified };
}

beforeEach(() => {
	// Each case builds its own service; nothing shared to reset.
});

describe('SiteAttendanceService check-in', () => {
	test('inside the radius is verified and snapshots distance + radius', async () => {
		const { instance, created } = service();
		const view = await instance.checkIn(actor, {
			projectId: 'proj-1',
			latitude: -6.2,
			longitude: 106.8,
			accuracyMeters: 8,
			note: null,
			selfie: selfie(),
		});
		expect(view.status).toBe('verified');
		expect(view.distance).toBe(12);
		expect(view.radius).toBe(100);
		expect(view.selfieUrl).toBe('https://signed/selfie.jpg');
		expect(created()?.selfieContentType).toBe('image/jpeg');
		expect(String(created()?.distanceMeters)).toBe('12.00');
	});

	test('outside the radius is recorded as out_of_range, not rejected', async () => {
		const { instance, created } = service({ measured: { distanceMeters: 250.4, within: false } });
		const view = await instance.checkIn(actor, {
			projectId: 'proj-1',
			latitude: -6.3,
			longitude: 106.9,
			accuracyMeters: null,
			note: null,
			selfie: selfie(),
		});
		expect(view.status).toBe('out_of_range');
		expect(String(created()?.distanceMeters)).toBe('250.40');
	});

	test('the PIC is notified, but never a check-in by the PIC themself', async () => {
		const first = service();
		await first.instance.checkIn(actor, { projectId: 'proj-1', latitude: -6.2, longitude: 106.8, accuracyMeters: null, note: null, selfie: selfie() });
		expect(first.notified()).toHaveLength(1);

		const own = service();
		await own.instance.checkIn(
			{ ...actor, userId: 'pic-1' },
			{ projectId: 'proj-1', latitude: -6.2, longitude: 106.8, accuracyMeters: null, note: null, selfie: selfie() },
		);
		expect(own.notified()).toHaveLength(0);
	});

	test('a second check-in on the same project and day is refused', async () => {
		const { instance } = service({ existing: row() });
		await expect(
			instance.checkIn(actor, { projectId: 'proj-1', latitude: -6.2, longitude: 106.8, accuracyMeters: null, note: null, selfie: selfie() }),
		).rejects.toBeInstanceOf(SiteAttendanceStateError);
	});

	test('a project without site coordinates cannot be measured', async () => {
		const { instance } = service({ measured: null });
		await expect(
			instance.checkIn(actor, { projectId: 'proj-1', latitude: -6.2, longitude: 106.8, accuracyMeters: null, note: null, selfie: selfie() }),
		).rejects.toBeInstanceOf(ProjectSiteCoordinatesError);
	});

	test('a selfie is mandatory', async () => {
		const { instance } = service();
		await expect(
			instance.checkIn(actor, {
				projectId: 'proj-1',
				latitude: -6.2,
				longitude: 106.8,
				accuracyMeters: null,
				note: null,
				selfie: undefined as unknown as File,
			}),
		).rejects.toBeInstanceOf(SiteSelfieError);
	});

	test('a non-image selfie is refused', async () => {
		const { instance } = service();
		await expect(
			instance.checkIn(actor, {
				projectId: 'proj-1',
				latitude: -6.2,
				longitude: 106.8,
				accuracyMeters: null,
				note: null,
				selfie: new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], 'x.pdf', { type: 'application/pdf' }),
			}),
		).rejects.toBeInstanceOf(SiteSelfieError);
	});

	test('an uninvolved project is not found', async () => {
		const { instance } = service({ involved: false });
		await expect(
			instance.checkIn(actor, { projectId: 'proj-1', latitude: -6.2, longitude: 106.8, accuracyMeters: null, note: null, selfie: selfie() }),
		).rejects.toBeInstanceOf(ProjectNotFoundError);
	});
});

describe('SiteAttendanceService check-out', () => {
	test("another employee's visit is not found", async () => {
		const { instance } = service({ openRow: row({ employeeId: 'emp-2' }) });
		await expect(
			instance.checkOut(actor, 'att-1', { latitude: -6.2, longitude: 106.8, accuracyMeters: null, note: null }),
		).rejects.toBeInstanceOf(ProjectNotFoundError);
	});

	test('a closed visit cannot be checked out again', async () => {
		const { instance } = service({ openRow: row({ checkOutAt: new Date() }) });
		await expect(
			instance.checkOut(actor, 'att-1', { latitude: -6.2, longitude: 106.8, accuracyMeters: null, note: null }),
		).rejects.toBeInstanceOf(SiteAttendanceStateError);
	});

	test('the open visit is stamped', async () => {
		const { instance } = service({ openRow: row() });
		const view = await instance.checkOut(actor, 'att-1', {
			latitude: -6.2,
			longitude: 106.8,
			accuracyMeters: 5,
			note: null,
		});
		expect(view.checkOutAt).toBeInstanceOf(Date);
	});

	test("a project's visits are PIC-only", async () => {
		const { instance } = service({ picUserId: 'someone-else' });
		await expect(
			instance.listProject(actor, 'proj-1', { page: 1, limit: 20, projectId: undefined, period: undefined, status: undefined }),
		).rejects.toBeInstanceOf(Error);
	});
});
