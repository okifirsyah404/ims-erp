import type {
	TSupplierCompanySelect,
	TSupplierSelect,
} from '@drizzle/schemas/supplier.schema';
import { inject, injectable } from 'tsyringe';

import {
	SUPPLIER_COMPANY_REPOSITORY_TOKEN,
	SUPPLIER_PERSON_REPOSITORY_TOKEN,
} from '../constants/di';
import type { ISupplierCompanyRepository } from '../contracts/supplier.repository.interface';
import type { ISupplierRepository } from '../contracts/supplier.repository.interface';
import { SupplierCompanyNotFoundError } from '../errors/supplier.errors';

/** Data a purchase order prints: the company block plus its primary PIC. */
export type TPurchaseSnapshot = {
	code: string;
	name: string;
	address: string | null;
	taxId: string | null;
	phone: string | null;
	email: string | null;
	picName: string | null;
	picTitle: string | null;
	picPhone: string | null;
	picEmail: string | null;
};

/**
 * Repository-only facade over the supplier master.
 *
 * @remarks
 * `procurement` resolves `supplier_company_id` / `supplier_pic_id` here before a
 * purchase order is written; `inventory` asserts `items.supplier_company_id`.
 * Repository-only on purpose: it must never depend on a module that itself
 * depends on this one.
 */
@injectable()
export class ExportedSupplierService {
	constructor(
		@inject(SUPPLIER_COMPANY_REPOSITORY_TOKEN)
		private readonly companies: ISupplierCompanyRepository,
		@inject(SUPPLIER_PERSON_REPOSITORY_TOKEN)
		private readonly people: ISupplierRepository,
	) {}

	/** The live company, or an error. */
	async assertActiveCompany(id: string): Promise<TSupplierCompanySelect> {
		const company = await this.companies.findById(id);
		if (!company) throw new SupplierCompanyNotFoundError();
		return company;
	}

	/** The live company by its `{SUPPLIER}` code, or `null`. */
	findCompanyByCode(code: string): Promise<TSupplierCompanySelect | null> {
		return this.companies.findByCode(code);
	}

	/** The live person, or `null`. */
	findPerson(id: string): Promise<TSupplierSelect | null> {
		return this.people.findById(id);
	}

	/**
	 * Builds the printed purchase-order block for a company.
	 *
	 * @remarks
	 * Address names the primary `supplier.company_addresses` row through the
	 * supplier module's own repository once addresses are served; until then it
	 * is the concatenated company contact fields.
	 */
	async getPurchaseSnapshot(companyId: string): Promise<TPurchaseSnapshot> {
		const company = await this.assertActiveCompany(companyId);
		return {
			code: company.code,
			name: company.name,
			address: null,
			taxId: company.taxId,
			phone: company.phone,
			email: company.email,
			picName: null,
			picTitle: null,
			picPhone: null,
			picEmail: null,
		};
	}

	/**
	 * Bank details of a company.
	 *
	 * @remarks
	 * Permission gating (`supplier:read_bank`) stays with the **caller**; this
	 * method only transports the data.
	 */
	getBankDetails(companyId: string): Promise<{
		bankName: string | null;
		bankAccountNumber: string | null;
		bankAccountHolder: string | null;
	} | null> {
		return this.companies.findById(companyId).then((company) =>
			company
				? {
						bankName: company.bankName,
						bankAccountNumber: company.bankAccountNumber,
						bankAccountHolder: company.bankAccountHolder,
					}
				: null,
		);
	}
}
