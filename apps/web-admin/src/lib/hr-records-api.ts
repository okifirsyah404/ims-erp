import type { TApiPaginatedResponse, TApiResponse } from '@ims-erp/common';
import { queryOptions } from '@tanstack/react-query';
import { currentLanguage } from '@/i18n';

/**
 * API client for the M08 employee records (`/human-resources/*`): attendance, leave,
 * overtime, tasks, monthly salary summaries and the salary bank account.
 * Employees themselves are ERP-0034 (`@/lib/hr-api`). Money is IDR minor
 * units; business dates `YYYY-MM-DD`; times `HH:MM`.
 */

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export const ATTENDANCE_STATUSES = ['present', 'permit', 'sick', 'leave', 'absent', 'holiday'] as const;
export type TAttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];
export const REQUEST_STATUSES = ['submitted', 'approved', 'rejected', 'cancelled'] as const;
export type TRequestStatus = (typeof REQUEST_STATUSES)[number];
export const TASK_STATUSES = ['open', 'done', 'cancelled'] as const;
export type TTaskStatus = (typeof TASK_STATUSES)[number];

export const REQUEST_STATUS_VARIANT: Record<TRequestStatus, 'default' | 'secondary' | 'outline' | 'destructive'> = {
	submitted: 'secondary',
	approved: 'default',
	rejected: 'destructive',
	cancelled: 'outline',
};

export type TPersonRef = { id: string; employeeCode: string; fullName: string };

/** The salary bank account; the number is masked without `employee:read_private`. */
export type TBankAccount = { bankName: string | null; bankAccountNumber: string | null; bankAccountHolder: string | null; masked: boolean };

export type TAttendanceRecord = {
	status: TAttendanceStatus;
	checkIn: string | null;
	checkOut: string | null;
	notes: string | null;
	source: 'manual' | 'import' | 'leave';
	leaveRequestId: string | null;
};
export type TAttendanceDayRow = { employee: TPersonRef; record: TAttendanceRecord | null };
export type TAttendanceMonthRow = { employee: TPersonRef; counts: Record<TAttendanceStatus, number> };
export type TAttendanceEntry = { employeeId: string; status: TAttendanceStatus; checkIn: string | null; checkOut: string | null; notes: string | null };

export type TRowError = { row: number; code: string; value: string };
export type TImportResult = { imported: number; errors: TRowError[] };

export type TLeaveType = { id: string; code: string; name: string; usesQuota: boolean; annualQuotaDays: number };
export type TLeaveRequest = {
	id: string;
	employeeId: string;
	employee: TPersonRef | null;
	leaveType: { id: string; code: string; name: string } | null;
	startDate: string;
	endDate: string;
	days: number;
	reason: string | null;
	status: TRequestStatus;
	recordedBy: string;
	decidedBy: string | null;
	decisionNote: string | null;
};
export type TLeaveBalance = {
	leaveType: { id: string; code: string; name: string; annualQuotaDays: number };
	year: number;
	approved: number;
	pending: number;
	remaining: number;
};
export type TOvertime = {
	id: string;
	employeeId: string;
	employee: TPersonRef | null;
	workDate: string;
	hours: string;
	reason: string | null;
	status: TRequestStatus;
	recordedBy: string;
	decisionNote: string | null;
};

export type TTask = {
	id: string;
	employeeId: string;
	employee: TPersonRef | null;
	title: string;
	description: string | null;
	dueDate: string | null;
	status: TTaskStatus;
	doneAt: string | null;
};

export type TSalaryRow = {
	id: string;
	period: string;
	employeeId: string;
	employeeName: string;
	baseSalary: number;
	allowances: number;
	overtimePay: number;
	bonus: number;
	deductions: number;
	netPay: number;
	notes: string | null;
	status: 'draft' | 'approved';
	overtimeHours: number;
};
export type TSalaryPeriod = {
	period: string;
	rows: TSalaryRow[];
	totals: Pick<TSalaryRow, 'baseSalary' | 'allowances' | 'overtimePay' | 'bonus' | 'deductions' | 'netPay'>;
	state: 'empty' | 'draft' | 'approved';
};
export type TSalaryInput = Pick<TSalaryRow, 'period' | 'employeeId' | 'baseSalary' | 'allowances' | 'overtimePay' | 'bonus' | 'deductions' | 'notes'>;

async function request<T>(path: string, init?: RequestInit): Promise<TApiResponse<T>> {
	const isForm = init?.body instanceof FormData;
	const response = await fetch(`${API_URL}${path}`, {
		credentials: 'include',
		headers: {
			'Accept-Language': currentLanguage(),
			...(init?.body != null && !isForm ? { 'Content-Type': 'application/json' } : {}),
		},
		...init,
	});
	const envelope = (await response.json()) as TApiResponse<T>;
	if (!response.ok) throw new Error(envelope.errors?.[0]?.message ?? envelope.message ?? 'Request failed');
	return envelope;
}

const send = async <T>(path: string, method: string, body?: unknown): Promise<T> =>
	(await request<T>(path, { method, body: body === undefined ? undefined : JSON.stringify(body) })).data as T;

const upload = async (path: string, file: File): Promise<TImportResult> => {
	const form = new FormData();
	form.append('file', file);
	return (await request<TImportResult>(path, { method: 'POST', body: form })).data as TImportResult;
};

const query = (params: Record<string, unknown>) => {
	const search = new URLSearchParams();
	for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== '') search.set(key, String(value));
	return search.size ? `?${search}` : '';
};

