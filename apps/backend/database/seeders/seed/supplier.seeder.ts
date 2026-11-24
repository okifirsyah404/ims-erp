import { and, eq, isNull } from 'drizzle-orm';
import pino from 'pino';
import { drizzleDB } from '../../../drizzle/db';
import {
	supplierCompanies,
	supplierCompanyAddresses,
	suppliers,
} from '../../../drizzle/schemas/supplier.schema';

const logger = pino({
	timestamp: false,
	formatters: {
		level: (label) => ({ level: label }),
	},
});

/** One seeded supplier; `pic`/`address` are absent for an individual. */
type TSeedSupplier = {
	code: string;
	name: string;
	supplierType: 'company' | 'government' | 'individual';
	legalName: string | null;
	taxId: string | null;
	email: string;
	phone: string;
	pic?: { name: string; title: string; phone: string; email: string };
	address?: { line: string; postalCode: string };
};

const SUPPLIERS: TSeedSupplier[] = [
	{
		code: 'DEV-SUP-CO',
		name: 'PT Sinar Akses Nusantara',
		supplierType: 'company',
		legalName: 'PT Sinar Akses Nusantara',
		taxId: '0123456789012345',
		email: 'sales@sinarakses.example',
		phone: '+62215550101',
		pic: {
			name: 'Ria Nainggolan',
			title: 'Sales Manager',
			phone: '+628123450001',
			email: 'ria@sinarakses.example',
		},
		address: {
			line: 'Jl. Mangga Dua Raya No. 12, Jakarta Utara 14430',
			postalCode: '14430',
		},
	},
	{
		code: 'DEV-SUP-GOV',
		name: 'Dinas Perhubungan Provinsi DKI Jakarta',
		supplierType: 'government',
		legalName: 'Dinas Perhubungan Provinsi DKI Jakarta',
		taxId: '0987654321098765',
		email: 'pengadaan@dishub.example',
		phone: '+622138210001',
		pic: {
			name: 'Bambang Prasetyo',
			title: 'Kepala Seksi Pengadaan',
			phone: '+628123450002',
			email: 'bambang@dishub.example',
		},
		address: {
			line: 'Jl. Taman Jatibaru No. 1, Jakarta Pusat 10150',
			postalCode: '10150',
		},
	},
	{
		code: 'DEV-SUP-IND',
		name: 'Agus Setiawan',
		supplierType: 'individual',
		legalName: null,
		taxId: null,
		email: 'agus.setiawan@example.com',
		phone: '+628123450003',
	},
];

/**
 * Dev supplier fixtures: one company, one government agency and one
 * individual, each with a PIC and an address where that makes sense.
 *
 * @remarks
 * Idempotent by `code`: an existing live supplier is left untouched, so edits
 * made through the UI are never overwritten. Runs after the organization
 * seeder because a generated code may carry the `{ORG}` token.
 */
export async function seedSupplier(): Promise<void> {
	for (const seed of SUPPLIERS) {
		const [existing] = await drizzleDB
			.select({ id: supplierCompanies.id })
			.from(supplierCompanies)
			.where(
				and(
					eq(supplierCompanies.code, seed.code),
					isNull(supplierCompanies.deletedAt),
				),
			)
			.limit(1);
		if (existing) continue;

		const now = new Date();
		const [company] = await drizzleDB
			.insert(supplierCompanies)
			.values({
				code: seed.code,
				name: seed.name,
				supplierType: seed.supplierType,
				legalName: seed.legalName,
				taxId: seed.taxId,
				email: seed.email,
				phone: seed.phone,
				status: 'active',
				createdAt: now,
				updatedAt: now,
			})
			.returning({ id: supplierCompanies.id });
		if (!company) continue;

		if (seed.pic) {
			await drizzleDB.insert(suppliers).values({
				companyId: company.id,
				...seed.pic,
				isPrimary: true,
				status: 'active',
				createdAt: now,
				updatedAt: now,
			});
		}
		if (seed.address) {
			await drizzleDB.insert(supplierCompanyAddresses).values({
				companyId: company.id,
				kind: 'office',
				label: 'Head office',
				addressLine: seed.address.line,
				postalCode: seed.address.postalCode,
				isPrimary: true,
				createdAt: now,
				updatedAt: now,
			});
		}
		logger.info({ code: seed.code }, 'Seeded supplier');
	}
}
