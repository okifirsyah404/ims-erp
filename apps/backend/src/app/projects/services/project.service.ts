import { ORGANIZATION_SERVICE_TOKEN } from '@app/organization/constants/di';
import { CODE_NUMBER_SERVICE_TOKEN } from '@app/code-number';
import type { CodeNumberService } from '@app/code-number';
import type { OrganizationService } from '@app/organization/services/organization.service';
import { SALES_FULFILMENT_SERVICE_TOKEN } from '@app/sales/constants/di';
import type { SalesFulfilmentService } from '@app/sales/services/sales-fulfilment.service';
import { CUSTOMER_PORTAL_NOTIFIER_TOKEN, USER_SERVICE_TOKEN } from '@app/user/constants/di';
import type { CustomerPortalNotifier } from '@app/user/services/customer-portal-notifier.service';
import type { UserService } from '@app/user/services/user.service';
import { type IPermissionResolver, PERMISSION_RESOLVER_TOKEN } from '@authorization/permission-resolver';
import { isUniqueViolation } from '@drizzle/errors';
import {
	type EvidenceKind,
	type ProjectStage,
	REQUIRED_EVIDENCE,
	type TaskStatus,
	type TProjectCostSelect,
	type TProjectEvidenceSelect,
	type TProjectSelect,
	type TProjectTaskSelect,
} from '@drizzle/schemas/projects.schema';
import type { ErpPermissionRequest, TPaginationResult } from '@ims-erp/common';
import { businessDateOf } from '@utils/business-date.util';
import { type IObjectStorage, OBJECT_STORAGE_TOKEN } from '@providers/s3/object-storage';
import { inject, injectable } from 'tsyringe';
import { PROJECT_REPOSITORY_TOKEN } from '../constants/di';
import type {
	TCostBodyRequest,
	TCreateProjectRequest,
	TEvidenceUploadRequest,
	TProjectListQuery,
	TTaskBodyRequest,
	TUpdateProjectRequest,
} from '../contracts/project.contract';
import type {
	IProjectRepository,
	TProjectStats,
	TTaskData,
} from '../contracts/project.repository.interface';
import {
	ProjectChildNotFoundError,
	ProjectCostVoidedError,
	ProjectDatesError,
	ProjectDealError,
	ProjectEvidenceMissingError,
	ProjectFileError,
	ProjectForbiddenError,
	ProjectNotActiveError,
	ProjectNotFoundError,
	ProjectStaffError,
} from '../errors/project.errors';
import { PROJECT_FILE_MAX_BYTES, cleanFileName, sniffProjectFile } from '../utils/project-files';

/** Server-derived caller context (see the controller). */
export type TProjectContext = {
	organizationId: string;
	actorUserId: string;
	/** Managers, finance, auditors and ticket managers see every project. */
	canViewAll: boolean;
	/** `project:read_cost`: direct costs and material value. */
	canSeeCost: boolean;
	/** `task:assign`: may move any task (others only their own). */
	canAssignTasks: boolean;
	/** `project:update`: may remove anyone's evidence. */
	canManage: boolean;
};

export type TPerson = { userId: string; name: string };
export type TProjectView = TProjectSelect & { pic: TPerson | null };
export type TTaskView = TProjectTaskSelect & { assignee: TPerson | null };
export type TEvidenceView = TProjectEvidenceSelect & { url: string; uploader: TPerson | null };
export type TCostView = TProjectCostSelect & { receiptUrl: string | null };

export type TProjectCosts = {
	entries: TCostView[];
	/** Valid manual entries (IDR minor units). */
	directTotal: number;
	/** Goods shipped by the order's delivery notes, at their issue cost. */
	materials: { id: string; code: string; shippedAt: Date | null; value: number }[];
	materialTotal: number;
	total: number;
	contractValue: number;
};

