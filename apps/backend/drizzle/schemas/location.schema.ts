import {
	unixTimestamp,
	unixTimestampNullable,
} from '@drizzle/datatypes/unix-timestamp';
import { defineRelationsPart, sql } from 'drizzle-orm';
import {
	index,
	pgSchema,
	text,
	uniqueIndex,
	uuid,
	varchar,
} from 'drizzle-orm/pg-core';

export const locationSchema = pgSchema('location');

export const province = locationSchema.table(
	'provinces',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		code: varchar('code', { length: 20 }).notNull().unique(),
		name: text('name').notNull(),
		createdAt: unixTimestamp('created_at').notNull(),
		updatedAt: unixTimestampNullable('updated_at').$onUpdate(() => new Date()),
		deletedAt: unixTimestampNullable('deleted_at'),
	},
	(table) => [
		index('province_name_idx').on(table.name),
		uniqueIndex('province_code_idx').on(table.code),
	],
);

export const regency = locationSchema.table(
	'regencies',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		code: varchar('code', { length: 20 }).notNull().unique(),
		name: text('name').notNull(),
		createdAt: unixTimestamp('created_at').notNull(),
		updatedAt: unixTimestampNullable('updated_at').$onUpdate(() => new Date()),
		deletedAt: unixTimestampNullable('deleted_at'),
		provinceId: uuid('province_id').references(() => province.id, {
			onDelete: 'cascade',
		}),
	},
	(table) => [
		index('regency_name_idx').on(table.name),
		uniqueIndex('regency_code_idx').on(table.code),
	],
);

export const district = locationSchema.table(
	'districts',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		code: varchar('code', { length: 20 }).notNull().unique(),
		name: text('name').notNull(),
		createdAt: unixTimestamp('created_at').notNull(),
		updatedAt: unixTimestampNullable('updated_at').$onUpdate(() => new Date()),
		deletedAt: unixTimestampNullable('deleted_at'),
		regencyId: uuid('regency_id').references(() => regency.id, {
			onDelete: 'cascade',
		}),
	},
	(table) => [
		index('district_name_idx').on(table.name),
		uniqueIndex('district_code_idx').on(table.code),
	],
);

export const village = locationSchema.table(
	'villages',
	{
		id: uuid('id')
			.primaryKey()
			.default(sql`uuidv7()`),
		code: varchar('code', { length: 20 }).notNull().unique(),
		name: text('name').notNull(),
		createdAt: unixTimestamp('created_at').notNull(),
		updatedAt: unixTimestampNullable('updated_at').$onUpdate(() => new Date()),
		deletedAt: unixTimestampNullable('deleted_at'),
		districtId: uuid('district_id').references(() => district.id, {
			onDelete: 'cascade',
		}),
	},
	(table) => [
		index('village_name_idx').on(table.name),
		uniqueIndex('village_code_idx').on(table.code),
	],
);

export const locationRelations = defineRelationsPart(
	{
		province,
		regency,
		district,
		village,
	},
	(r) => ({
		province: {
			regency: r.many.regency({
				from: r.province.id,
				to: r.regency.provinceId,
			}),
		},
		regency: {
			province: r.one.province({
				from: r.regency.provinceId,
				to: r.province.id,
			}),
			district: r.many.district({
				from: r.regency.id,
				to: r.district.regencyId,
			}),
		},
		district: {
			regency: r.one.regency({
				from: r.district.regencyId,
				to: r.regency.id,
			}),
			village: r.many.village({
				from: r.district.id,
				to: r.village.districtId,
			}),
		},
		village: {
			district: r.one.district({
				from: r.village.districtId,
				to: r.district.id,
			}),
		},
	}),
);

export type TProvinceInsert = typeof province.$inferInsert;
export type TProvinceSelect = typeof province.$inferSelect;

export type TRegencyInsert = typeof regency.$inferInsert;
export type TRegencySelect = typeof regency.$inferSelect;

export type TDistrictInsert = typeof district.$inferInsert;
export type TDistrictSelect = typeof district.$inferSelect;

export type TVillageInsert = typeof village.$inferInsert;
export type TVillageSelect = typeof village.$inferSelect;
