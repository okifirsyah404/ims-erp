import type { TProjectSelect, TTaskSelect } from '@drizzle/schemas/project.schema';
import type { TPaginationResult } from '@ims-erp/common';
import { inject, injectable } from 'tsyringe';
import { PROJECT_REPOSITORY_TOKEN, PROJECT_SERVICE_TOKEN } from '../constants/di';
import type { IProjectRepository, TProjectPaginationRequest } from '../contracts/project.repository.interface';
import type { TEvidenceUploadRequest, TTaskBodyRequest } from '../contracts/project.contract';
import type { TPortalActor } from './site-attendance.service';
import type { ProjectService, TProjectContext, TProjectDetail } from './project.service';
import { ProjectChildNotFoundError, ProjectForbiddenError, ProjectNotFoundError } from '../errors/project.errors';

/**
 * The employee portal's view of projects (Phase B).
 *
 * @remarks
 * Deliberately thin: the rules already live in {@link ProjectService}
 * (visibility, own-task-unless-manager, evidence sniffing, presigned URLs).
 * This class only builds the caller's {@link TProjectContext} from the two
 * facts the portal has - the employee and the project's `pic_user_id` - and
 * narrows reads to "assigned to me".
 *
 * PIC rights come from `project.projects.pic_user_id = caller`, which is the
 * same fact the admin screen shows. No organization permission is consulted:
 * a technician holds `project:read` but no write grant, and the portal exists
 * to let exactly that person run the site.
 */
@injectable()
export class PortalProjectService {
	constructor(
		@inject(PROJECT_REPOSITORY_TOKEN) private readonly repository: IProjectRepository,
		@inject(PROJECT_SERVICE_TOKEN) private readonly service: ProjectService,
	) {}

	/** Projects the caller is involved in (PIC or has a live task). */
	async list(actor: TPortalActor, query: TProjectPaginationRequest): Promise<TPaginationResult<TProjectSelect & { isPic: boolean }>> {
		const result = await this.repository.paginate({ ...query, involvedUserId: actor.userId });
		return {
			meta: result.meta,
			data: result.data.map((project) => ({ ...project, isPic: project.picUserId === actor.userId })),
		};
	}

	private async isPic(actor: TPortalActor, projectId: string): Promise<boolean> {
		const project = await this.repository.findById(projectId);
		if (!project) throw new ProjectNotFoundError();
		if (!(await this.repository.isInvolved(projectId, actor.userId))) throw new ProjectNotFoundError();
		return project.picUserId === actor.userId;
	}

	private context(actor: TPortalActor, pic: boolean): TProjectContext {
		return {
			organizationId: actor.organizationId,
			actorUserId: actor.userId,
			// The portal never shows another project's costs, and a PIC manages
			// tasks but not money (grill decision).
			canViewAll: false,
			canSeeCost: false,
			canAssignTasks: pic,
			canManage: pic,
		};
	}

	/** Members who may be assigned a task (same list the admin screen shows). */
	staff(actor: TPortalActor): Promise<{ pics: { userId: string; name: string }[]; workers: { userId: string; name: string }[] }> {
		return this.service.staff(this.context(actor, false));
	}

	async get(actor: TPortalActor, projectId: string): Promise<TProjectDetail & { isPic: boolean }> {
		const pic = await this.isPic(actor, projectId);
		const detail = await this.service.get(this.context(actor, pic), projectId);
		return { ...detail, costs: null, isPic: pic };
	}

	/** A task write needs the PIC row; the service still checks the assignee. */
	private async requirePicContext(actor: TPortalActor, projectId: string): Promise<TProjectContext> {
		const pic = await this.isPic(actor, projectId);
		if (!pic) throw new ProjectForbiddenError('pic');
		return this.context(actor, true);
	}

	addTask(actor: TPortalActor, projectId: string, body: TTaskBodyRequest): Promise<TTaskSelect> {
		return this.requirePicContext(actor, projectId).then((ctx) => this.service.addTask(ctx, projectId, body));
	}

	updateTask(actor: TPortalActor, projectId: string, taskId: string, body: TTaskBodyRequest): Promise<TTaskSelect> {
		return this.requirePicContext(actor, projectId).then((ctx) => this.service.updateTask(ctx, projectId, taskId, body));
	}

	removeTask(actor: TPortalActor, projectId: string, taskId: string): Promise<TTaskSelect> {
		return this.requirePicContext(actor, projectId).then((ctx) => this.service.removeTask(ctx, projectId, taskId));
	}

	/**
	 * Moves a task: the assignee on their own task, the PIC on anyone's.
	 * `ProjectService` enforces the first half from `canAssignTasks`.
	 */
	async setTaskStatus(actor: TPortalActor, projectId: string, taskId: string, status: TaskStatus): Promise<TTaskSelect> {
		const pic = await this.isPic(actor, projectId);
		if (!pic) {
			const task = await this.repository.findTask(projectId, taskId);
			if (!task || task.assigneeUserId !== actor.userId) throw new ProjectChildNotFoundError('task');
		}
		return this.service.setTaskStatus(this.context(actor, pic), projectId, taskId, status);
	}

	async addEvidence(actor: TPortalActor, projectId: string, body: TEvidenceUploadRequest) {
		const pic = await this.isPic(actor, projectId);
		if (!pic) {
			// A non-PIC may only attach evidence to their own task.
			if (!body.taskId) throw new ProjectForbiddenError('evidence');
			const task = await this.repository.findTask(projectId, body.taskId);
			if (!task || task.assigneeUserId !== actor.userId) throw new ProjectForbiddenError('evidence');
		}
		return this.service.addEvidence(this.context(actor, pic), projectId, body);
	}

	async removeEvidence(actor: TPortalActor, projectId: string, evidenceId: string) {
		const pic = await this.isPic(actor, projectId);
		return this.service.removeEvidence(this.context(actor, pic), projectId, evidenceId);
	}
}

type TaskStatus = TTaskSelect['status'];

