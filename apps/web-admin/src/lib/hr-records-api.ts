import type { TApiPaginatedResponse, TApiResponse } from '@ims-erp/common';
import { queryOptions } from '@tanstack/react-query';
import { currentLanguage } from '@/i18n';

/**
 * API client for the M08 employee records (`/human-resources/*`): attendance, leave,
 * overtime, tasks, schedules, monthly salary summaries, salary periods, plus the
 * employee payee accounts that finance owns (`/finance/employee-bank-accounts`).
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


export type TAttendanceRecord = {
	status: TAttendanceStatus;
	checkIn: string | null;
	checkOut: string | null;
	notes: string | null;
	source: 'manual' | 'import' | 'leave';
	leaveRequestId: string | null;
};
export type TAttendanceDayRow = { employee: TPersonRef; record: TAttendanceRecord | null };
/** One row of the attendance list view (across dates). */
export type TAttendanceListRow = TAttendanceRecord & { id: string; employeeId: string; attendanceDate: string; employee: TPersonRef | null };
export type TAttendanceRecordInput = TAttendanceEntry & { date: string };
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

// Attendance
export const attendanceDayQueryOptions = (date: string) => single<TAttendanceDayRow[]>(['hr', 'attendance', 'day', date], `/human-resources/attendances/day?date=${date}`);
export const attendanceMonthQueryOptions = (period: string) =>
	single<TAttendanceMonthRow[]>(['hr', 'attendance', 'month', period], `/human-resources/attendances/month?period=${period}`);
export const saveAttendanceDay = (date: string, entries: TAttendanceEntry[]) =>
	send<{ saved: number; skipped: number }>('/human-resources/attendances/day', 'PUT', { date, entries });
export const importAttendance = (file: File) => upload('/human-resources/attendances/import', file);
export const attendanceListQueryOptions = (params: { page?: number; employeeId?: string; from?: string; to?: string; status?: TAttendanceStatus }) =>
	paginated<TAttendanceListRow>(['hr', 'attendance', 'list', params], `/human-resources/attendances${query(params)}`);
export const createAttendance = (input: TAttendanceRecordInput) => send<TAttendanceListRow>('/human-resources/attendances', 'POST', input);
export const updateAttendance = (id: string, input: TAttendanceRecordInput) =>
	send<TAttendanceListRow>(`/human-resources/attendances/${id}`, 'PUT', input);
export const removeAttendance = (id: string) => send<{ removed: true }>(`/human-resources/attendances/${id}`, 'DELETE');

// Leave and overtime
export const leaveTypesQueryOptions = () => single<TLeaveType[]>(['hr', 'leave-types'], '/human-resources/leave-types');
export const leaveRequestsQueryOptions = (params: { page?: number; status?: TRequestStatus; period?: string; employeeId?: string }) =>
	paginated<TLeaveRequest>(['hr', 'leave', params], `/human-resources/leave${query(params)}`);
export const leaveBalancesQueryOptions = (employeeId: string, year: number) =>
	single<TLeaveBalance[]>(['hr', 'leave', 'balances', employeeId, year], `/human-resources/leave/balances?employeeId=${employeeId}&year=${year}`, !!employeeId);
export const createLeave = (input: { employeeId: string; leaveTypeId: string; startDate: string; endDate: string; reason: string | null }) =>
	send<TLeaveRequest>('/human-resources/leave', 'POST', input);
export const updateLeave = (id: string, input: { employeeId: string; leaveTypeId: string; startDate: string; endDate: string; reason: string | null }) =>
	send<TLeaveRequest>(`/human-resources/leave/${id}`, 'PUT', input);
export const decideLeave = (id: string, action: 'approve' | 'reject' | 'cancel', note: string | null) =>
	send<TLeaveRequest>(`/human-resources/leave/${id}/${action}`, 'POST', { note });
export const overtimeQueryOptions = (params: { page?: number; status?: TRequestStatus; period?: string }) =>
	paginated<TOvertime>(['hr', 'overtime', params], `/human-resources/overtime${query(params)}`);
