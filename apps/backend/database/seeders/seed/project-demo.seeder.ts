import { and, eq, isNull } from 'drizzle-orm';
import pino from 'pino';
import { drizzleDB } from '../../../drizzle/db';
import { organizations } from '../../../drizzle/schemas/auth.schema';
import { employees } from '../../../drizzle/schemas/human-resource.schema';
import {
	addresses,
	projectSettings,
	projects,
	tasks,
} from '../../../drizzle/schemas/project.schema';
import { SEED_ORGANIZATION_SLUG } from './organization.seeder';
import { isProductionEnv } from '../../../config/providers/env';

const logger = pino({
	timestamp: false,
	formatters: {
		level: (label) => ({ level: label }),
	},
});

/** Deterministic anchor of the demo project; a re-run finds it by this code. */
export const DEMO_PROJECT_CODE = 'PRJ-DEMO-001';

/** Jakarta coordinates a phone in the office would report (Monas area). */
const SITE_POINT = { latitude: '-6.1753920', longitude: '106.8271530' };

/** Default radius; the portal reads the setting and snapshots it per check-in. */
export const DEMO_SITE_RADIUS_METERS = 100;

/**
 * Seeds one project an employee can actually open in the portal (Phase B).
 *
 * @remarks
 * Phase B's field attendance needs a project with a **site point** and a PIC
 * that is also a linked employee, and neither existed in the seed: the portal
 * had nothing to list. This creates the smallest complete fixture:
 *
 * - one active project, PIC = the first seeded employee with a login;
 * - its primary site address **with coordinates** (the PostGIS source);
 * - one open task assigned to that same user (own-task status can be tried);
 * - the `attendance/site_radius_meters` setting (100 m).
 *
 * Idempotent on `project.projects.code`; if no linked employee exists yet the
 * seeder skips (it runs after `seedHrEmployees`).
 */
export async function seedDemoProject(): Promise<void> {
	if (isProductionEnv()) {
		logger.info('Demo project seeding skipped in production');
		return;
	}

	const [organization] = await drizzleDB
		.select({ id: organizations.id })
		.from(organizations)
		.where(eq(organizations.slug, SEED_ORGANIZATION_SLUG))
		.limit(1);
	if (!organization) {
		logger.info('Demo project seeding skipped: no seeded organization');
		return;
	}

	const [person] = await drizzleDB
		.select({ userId: employees.userId, fullName: employees.fullName })
		.from(employees)
		.where(
			and(
				eq(employees.organizationId, organization.id),
				isNull(employees.deletedAt),
				eq(employees.employmentStatus, 'active'),
			),
		)
		.limit(1);
	if (!person?.userId) {
		logger.info('Demo project seeding skipped: no employee with a login yet');
		return;
	}

	// One row per setting key, anchored by the partial unique index.
	const [radius] = await drizzleDB
		.select({ id: projectSettings.id })
		.from(projectSettings)
		.where(
			and(
				eq(projectSettings.settingGroup, 'attendance'),
				eq(projectSettings.settingKey, 'site_radius_meters'),
				isNull(projectSettings.deletedAt),
			),
		)
		.limit(1);
	if (!radius) {
		const now = new Date();
		await drizzleDB.insert(projectSettings).values({
			settingGroup: 'attendance',
			settingKey: 'site_radius_meters',
			settingValue: String(DEMO_SITE_RADIUS_METERS),
			valueType: 'number',
			description: 'Field attendance radius around a project site, in metres.',
			createdAt: now,
			updatedAt: now,
		});
	}

	const [existing] = await drizzleDB
		.select({ id: projects.id })
		.from(projects)
		.where(and(eq(projects.code, DEMO_PROJECT_CODE), isNull(projects.deletedAt)))
		.limit(1);
	if (existing) {
		logger.info({ projectId: existing.id }, 'Demo project already seeded; skipping');
		return;
	}

	const now = new Date();
	const [project] = await drizzleDB
		.insert(projects)
		.values({
			code: DEMO_PROJECT_CODE,
			orderCode: 'DEMO-SO-001',
			customerName: 'PT Pelanggan Demo',
			title: 'Instalasi Demo Portal Karyawan',
			siteName: 'Kantor Demo Jakarta',
			contractValue: 0,
			picUserId: person.userId,
			stage: 'installation',
			status: 'active',
			createdAt: now,
			updatedAt: now,
		})
		.returning({ id: projects.id });

	await drizzleDB.insert(addresses).values({
		projectId: project!.id,
		kind: 'site',
		label: 'Kantor Demo',
		addressLine: 'Jl. Medan Merdeka Barat No. 1, Jakarta Pusat',
		latitude: SITE_POINT.latitude,
		longitude: SITE_POINT.longitude,
		// The indexed spatial source; `latitude`/`longitude` are the display mirror.
		sitePoint: {
			x: Number(SITE_POINT.longitude),
			y: Number(SITE_POINT.latitude),
		},
		isPrimary: true,
		createdAt: now,
		updatedAt: now,
	});

	await drizzleDB.insert(tasks).values({
		projectId: project!.id,
		title: 'Cek panel lantai 1',
		stage: 'installation',
		assigneeUserId: person.userId,
		status: 'todo',
		createdAt: now,
		updatedAt: now,
	});

	logger.info(
		{ projectId: project!.id, pic: person.fullName, radius: DEMO_SITE_RADIUS_METERS },
		'Demo project seeded',
	);
}
