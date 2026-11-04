import type { TInventoryAuditActor } from '../constants/audit-actor';

/**
 * Shared audit plumbing for the inventory module.
 *
 * @remarks
 * A thin adapter over the audit module's fire-and-forget
 * {@link AuditService}: the inventory services construct entries, this
 * helper fills the boilerplate (actor fields, request context) and never
 * throws. Master-data entries carry before/after snapshots in `meta`
 * (hardening plan D3).
 */
import type { AuditService } from '../../audit/services/audit.service';
import type { AuditAction, TAuditTargetType } from '../../audit/contracts/audit.repository.interface';

/** Adapter bundling an {@link AuditService} with entry-building helpers. */
export class InventoryAuditWriter {
	constructor(private readonly audit: AuditService) {}

	/** Writes one entry; never throws. */
	async record(input: {
		actor: TInventoryAuditActor;
		action: AuditAction;
		targetType: TAuditTargetType;
		targetId: string;
		organizationId?: string | null;
		meta?: Record<string, unknown>;
	}): Promise<void> {
		await this.audit.record({
			actorUserId: input.actor.userId,
			actorEmail: input.actor.email ?? null,
			action: input.action,
			targetType: input.targetType,
			targetId: input.targetId,
			organizationId: input.organizationId ?? null,
			meta: input.meta,
			request: {
				ip: input.actor.ip ?? null,
				userAgent: input.actor.userAgent ?? null,
			},
		});
	}

	/** Builds a before/after snapshot for a master-data update. */
	static snapshot(
		before: Record<string, unknown>,
		after: Record<string, unknown>,
	): Record<string, unknown> {
		return {
			before,
			after,
			changed: Object.keys(after).filter(
				(key) => before[key] !== after[key],
			),
		};
	}
}
