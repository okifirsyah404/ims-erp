import type {
	TApiErrorMessage,
	TApiPaginatedResponse,
	TApiResponse,
	TPaginationMeta,
} from '@ims-erp/common';
import { queryOptions } from '@tanstack/react-query';

/**
 * API client for the HR employee endpoints (`/human-resources/employees*`).
 *
 * @remarks
 * Tenant scope comes from the caller's active organization server-side:
 * the list returns own-org rows plus company-level ones. `employee:*`
 * permissions gate every call; the UI only hides controls it knows will
 * fail.
 */

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

/** Employee lifecycle statuses, mirroring `EMPLOYMENT_STATUSES`. */
export const EMPLOYMENT_STATUSES = ['active', 'inactive', 'terminated'] as const;
export type TEmploymentStatus = (typeof EMPLOYMENT_STATUSES)[number];

export const EMPLOYMENT_TYPES = [
	'permanent',
	'contract',
	'probation',
	'internship',
	'outsourced',
] as const;
export type TEmploymentType = (typeof EMPLOYMENT_TYPES)[number];

export const WORK_TYPES = ['onsite', 'remote', 'hybrid'] as const;
export type TWorkType = (typeof WORK_TYPES)[number];

export type TEmployee = {
	id: string;
	organizationId: string | null;
	userId: string | null;
	employeeCode: string;
	fullName: string;
	legalName: string | null;
	nickname: string | null;
	gender: 'male' | 'female' | null;
	birthDate: string | null;
	birthPlace: string | null;
	nationalId: string | null;
	maritalStatus: string | null;
	email: string | null;
	phone: string | null;
	whatsapp: string | null;
	employmentStatus: TEmploymentStatus;
	employmentType: TEmploymentType;
	workType: TWorkType;
	hireDate: string | null;
	terminationDate: string | null;
	managerEmployeeId: string | null;
	createdAt: string;
	updatedAt: string;
	deletedAt: string | null;
	/** Avatar and handle of the login, on list rows; `null` without a login. */
	login?: { username: string | null; image: string | null } | null;
	/** The linked login (`auth.users`), detail endpoint only; `null` without a login. */
	account?: TEmployeeAccount | null;
};

/** The login behind an employee, as the employee detail returns it (no credential data). */
export type TEmployeeAccount = {
	id: string;
	name: string;
	email: string;
	emailVerified: boolean;
	username: string | null;
	displayUsername: string | null;
	image: string | null;
	phone: string | null;
	bio: string | null;
	role: string | null;
	status: 'pending' | 'active' | 'deactivated';
	banned: boolean;
	banReason: string | null;
	banExpires: string | null;
	claimedAt: string | null;
	createdAt: string;
	updatedAt: string;
};

type TPaginated<T> = { rows: T[]; pagination: TPaginationMeta };

async function request<T>(path: string, init?: RequestInit): Promise<TApiResponse<T>> {
	const response = await fetch(`${API_URL}${path}`, {
		credentials: 'include',
		headers:
			init?.body != null ? { 'Content-Type': 'application/json' } : undefined,
		...init,
	});
	const text = await response.text();
	const envelope = text ? (JSON.parse(text) as TApiResponse<T>) : ({} as TApiResponse<T>);
	if (!response.ok) {
		const message =
			(envelope as { errors?: TApiErrorMessage[] }).errors?.[0]?.message ??
			envelope.message ??
			`Request failed (${response.status})`;
		throw new Error(message);
	}
	return envelope;
}

async function getData<T>(path: string): Promise<T> {
	return (await request<T>(path)).data as T;
}

async function sendData<T>(
	path: string,
	method: 'POST' | 'PATCH' | 'DELETE',
	body?: unknown,
): Promise<T> {
	return (
		(await request<T>(path, {
			method,
			body: body === undefined ? undefined : JSON.stringify(body),
		})) as TApiResponse<T>
	).data as T;
}

