import { inject, injectable } from 'tsyringe';
import { PROJECT_REPOSITORY_TOKEN } from '../constants/di';
import type { IProjectRepository } from '../contracts/project.repository.interface';

/**
 * Projects contract for the Sales module: whether an order has a live
 * project. Depends only on the project repository, so Sales can ask while
 * Projects uses Sales' fulfilment contract, without a dependency cycle.
 */
@injectable()
export class ProjectLookupService {
	constructor(
		@inject(PROJECT_REPOSITORY_TOKEN)
		private readonly projects: Pick<IProjectRepository, 'findLiveBySalesOrder'>,
	) {}

	async hasLiveProject(salesOrderId: string): Promise<boolean> {
		return !!(await this.projects.findLiveBySalesOrder(salesOrderId));
	}
}
