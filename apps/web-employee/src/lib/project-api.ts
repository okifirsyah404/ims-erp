import type { TApiPaginatedResponse, TApiResponse } from '@ims-erp/common';
import { queryOptions } from '@tanstack/react-query';
import { currentLanguage } from '@/i18n';
import { organizationHeaders } from '@/lib/organization-store';

/**
 * API client for the portal's project routes (`/projects/me/*`).
 *
 * @remarks
 * The backend guard resolves the employee, so no call sends an `employeeId`.
 * Multipart uploads (selfie, evidence) must not set `Content-Type`: the browser
 * has to add the boundary.
 */

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export const PROJECT_STAGES = [
	'preparation',
	'delivery',
	'installation',
	'testing',
	'training',
	'handover',
	'warranty',
] as const;
export type TProjectStage = (typeof PROJECT_STAGES)[number];
export const PROJECT_TASK_STATUSES = ['todo', 'in_progress', 'done'] as const;
export type TProjectTaskStatus = (typeof PROJECT_TASK_STATUSES)[number];
export const EVIDENCE_KINDS = ['testing', 'training', 'bast', 'photo', 'other'] as const;
export type TEvidenceKind = (typeof EVIDENCE_KINDS)[number];
export const SITE_ATTENDANCE_STATUSES = ['verified', 'out_of_range'] as const;
export type TSiteAttendanceStatus = (typeof SITE_ATTENDANCE_STATUSES)[number];

export type TPerson = { userId: string; name: string };
export type TProject = {
	id: string;
	code: string;
	title: string;
	customerName: string;
	siteName: string | null;
	stage: TProjectStage;
	status: 'active' | 'closed' | 'cancelled';
	targetStartDate: string | null;
	targetEndDate: string | null;
	picUserId: string | null;
	pic: TPerson | null;
	isPic: boolean;
};
export type TProjectTask = {
	id: string;
	projectId: string;
	title: string;
	stage: TProjectStage;
	assigneeUserId: string | null;
	dueDate: string | null;
	status: TProjectTaskStatus;
	doneAt: string | null;
	assignee: TPerson | null;
};
export type TProjectEvidence = {
	id: string;
	kind: TEvidenceKind;
	fileName: string;
	note: string | null;
	url: string;
	uploadedBy: string | null;
	uploader: TPerson | null;
	createdAt: string;
};
export type TProjectDetail = TProject & {
	tasks: TProjectTask[];
	evidence: TProjectEvidence[];
	evidenceComplete: Record<'testing' | 'training' | 'bast', boolean>;
	canClose: boolean;
};
export type TMySiteAttendance = {
	id: string;
	projectId: string;
	employeeId: string;
	userId: string;
	businessDate: string;
	checkInAt: string;
	checkOutAt: string | null;
	latitude: string;
	longitude: string;
	accuracyMeters: string | null;
	distanceMeters: string;
	radiusMeters: number;
	status: TSiteAttendanceStatus;
	selfieKey: string;
	selfieUrl: string | null;
	distance: number;
	radius: number;
	note: string | null;
};
export type TProjectStaff = { pics: TPerson[]; workers: TPerson[] };
/** A GPS fix from the browser. */
export type TPosition = { latitude: number; longitude: number; accuracyMeters: number | null };

async function parse<T>(response: Response): Promise<TApiResponse<T>> {
	const text = await response.text();
	const envelope = (text ? JSON.parse(text) : {}) as TApiResponse<T>;
	if (!response.ok) {
		throw new Error(envelope.errors?.[0]?.message ?? envelope.message ?? `Request failed (${response.status})`);
	}
	return envelope;
}

const headers = (json: boolean) => ({
	...(json ? { 'Content-Type': 'application/json' } : {}),
	'Accept-Language': currentLanguage(),
	...organizationHeaders(),
});

async function getData<T>(path: string): Promise<T> {
	const envelope = await parse<T>(
		await fetch(`${API_URL}${path}`, { credentials: 'include', headers: headers(false) }),
	);
	if (envelope.data === null) throw new Error(envelope.message ?? 'No data');
	return envelope.data;
}

async function getPaginated<T>(path: string): Promise<TApiPaginatedResponse<T>> {
	const response = await fetch(`${API_URL}${path}`, { credentials: 'include', headers: headers(false) });
	return (await parse<T>(response)) as unknown as TApiPaginatedResponse<T>;
}

