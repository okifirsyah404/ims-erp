import {
	Sidebar,
	SidebarContent,
	SidebarHeader,
	SidebarRail,
} from '@ims-erp/ui/components/sidebar';
import { PortalOrganizationSwitcher } from '@/components/organization/portal-organization-switcher';
import { liveNavSections } from './portal-nav';
import { PortalSidebarSection } from './portal-sidebar-section';

/**
 * Desktop rail: the same `Sidebar` shell web-admin uses, filled with the
 * portal's sections.
 *
 * @remarks
 * The header is the organization switcher alone (admin does the same): the app
 * name lives in the document title and the login screen, not above the org, so
 * switching organizations reads as the identity of the rail.
 */
export function PortalSidebar(props: React.ComponentProps<typeof Sidebar>) {
	return (
		<Sidebar collapsible='icon' {...props}>
			<SidebarHeader>
				<PortalOrganizationSwitcher />
			</SidebarHeader>
			<SidebarContent>
				{liveNavSections.map((section) => (
					<PortalSidebarSection key={section.labelKey} labelKey={section.labelKey} items={section.items} />
				))}
			</SidebarContent>
			<SidebarRail />
		</Sidebar>
	);
}
