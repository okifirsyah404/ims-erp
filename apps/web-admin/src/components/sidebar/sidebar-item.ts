import type { LucideIcon } from 'lucide-react';
import type { NavKey } from '@ims-erp/locales';

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
};
