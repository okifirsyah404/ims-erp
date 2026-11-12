import { isNull } from 'drizzle-orm';
import pino from 'pino';
import { isProductionEnv } from '../../../config/providers/env';
import { drizzleDB } from '../../../drizzle/db';
import {
	bankAccounts,
	companyProfiles,
	contacts,
	headOfficeAddresses,
} from '../../../drizzle/schemas/company.schema';
import { SEED_ORGANIZATION_NAME } from './organization.seeder';

const logger = pino({
	timestamp: false,
	formatters: {
		level: (label) => ({ level: label }),
	},
});

/**
 * Dev-only company profile, so document numbers work right after seeding
 * (`{COMPANY}` comes from the profile's document code, ADR-0011) and printed
 * invoices have a letterhead.
 *
 * @remarks
 * Runs first: every later seeder may allocate a code, and allocation needs the
 * company document code. Idempotent: does nothing when a live profile exists,
 * so an edited profile is never overwritten. Skipped in production, where the
 * owner fills in the real profile through the company page.
 */
export async function seedCompany(): Promise<void> {
	if (isProductionEnv()) {
		logger.info('Production environment; skipping company seeding');
		return;
	}
	const [existing] = await drizzleDB
		.select({ id: companyProfiles.id })
		.from(companyProfiles)
		.where(isNull(companyProfiles.deletedAt))
		.limit(1);
	if (existing) {
		logger.info('Company profile already exists; skipping');
		return;
	}

	const now = new Date();
	await drizzleDB.insert(companyProfiles).values({
		legalName: `PT ${SEED_ORGANIZATION_NAME} (dev)`,
		tradingName: SEED_ORGANIZATION_NAME,
		documentCode: 'DEV',
		tagline: 'Access control, integrated',
		taxId: '01.234.567.8-901.000',
		signatoryName: 'Budi Santoso',
		signatoryTitle: 'Director',
		createdAt: now,
		updatedAt: now,
	});

	await drizzleDB.insert(headOfficeAddresses).values({
		addressLine: 'Jl. Jenderal Sudirman Kav. 52-53, Jakarta Selatan 12190',
		postalCode: '12190',
		isPrimary: true,
		createdAt: now,
		updatedAt: now,
	});

	await drizzleDB.insert(contacts).values([
		{
			contactType: 'phone',
			value: '+62 21 5140 0000',
			label: 'Phone',
			isPrimary: true,
			createdAt: now,
			updatedAt: now,
		},
		{
			contactType: 'email',
			value: 'hello@entragate.example',
			label: 'Email',
			isPrimary: true,
			createdAt: now,
			updatedAt: now,
		},
		{
			contactType: 'other',
			value: 'https://entragate.example',
			label: 'Website',
			createdAt: now,
			updatedAt: now,
		},
	]);

	await drizzleDB.insert(bankAccounts).values([
		{
			code: 'INVOICE-VAT',
			bankName: 'Bank Central Asia',
			accountNumber: '1234567890',
			accountHolder: `PT ${SEED_ORGANIZATION_NAME}`,
			invoiceUsage: 'vat',
			isPrimary: true,
			createdAt: now,
			updatedAt: now,
		},
		{
			code: 'INVOICE-NON-VAT',
			bankName: 'Bank Mandiri',
			accountNumber: '0987654321',
			accountHolder: `PT ${SEED_ORGANIZATION_NAME}`,
			invoiceUsage: 'non_vat',
			createdAt: now,
			updatedAt: now,
		},
	]);

	logger.info('Seeded dev company profile');
}
