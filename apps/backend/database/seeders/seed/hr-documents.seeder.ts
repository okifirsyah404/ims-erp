import { and, asc, eq, isNull, ne } from 'drizzle-orm';
import pino from 'pino';
import { drizzleDB } from '../../../drizzle/db';
import { documents } from '../../../drizzle/schemas/document.schema';
import { employees } from '../../../drizzle/schemas/human-resource.schema';
import { isProductionEnv } from '../../../config/providers/env';
import { DocumentCodeNumberingRepository } from '../../../src/app/document/repositories/code-numbering.repository';
import { DocumentNumberingService } from '../../../src/app/document/services/document-numbering.service';

const logger = pino({
	timestamp: false,
	formatters: {
		level: (label) => ({ level: label }),
	},
});

/**
 * Seeds the ERP-0121 draft employment agreement of every seeded employee
 * (grill-me Q14: no backfill migration; the seeder covers the seeded rows,
 * the Documents tab covers the rest). No PDF: the render worker needs a
 * running Chromium and web-admin.
 *
 * Anchored per employee on a live `employment_agreement` row of that
 * employee, so a second run inserts nothing.
 */
export async function seedHrDocuments(): Promise<void> {
	if (isProductionEnv()) {
		logger.info('Production environment; skipping HR documents');
		return;
	}
	const people = await drizzleDB
		.select({ id: employees.id, organizationId: employees.organizationId, fullName: employees.fullName })
		.from(employees)
		.where(isNull(employees.deletedAt))
		.orderBy(asc(employees.employeeCode));
	// The seeder runs outside the DI container; the {COMPANY} token is the seeded profile's code.
	const numbering = new DocumentNumberingService(new DocumentCodeNumberingRepository(drizzleDB), { requireDocumentCode: async () => 'DEV' } as never);
	let created = 0;
	for (const person of people) {
		const [existing] = await drizzleDB
			.select({ id: documents.id })
			.from(documents)
			.where(
				and(
					eq(documents.module, 'human_resource'),
					eq(documents.sourceType, 'employee'),
					eq(documents.sourceId, person.id),
					eq(documents.documentType, 'employment_agreement'),
					ne(documents.status, 'void'),
					isNull(documents.deletedAt),
				),
			)
			.limit(1);
		if (existing) continue;
		const now = new Date();
		await drizzleDB.insert(documents).values({
			organizationId: person.organizationId,
			code: await numbering.next('document'),
			documentType: 'employment_agreement',
			title: `Perjanjian Kerja - ${person.fullName}`,
			templateId: null,
			module: 'human_resource',
			sourceType: 'employee',
			sourceId: person.id,
			status: 'draft',
			issuedOn: null,
			issuedByUserId: null,
			version: 1,
			isCurrent: true,
			createdAt: now,
			updatedAt: now,
		});
		created += 1;
	}
	logger.info({ created }, 'Seeded employee employment agreements');
}