export const createOvertime = (input: { employeeId: string; workDate: string; hours: number; reason: string | null }) =>
	send<TOvertime>('/human-resources/overtime', 'POST', input);
export const updateOvertime = (id: string, input: { employeeId: string; workDate: string; hours: number; reason: string | null }) =>
	send<TOvertime>(`/human-resources/overtime/${id}`, 'PUT', input);
export const decideOvertime = (id: string, action: 'approve' | 'reject' | 'cancel', note: string | null) =>
	send<TOvertime>(`/human-resources/overtime/${id}/${action}`, 'POST', { note });

// Tasks
export const tasksQueryOptions = (params: { page?: number; status?: TTaskStatus; employeeId?: string }) =>
	paginated<TTask>(['hr', 'tasks', params], `/human-resources/employee-tasks${query(params)}`);
export const createTask = (input: { employeeId: string; title: string; description: string | null; dueDate: string | null }) =>
	send<TTask>('/human-resources/employee-tasks', 'POST', input);
export const updateTask = (id: string, input: { employeeId: string; title: string; description: string | null; dueDate: string | null }) =>
	send<TTask>(`/human-resources/employee-tasks/${id}`, 'PUT', input);
export const removeTask = (id: string) => send<{ removed: true }>(`/human-resources/employee-tasks/${id}`, 'DELETE');
export const setTaskStatus = (id: string, status: TTaskStatus) => send<TTask>(`/human-resources/employee-tasks/${id}/status`, 'POST', { status });

// Work schedule (ERP-0118)
/** One shift; a day off has no times, an end before the start is an overnight shift. */
export type TShift = { isDayOff: boolean; shiftStart: string | null; shiftEnd: string | null; shiftLabel: string | null };
export type TScheduleCell = TShift & { id: string; employeeId: string; workDate: string };
export type TScheduleWeek = {
	start: string;
	dates: string[];
	rows: { employee: TPersonRef; cells: Record<string, TScheduleCell | null> }[];
};
export type TScheduleInput = TShift & { employeeId: string; workDate: string };
export const scheduleWeekQueryOptions = (start: string) =>
	single<TScheduleWeek>(['hr', 'schedule', 'week', start], `/human-resources/schedules/week?start=${start}`);
export const createSchedule = (input: TScheduleInput) => send<TScheduleCell>('/human-resources/schedules', 'POST', input);
export const updateSchedule = (id: string, input: TScheduleInput) => send<TScheduleCell>(`/human-resources/schedules/${id}`, 'PUT', input);
export const removeSchedule = (id: string) => send<{ removed: true }>(`/human-resources/schedules/${id}`, 'DELETE');
/** Fills `from`..`to` from a Monday-first weekly pattern; taken cells are skipped. */
export const fillSchedule = (input: { from: string; to: string; employeeIds?: string[]; pattern: TShift[] }) =>
	send<{ created: number; skipped: number }>('/human-resources/schedules/fill', 'POST', input);

// Salary periods (ERP-0119): money in IDR minor units
export type TSalaryPeriodRow = {
	id: string;
	employeeId: string;
	baseSalary: number;
	fixedAllowances: number;
	currencyCode: string;
	effectiveFrom: string;
	effectiveTo: string | null;
	isActive: boolean;
};
export const salaryPeriodsQueryOptions = (employeeId: string) =>
	single<TSalaryPeriodRow[]>(['hr', 'salary-periods', employeeId], `/human-resources/employees/${employeeId}/salaries`);
export const createSalaryPeriod = (employeeId: string, input: { effectiveFrom: string; baseSalary: number; fixedAllowances: number }) =>
	send<TSalaryPeriodRow>(`/human-resources/employees/${employeeId}/salaries`, 'POST', input);
export const updateSalaryPeriod = (id: string, input: { baseSalary: number; fixedAllowances: number }) =>
	send<TSalaryPeriodRow>(`/human-resources/salaries/${id}`, 'PUT', input);
export const removeSalaryPeriod = (id: string) => send<{ removed: true }>(`/human-resources/salaries/${id}`, 'DELETE');

