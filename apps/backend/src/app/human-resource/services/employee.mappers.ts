import type { TEmployeeInsert, TEmployeeSelect } from '@drizzle/schemas/human-resource.schema';
import type { TUserPersonalFields, TUserPersonalFieldsPatch } from '@app/user/contracts/user-personal-fields.contract';
import type { IUserPersonalFieldsPort } from '@app/user/contracts/user-personal-fields.port';
import type { TEmployeeDto } from '../contracts/hr.contract';

/** Parses a `YYYY-MM-DD` business date into the instant at Jakarta midnight. */
export function jakartaDate(value: string | null | undefined): Date | null {
	if (!value) return null;
	return new Date(`${value}T00:00:00+07:00`);
}

/**
 * Maps the employment-side API body into a DB insert shape. Personal fields
 * (gender, birth date/place, marital status) live on `auth.users`, see
 * {@link personalPatchFrom}.
 */
export function toRow(body: {
	fullName: string;
	nickname?: string | null;
	nationalId?: string | null;
	taxId?: string | null;
	ptkpStatus?: string | null;
	bpjsHealthNumber?: string | null;
	bpjsEmploymentNumber?: string | null;
	email?: string | null;
	phone?: string | null;
	employmentStatus?: string;
	employmentType?: string;
	workType?: string;
	hireDate?: string | null;
	terminationDate?: string | null;
	managerEmployeeId?: string | null;
}): Omit<TEmployeeInsert, 'employeeCode' | 'createdAt'> {
	return {
		fullName: body.fullName,
		nickname: body.nickname ?? null,
		nationalId: body.nationalId ?? null,
		taxId: body.taxId ?? null,
		ptkpStatus: body.ptkpStatus ?? null,
		bpjsHealthNumber: body.bpjsHealthNumber ?? null,
		bpjsEmploymentNumber: body.bpjsEmploymentNumber ?? null,
		email: body.email ?? null,
		phone: body.phone ?? null,
		employmentStatus: body.employmentStatus,
		employmentType: body.employmentType,
		workType: body.workType,
		hireDate: jakartaDate(body.hireDate),
		terminationDate: jakartaDate(body.terminationDate),
		managerEmployeeId: body.managerEmployeeId ?? null,
	};
}

const emptyPersonal: TUserPersonalFields = {
	gender: null,
	birthDate: null,
	birthPlace: null,
	maritalStatus: null,
};

/** Personal-field patch from the API body (absent keys stay untouched). */
export function personalPatchFrom(body: {
	gender?: 'male' | 'female' | null;
	birthDate?: string | null;
	birthPlace?: string | null;
	maritalStatus?: 'single' | 'married' | 'divorced' | 'widowed' | null;
}): TUserPersonalFieldsPatch {
	return {
		...(body.gender !== undefined ? { gender: body.gender ?? null } : {}),
		...(body.birthDate !== undefined ? { birthDate: jakartaDate(body.birthDate) } : {}),
		...(body.birthPlace !== undefined ? { birthPlace: body.birthPlace ?? null } : {}),
		...(body.maritalStatus !== undefined ? { maritalStatus: body.maritalStatus ?? null } : {}),
	};
}

/** Joins personal fields from `auth.users` onto an employee row for the API. */
export async function withPersonalFields(
	personalFields: IUserPersonalFieldsPort,
	row: TEmployeeSelect,
): Promise<TEmployeeDto> {
	const personal: TUserPersonalFields = row.userId
		? ((await personalFields.get(row.userId)) ?? emptyPersonal)
		: emptyPersonal;
	return {
		...(row as unknown as TEmployeeDto),
		...personal,
		birthDate: personal.birthDate ? personal.birthDate.toISOString() : null,
	} as unknown as TEmployeeDto;
}
