import type { LucideIcon } from 'lucide-react';
import type { NavKey } from '@ims-erp/locales';
import type { Permission } from '@/lib/permissions';

export type SidebarItem = {
	/**
	 * i18next key in the `nav` namespace (e.g. `item.warehouses`), not display
	 * text. Resolved by `SidebarSection`, which is a component and can use
	 * `useTranslation` — these item lists are module-level constants.
	 */
	titleKey: NavKey;
	url?: string;
	icon?: LucideIcon;
	isActive?: boolean;
	items?: SidebarItem[];
	/**
	 * Organization permission(s) that show this item. All listed permissions
	 * must hold in the active organization.
	 *
	 * @remarks
	 * UX only: the backend enforces the route. Items with no `permission`,
	 * no `open`, and no `appAdminOnly` are hidden (deny by default).
	 */
	permission?: Permission | Permission[];
	/**
	 * Shown when **any one** of these permissions holds (ERP-0065), for routes
	 * the backend opens on an either-or check, e.g. delivery notes read with
	 * `stock:read` or `sales_order:read`.
	 */
	anyPermission?: Permission[];
	/** Shown to every logged-in user with an internal role in some organization. */
	internalRole?: true;
	/** Shown to any logged-in user, no role check (e.g. Notifications). */
	open?: true;
	/** Shown only to application administrators. */
	appAdminOnly?: true;
	/**
	 * Also shown to application administrators, on top of `permission` /
	 * `anyPermission`, for routes the backend opens to an app admin without
	 * an organization permission (code numbering, `adminOrErpGuard`).
	 */
	orAppAdmin?: true;
	/**
	 * Shown to application administrators or to a warehouse person in charge
	 * (ADR-0017).
	 *
	 * @remarks
	 * A PIC grant is a row in `inventory.warehouse_managers`, not an
	 * organization permission, so this cannot be expressed as a `permission`
	 * string. The caller resolves the fact from `GET /warehouses/mine`.
	 */
	warehousePic?: true;
};
