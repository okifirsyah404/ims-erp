import type { TProjectSelect } from '@drizzle/schemas/project.schema';
import { inject, injectable } from 'tsyringe';
import { LICENSING_REPOSITORY_TOKEN, PROJECT_REPOSITORY_TOKEN } from '../constants/di';
import type { ILicensingRepository } from '../contracts/licensing.contract';
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
		private readonly projects: Pick<IProjectRepository, 'findLiveBySalesOrder' | 'findById' | 'paginate'>,
		/** ERP-0149: licence renewals for finance's cash forecast; optional for older tests. */
		@inject(LICENSING_REPOSITORY_TOKEN)
		private readonly licensing?: Pick<ILicensingRepository, 'paginateContracts'>,
	) {}

	/** Active licence contracts ending on or before `until` (finance cash forecast, ERP-0149). */
	async renewalsDue(until: string): Promise<Array<{ id: string; code: string; customerName: string; endDate: string | null; billingCycle: string }>> {
		if (!this.licensing) return [];
		const page = await this.licensing.paginateContracts({ page: 1, limit: 100, status: 'active', dueBefore: until });
		return page.data.map((row) => ({ id: row.id, code: row.code, customerName: row.customerName, endDate: row.endDate, billingCycle: row.billingCycle }));
	}

	async hasLiveProject(orderId: string): Promise<boolean> {
		return !!(await this.projects.findLiveBySalesOrder(orderId));
	}

	/** The live project of an order (After-Sales warranty check), or `null`. */
	liveProjectOfOrder(orderId: string): Promise<TProjectSelect | null> {
		return this.projects.findLiveBySalesOrder(orderId);
	}

	/** One project without caller visibility (After-Sales validates ticket links). */
	getProject(id: string): Promise<TProjectSelect | null> {
		return this.projects.findById(id);
	}

	/**
	 * Active projects matching a search, for pickers in other modules
	 * (B-29: the warehouse issuing material to a project). Only the fields a
	 * picker shows; no costs and no caller visibility.
	 */
	async activeProjectOptions(search?: string): Promise<Array<{ id: string; code: string; title: string; customerName: string }>> {
		const page = await this.projects.paginate({ page: 1, limit: 20, search, status: 'active' });
		return page.data.map((project) => ({
			id: project.id,
			code: project.code,
			title: project.title,
			customerName: project.customerName,
		}));
	}
}
