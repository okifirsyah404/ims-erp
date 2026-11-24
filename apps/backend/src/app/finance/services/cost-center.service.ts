import type { TCostCenterSelect } from '@drizzle/schemas/finance.schema';
import type { TPaginationResult } from '@ims-erp/common';
import { inject, injectable } from 'tsyringe';
import type { AuditWriter } from '@shared/audit';
import { COST_CENTER_REPOSITORY_TOKEN, FINANCE_AUDIT_WRITER_TOKEN } from '../constants/di';
import { CostCenterCodeTakenError, CostCenterNotFoundError } from '../errors/ledger.errors';
import type {
	ICostCenterRepository,
	TCostCenterPaginationRequest,
} from '../contracts/cost-center.repository.interface';

export type TCostCenterActor = { organizationId: string; actorUserId: string };

/**
 * Cost-centre master data (ERP-0127). Codes are unique per organization and
 * immutable; archiving is a soft deactivation, so journal lines keep their
 * reference.
 */
@injectable()
export class CostCenterService {
	constructor(
		@inject(COST_CENTER_REPOSITORY_TOKEN) private readonly costCenters: ICostCenterRepository,
		@inject(FINANCE_AUDIT_WRITER_TOKEN) private readonly audit?: AuditWriter,
	) {}

	list(request: TCostCenterPaginationRequest): Promise<TPaginationResult<TCostCenterSelect>> {
		return this.costCenters.paginate(request);
	}

	async get(organizationId: string, id: string): Promise<TCostCenterSelect> {
		const row = await this.costCenters.findById(organizationId, id);
		if (!row) throw new CostCenterNotFoundError();
		return row;
	}

	async create(
		ctx: TCostCenterActor,
		input: { code: string; name: string; parentCostCenterId: string | null; description: string | null },
	): Promise<TCostCenterSelect> {
		if (await this.costCenters.findByCode(ctx.organizationId, input.code)) {
			throw new CostCenterCodeTakenError();
		}
		if (input.parentCostCenterId) await this.get(ctx.organizationId, input.parentCostCenterId);
		const created = await this.costCenters.insert({ organizationId: ctx.organizationId, ...input });
		await this.record(ctx, 'cost_center.created', created.id, { code: created.code });
		return created;
	}

	async update(
		ctx: TCostCenterActor,
		id: string,
		patch: { name?: string; parentCostCenterId?: string | null; isActive?: boolean; description?: string | null },
	): Promise<TCostCenterSelect> {
		const before = await this.get(ctx.organizationId, id);
		if (patch.parentCostCenterId) {
			if (patch.parentCostCenterId === id) throw new CostCenterNotFoundError();
			await this.get(ctx.organizationId, patch.parentCostCenterId);
		}
		const updated = await this.costCenters.update(ctx.organizationId, id, patch);
		if (!updated) throw new CostCenterNotFoundError();
		await this.record(ctx, 'cost_center.updated', id, {
			before: { name: before.name, isActive: before.isActive },
			after: { name: updated.name, isActive: updated.isActive },
		});
		return updated;
	}

	async archive(ctx: TCostCenterActor, id: string): Promise<TCostCenterSelect> {
		await this.get(ctx.organizationId, id);
		const updated = await this.costCenters.update(ctx.organizationId, id, { isActive: false });
		if (!updated) throw new CostCenterNotFoundError();
		await this.record(ctx, 'cost_center.archived', id, { code: updated.code });
		return updated;
	}

	private async record(
		ctx: TCostCenterActor,
		action: 'cost_center.created' | 'cost_center.updated' | 'cost_center.archived',
		targetId: string,
		meta: Record<string, unknown>,
	): Promise<void> {
		await this.audit?.record({
			actor: { userId: ctx.actorUserId },
			action,
			targetType: 'cost_center',
			targetId,
			organizationId: ctx.organizationId,
			meta,
		});
	}
}
