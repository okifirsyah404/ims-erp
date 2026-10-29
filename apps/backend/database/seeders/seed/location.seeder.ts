import {
	district,
	province,
	regency,
	village,
} from '@drizzle/schemas/location.schema';
import { sql } from 'drizzle-orm';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { DateTime, Duration } from 'luxon';
import path from 'node:path';
import pino from 'pino';

const logger = pino({
	timestamp: false,
	formatters: {
		level: (label) => ({ level: label }),
	},
});

const CHUNK_SIZE = 1_000;

type LocationEntry = { code: string; name: string };
type LocationRow = {
	code: string;
	name: string;
	createdAt: Date;
	provinceId?: string;
	regencyId?: string;
	districtId?: string;
};

function rawLocationPath(fileName: string): string {
	return path.join(__dirname, '..', 'raw', 'location', fileName);
}

async function readRawLocationData(fileName: string): Promise<LocationEntry[]> {
	const file = Bun.file(rawLocationPath(fileName));
	return file.json();
}

const drizzleName: unique symbol = Symbol.for('drizzle:Name');

type AnyLocationTable =
	typeof province | typeof regency | typeof district | typeof village;

function tableName(table: AnyLocationTable): string {
	return (table as unknown as Record<typeof drizzleName, string>)[drizzleName];
}

async function insertChunked(
	db: BunSQLDatabase,
	table: AnyLocationTable,
	rows: LocationRow[],
): Promise<number> {
	let processed = 0;
	const tableStart = DateTime.now();
	const name = tableName(table);

	for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
		const chunk = rows.slice(i, i + CHUNK_SIZE);

		await db.transaction(async (tx) => {
			await tx
				.insert(table)
				.values(chunk)
				.onConflictDoUpdate({
					target: table.code,
					set: { name: sql.raw('excluded.name') },
				});
		});

		processed += chunk.length;
		logger.debug(
			{ table: name, processed, total: rows.length },
			'Insert progress',
		);
	}

	const duration = Duration.fromObject({
		milliseconds: DateTime.now().diff(tableStart).milliseconds,
	})
		.shiftTo('seconds', 'milliseconds')
		.toHuman();

	logger.info({ table: name, rows: processed, duration }, 'Table seeded');
	return processed;
}

function requireParentId(
	entry: LocationEntry,
	parentCode: string,
	parentMap: Map<string, string>,
	parentName: string,
): string {
	const parentId = parentMap.get(parentCode);

	if (!parentId) {
		throw new Error(
			`No ${parentName} found for code "${entry.code}" (prefix "${parentCode}")`,
		);
	}

	return parentId;
}

export async function seedProvinces(db: BunSQLDatabase): Promise<number> {
	const data = await readRawLocationData('provinces.json');
	const rows: LocationRow[] = data.map((entry) => ({
		code: entry.code,
		name: entry.name,
		createdAt: new Date(),
	}));

	return insertChunked(db, province, rows);
}

export async function seedRegencies(
	db: BunSQLDatabase,
	provinceIdByCode: Map<string, string>,
): Promise<number> {
	const data = await readRawLocationData('regencies.json');
	const rows: LocationRow[] = data.map((entry) => ({
		code: entry.code,
		name: entry.name,
		createdAt: new Date(),
		provinceId: requireParentId(
			entry,
			entry.code.slice(0, 2),
			provinceIdByCode,
			'province',
		),
	}));

	return insertChunked(db, regency, rows);
}

export async function seedDistricts(
	db: BunSQLDatabase,
	regencyIdByCode: Map<string, string>,
): Promise<number> {
	const data = await readRawLocationData('districts.json');
	const rows: LocationRow[] = data.map((entry) => ({
		code: entry.code,
		name: entry.name,
		createdAt: new Date(),
		regencyId: requireParentId(
			entry,
			entry.code.slice(0, 4),
			regencyIdByCode,
			'regency',
		),
	}));

	return insertChunked(db, district, rows);
}

export async function seedVillages(
	db: BunSQLDatabase,
	districtIdByCode: Map<string, string>,
): Promise<number> {
	const data = await readRawLocationData('villages.json');
	const rows: LocationRow[] = data.map((entry) => ({
		code: entry.code,
		name: entry.name,
		createdAt: new Date(),
		districtId: requireParentId(
			entry,
			entry.code.slice(0, 6),
			districtIdByCode,
			'district',
		),
	}));

	return insertChunked(db, village, rows);
}

export async function seedLocations(db: BunSQLDatabase): Promise<void> {
	await seedProvinces(db);
	const provinceIdByCode = new Map(
		(
			await db.select({ code: province.code, id: province.id }).from(province)
		).map((row) => [row.code, row.id]),
	);

	await seedRegencies(db, provinceIdByCode);
	const regencyIdByCode = new Map(
		(await db.select({ code: regency.code, id: regency.id }).from(regency)).map(
			(row) => [row.code, row.id],
		),
	);

	await seedDistricts(db, regencyIdByCode);
	const districtIdByCode = new Map(
		(
			await db.select({ code: district.code, id: district.id }).from(district)
		).map((row) => [row.code, row.id]),
	);

	await seedVillages(db, districtIdByCode);
}