const paginated = <T>(key: readonly unknown[], path: string) =>
	queryOptions({
		queryKey: key,
		queryFn: async () => {
			const envelope = (await request<T[]>(path)) as TApiPaginatedResponse<T>;
			return { rows: envelope.data, pagination: envelope.pagination };
		},
	});

const single = <T>(key: readonly unknown[], path: string, enabled = true) =>
	queryOptions({ queryKey: key, queryFn: async () => (await request<T>(path)).data as T, enabled, retry: false });

/** Downloads a template with the session cookie and saves it. */
export async function downloadTemplate(path: string, filename: string): Promise<void> {
	const response = await fetch(`${API_URL}${path}`, { credentials: 'include', headers: { 'Accept-Language': currentLanguage() } });
	if (!response.ok) throw new Error('Download failed');
	const url = URL.createObjectURL(await response.blob());
	const link = document.createElement('a');
	link.href = url;
	link.download = filename;
	link.click();
	URL.revokeObjectURL(url);
}

// Employees (M08 additions to ERP-0034)
export const activeEmployeesQueryOptions = () => single<TPersonRef[]>(['hr', 'employees', 'active'], '/human-resources/active-employees');
export const bankAccountQueryOptions = (employeeId: string) =>
	single<TBankAccount | null>(['hr', 'bank-account', employeeId], `/human-resources/employees/${employeeId}/bank-account`);
export const saveBankAccount = (id: string, input: { bankName: string; bankAccountNumber: string; bankAccountHolder: string }) =>
	send<TBankAccount | null>(`/human-resources/employees/${id}/bank-account`, 'PUT', input);

// Attendance
export const attendanceDayQueryOptions = (date: string) => single<TAttendanceDayRow[]>(['hr', 'attendance', 'day', date], `/human-resources/attendances/day?date=${date}`);
export const attendanceMonthQueryOptions = (period: string) =>
	single<TAttendanceMonthRow[]>(['hr', 'attendance', 'month', period], `/human-resources/attendances/month?period=${period}`);
export const saveAttendanceDay = (date: string, entries: TAttendanceEntry[]) =>
	send<{ saved: number; skipped: number }>('/human-resources/attendances/day', 'PUT', { date, entries });
export const importAttendance = (file: File) => upload('/human-resources/attendances/import', file);

// Leave and overtime
export const leaveTypesQueryOptions = () => single<TLeaveType[]>(['hr', 'leave-types'], '/human-resources/leave-types');
export const leaveRequestsQueryOptions = (params: { page?: number; status?: TRequestStatus; period?: string; employeeId?: string }) =>
	paginated<TLeaveRequest>(['hr', 'leave', params], `/human-resources/leave${query(params)}`);
export const leaveBalancesQueryOptions = (employeeId: string, year: number) =>
	single<TLeaveBalance[]>(['hr', 'leave', 'balances', employeeId, year], `/human-resources/leave/balances?employeeId=${employeeId}&year=${year}`, !!employeeId);
export const createLeave = (input: { employeeId: string; leaveTypeId: string; startDate: string; endDate: string; reason: string | null }) =>
	send<TLeaveRequest>('/human-resources/leave', 'POST', input);
export const decideLeave = (id: string, action: 'approve' | 'reject' | 'cancel', note: string | null) =>
	send<TLeaveRequest>(`/human-resources/leave/${id}/${action}`, 'POST', { note });
export const overtimeQueryOptions = (params: { page?: number; status?: TRequestStatus; period?: string }) =>
	paginated<TOvertime>(['hr', 'overtime', params], `/human-resources/overtime${query(params)}`);
export const createOvertime = (input: { employeeId: string; workDate: string; hours: number; reason: string | null }) =>
	send<TOvertime>('/human-resources/overtime', 'POST', input);
export const decideOvertime = (id: string, action: 'approve' | 'reject' | 'cancel', note: string | null) =>
	send<TOvertime>(`/human-resources/overtime/${id}/${action}`, 'POST', { note });

// Tasks
export const tasksQueryOptions = (params: { page?: number; status?: TTaskStatus; employeeId?: string }) =>
	paginated<TTask>(['hr', 'tasks', params], `/human-resources/employee-tasks${query(params)}`);
export const createTask = (input: { employeeId: string; title: string; description: string | null; dueDate: string | null }) =>
	send<TTask>('/human-resources/employee-tasks', 'POST', input);
export const setTaskStatus = (id: string, status: TTaskStatus) => send<TTask>(`/human-resources/employee-tasks/${id}/status`, 'POST', { status });

// Salary summaries
export const salaryQueryOptions = (period: string) => single<TSalaryPeriod>(['hr', 'salary', period], `/human-resources/salary-records?period=${period}`);
export const saveSalary = (input: TSalaryInput) => send<TSalaryRow>('/human-resources/salary-records', 'PUT', input);
export const removeSalary = (id: string) => send<{ removed: true }>(`/human-resources/salary-records/${id}`, 'DELETE');
export const generateSalary = (period: string) => send<TSalaryPeriod>(`/human-resources/salary-records/generate?period=${period}`, 'POST');
export const approveSalary = (period: string) => send<TSalaryPeriod>(`/human-resources/salary-records/approve?period=${period}`, 'POST');
export const importSalary = (period: string, file: File) => upload(`/human-resources/salary-records/import?period=${period}`, file);
