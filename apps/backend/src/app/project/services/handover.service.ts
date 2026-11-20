import { PROJECT_NUMBERING_SERVICE_TOKEN } from '../constants/di';
import { COMPANY_SERVICE_TOKEN } from '@app/company';
import type { CompanyService } from '@app/company';
import type { ProjectNumberingService } from './project-numbering.service';
import { DOCUMENT_SERVICE_TOKEN } from '@app/document';
import type { DocumentService } from '@app/document';
import { SALES_FULFILMENT_SERVICE_TOKEN } from '@app/sale/constants/di';
import type { SalesFulfilmentService } from '@app/sale/services/sales-fulfilment.service';
import { USER_SERVICE_TOKEN } from '@app/user/constants/di';
import type { UserService } from '@app/user/services/user.service';
import type { THandoverSelect, TProjectSelect } from '@drizzle/schemas/project.schema';
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
		@inject(COMPANY_SERVICE_TOKEN) private readonly profile: Pick<CompanyService, 'get'>,
		@inject(USER_SERVICE_TOKEN) private readonly users: Pick<UserService, 'getUser'>,
		@inject(PROJECT_NUMBERING_SERVICE_TOKEN) private readonly numbering: Pick<ProjectNumberingService, 'next'>,
		/** ERP-0044: issued BAST is recorded in the registry. */
		@inject(DOCUMENT_SERVICE_TOKEN) private readonly documents: Pick<DocumentService, 'register' | 'voidBySource'>,
	) {}

	// Contract for After-Sales -------------------------------------------------

	/** The visible project or 404 (same rule as the project pages). */
	requireProject(ctx: TProjectContext, projectId: string): Promise<TProjectSelect> {
		return this.projects.require(ctx, projectId);
	}

	/** One BAST of a project (cancelled included) or `null`. */
	findBast(projectId: string, handoverId: string): Promise<THandoverSelect | null> {
		return this.basts.find(projectId, handoverId);
	}

	// BAST ---------------------------------------------------------------------

	/** BASTs across the projects visible to the caller. */
	listAll(ctx: TProjectContext, query: { page: number; limit: number; search?: string }): Promise<TPaginationResult<TBastRow>> {
		return this.basts.paginate({ ...query, involvedUserId: ctx.canViewAll ? undefined : ctx.actorUserId });
	}

	async list(ctx: TProjectContext, projectId: string): Promise<THandoverSelect[]> {
		await this.projects.require(ctx, projectId);
		return this.basts.list(projectId);
	}

	async get(ctx: TProjectContext, projectId: string, handoverId: string): Promise<THandoverSelect> {
		await this.projects.require(ctx, projectId);
		const bast = await this.basts.find(projectId, handoverId);
		if (!bast) throw new BastNotFoundError();
		return bast;
	}

	/** Prefilled fields from the order, the company and the PIC. */
	async draft(ctx: TProjectContext, projectId: string): Promise<TBastDraft> {
		const project = await this.projects.require(ctx, projectId);
		// ADR-0014: the order and the PIC are optional links; without one the
		// matching prefill is simply blank.
		const orderId = project.orderId;
		const picUserId = project.picUserId;
		const [order, lines, profile, pic] = await Promise.all([
			orderId ? this.sales.getOrder(orderId) : Promise.resolve(null),
			orderId ? this.sales.orderLines(orderId) : Promise.resolve([]),
			this.profile.get(),
			picUserId ? this.users.getUser(picUserId) : Promise.resolve(null),
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

	async create(ctx: TProjectContext, projectId: string, body: TBastBodyRequest): Promise<THandoverSelect> {
		await this.requireActive(ctx, projectId);
		const code = await this.numbering.next('bast', undefined, new Date(`${body.bastDate}T12:00:00+07:00`));
		const bast = await this.basts.create(projectId, code, ctx.actorUserId, body);
		// ERP-0044: the signed handover is the document the customer keeps.
		await this.documents.register({
			code: bast.code,
			documentType: 'bast',
			module: 'projects',
			sourceType: 'bast',
			sourceId: bast.id,
			organizationId: null,
			issuedOn: bast.bastDate,
			issuedByUserId: ctx.actorUserId,
		});
		return bast;
	}

	async update(ctx: TProjectContext, projectId: string, handoverId: string, body: TBastBodyRequest): Promise<THandoverSelect> {
		await this.requireActive(ctx, projectId);
		if (!(await this.basts.find(projectId, handoverId))) throw new BastNotFoundError();
		const updated = await this.basts.update(handoverId, body);
		if (!updated) throw new BastNotFoundError();
		return updated;
	}

	async cancel(ctx: TProjectContext, projectId: string, handoverId: string): Promise<THandoverSelect> {
		await this.requireActive(ctx, projectId);
		if (!(await this.basts.find(projectId, handoverId))) throw new BastNotFoundError();
		const cancelled = await this.basts.cancel(handoverId, ctx.actorUserId);
		if (!cancelled) throw new BastNotFoundError();
		// ERP-0044: a cancelled BAST is a dead document in the registry.
		await this.documents.voidBySource('projects', 'bast', handoverId);
		return cancelled;
	}
}