// Employee payee accounts (ERP-0119): owned by finance; the number is masked without `employee:read_private`
export const EMPLOYEE_ACCOUNT_TYPES = ['bank', 'ewallet'] as const;
export type TEmployeeBankAccount = {
	id: string;
	code: string;
	employeeId: string;
	accountType: (typeof EMPLOYEE_ACCOUNT_TYPES)[number];
	bankName: string | null;
	bankCode: string | null;
	accountNumber: string | null;
	accountHolder: string | null;
	isPrimary: boolean;
	isActive: boolean;
	masked: boolean;
};
export type TEmployeeBankAccountInput = {
	accountType: (typeof EMPLOYEE_ACCOUNT_TYPES)[number];
	bankName: string;
	bankCode: string | null;
	accountNumber: string;
	accountHolder: string;
	isPrimary: boolean;
	isActive: boolean;
};
export const employeeBankAccountsQueryOptions = (employeeId: string) =>
	single<TEmployeeBankAccount[]>(['hr', 'bank-accounts', employeeId], `/finance/employee-bank-accounts?employeeId=${employeeId}`);
export const createEmployeeBankAccount = (employeeId: string, input: TEmployeeBankAccountInput) =>
	send<TEmployeeBankAccount>('/finance/employee-bank-accounts', 'POST', { ...input, employeeId });
export const updateEmployeeBankAccount = (id: string, input: TEmployeeBankAccountInput) =>
	send<TEmployeeBankAccount>(`/finance/employee-bank-accounts/${id}`, 'PUT', input);
export const removeEmployeeBankAccount = (id: string) => send<{ removed: true }>(`/finance/employee-bank-accounts/${id}`, 'DELETE');

// Payroll settings (ERP-0120): application admins only
export type TPayrollSettings = { payDay: number | null; nextRunDate: string | null };
export const payrollSettingsQueryOptions = () => single<TPayrollSettings>(['hr', 'payroll-settings'], '/human-resources/payroll-settings');
export const savePayrollSettings = (input: { payDay: number | null }) =>
	send<TPayrollSettings>('/human-resources/payroll-settings', 'PUT', input);

// Employee documents (ERP-0121): registry rows of the document module kept on the employee
export const EMPLOYEE_DOCUMENT_TYPES = ['employment_agreement', 'id_card', 'tax_id', 'cv', 'certificate', 'other'] as const;
export type TEmployeeDocumentType = (typeof EMPLOYEE_DOCUMENT_TYPES)[number];
export type TEmployeeDocumentFile = { id: string; fileName: string; mimeType: string | null; sizeBytes: number | null; uploadedAt: string };
export type TEmployeeDocument = {
	id: string;
	code: string;
	documentType: string;
	title: string;
	status: 'draft' | 'submitted' | 'approved' | 'issued' | 'void' | 'expired' | 'archived';
	createdAt: string;
	files: TEmployeeDocumentFile[];
};
export const employeeDocumentsQueryOptions = (employeeId: string) =>
	single<TEmployeeDocument[]>(['hr', 'employee-documents', employeeId], `/human-resources/employees/${employeeId}/documents`);
export const createEmployeeDocument = (employeeId: string, input: { documentType: TEmployeeDocumentType; title: string | null }) =>
	send<TEmployeeDocument>(`/human-resources/employees/${employeeId}/documents`, 'POST', input);
export const uploadEmployeeDocumentFile = async (employeeId: string, documentId: string, file: File) => {
	const form = new FormData();
	form.append('file', file);
	return (await request<TEmployeeDocumentFile>(`/human-resources/employees/${employeeId}/documents/${documentId}/files`, { method: 'POST', body: form })).data;
};
export const employeeDocumentDownloadUrl = (employeeId: string, documentId: string, fileId: string) =>
	send<{ url: string; fileName: string }>(`/human-resources/employees/${employeeId}/documents/${documentId}/files/${fileId}/download`, 'GET');
export const voidEmployeeDocument = (employeeId: string, documentId: string) =>
	send<TEmployeeDocument>(`/human-resources/employees/${employeeId}/documents/${documentId}/void`, 'POST');
