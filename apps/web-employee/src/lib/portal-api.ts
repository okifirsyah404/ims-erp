import type { TApiPaginatedResponse, TApiResponse } from '@ims-erp/common';
import { queryOptions } from '@tanstack/react-query';
import { currentLanguage } from '@/i18n';
import { organizationHeaders } from '@/lib/organization-store';

/**
 * API client for the employee portal's self-service routes
 * (`/human-resources/me/*`).
 *
 * @remarks
 * Every route is scoped to the caller by the backend guard: no `employeeId` is
 * ever sent. The active organization header is pinned on each call so a user
 * with employee records in two organizations reads the right one.
 */

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export const ATTENDANCE_STATUSES = ['present', 'permit', 'sick', 'leave', 'absent', 'holiday'] as const;
export type TAttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];
export type TAttendanceSource = 'manual' | 'import' | 'leave' | 'self';
export const REQUEST_STATUSES = ['submitted', 'approved', 'rejected', 'cancelled'] as const;
export type TRequestStatus = (typeof REQUEST_STATUSES)[number];
export const TASK_STATUSES = ['open', 'done', 'cancelled'] as const;
export type TTaskStatus = (typeof TASK_STATUSES)[number];

export type TPortalOrganization = {
	organizationId: string;
	employeeId: string;
	employeeCode: string;
	fullName: string;
};

export type TMyContext = {
	employeeId: string;
	employeeCode: string;
	fullName: string;
	organizationId: string;
	organizations: TPortalOrganization[];
};

export type TPortalAccess = { organizations: TPortalOrganization[] };

export type TMyProfile = {
	id: string;
	employeeCode: string;
	fullName: string;
	nickname: string | null;
	email: string | null;
	phone: string | null;
	employmentStatus: string;
	employmentType: string;
	workType: string;
	hireDate: string | null;
	photoUrl: string | null;
	address: { addressLine: string; villageId: string | null; postalCode: string | null } | null;
};

export type TMyAttendance = {
	id: string;
	status: TAttendanceStatus;
	checkIn: string | null;
	checkOut: string | null;
	notes: string | null;
	source: TAttendanceSource;
	leaveRequestId: string | null;
	attendanceDate: string;
};

export type TMyToday = { date: string; record: Omit<TMyAttendance, 'attendanceDate'> | null };
export type TMyAttendanceMonth = {
	employee: { id: string; employeeCode: string; fullName: string };
	counts: Record<TAttendanceStatus, number>;
};

export type TMyScheduleCell = {
	id: string;
	employeeId: string;
	workDate: string;
	shiftStart: string | null;
	shiftEnd: string | null;
	shiftLabel: string | null;
	isDayOff: boolean;
};
export type TMySchedule = {
	start: string;
	dates: string[];
	rows: { employee: { id: string; employeeCode: string; fullName: string }; cells: Record<string, TMyScheduleCell | null> }[];
};

export type TMyLeaveType = { id: string; code: string; name: string; usesQuota: boolean; annualQuotaDays: number };
export type TMyLeaveBalance = {
	leaveType: { id: string; code: string; name: string; annualQuotaDays: number };
	year: number;
	approved: number;
	pending: number;
	remaining: number;
};
export type TMyLeave = {
	id: string;
	employeeId: string;
	employee: { id: string; employeeCode: string; fullName: string } | null;
	leaveType: { id: string; code: string; name: string } | null;
	startDate: string;
	endDate: string;
	days: number;
	reason: string | null;
	status: TRequestStatus;
	decidedBy: string | null;
	decisionNote: string | null;
};
export type TMyOvertime = {
	id: string;
	employeeId: string;
	employee: { id: string; employeeCode: string; fullName: string } | null;
	workDate: string;
	hours: string;
	reason: string | null;
	status: TRequestStatus;
	decidedBy: string | null;
	decisionNote: string | null;
};
export type TMyTask = {
	id: string;
	employeeId: string;
	title: string;
	notes: string | null;
	dueDate: string | null;
	status: TTaskStatus;
	doneAt: string | null;
};

async function request<T>(path: string, init?: RequestInit): Promise<TApiResponse<T>> {
	const response = await fetch(`${API_URL}${path}`, {
		credentials: 'include',
		...init,
		headers: {
			...(init?.body != null ? { 'Content-Type': 'application/json' } : {}),
			'Accept-Language': currentLanguage(),
			...organizationHeaders(),
			...init?.headers,
		},
	});
	const text = await response.text();
	const envelope = (text ? JSON.parse(text) : {}) as TApiResponse<T>;
	if (!response.ok) {
		throw new Error(envelope.errors?.[0]?.message ?? envelope.message ?? `Request failed (${response.status})`);
	}
	return envelope;
}

async function getData<T>(path: string): Promise<T> {
	const envelope = await request<T>(path);
	if (envelope.data === null) throw new Error(envelope.message ?? 'No data');
	return envelope.data;
}

async function getPaginated<T>(path: string): Promise<TApiPaginatedResponse<T>> {
	const response = await fetch(`${API_URL}${path}`, {
		credentials: 'include',
		headers: { 'Accept-Language': currentLanguage(), ...organizationHeaders() },
	});
	const text = await response.text();
	const envelope = (text ? JSON.parse(text) : {}) as TApiPaginatedResponse<T>;
	if (!response.ok) {
		throw new Error(envelope.errors?.[0]?.message ?? envelope.message ?? `Request failed (${response.status})`);
	}
	return envelope;
}