async function send<T>(method: 'POST' | 'PUT' | 'DELETE', path: string, body?: unknown): Promise<T> {
	const multipart = typeof FormData !== 'undefined' && body instanceof FormData;
	const envelope = await parse<T>(
		await fetch(`${API_URL}${path}`, {
			method,
			credentials: 'include',
			headers: headers(!multipart && body !== undefined),
			body: body === undefined ? undefined : multipart ? body : JSON.stringify(body),
		}),
	);
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

export const myProjectsQueryOptions = (params: { page?: number; search?: string; status?: string } = {}) =>
	queryOptions({
		queryKey: ['employee-portal', 'projects', params] as const,
		queryFn: async () => (await getPaginated<TProject>(`/projects/me/projects${query(params)}`)).data,
	});

export const myProjectQueryOptions = (projectId: string) =>
	queryOptions({
		queryKey: ['employee-portal', 'project', projectId] as const,
		queryFn: () => getData<TProjectDetail>(`/projects/me/projects/${projectId}`),
	});

export const projectStaffQueryOptions = queryOptions({
	queryKey: ['employee-portal', 'project-staff'] as const,
	queryFn: () => getData<TProjectStaff>('/projects/me/staff'),
	staleTime: 300_000,
});

export type TTaskInput = {
	title: string;
	stage: TProjectStage;
	assigneeUserId: string | null;
	dueDate: string | null;
};

export const addProjectTask = (projectId: string, body: TTaskInput) =>
	send<TProjectTask>('POST', `/projects/me/projects/${projectId}/tasks`, body);

export const updateProjectTask = (projectId: string, taskId: string, body: TTaskInput) =>
	send<TProjectTask>('PUT', `/projects/me/projects/${projectId}/tasks/${taskId}`, body);

export const removeProjectTask = (projectId: string, taskId: string) =>
	send<TProjectTask>('DELETE', `/projects/me/projects/${projectId}/tasks/${taskId}`);

export const setProjectTaskStatus = (projectId: string, taskId: string, status: TProjectTaskStatus) =>
	send<TProjectTask>('POST', `/projects/me/projects/${projectId}/tasks/${taskId}/status`, { status });

export const addProjectEvidence = (
	projectId: string,
	body: { file: File; kind: TEvidenceKind; taskId?: string; note?: string },
) => {
	const form = new FormData();
	form.append('file', body.file);
	form.append('kind', body.kind);
	if (body.taskId) form.append('taskId', body.taskId);
	if (body.note) form.append('note', body.note);
	return send<TProjectEvidence>('POST', `/projects/me/projects/${projectId}/evidence`, form);
};

export const removeProjectEvidence = (projectId: string, evidenceId: string) =>
	send<TProjectEvidence>('DELETE', `/projects/me/projects/${projectId}/evidence/${evidenceId}`);

export const mySiteAttendanceQueryOptions = (params: { projectId?: string; period?: string } = {}) =>
	queryOptions({
		queryKey: ['employee-portal', 'site-attendance', params] as const,
		queryFn: async () => (await getPaginated<TMySiteAttendance>(`/projects/me/site-attendance${query(params)}`)).data,
	});

export const projectSiteAttendanceQueryOptions = (projectId: string, period?: string) =>
	queryOptions({
		queryKey: ['employee-portal', 'site-attendance', 'project', projectId, period ?? 'all'] as const,
		queryFn: async () =>
			(await getPaginated<TMySiteAttendance>(`/projects/me/projects/${projectId}/site-attendance${query({ period })}`)).data,
	});

export const checkInToSite = (body: {
	projectId: string;
	latitude: number;
	longitude: number;
	accuracyMeters: number | null;
	note?: string | null;
	selfie: File;
}) => {
	const form = new FormData();
	form.append('projectId', body.projectId);
	form.append('latitude', String(body.latitude));
	form.append('longitude', String(body.longitude));
	if (body.accuracyMeters !== null) form.append('accuracyMeters', String(body.accuracyMeters));
	if (body.note) form.append('note', body.note);
	form.append('selfie', body.selfie, body.selfie.name || 'selfie.jpg');
	return send<TMySiteAttendance>('POST', '/projects/me/site-attendance/check-in', form);
};

export const checkOutOfSite = (id: string, body: { latitude: number; longitude: number; accuracyMeters: number | null }) =>
	send<TMySiteAttendance>('POST', `/projects/me/site-attendance/${id}/check-out`, body);

