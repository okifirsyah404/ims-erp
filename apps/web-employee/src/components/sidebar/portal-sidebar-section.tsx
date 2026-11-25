import {
	SidebarGroup,
	SidebarGroupLabel,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from '@ims-erp/ui/components/sidebar';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import type { NavKey } from '@ims-erp/locales';
import type { TPortalNavItem } from './portal-nav';

/**
 * One rail section, rendered exactly like web-admin's `SidebarSection`.
 *
 * @remarks
 * Flat items only: the portal has no collapsible parents (its tree is two levels
 * deep), so the admin's `Collapsible` branch would be dead code here.
 */
export function PortalSidebarSection({
	labelKey,
	items,
}: {
	labelKey: NavKey;
	items: TPortalNavItem[];
}) {
	const { t } = useTranslation('nav');

	return (
		<SidebarGroup>
			<SidebarGroupLabel>{t(labelKey)}</SidebarGroupLabel>
			<SidebarMenu>
				{items.map((item) => (
					<SidebarMenuItem key={item.url}>
						<SidebarMenuButton
							tooltip={t(item.titleKey)}
							render={
								<Link to={item.url} activeOptions={{ exact: item.url === '/' }} activeProps={{ 'data-active': true }} />
							}
						>
							{item.icon && <item.icon />}
							<span>{t(item.titleKey)}</span>
						</SidebarMenuButton>
					</SidebarMenuItem>
				))}
			</SidebarMenu>
		</SidebarGroup>
	);
}
