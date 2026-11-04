import { NavUser } from '@/components/sidebar/nav-user';
import { OrganizationSwitcher } from '@/components/sidebar/organization-switcher';
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarHeader,
	SidebarRail,
} from '@ims-erp/ui/components/sidebar';

import { useSelfUserImageRefresh } from '@/lib/user-api';
import { navSections } from './nav-config';
import SidebarSection from './sidebar-section';

/**
 * Full ERP sidebar (docs module map M01–M12 + Administration).
 *
 * UI-first pass: all sections render unconditionally so the whole app
 * shape is reviewable. Permission gating on items comes later via the
 * shared `erp-permissions` catalog; the backend enforces every operation
 * behind these routes regardless.
 */
export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
	// Keeps the presigned avatar URL fresh for the whole authenticated shell
	// (this sidebar mounts once per session, so the timer is not duplicated
	// by `NavUser` / profile pages reading the same cache entry).
	useSelfUserImageRefresh();

	return (
		<Sidebar collapsible='icon' {...props}>
			<SidebarHeader>
				<OrganizationSwitcher />
			</SidebarHeader>
			<SidebarContent>
				{navSections.map((section) => (
					<SidebarSection
						key={section.labelKey}
						labelKey={section.labelKey}
						items={section.items}
					/>
				))}
			</SidebarContent>
			<SidebarFooter>
				<NavUser />
			</SidebarFooter>
			<SidebarRail />
		</Sidebar>
	);
}
