/**
 * Shared audit plumbing for every module that records master-data mutations.
 *
 * @remarks
 * A thin adapter over the audit module's fire-and-forget {@link AuditService}:
 * the module services construct entries, this helper fills the boilerplate
 * (actor fields, request context) and never throws. Master-data entries carry
 * before/after snapshots in `meta` (hardening plan D3).
 *
 * Each module registers its own instance (`container.registerInstance`) so the
 * token never crosses a module boundary; the class lives here only because
 * `inventory`, `product` and `warehouse` all need the identical adapter
 * (ADR-0026).
 */
import type { AuditAction, TAuditTargetType } from '@app/audit/contracts/audit.repository.interface';
import type { AuditService } from '@app/audit/services/audit.service';
import type { TAuditActor } from './actor';

/** Adapter bundling an {@link AuditService} with entry-building helpers. */
export class AuditWriter {
	constructor(private readonly audit: AuditService) {}

	/** Writes one entry; never throws. */
	async record(input: {
		actor: TAuditActor;
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