export const regenerateAgreementPdf = (employeeId: string, documentId: string) =>
	send<{ queued: true }>(`/human-resources/employees/${employeeId}/documents/${documentId}/regenerate-pdf`, 'POST');

/** The employment agreement print view data (public, render token). */
export type TAgreementRender = {
	document: { id: string; code: string; title: string; status: string };
	employee: {
		employeeCode: string;
		fullName: string;
		nationalId: string | null;
		email: string | null;
		phone: string | null;
		employmentType: string;
		workType: string;
		hireDate: string | null;
		gender: string | null;
		birthPlace: string | null;
		birthDate: string | null;
		maritalStatus: string | null;
	};
	address: {
		addressLine: string;
		postalCode: string | null;
		villageName: string | null;
		districtName: string | null;
		regencyName: string | null;
		provinceName: string | null;
	} | null;
	profile: import('./company-api').TCompanyProfile | null;
};
export const agreementRenderQueryOptions = (documentId: string, token: string) =>
	queryOptions({
		queryKey: ['hr', 'agreement-render', documentId],
		queryFn: async () => (await request<TAgreementRender>(`/human-resources/public/v1/render/employment-agreements/${documentId}?token=${encodeURIComponent(token)}`)).data as TAgreementRender,
		retry: false,
	});

// Payslips (ERP-0122)
export const payslipDownloadUrl = (recordId: string) =>
	send<{ url: string; fileName: string }>(`/human-resources/salary-records/${recordId}/payslip`, 'GET');
export const regeneratePayslip = (recordId: string) => send<{ queued: true }>(`/human-resources/salary-records/${recordId}/payslip/regenerate`, 'POST');
/** Saves every ready payslip of a period as one ZIP (session cookie). */
export const downloadPayslipZip = (period: string) => downloadTemplate(`/human-resources/salary-records/payslips.zip?period=${period}`, `slip-gaji-${period}.zip`);
export type TMyPayslip = { recordId: string; period: string; netPay: number; ready: boolean };
export const myPayslipsQueryOptions = () => single<TMyPayslip[]>(['me', 'payslips'], '/users/me/payslips');
export const myPayslipDownloadUrl = (recordId: string) => send<{ url: string; fileName: string }>(`/users/me/payslips/${recordId}/download`, 'GET');

/** The payslip print view data (public, render token). */
export type TPayslipRender = {
	document: { id: string; code: string; title: string };
	record: {
		period: string;
		baseSalary: number;
		allowances: number;
		overtimePay: number;
		bonus: number;
		deductions: number;
		netPay: number;
		notes: string | null;
		approvedAt: string | null;
		approvedByName: string | null;
	};
	employee: { employeeCode: string; fullName: string; employmentType: string };
	payee: { bankName: string | null; accountNumber: string | null; accountHolder: string | null } | null;
	profile: import('./company-api').TCompanyProfile | null;
};
export const payslipRenderQueryOptions = (documentId: string, token: string) =>
	queryOptions({
		queryKey: ['hr', 'payslip-render', documentId],
		queryFn: async () => (await request<TPayslipRender>(`/human-resources/public/v1/render/payslips/${documentId}?token=${encodeURIComponent(token)}`)).data as TPayslipRender,
		retry: false,
	});

// Salary summaries
export const salaryQueryOptions = (period: string) => single<TSalaryPeriod>(['hr', 'salary', period], `/human-resources/salary-records?period=${period}`);
export const saveSalary = (input: TSalaryInput) => send<TSalaryRow>('/human-resources/salary-records', 'PUT', input);
export const removeSalary = (id: string) => send<{ removed: true }>(`/human-resources/salary-records/${id}`, 'DELETE');
export const generateSalary = (period: string) => send<TSalaryPeriod>(`/human-resources/salary-records/generate?period=${period}`, 'POST');
export const approveSalary = (period: string) => send<TSalaryPeriod>(`/human-resources/salary-records/approve?period=${period}`, 'POST');
export const importSalary = (period: string, file: File) => upload(`/human-resources/salary-records/import?period=${period}`, file);