export type TProjectDetail = TProjectView & {
	tasks: TTaskView[];
	evidence: TEvidenceView[];
	/** Which closing evidence exists (function test, training, signed BAST). */
	evidenceComplete: Record<'testing' | 'training' | 'bast', boolean>;
	canClose: boolean;
	/** `null` without `project:read_cost`. */
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

/** Default checklist of a new project, one task per stage (2026-11-04). */
const DEFAULT_TASKS: { title: string; stage: ProjectStage }[] = [
	{ title: 'Survei lokasi & jadwal pekerjaan', stage: 'preparation' },
	{ title: 'Pengiriman barang ke lokasi (surat jalan)', stage: 'delivery' },
	{ title: 'Instalasi perangkat', stage: 'installation' },
	{ title: 'Uji fungsi sistem', stage: 'testing' },
	{ title: 'Training operator', stage: 'training' },
	{ title: 'BAST ditandatangani pelanggan', stage: 'handover' },
];

const FILE_URL_TTL_SECONDS = 600;

/**
 * Projects and their execution (M07 part 1, ADR-0011 step 6a).
 *
 * @remarks
 * - A project is created from a live deal (sales order), one live project
 *   per order, through the Sales fulfilment contract; customer, title and
 *   contract value are snapshotted.
 * - The PIC must be a member of the caller's organization who can manage
 *   projects (`project:update`); task assignees must be able to work tasks
 *   (`task:update`).
 * - Visibility: see {@link TProjectContext.canViewAll}; everyone else only
 *   sees projects they lead or have a task in (404 otherwise).
 * - Closing needs function-test, training and signed-BAST evidence; costs
 *   are visible only with `project:read_cost`.
 * - Nothing is hard-deleted: tasks and evidence are soft-removed, costs voided.
 */
@injectable()
export class ProjectService {
	constructor(
		@inject(PROJECT_REPOSITORY_TOKEN) private readonly repository: IProjectRepository,
		@inject(SALES_FULFILMENT_SERVICE_TOKEN)
		private readonly sales: Pick<SalesFulfilmentService, 'getLiveOrder' | 'listLiveOrders' | 'shippedMaterials'>,
		@inject(ORGANIZATION_SERVICE_TOKEN)
		private readonly organizations: Pick<OrganizationService, 'getMemberRole' | 'listMembers'>,
		@inject(PERMISSION_RESOLVER_TOKEN) private readonly permissions: Pick<IPermissionResolver, 'hasPermission'>,
		@inject(USER_SERVICE_TOKEN) private readonly users: Pick<UserService, 'getUser'>,
		@inject(CODE_NUMBER_SERVICE_TOKEN) private readonly numbering: Pick<CodeNumberService, 'next'>,
		@inject(OBJECT_STORAGE_TOKEN) private readonly storage: Pick<IObjectStorage, 'put' | 'presignGet'>,
		/** ERP-0093: tells the customer's portal logins when the project moves on. */
		@inject(CUSTOMER_PORTAL_NOTIFIER_TOKEN) private readonly portalNotifier: Pick<CustomerPortalNotifier, 'notify'>,
	) {}

	/** The customer hears that the project reached a stage (once per stage). */
	private async stageReached(project: TProjectSelect): Promise<void> {
		await this.portalNotifier.notify({
			customerId: project.customerId,
			templateCode: 'portal.project_stage_changed',
			variables: { projectCode: project.code, projectName: project.title, stage: project.stage },
			sourceType: 'project',
			sourceId: project.id,
			tags: [project.code],
			dedupeKey: `${project.id}-${project.stage}`,
		});
	}

	// Visibility -------------------------------------------------------------

	/** The visible project or 404 (also used by the handover service, step 6b). */
	async require(ctx: TProjectContext, id: string): Promise<TProjectSelect> {
		const project = await this.repository.findById(id);
		if (!project || (!ctx.canViewAll && !(await this.repository.isInvolved(id, ctx.actorUserId)))) {
			throw new ProjectNotFoundError();
		}
		return project;
	}

	private async requireActive(ctx: TProjectContext, id: string): Promise<TProjectSelect> {
		const project = await this.require(ctx, id);
		if (project.status !== 'active') throw new ProjectNotActiveError();
		return project;
	}

	private async people(userIds: (string | null | undefined)[]): Promise<Map<string, TPerson>> {
		const ids = [...new Set(userIds.filter((id): id is string => !!id))];
		const found = await Promise.all(ids.map((id) => this.users.getUser(id)));
		return new Map(found.flatMap((user) => (user ? [[user.id, { userId: user.id, name: user.name }] as const] : [])));
	}

	private async memberCan(organizationId: string, userId: string, request: ErpPermissionRequest): Promise<boolean> {
		const role = await this.organizations.getMemberRole(organizationId, userId);
		if (!role) return false;
		return this.permissions.hasPermission(organizationId, role.split(',').map((name) => name.trim()), request);
	}

	private async assertPic(ctx: TProjectContext, userId: string) {
		if (!(await this.memberCan(ctx.organizationId, userId, { project: ['update'] }))) throw new ProjectStaffError('pic');
	}

	private async assertAssignee(ctx: TProjectContext, userId: string | null | undefined) {
		if (userId && !(await this.memberCan(ctx.organizationId, userId, { task: ['update'] }))) {
			throw new ProjectStaffError('assignee');
		}
	}

	// Queries ----------------------------------------------------------------

	async list(ctx: TProjectContext, query: TProjectListQuery): Promise<TPaginationResult<TProjectView>> {
		const result = await this.repository.paginate({ ...query, involvedUserId: ctx.canViewAll ? undefined : ctx.actorUserId });
		const people = await this.people(result.data.map((project) => project.picUserId));
		return { meta: result.meta, data: result.data.map((project) => ({ ...project, pic: people.get(project.picUserId) ?? null })) };
	}

	/**
	 * Dashboard counts (M01) over the caller's visible projects.
	 *
	 * @remarks
	 * Reuses the {@link list} visibility rule: a caller without `canViewAll`
	 * only counts projects they lead or hold a live task in, so the aggregate
	 * cannot reveal a project the list would hide.
	 */
	async stats(ctx: TProjectContext): Promise<TProjectStats> {
		return this.repository.stats({
			involvedUserId: ctx.canViewAll ? undefined : ctx.actorUserId,
			today: businessDateOf(),
		});
	}

	/** Live deals for the "new project" picker, flagged when they already have one. */
	async openDeals(search?: string): Promise<TOpenDeal[]> {
		const orders = await this.sales.listLiveOrders(search);
		const taken = await this.repository.salesOrdersWithProject(orders.map((order) => order.id));
		return orders.map((order) => ({
			id: order.id,
			code: order.code,
			quotationCode: order.quotationCode,
			title: order.title,
			customerName: order.customerSnapshot.name,
			grandTotal: order.grandTotal,
			orderDate: order.orderDate,
			hasProject: taken.has(order.id),
		}));
	}

	/** Members of the caller's organization who can lead projects / work tasks. */
	async staff(ctx: TProjectContext): Promise<{ pics: TPerson[]; workers: TPerson[] }> {
		const members = await this.organizations.listMembers(ctx.organizationId, { page: 1, limit: 100 });
		const byRole = new Map<string, Promise<[boolean, boolean]>>();
		const verdict = (role: string) => {
			if (!byRole.has(role)) {
				const roles = role.split(',').map((name) => name.trim());
				byRole.set(
					role,
					Promise.all([
						this.permissions.hasPermission(ctx.organizationId, roles, { project: ['update'] }),
						this.permissions.hasPermission(ctx.organizationId, roles, { task: ['update'] }),
					]),
				);
			}
			return byRole.get(role)!;
		};
		const pics: TPerson[] = [];
		const workers: TPerson[] = [];
		for (const member of members.data) {
			const [leads, works] = await verdict(member.role);
			const person = { userId: member.userId, name: member.user?.name ?? member.userId };
			if (leads) pics.push(person);
			if (works) workers.push(person);
		}
		const byName = (a: TPerson, b: TPerson) => a.name.localeCompare(b.name);
		return { pics: pics.sort(byName), workers: workers.sort(byName) };
	}

	async get(ctx: TProjectContext, id: string): Promise<TProjectDetail> {
		const project = await this.require(ctx, id);
		const [tasks, evidence, costs, materials] = await Promise.all([
			this.repository.listTasks(id),
			this.repository.listEvidence(id),
			ctx.canSeeCost ? this.repository.listCosts(id) : Promise.resolve(null),
			ctx.canSeeCost ? this.sales.shippedMaterials(project.salesOrderId) : Promise.resolve(null),
		]);
		const people = await this.people([
			project.picUserId,
			...tasks.map((task) => task.assigneeUserId),
			...evidence.map((file) => file.uploadedBy),
		]);
		const has = (kind: EvidenceKind) => evidence.some((file) => file.kind === kind);
		return {
			...project,
			pic: people.get(project.picUserId) ?? null,
			tasks: tasks.map((task) => ({ ...task, assignee: task.assigneeUserId ? (people.get(task.assigneeUserId) ?? null) : null })),
			evidence: evidence.map((file) => ({
				...file,
				url: this.storage.presignGet(file.storageKey, { fileName: file.fileName, expiresIn: FILE_URL_TTL_SECONDS, inline: true }),
				uploader: people.get(file.uploadedBy) ?? null,
			})),
			evidenceComplete: { testing: has('testing'), training: has('training'), bast: has('bast') },
			canClose: project.status === 'active' && REQUIRED_EVIDENCE.every(has),
			costs: costs && materials ? this.costSummary(project, costs, materials) : null,
		};
	}

	private costSummary(project: TProjectSelect, costs: TProjectCostSelect[], materials: TProjectCosts['materials']): TProjectCosts {
		const directTotal = costs.filter((cost) => !cost.voidedAt).reduce((sum, cost) => sum + cost.amount, 0);
		const materialTotal = materials.reduce((sum, note) => sum + note.value, 0);
		return {
			entries: costs.map((cost) => ({
				...cost,
				receiptUrl: cost.receiptStorageKey
					? this.storage.presignGet(cost.receiptStorageKey, {
							fileName: cost.receiptFileName ?? 'nota',
							expiresIn: FILE_URL_TTL_SECONDS,
							inline: true,
						})
					: null,
			})),
			directTotal,
			materials,
			materialTotal,
			total: directTotal + materialTotal,
			contractValue: project.contractValue,
		};
	}

	// Project ----------------------------------------------------------------

	async create(ctx: TProjectContext, body: TCreateProjectRequest): Promise<TProjectSelect> {
		const order = await this.sales.getLiveOrder(body.salesOrderId);
		if (!order) throw new ProjectDealError('notFound');
		if (await this.repository.findLiveBySalesOrder(order.id)) throw new ProjectDealError('taken');
		await this.assertPic(ctx, body.picUserId);
		if (body.targetStartDate && body.targetEndDate && body.targetEndDate < body.targetStartDate) throw new ProjectDatesError();
		const today = businessDateOf();
		const code = await this.numbering.next('project', { date: new Date(`${today}T12:00:00+07:00`) });
		try {
			return await this.repository.create(
				{
					code,
					salesOrderId: order.id,
					salesOrderCode: order.code,
					quotationCode: order.quotationCode,
					customerId: order.customerId,
					customerName: order.customerSnapshot.name,
					title: order.title,
					contractValue: order.grandTotal,
					picUserId: body.picUserId,
					siteName: body.siteName,
					targetStartDate: body.targetStartDate ?? null,
					targetEndDate: body.targetEndDate ?? null,
					notes: body.notes,
					createdBy: ctx.actorUserId,
				},
				DEFAULT_TASKS.map((task) => ({ ...task, assigneeUserId: null, dueDate: null })),
			);
		} catch (error) {
			if (isUniqueViolation(error)) throw new ProjectDealError('taken');
			throw error;
		}
	}

	async update(ctx: TProjectContext, id: string, body: TUpdateProjectRequest): Promise<TProjectSelect> {
		const previousStage = (await this.requireActive(ctx, id)).stage;
		await this.assertPic(ctx, body.picUserId);
		if (body.targetStartDate && body.targetEndDate && body.targetEndDate < body.targetStartDate) throw new ProjectDatesError();
		const updated = await this.repository.update(id, {
			picUserId: body.picUserId,
			siteName: body.siteName,
			targetStartDate: body.targetStartDate ?? null,
			targetEndDate: body.targetEndDate ?? null,
			// Only closing reaches the warranty stage.
			stage: body.stage === 'warranty' ? 'handover' : body.stage,
			notes: body.notes,
		});
		if (!updated) throw new ProjectNotActiveError();
		if (updated.stage !== previousStage) await this.stageReached(updated);
		return updated;
	}

	/** Active → closed (warranty stage) once the closing evidence exists. */
	async close(ctx: TProjectContext, id: string): Promise<TProjectSelect> {
		await this.requireActive(ctx, id);
		const evidence = await this.repository.listEvidence(id);
		const missing = REQUIRED_EVIDENCE.filter((kind) => !evidence.some((file) => file.kind === kind));
		if (missing.length > 0) throw new ProjectEvidenceMissingError([...missing]);
		const closed = await this.repository.transition(id, {
			status: 'closed',
			stage: 'warranty',
			closedBy: ctx.actorUserId,
			closedAt: new Date(),
		});
		if (!closed) throw new ProjectNotActiveError();
		await this.stageReached(closed);
		return closed;
	}

	/** Active → cancelled with a reason; the deal can start a new project. */
	async cancel(ctx: TProjectContext, id: string, reason: string): Promise<TProjectSelect> {
		await this.requireActive(ctx, id);
		const cancelled = await this.repository.transition(id, {
			status: 'cancelled',
			cancelledBy: ctx.actorUserId,
			cancelledAt: new Date(),
			cancelReason: reason,
		});
		if (!cancelled) throw new ProjectNotActiveError();
		return cancelled;
	}

	// Tasks ------------------------------------------------------------------

	private taskData(body: TTaskBodyRequest): TTaskData {
		return { title: body.title, stage: body.stage, assigneeUserId: body.assigneeUserId ?? null, dueDate: body.dueDate ?? null };
	}

	async addTask(ctx: TProjectContext, id: string, body: TTaskBodyRequest): Promise<TProjectTaskSelect> {
		await this.requireActive(ctx, id);
		await this.assertAssignee(ctx, body.assigneeUserId);
		return this.repository.addTask(id, ctx.actorUserId, this.taskData(body));
	}

	async updateTask(ctx: TProjectContext, id: string, taskId: string, body: TTaskBodyRequest): Promise<TProjectTaskSelect> {
		await this.requireActive(ctx, id);
		if (!(await this.repository.findTask(id, taskId))) throw new ProjectChildNotFoundError('task');
		await this.assertAssignee(ctx, body.assigneeUserId);
		const updated = await this.repository.updateTask(taskId, this.taskData(body));
		if (!updated) throw new ProjectChildNotFoundError('task');
		return updated;
	}

	/** Assignees move their own tasks; `task:assign` holders move any task. */
	async setTaskStatus(ctx: TProjectContext, id: string, taskId: string, status: TaskStatus): Promise<TProjectTaskSelect> {
		await this.requireActive(ctx, id);
		const task = await this.repository.findTask(id, taskId);
		if (!task) throw new ProjectChildNotFoundError('task');
		if (!ctx.canAssignTasks && task.assigneeUserId !== ctx.actorUserId) throw new ProjectForbiddenError('task');
		const updated = await this.repository.setTaskStatus(taskId, status, ctx.actorUserId);
		if (!updated) throw new ProjectChildNotFoundError('task');
		return updated;
	}

	async removeTask(ctx: TProjectContext, id: string, taskId: string): Promise<TProjectTaskSelect> {
		await this.requireActive(ctx, id);
		if (!(await this.repository.findTask(id, taskId))) throw new ProjectChildNotFoundError('task');
		const removed = await this.repository.removeTask(taskId, ctx.actorUserId);
		if (!removed) throw new ProjectChildNotFoundError('task');
		return removed;
	}

	// Files ------------------------------------------------------------------

	private async checkFile(file: File) {
		if (file.size === 0) throw new ProjectFileError('empty');
		if (file.size > PROJECT_FILE_MAX_BYTES) throw new ProjectFileError('size');
		const type = sniffProjectFile(new Uint8Array(await file.slice(0, 16).arrayBuffer()));
		if (!type) throw new ProjectFileError('type');
		return type;
	}

	async addEvidence(ctx: TProjectContext, id: string, body: TEvidenceUploadRequest): Promise<TProjectEvidenceSelect> {
		await this.requireActive(ctx, id);
		if (body.taskId && !(await this.repository.findTask(id, body.taskId))) throw new ProjectChildNotFoundError('task');
		const type = await this.checkFile(body.file);
		const storageKey = `projects/${id}/evidence/${crypto.randomUUID()}.${type.ext}`;
		await this.storage.put(storageKey, body.file, type.contentType);
		return this.repository.addEvidence({
			projectId: id,
			taskId: body.taskId ?? null,
			kind: body.kind,
			storageKey,
			fileName: cleanFileName(body.file.name),
			contentType: type.contentType,
			sizeBytes: body.file.size,
			note: body.note?.trim() || null,
			uploadedBy: ctx.actorUserId,
		});
	}

	/** The uploader or a project manager removes (soft) an evidence file. */
	async removeEvidence(ctx: TProjectContext, id: string, evidenceId: string): Promise<TProjectEvidenceSelect> {
		await this.requireActive(ctx, id);
		const evidence = await this.repository.findEvidence(id, evidenceId);
		if (!evidence) throw new ProjectChildNotFoundError('evidence');
		if (!ctx.canManage && evidence.uploadedBy !== ctx.actorUserId) throw new ProjectForbiddenError('evidence');
		const removed = await this.repository.removeEvidence(evidenceId, ctx.actorUserId);
		if (!removed) throw new ProjectChildNotFoundError('evidence');
		return removed;
	}

	// Costs ------------------------------------------------------------------

	async addCost(ctx: TProjectContext, id: string, body: TCostBodyRequest): Promise<TProjectCostSelect> {
		await this.requireActive(ctx, id);
		let receipt: { key: string; name: string; type: string } | null = null;
		if (body.receipt && body.receipt.size > 0) {
			const type = await this.checkFile(body.receipt);
			const key = `projects/${id}/costs/${crypto.randomUUID()}.${type.ext}`;
			await this.storage.put(key, body.receipt, type.contentType);
			receipt = { key, name: cleanFileName(body.receipt.name), type: type.contentType };
		}
		return this.repository.addCost({
			projectId: id,
			category: body.category,
			costDate: body.costDate,
			amount: body.amount,
			description: body.description,
			receiptStorageKey: receipt?.key ?? null,
			receiptFileName: receipt?.name ?? null,
			receiptContentType: receipt?.type ?? null,
			createdBy: ctx.actorUserId,
		});
	}

	async voidCost(ctx: TProjectContext, id: string, costId: string, reason: string): Promise<TProjectCostSelect> {
		await this.requireActive(ctx, id);
		const voided = await this.repository.voidCost(id, costId, ctx.actorUserId, reason);
		if (!voided) {
			const exists = (await this.repository.listCosts(id)).some((cost) => cost.id === costId);
			throw exists ? new ProjectCostVoidedError() : new ProjectChildNotFoundError('cost');
		}
		return voided;
	}
}
