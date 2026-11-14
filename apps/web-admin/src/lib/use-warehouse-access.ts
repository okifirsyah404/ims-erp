import { useQuery } from '@tanstack/react-query';
import { useIsAppAdmin } from './use-is-app-admin';
import { myWarehousesQueryOptions } from './warehouse-api';

/**
 * Whether the caller may use the warehouse screens (ADR-0017).
 *
 * @remarks
 * Two independent ways in: the platform administrator role, or a live
 * person-in-charge grant. The grant is read from `GET /warehouses/mine`, so a
 * PIC needs no organization membership and no `warehouse:*` permission — the
 * fact lives in `inventory.warehouse_managers`, not in the permission catalog.
 *
 * UX only. The backend re-authorizes every warehouse call.
 */
export function useWarehouseAccess(): {
	isAppAdmin: boolean;
	isPic: boolean;
	/** True when the caller may render the warehouse screens at all. */
	canAccess: boolean;
	isPending: boolean;
} {
	const { isAppAdmin, isPending: sessionPending } = useIsAppAdmin();
	// An app admin passes every gate, so the grant query is skipped for them.
	const { data, isPending: grantsPending } = useQuery({
		...myWarehousesQueryOptions(),
		enabled: !sessionPending && !isAppAdmin,
	});

	const isPic = !isAppAdmin && (data ?? []).length > 0;
	return {
		isAppAdmin,
		isPic,
		canAccess: isAppAdmin || isPic,
		isPending: sessionPending || (!isAppAdmin && grantsPending),
	};
}
