import type { TProjectSelect } from '@drizzle/schemas/projects.schema';
import { inject, injectable } from 'tsyringe';
import { PROJECT_REPOSITORY_TOKEN } from '../constants/di';
import type { IProjectRepository } from '../contracts/project.repository.interface';

/**
 * Projects contract for the Sales and After-Sales modules: whether an order
 * has a live project, and plain project lookups (no caller visibility).
 * Depends only on the project repository, so Sales can ask while Projects
 * uses Sales' fulfilment contract, without a dependency cycle.
 */
@injectable()
export class ProjectLookupService {
	constructor(
		@inject(PROJECT_REPOSITORY_TOKEN)
		private readonly projects: Pick<IProjectRepository, 'findLiveBySalesOrder' | 'findById'>,
	) {}

	async hasLiveProject(salesOrderId: string): Promise<boolean> {
		return !!(await this.projects.findLiveBySalesOrder(salesOrderId));
	}

	/** The live project of an order (After-Sales warranty check), or `null`. */
	liveProjectOfOrder(salesOrderId: string): Promise<TProjectSelect | null> {
		return this.projects.findLiveBySalesOrder(salesOrderId);
	}

	/** One project without caller visibility (After-Sales validates ticket links). */
	getProject(id: string): Promise<TProjectSelect | null> {
		return this.projects.findById(id);
	}
}