async function getDataPaginated<T>(path: string): Promise<TPaginated<T>> {
	const envelope = (await request<T[]>(path)) as TApiPaginatedResponse<T>;
	return { rows: envelope.data, pagination: envelope.pagination };
}

/* ------------------------------ employees ------------------------------- */

export type TEmployeeListParams = {
	page: number;
	limit: number;
	search?: string;
	status?: TEmploymentStatus;
	scope?: 'all' | 'organization' | 'company';
	employmentType?: TEmploymentType;
	workType?: TWorkType;
	gender?: TGender;
	maritalStatus?: TMaritalStatus;
	/** `yes`: has a login account; `no`: none. */
	login?: 'yes' | 'no';
	sortBy?: TEmployeeSortField;
	sortDir?: 'asc' | 'desc';
};

export const GENDERS = ['male', 'female'] as const;
export type TGender = (typeof GENDERS)[number];
export const MARITAL_STATUSES = ['single', 'married', 'divorced', 'widowed'] as const;
export type TMaritalStatus = (typeof MARITAL_STATUSES)[number];
export const EMPLOYEE_SORT_FIELDS = ['fullName', 'employeeCode', 'hireDate', 'createdAt'] as const;
export type TEmployeeSortField = (typeof EMPLOYEE_SORT_FIELDS)[number];

export function employeesQueryOptions(params: TEmployeeListParams) {
	const search = new URLSearchParams({
		page: String(params.page),
		limit: String(params.limit),
	});
	for (const key of ['search', 'status', 'scope', 'employmentType', 'workType', 'gender', 'maritalStatus', 'login', 'sortBy', 'sortDir'] as const) {
		const value = params[key];
		if (value) search.set(key, value);
	}
	return queryOptions({
		queryKey: ['hr', 'employees', params],
		queryFn: () => getDataPaginated<TEmployee>(`/human-resources/employees?${search.toString()}`),
	});
}

export function employeeDetailQueryOptions(id: string) {
	return queryOptions({
		queryKey: ['hr', 'employees', 'detail', id],
		queryFn: () => getData<TEmployee>(`/human-resources/employees/${id}`),
	});
}

/** Minimal picker row for the warehouse PIC dropdown. */
export type TEmployeePickerRow = {
	id: string;
	employeeCode: string;
	fullName: string;
	organizationId: string | null;
};

/** Candidates for the warehouse PIC: linked-org employees + company-level. */
export function employeePickerQueryOptions(organizationIds: string[], search?: string) {
	return queryOptions({
		queryKey: ['hr', 'employees', 'picker', { organizationIds, search }],
		queryFn: () => {
			const params = new URLSearchParams({
				organizationIds: organizationIds.join(','),
			});
			if (search) params.set('search', search);
			return getData<TEmployeePickerRow[]>(`/human-resources/employees/picker?${params.toString()}`);
		},
		enabled: organizationIds.length > 0,
	});
}

export function createEmployee(input: {
	fullName: string;
	email: string;
	organizationId?: string | null;
	organizationRoles?: string[];
	employeeCode?: string | null;
	legalName?: string | null;
	nickname?: string | null;
	gender?: 'male' | 'female' | null;
	birthDate?: string | null;
	birthPlace?: string | null;
	nationalId?: string | null;
	maritalStatus?: string | null;
	phone?: string | null;
	whatsapp?: string | null;
	employmentStatus?: TEmploymentStatus;
	employmentType?: TEmploymentType;
	workType?: TWorkType;
	hireDate?: string | null;
	terminationDate?: string | null;
}) {
	return sendData<TEmployee>('/human-resources/employees', 'POST', input);
}

export function updateEmployee(id: string, input: Record<string, unknown>) {
	return sendData<TEmployee>(`/human-resources/employees/${id}`, 'PATCH', input);
}

export function archiveEmployee(id: string) {
	return sendData<{ archived: boolean }>(`/human-resources/employees/${id}`, 'DELETE');
}
