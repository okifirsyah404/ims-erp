import { customType } from 'drizzle-orm/pg-core';

/**
 * Unix timestamp (milliseconds since epoch) stored as PostgreSQL bigint.
 *
 * Bridges better-auth (which passes JS `Date` objects) with a bigint
 * storage column: Date -> millis on write, millis -> Date on read.
 *
 * JS `number` holds ms exactly up to ±2^53 ms (~273,790 years), so the
 * driver value is always a plain number, never a JS `BigInt`.
 */
export const unixTimestamp = customType<{ data: Date; driverData: bigint | number }>({
	dataType() {
		return 'bigint';
	},
	toDriver(value: Date) {
		return value.getTime();
	},
	fromDriver(value: bigint | number) {
		return new Date(Number(value));
	},
});

/**
 * Nullable variant: passes null through untouched.
 */
export const unixTimestampNullable = customType<{
	data: Date | null;
	driverData: bigint | number | null;
}>({
	dataType() {
		return 'bigint';
	},
	toDriver(value: Date | null) {
		return value ? value.getTime() : null;
	},
	fromDriver(value: bigint | number | null) {
		return value === null ? null : new Date(Number(value));
	},
});
