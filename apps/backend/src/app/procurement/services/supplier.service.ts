import { LOCATION_SERVICE_TOKEN } from '@app/location/constants/di';
import type { LocationService } from '@app/location/services/location.service';
import { isUniqueViolation } from '@drizzle/errors';
import type { TSupplierSelect } from '@drizzle/schemas/procurement.schema';
import type { TPaginationResult } from '@ims-erp/common';
import { inject, injectable } from 'tsyringe';
import { SUPPLIER_REPOSITORY_TOKEN } from '../constants/di';
import type { ISupplierRepository } from '../contracts/procurement.repository.interface';
import {
	SUPPLIER_BANK_FIELDS,
	type TCreateSupplierInput,
	type TSupplierListQuery,
	type TUpdateSupplierInput,
} from '../contracts/supplier.contract';
import {
	SupplierCodeTakenError,
	SupplierNotFoundError,
	SupplierStatusUnchangedError,
	SupplierVillageNotFoundError,
} from '../errors/procurement.errors';

/** A supplier as returned to a caller; bank columns are `null` without `supplier:read_bank`. */
export type TSupplierView = TSupplierSelect & { bankVisible: boolean };

function view(supplier: TSupplierSelect, canSeeBank: boolean): TSupplierView {
	if (canSeeBank) return { ...supplier, bankVisible: true };
	return { ...supplier, bankName: null, bankAccountNumber: null, bankAccountHolder: null, bankVisible: false };
}

/** Bank columns are neither shown to nor accepted from callers without `supplier:read_bank`. */
function withoutBank<T extends Record<string, unknown>>(input: T, canSeeBank: boolean): T {
	if (canSeeBank) return input;
	const copy = { ...input };
	for (const field of SUPPLIER_BANK_FIELDS) delete copy[field];
	return copy;
}

/**
 * Supplier master-data use cases (company-wide, ADR-0011 step 4a).
 *
 * @remarks
 * Exported contract for other modules: {@link SupplierService.getActiveSupplier}.
 * The address village is validated through the Location module's service.
 */
@injectable()
export class SupplierService {
	constructor(
		@inject(SUPPLIER_REPOSITORY_TOKEN)
		private readonly suppliers: ISupplierRepository,
		@inject(LOCATION_SERVICE_TOKEN)
		private readonly locations: Pick<LocationService, 'getVillage'>,
	) {}

	private async assertVillage(villageId: string | null | undefined) {
		if (villageId && !(await this.locations.getVillage(villageId))) throw new SupplierVillageNotFoundError();
	}

	private async assertCodeFree(code: string, exceptId?: string) {
		const existing = await this.suppliers.findByCode(code);
		if (existing && existing.id !== exceptId) throw new SupplierCodeTakenError(code);
	}

	private async require(id: string): Promise<TSupplierSelect> {
		const supplier = await this.suppliers.findById(id);
		if (!supplier) throw new SupplierNotFoundError();
		return supplier;
	}

	async list(query: TSupplierListQuery, canSeeBank: boolean): Promise<TPaginationResult<TSupplierView>> {
		const result = await this.suppliers.paginate(query);
		return { meta: result.meta, data: result.data.map((row) => view(row, canSeeBank)) };
	}

	async get(id: string, canSeeBank: boolean): Promise<TSupplierView> {
		return view(await this.require(id), canSeeBank);
	}

	/** An active supplier, or `null` — for new purchase orders. */
	async getActiveSupplier(id: string): Promise<TSupplierSelect | null> {
		const supplier = await this.suppliers.findById(id);
		return supplier?.status === 'active' ? supplier : null;
	}

	async create(input: TCreateSupplierInput, actorUserId: string, canSeeBank: boolean): Promise<TSupplierView> {
		await this.assertVillage(input.villageId);
		await this.assertCodeFree(input.code);
		try {
			return view(await this.suppliers.create({ ...withoutBank(input, canSeeBank), createdBy: actorUserId }), canSeeBank);
		} catch (error) {
			if (isUniqueViolation(error)) throw new SupplierCodeTakenError(input.code);
			throw error;
		}
	}

	async update(id: string, patch: TUpdateSupplierInput, canSeeBank: boolean): Promise<TSupplierView> {
		await this.require(id);
		await this.assertVillage(patch.villageId);
		if (patch.code !== undefined) await this.assertCodeFree(patch.code, id);
		try {
			const updated = await this.suppliers.update(id, withoutBank(patch, canSeeBank));
			if (!updated) throw new SupplierNotFoundError();
			return view(updated, canSeeBank);
		} catch (error) {
			if (isUniqueViolation(error) && patch.code) throw new SupplierCodeTakenError(patch.code);
			throw error;
		}
	}

	async setActive(id: string, active: boolean, canSeeBank: boolean): Promise<TSupplierView> {
		await this.require(id);
		const updated = active
			? await this.suppliers.transitionStatus(id, 'inactive', 'active')
			: await this.suppliers.transitionStatus(id, 'active', 'inactive');
		if (!updated) throw new SupplierStatusUnchangedError(active ? 'active' : 'inactive');
		return view(updated, canSeeBank);
	}
}
