import { inject, injectable } from 'tsyringe';

import { AppError } from '@http/errors';

import {
	SUPPLIER_COMPANY_REPOSITORY_TOKEN,
	SUPPLIER_PERSON_REPOSITORY_TOKEN,
} from '../constants/di';
import type {
	TSupplierCompanyCreateInput,
	TSupplierCompanyListQuery,
	TSupplierCompanyUpdateInput,
	TSupplierCreateInput,
	TSupplierListQuery,
	TSupplierCompanyView,
	TSupplierUpdateInput,
} from '../contracts/supplier.contract';
import type {
	ISupplierCompanyRepository,
	ISupplierRepository,
} from '../contracts/supplier.repository.interface';
import {
	SupplierCompanyCodeTakenError,
	SupplierCompanyNotFoundError,
	SupplierPersonNotFoundError,
} from '../errors/supplier.errors';

/**
 * Use cases for the supplier master: companies (B2B entity) and people (PIC).
 *
 * @remarks
 * One service for both halves of the module; the repositories stay one per
 * table. Permission checks live in the controller guards; ownership of bank
 * detail readability is enforced at read sites via `ExportedSupplierService`.
 */
@injectable()
export class SupplierService {
	constructor(
		@inject(SUPPLIER_COMPANY_REPOSITORY_TOKEN)
		private readonly companies: ISupplierCompanyRepository,
		@inject(SUPPLIER_PERSON_REPOSITORY_TOKEN)
		private readonly people: ISupplierRepository,
	) {}

	async listCompanies(query: TSupplierCompanyListQuery) {
		const [data, total] = await Promise.all([
			this.companies.paginate(query),
			this.companies.count(query),
		]);
		return {
			meta: {
				page: query.page,
				limit: query.limit,
				total,
				totalPages: Math.max(1, Math.ceil(total / query.limit)),
			},
			data,
		};
	}

	async getCompany(id: string): Promise<TSupplierCompanyView> {
		const company = await this.companies.findById(id);
		if (!company) throw new SupplierCompanyNotFoundError();

		const people = await this.people.paginate({ page: 1, limit: 100, companyId: id });
		return { ...company, people };
	}

	async createCompany(
		data: TSupplierCompanyCreateInput,
		actorUserId: string,
	) {
		const existing = await this.companies.findByCode(data.code);
		if (existing) throw new SupplierCompanyCodeTakenError(data.code);
		return this.companies.create({ ...data, createdBy: actorUserId });
	}

	async updateCompany(id: string, patch: TSupplierCompanyUpdateInput) {
		const row = await this.companies.update(id, patch);
		if (!row) throw new SupplierCompanyNotFoundError();
		return row;
	}

	async setCompanyActive(id: string, active: boolean) {
		const current = await this.companies.findById(id);
		if (!current) throw new SupplierCompanyNotFoundError();
		if (current.status === (active ? 'active' : 'inactive')) {
			throw new AppError(
				409,
				active
					? 'procurement.supplierAlreadyActive'
					: 'procurement.supplierAlreadyInactive',
				'Supplier already in this status',
			);
		}
		return this.companies.transitionStatus(
			id,
			current.status as 'active' | 'inactive',
			active ? 'active' : 'inactive',
		);
	}

	async listPeople(query: TSupplierListQuery) {
		const [data, total] = await Promise.all([
			this.people.paginate(query),
			this.people.count(query),
		]);
		return {
			meta: {
				page: query.page,
				limit: query.limit,
				total,
				totalPages: Math.max(1, Math.ceil(total / query.limit)),
			},
			data,
		};
	}

	async createPerson(data: TSupplierCreateInput, actorUserId: string) {
		if (data.companyId) {
			const company = await this.companies.findById(data.companyId);
			if (!company) throw new SupplierCompanyNotFoundError();
		}
		return this.people.create({ ...data, createdBy: actorUserId });
	}

	async updatePerson(id: string, patch: TSupplierUpdateInput) {
		const row = await this.people.update(id, patch);
		if (!row) throw new SupplierPersonNotFoundError();
		return row;
	}

	async removePerson(id: string): Promise<void> {
		const removed = await this.people.softDelete(id);
		if (!removed) throw new SupplierPersonNotFoundError();
	}
}
