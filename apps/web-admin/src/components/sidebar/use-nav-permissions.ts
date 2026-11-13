import { queryOptions, useQueries } from '@tanstack/react-query';
import { organization, useSession } from '@/lib/auth-client';
import type { Permission } from '@/lib/permissions';
import { splitPermission } from '@/lib/use-permission';

/**
 * Cached `hasPermission` for one permission in one organization. Shared by the
 * sidebar and the route guard so both read the same cache entry.
 */
export function orgPermissionQueryOptions(
	userId: string,
	activeOrgId: string,
	permission: Permission,
) {
	return queryOptions({
		queryKey: ['erp-has-permission', userId, activeOrgId, permission] as const,
		staleTime: 60 * 1000,
		queryFn: async () => {
			const { resource, action } = splitPermission(permission);
			const result = await organization.hasPermission({
				permissions: { [resource]: [action] },
			});
			return result.data?.success === true;
		},
	});
}

/**
 * Resolves every nav permission in one batch: one `hasPermission` query per
 * permission, cached under the active organization.
 *
 * @remarks
 * UX only. `can` is false until the active organization is known, so an
 * org-less user sees only `open` items. `pending` stays true until every
 * query settles, so the sidebar can show skeletons instead of hiding sections.
 */
export function useNavPermissions(permissions: Permission[]) {
	const { data: session, isPending } = useSession();
	const userId = session?.user?.id;
	const activeOrgId = session?.session?.activeOrganizationId;

	const results = useQueries({
		queries: permissions.map((permission) => ({
			...orgPermissionQueryOptions(userId ?? '', activeOrgId ?? '', permission),
			enabled: !isPending && !!userId && !!activeOrgId,
		})),
	});

	const granted = new Set(permissions.filter((_, i) => results[i]?.data === true));
	const pending = isPending || (!!activeOrgId && results.some((r) => r.isPending));

	return {
		pending,
		can: (required: Permission[]) => required.every((p) => granted.has(p)),
	};
}
