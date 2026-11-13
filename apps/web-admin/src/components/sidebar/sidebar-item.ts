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
	/** Shown to every logged-in user with an internal role. */
	open?: true;
	/** Shown only to application administrators. */
	appAdminOnly?: true;
};
