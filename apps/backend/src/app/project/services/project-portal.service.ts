import { USER_SERVICE_TOKEN } from '@app/user/constants/di';
import type { UserService } from '@app/user/services/user.service';
import type { EvidenceKind, ProjectStage, ProjectStatus, TaskStatus } from '@drizzle/schemas/project.schema';
import { type IObjectStorage, OBJECT_STORAGE_TOKEN } from '@providers/s3/object-storage';
import { inject, injectable } from 'tsyringe';
import { HANDOVER_REPOSITORY_TOKEN, PROJECT_REPOSITORY_TOKEN } from '../constants/di';
import type { IHandoverRepository } from '../contracts/handover.repository.interface';
import type { IProjectRepository } from '../contracts/project.repository.interface';

/** Short-lived download links for the customer (signed, ownership checked before signing). */
const PORTAL_FILE_URL_TTL_SECONDS = 300;

/** Evidence the customer may see; `other` stays internal. */
const CUSTOMER_EVIDENCE: readonly EvidenceKind[] = ['testing', 'training', 'bast', 'photo'];

/**
 * A project as the customer sees it (ERP-0022). Deliberately no contract
 * value, costs, margins, notes or staff ids — a separate DTO, never the staff
 * view with fields removed.
 */
export type TPortalProject = {
	id: string;
	code: string;
	title: string;
	siteName: string | null;
	stage: ProjectStage;
	status: ProjectStatus;
	targetStartDate: string | null;
	targetEndDate: string | null;
	closedAt: Date | null;
	manager: { name: string } | null;
	tasks: { title: string; stage: ProjectStage; status: TaskStatus; dueDate: string | null; doneAt: Date | null }[];
};

export type TPortalProjectDetail = TPortalProject & {
	handovers: { id: string; code: string; bastDate: string; workTitle: string }[];
	files: { id: string; kind: EvidenceKind; fileName: string; contentType: string; sizeBytes: number; url: string; createdAt: Date }[];
};

/**
 * Customer-portal view of projects (ERP-0022), the projects module's
 * contract for the portal module. Every read is scoped to the customer id
 * the portal guard resolved; another customer's project answers `null`.
 */
@injectable()
export class ProjectPortalService {
	constructor(
		@inject(PROJECT_REPOSITORY_TOKEN) private readonly projects: IProjectRepository,
		@inject(HANDOVER_REPOSITORY_TOKEN) private readonly handovers: Pick<IHandoverRepository, 'list'>,
		@inject(USER_SERVICE_TOKEN) private readonly users: Pick<UserService, 'getUser'>,
		@inject(OBJECT_STORAGE_TOKEN) private readonly storage: Pick<IObjectStorage, 'presignGet'>,
	) {}

	async listForCustomer(customerId: string): Promise<TPortalProject[]> {
		const rows = await this.projects.listByCustomer(customerId);
		return Promise.all(rows.map((project) => this.summary(project)));
	}

	async getForCustomer(customerId: string, id: string): Promise<TPortalProjectDetail | null> {
		const project = await this.projects.findById(id);
		if (!project || project.customerId !== customerId || project.status === 'cancelled') return null;
		const [summary, basts, evidence] = await Promise.all([
			this.summary(project),
			this.handovers.list(project.id),
			this.projects.listEvidence(project.id),
		]);
		return {
			...summary,
			handovers: basts
				.filter((bast) => bast.status === 'issued')
				.map((bast) => ({ id: bast.id, code: bast.code, bastDate: bast.bastDate, workTitle: bast.workTitle })),
			files: evidence
				.filter((file) => CUSTOMER_EVIDENCE.includes(file.kind))
				.map((file) => ({
					id: file.id,
					kind: file.kind,
					fileName: file.fileName,
					contentType: file.contentType,
					sizeBytes: file.sizeBytes,
					url: this.storage.presignGet(file.storageKey, { fileName: file.fileName, expiresIn: PORTAL_FILE_URL_TTL_SECONDS, inline: true }),
					createdAt: file.createdAt,
				})),
		};
	}

	private async summary(project: Awaited<ReturnType<IProjectRepository['findById']>> & {}): Promise<TPortalProject> {
		const [tasks, manager] = await Promise.all([this.projects.listTasks(project.id), this.users.getUser(project.picUserId)]);
		return {
			id: project.id,
			code: project.code,
			title: project.title,
			siteName: project.siteName,
			stage: project.stage,
			status: project.status,
			targetStartDate: project.targetStartDate,
			targetEndDate: project.targetEndDate,
			closedAt: project.closedAt,
			manager: manager ? { name: manager.name } : null,
			tasks: tasks.map((task) => ({ title: task.title, stage: task.stage, status: task.status, dueDate: task.dueDate, doneAt: task.doneAt })),
		};
	}
}