async function sendData<T>(method: 'POST' | 'PATCH' | 'PUT' | 'DELETE', path: string, body?: unknown): Promise<T> {
	const envelope = await request<T>(path, {
		method,
		body: body === undefined ? undefined : JSON.stringify(body),
	});
	if (envelope.data === null) throw new Error(envelope.message ?? 'No data');
	return envelope.data;
}

const query = (params: Record<string, string | number | undefined>) => {
	const search = new URLSearchParams();
	for (const [key, value] of Object.entries(params)) {
		if (value !== undefined && value !== '') search.set(key, String(value));
	}
	const text = search.toString();
	return text ? `?${text}` : '';
};

/** Portal access probe: session only, no organization required. */
export const portalAccessQueryOptions = queryOptions({
	queryKey: ['employee-portal', 'access'] as const,
	queryFn: () => getData<TPortalAccess>('/human-resources/me/access'),
	staleTime: 60_000,
	retry: false,
});

export const myContextQueryOptions = queryOptions({
	queryKey: ['employee-portal', 'context'] as const,
	queryFn: () => getData<TMyContext>('/human-resources/me/context'),
	staleTime: 60_000,
});

export const myProfileQueryOptions = queryOptions({
	queryKey: ['employee-portal', 'profile'] as const,
	queryFn: () => getData<TMyProfile>('/human-resources/me/profile'),
});

export const updateMyProfile = (body: {
	nickname: string | null;
	phone: string | null;
	address: { addressLine: string; villageId: string | null; postalCode: string | null } | null;
}) => sendData<TMyProfile>('PATCH', '/human-resources/me/profile', body);

export const myTodayQueryOptions = queryOptions({
	queryKey: ['employee-portal', 'attendance', 'today'] as const,
	queryFn: () => getData<TMyToday>('/human-resources/me/attendance/today'),
});

export const myAttendanceMonthQueryOptions = (period: string) =>
	queryOptions({
		queryKey: ['employee-portal', 'attendance', 'month', period] as const,
		queryFn: () => getData<TMyAttendanceMonth>(`/human-resources/me/attendance/month${query({ period })}`),
	});

export const myAttendanceListQueryOptions = (period?: string) =>
	queryOptions({
		queryKey: ['employee-portal', 'attendance', 'list', period ?? 'all'] as const,
		queryFn: async () => (await getPaginated<TMyAttendance>(`/human-resources/me/attendance${query({ period })}`)).data,
	});

export const checkIn = () => sendData<TMyToday>('POST', '/human-resources/me/attendance/check-in');
export const checkOut = () => sendData<TMyToday>('POST', '/human-resources/me/attendance/check-out');

export const myScheduleQueryOptions = (start: string) =>
	queryOptions({
		queryKey: ['employee-portal', 'schedule', start] as const,
		queryFn: () => getData<TMySchedule>(`/human-resources/me/schedule${query({ start })}`),
	});

export const myLeaveTypesQueryOptions = queryOptions({
	queryKey: ['employee-portal', 'leave-types'] as const,
	queryFn: () => getData<TMyLeaveType[]>('/human-resources/me/leave-types'),
	staleTime: 300_000,
});

export const myLeaveBalancesQueryOptions = queryOptions({
	queryKey: ['employee-portal', 'leave-balances'] as const,
	queryFn: () => getData<TMyLeaveBalance[]>('/human-resources/me/leave-balances'),
});

export const myLeaveListQueryOptions = (period?: string) =>
	queryOptions({
		queryKey: ['employee-portal', 'leave', 'list', period ?? 'all'] as const,
		queryFn: async () => (await getPaginated<TMyLeave>(`/human-resources/me/leave${query({ period })}`)).data,
	});

export const requestLeave = (body: { leaveTypeId: string; startDate: string; endDate: string; reason: string | null }) =>
	sendData<TMyLeave>('POST', '/human-resources/me/leave', body);

export const cancelLeave = (id: string) => sendData<TMyLeave>('POST', `/human-resources/me/leave/${id}/cancel`);

export const myOvertimeListQueryOptions = (period?: string) =>
	queryOptions({
		queryKey: ['employee-portal', 'overtime', 'list', period ?? 'all'] as const,
		queryFn: async () => (await getPaginated<TMyOvertime>(`/human-resources/me/overtime${query({ period })}`)).data,
	});

export const requestOvertime = (body: { workDate: string; hours: number; reason: string | null }) =>
	sendData<TMyOvertime>('POST', '/human-resources/me/overtime', body);

export const myTasksQueryOptions = (status?: TTaskStatus) =>
	queryOptions({
		queryKey: ['employee-portal', 'tasks', status ?? 'all'] as const,
		queryFn: async () => (await getPaginated<TMyTask>(`/human-resources/me/tasks${query({ status })}`)).data,
	});

export const setMyTaskStatus = (id: string, status: TTaskStatus) =>
	sendData<TMyTask>('POST', `/human-resources/me/tasks/${id}/status`, { status });
