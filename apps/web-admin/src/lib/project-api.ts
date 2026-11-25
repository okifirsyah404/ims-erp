import type { TApiPaginatedResponse, TApiResponse } from '@ims-erp/common';
import { queryOptions } from '@tanstack/react-query';
import { currentLanguage } from '@/i18n';
import { organizationHeaders } from './organization-store';

/**
 * API client for projects (`/projects`, M07, ADR-0011 step 6a). Costs come
 * back as `null` for callers without `project:read_cost`; evidence and
 * receipt URLs are short-lived (10 minutes).
 */

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export const PROJECT_STAGES = ['preparation', 'delivery', 'installation', 'testing', 'training', 'handover', 'warranty'] as const;
export type TProjectStage = (typeof PROJECT_STAGES)[number];
export const PROJECT_STATUSES = ['active', 'closed', 'cancelled'] as const;
export type TProjectStatus = (typeof PROJECT_STATUSES)[number];
export const TASK_STATUSES = ['todo', 'in_progress', 'done'] as const;
export type TTaskStatus = (typeof TASK_STATUSES)[number];
export const EVIDENCE_KINDS = ['testing', 'training', 'bast', 'photo', 'other'] as const;
export type TEvidenceKind = (typeof EVIDENCE_KINDS)[number];
export const COST_CATEGORIES = ['material', 'transport', 'accommodation', 'subcontract', 'other'] as const;
export type TCostCategory = (typeof COST_CATEGORIES)[number];

export const PROJECT_STATUS_VARIANT: Record<TProjectStatus, 'default' | 'secondary' | 'outline'> = {
	active: 'default',
	closed: 'secondary',
	cancelled: 'outline',
};

export type TPerson = { userId: string; name: string };

export type TProject = {
	id: string;
	code: string;
	orderId: string | null;
	orderCode: string;
	quotationCode: string | null;
	customerId: string | null;
	companyId: string | null;
	leadId: string | null;
	customerName: string;
	title: string;
	siteName: string | null;
	contractValue: number;
	picUserId: string | null;
	pic: TPerson | null;
	targetStartDate: string | null;
	targetEndDate: string | null;
	stage: TProjectStage;
	status: TProjectStatus;
	notes: string | null;
	closedAt: string | null;
	cancelledAt: string | null;
	cancelReason: string | null;
	createdAt: string;
};

export type TProjectTask = {
	id: string;
	position: number;
	title: string;
	stage: TProjectStage;
	assigneeUserId: string | null;
	assignee: TPerson | null;
	dueDate: string | null;
	status: TTaskStatus;
	doneAt: string | null;
};

export type TProjectEvidence = {
	id: string;
	taskId: string | null;
	kind: TEvidenceKind;
	fileName: string;
	contentType: string;
	sizeBytes: number;
	note: string | null;
	uploadedBy: string | null;
	uploader: TPerson | null;
	url: string;
	createdAt: string;
};

export type TProjectCost = {
	id: string;
	category: TCostCategory;
	costDate: string;
	amount: number;
	description: string;
	receiptUrl: string | null;
	voidedAt: string | null;
	voidReason: string | null;
	paymentSource: TCostPaymentSource;
	reference: string | null;
	journalEntryId: string | null;
};

export type TProjectCosts = {
	entries: TProjectCost[];
	directTotal: number;
	materials: { id: string; code: string; shippedAt: string | null; value: number }[];
	materialTotal: number;
	total: number;
	contractValue: number;
};

export type TProjectDetail = TProject & {
	tasks: TProjectTask[];
	evidence: TProjectEvidence[];
	evidenceComplete: Record<'testing' | 'training' | 'bast', boolean>;
	canClose: boolean;
	costs: TProjectCosts | null;
};

export type TOpenDeal = {
	id: string;
	code: string;
	quotationCode: string;
	title: string;
	customerName: string;
	grandTotal: number;
	orderDate: string;
	hasProject: boolean;
};

export type TProjectInput = {
	picUserId: string;
	siteName: string | null;
	targetStartDate: string | null;
	targetEndDate: string | null;
	notes: string | null;
};

export type TTaskInput = { title: string; stage: TProjectStage; assigneeUserId: string | null; dueDate: string | null };

async function request<T>(path: string, init?: RequestInit): Promise<TApiResponse<T>> {
	const json = init?.body != null && !(init.body instanceof FormData);
	const response = await fetch(`${API_URL}${path}`, {
		credentials: 'include',
		headers: {
			...organizationHeaders(),
			// Server error messages come back in the UI language.
			'Accept-Language': currentLanguage(),
			...(json ? { 'Content-Type': 'application/json' } : {}),
		},
		...init,
	});
	const envelope = (await response.json()) as TApiResponse<T>;
	if (!response.ok) {
		throw new Error(envelope.errors?.[0]?.message ?? envelope.message ?? 'Request failed');
	}
	return envelope;
}

