import { z } from 'zod';
import { AUDIT_ACTIONS } from '@drizzle/schemas/audit.schema';

/**
 * Request/response contracts for the audit read API.
 *
 * @remarks
 * Only the read side has a contract: writes are performed internally by the
 * services that own each business action, never over HTTP.
 */

/** Audit listing query. All filters are optional and ANDed. */
export const auditQuerySchema = z.object({
	page: z.coerce.number().int().min(1).default(1),
	limit: z.coerce.number().int().min(1).max(100).default(20),
	action: z.enum(AUDIT_ACTIONS).optional(),
	actorUserId: z.string().min(1).optional(),
	targetType: z
		.enum(['invitation', 'user', 'role', 'member', 'organization'])
		.optional(),
	organizationId: z.string().min(1).optional(),
	/** Inclusive ISO-8601 lower bound. */
	from: z.string().datetime().optional(),
	/** Exclusive ISO-8601 upper bound. */
	to: z.string().datetime().optional(),
});
export type TAuditQuery = z.infer<typeof auditQuerySchema>;

/** Admin-facing audit row. */
export type TAdminAudit = {
	id: string;
	actorUserId: string;
	actorEmail: string | null;
	action: string;
	targetType: string;
	targetId: string;
	organizationId: string | null;
	meta: Record<string, unknown> | null;
	ipAddress: string | null;
	userAgent: string | null;
	createdAt: Date;
};
