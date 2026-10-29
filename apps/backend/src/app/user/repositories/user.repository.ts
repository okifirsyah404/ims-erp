import { DRIZZLE_TOKEN } from '@di/provider';
import { BunSQLDatabase } from 'drizzle-orm/bun-sql/postgres';
import { inject, injectable } from 'tsyringe';

@injectable()
class UserRepository {
	constructor(@inject(DRIZZLE_TOKEN) database: BunSQLDatabase) {}
}