const send = async <T>(path: string, method: string, body?: unknown): Promise<T> =>
	(await request<T>(path, { method, body: body instanceof FormData ? body : body === undefined ? undefined : JSON.stringify(body) })).data as T;

export function projectsQueryOptions(params: { page?: number; limit?: number; search?: string; status?: TProjectStatus }) {
	return queryOptions({
		queryKey: ['projects', 'list', params] as const,
		queryFn: async () => {
			const search = new URLSearchParams();
			for (const [key, value] of Object.entries(params)) {
				if (value !== undefined && value !== '') search.set(key, String(value));
			}
			const envelope = (await request<TProject[]>(`/projects${search.size ? `?${search}` : ''}`)) as TApiPaginatedResponse<TProject>;
			return { rows: envelope.data, pagination: envelope.pagination };
		},
	});
}

export function projectQueryOptions(id: string) {
	return queryOptions({
		queryKey: ['projects', 'detail', id] as const,
		queryFn: async () => (await request<TProjectDetail>(`/projects/${id}`)).data as TProjectDetail,
		retry: false,
	});
}

/** Counts by status/stage plus overdue (`GET /projects/stats`, M01 dashboard). */
export type TProjectStats = {
	active: number;
	closed: number;
	cancelled: number;
	overdue: number;
	byStage: Array<{ stage: TProjectStage; count: number }>;
};

export function projectStatsQueryOptions(organizationId: string | null) {
	return queryOptions({
		queryKey: ['projects', 'stats', organizationId] as const,
		queryFn: async () => (await request<TProjectStats>('/projects/stats')).data as TProjectStats,
		enabled: organizationId !== null,
		staleTime: 60 * 1000,
	});
}

export function openDealsQueryOptions() {
	return queryOptions({
		queryKey: ['projects', 'open-deals'] as const,
		queryFn: async () => (await request<TOpenDeal[]>('/projects/open-deals')).data as TOpenDeal[],
	});
}

export function projectStaffQueryOptions() {
	return queryOptions({
		queryKey: ['projects', 'staff'] as const,
		queryFn: async () => (await request<{ pics: TPerson[]; workers: TPerson[] }>('/projects/staff')).data as { pics: TPerson[]; workers: TPerson[] },
	});
}

export const createProject = (input: TProjectInput & { orderId: string }) => send<TProject>('/projects', 'POST', input);
export const updateProject = (id: string, input: TProjectInput & { stage: TProjectStage }) => send<TProject>(`/projects/${id}`, 'PUT', input);
export const closeProject = (id: string) => send<TProject>(`/projects/${id}/close`, 'POST');
export const cancelProject = (id: string, reason: string) => send<TProject>(`/projects/${id}/cancel`, 'POST', { reason });
export const addTask = (id: string, input: TTaskInput) => send<TProjectTask>(`/projects/${id}/tasks`, 'POST', input);
export const updateTask = (id: string, taskId: string, input: TTaskInput) => send<TProjectTask>(`/projects/${id}/tasks/${taskId}`, 'PUT', input);
export const setTaskStatus = (id: string, taskId: string, status: TTaskStatus) =>
	send<TProjectTask>(`/projects/${id}/tasks/${taskId}/status`, 'POST', { status });
export const removeTask = (id: string, taskId: string) => send<TProjectTask>(`/projects/${id}/tasks/${taskId}`, 'DELETE');

export function uploadEvidence(id: string, input: { file: File; kind: TEvidenceKind; taskId?: string; note?: string }) {
	const body = new FormData();
	body.set('file', input.file);
	body.set('kind', input.kind);
	if (input.taskId) body.set('taskId', input.taskId);
	if (input.note) body.set('note', input.note);
	return send<TProjectEvidence>(`/projects/${id}/evidence`, 'POST', body);
}

export const removeEvidence = (id: string, evidenceId: string) => send<TProjectEvidence>(`/projects/${id}/evidence/${evidenceId}`, 'DELETE');

export const COST_PAYMENT_SOURCES = ['employee_claim', 'petty_cash', 'bank'] as const;
export type TCostPaymentSource = (typeof COST_PAYMENT_SOURCES)[number];

export function addCost(
	id: string,
	input: {
		category: TCostCategory;
		costDate: string;
		amount: number;
		description: string;
		receipt?: File | null;
		paymentSource: TCostPaymentSource;
		reference?: string | null;
	},
) {
	const body = new FormData();
	body.set('category', input.category);
	body.set('costDate', input.costDate);
	body.set('amount', String(input.amount));
	body.set('description', input.description);
	body.set('paymentSource', input.paymentSource);
	if (input.reference) body.set('reference', input.reference);
	if (input.receipt) body.set('receipt', input.receipt);
	return send<TProjectCost>(`/projects/${id}/costs`, 'POST', body);
}

export const voidCost = (id: string, costId: string, reason: string) => send<TProjectCost>(`/projects/${id}/costs/${costId}/void`, 'POST', { reason });
