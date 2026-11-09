import { COMPANY_PROFILE_SERVICE_TOKEN, NUMBERING_SERVICE_TOKEN } from '@app/organization/constants/di';
import type { CompanyProfileService } from '@app/organization/services/company-profile.service';
import type { NumberingService } from '@app/organization/services/numbering.service';
import { SALES_FULFILMENT_SERVICE_TOKEN } from '@app/sales/constants/di';
import type { SalesFulfilmentService } from '@app/sales/services/sales-fulfilment.service';
import { USER_SERVICE_TOKEN } from '@app/user/constants/di';
import type { UserService } from '@app/user/services/user.service';
import type { TProjectHandoverSelect, TProjectSelect } from '@drizzle/schemas/projects.schema';
import { businessDateOf } from '@utils/business-date.util';
import { inject, injectable } from 'tsyringe';
import { HANDOVER_REPOSITORY_TOKEN, PROJECT_SERVICE_TOKEN } from '../constants/di';
import type { TBastBodyRequest } from '../contracts/handover.contract';
import type { IHandoverRepository, TBastData, TBastRow } from '../contracts/handover.repository.interface';
import type { TPaginationResult } from '@ims-erp/common';
import { BastNotFoundError, ProjectNotActiveError } from '../errors/project.errors';
import { BAST_ITEM_REMARK, DEFAULT_BAST_SCOPE } from '../utils/handover-defaults';
import type { ProjectService, TProjectContext } from './project.service';

/** A new BAST's prefilled fields (not saved). */
export type TBastDraft = TBastData;

/**
 * BAST documents of a project (M07, ADR-0011 step 6b) and the Projects
 * contract the After-Sales warranty uses (project visibility and BAST
 * lookup).
 *
 * @remarks
 * Several BASTs per project (owner decision 2026-11-06), each numbered on
 * creation by its BAST date. They change only while the project is active;
 * a wrong one is cancelled, never deleted.
 */
@injectable()
export class HandoverService {
	constructor(
		@inject(HANDOVER_REPOSITORY_TOKEN) private readonly basts: IHandoverRepository,
		@inject(PROJECT_SERVICE_TOKEN) private readonly projects: Pick<ProjectService, 'require'>,
		@inject(SALES_FULFILMENT_SERVICE_TOKEN) private readonly sales: Pick<SalesFulfilmentService, 'getOrder' | 'orderLines'>,
		@inject(COMPANY_PROFILE_SERVICE_TOKEN) private readonly profile: Pick<CompanyProfileService, 'get'>,
		@inject(USER_SERVICE_TOKEN) private readonly users: Pick<UserService, 'getUser'>,
		@inject(NUMBERING_SERVICE_TOKEN) private readonly numbering: Pick<NumberingService, 'next'>,
	) {}

	// Contract for After-Sales -------------------------------------------------

	/** The visible project or 404 (same rule as the project pages). */
	requireProject(ctx: TProjectContext, projectId: string): Promise<TProjectSelect> {
		return this.projects.require(ctx, projectId);
	}

	/** One BAST of a project (cancelled included) or `null`. */
	findBast(projectId: string, bastId: string): Promise<TProjectHandoverSelect | null> {
		return this.basts.find(projectId, bastId);
	}

	// BAST ---------------------------------------------------------------------

	/** BASTs across the projects visible to the caller. */
	listAll(ctx: TProjectContext, query: { page: number; limit: number; search?: string }): Promise<TPaginationResult<TBastRow>> {
		return this.basts.paginateAll({ ...query, involvedUserId: ctx.canViewAll ? undefined : ctx.actorUserId });
	}

	async list(ctx: TProjectContext, projectId: string): Promise<TProjectHandoverSelect[]> {
		await this.projects.require(ctx, projectId);
		return this.basts.list(projectId);
	}

	async get(ctx: TProjectContext, projectId: string, bastId: string): Promise<TProjectHandoverSelect> {
		await this.projects.require(ctx, projectId);
		const bast = await this.basts.find(projectId, bastId);
		if (!bast) throw new BastNotFoundError();
		return bast;
	}

	/** Prefilled fields from the order, the company and the PIC. */
	async draft(ctx: TProjectContext, projectId: string): Promise<TBastDraft> {
		const project = await this.projects.require(ctx, projectId);
		const [order, lines, profile, pic] = await Promise.all([
			this.sales.getOrder(project.salesOrderId),
			this.sales.orderLines(project.salesOrderId),
			this.profile.get(false),
			this.users.getUser(project.picUserId),
		]);
		const items = lines.map((line) => ({
			description: line.name,
			volume: `${Number(line.quantity).toLocaleString('id-ID')} ${line.unit}`,
			remarks: BAST_ITEM_REMARK,
		}));
		return {
			bastDate: businessDateOf(),
			firstPartyCompany: project.customerName,
			firstPartyName: order?.attention ?? '',
			firstPartyTitle: '',
			secondPartyCompany: profile?.legalName ?? '',
			secondPartyName: pic?.name ?? '',
			secondPartyTitle: 'Project Manager',
			contractNumber: order?.customerPoNumber ?? null,
			workTitle: project.title,
			projectName: project.siteName,
			items: items.length > 0 ? items : [{ description: project.title, volume: '1 Lot', remarks: BAST_ITEM_REMARK }],
			scope: DEFAULT_BAST_SCOPE,
		};
	}

	private async requireActive(ctx: TProjectContext, projectId: string): Promise<TProjectSelect> {
		const project = await this.projects.require(ctx, projectId);
		if (project.status !== 'active') throw new ProjectNotActiveError();
		return project;
	}

	async create(ctx: TProjectContext, projectId: string, body: TBastBodyRequest): Promise<TProjectHandoverSelect> {
		await this.requireActive(ctx, projectId);
		const code = await this.numbering.next('bast', { date: new Date(`${body.bastDate}T12:00:00+07:00`) });
		return this.basts.create(projectId, code, ctx.actorUserId, body);
	}

	async update(ctx: TProjectContext, projectId: string, bastId: string, body: TBastBodyRequest): Promise<TProjectHandoverSelect> {
		await this.requireActive(ctx, projectId);
		if (!(await this.basts.find(projectId, bastId))) throw new BastNotFoundError();
		const updated = await this.basts.update(bastId, body);
		if (!updated) throw new BastNotFoundError();
		return updated;
	}

	async cancel(ctx: TProjectContext, projectId: string, bastId: string): Promise<TProjectHandoverSelect> {
		await this.requireActive(ctx, projectId);
		if (!(await this.basts.find(projectId, bastId))) throw new BastNotFoundError();
		const cancelled = await this.basts.cancel(bastId, ctx.actorUserId);
		if (!cancelled) throw new BastNotFoundError();
		return cancelled;
	}
}
