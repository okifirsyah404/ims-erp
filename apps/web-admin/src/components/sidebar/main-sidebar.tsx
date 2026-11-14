import { OrganizationSwitcher } from '@/components/sidebar/organization-switcher';
import {
	Sidebar,
	SidebarContent,
	SidebarGroup,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarRail,
	SidebarMenu,
	SidebarMenuItem,
} from '@ims-erp/ui/components/sidebar';
import { Skeleton } from '@ims-erp/ui/components/skeleton';
import { useTranslation } from 'react-i18next';

import { useQuery } from '@tanstack/react-query';
import { hasInternalRole as hasInternalRoleOf } from '@/lib/internal-role';
import { myOrganizationsQueryOptions } from '@/lib/organization-api';
import { useSelfUserImageRefresh } from '@/lib/user-api';
import { useWarehouseAccess } from '@/lib/use-warehouse-access';
import { collectPermissions, filterNav } from './filter-nav';
import { navSections } from './nav-config';
import SidebarSection from './sidebar-section';
import { useNavPermissions } from './use-nav-permissions';

const navPermissions = collectPermissions(navSections);

/**
 * Full ERP sidebar (docs module map M01–M12 + Administration).
 *
 * @remarks
 * Items are filtered by `filterNav` using the active organization's
 * permissions, the application-admin flag, and the warehouse person-in-charge
 * fact (ADR-0017). Sections show skeletons while permissions resolve, so
 * nothing flashes or disappears during load. The backend enforces every route
 * behind these items regardless.
 */
export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
	// Keeps the presigned avatar URL fresh for the whole authenticated shell.
	useSelfUserImageRefresh();
	const { can, pending } = useNavPermissions(navPermissions);
	const { t } = useTranslation('nav');

	// One shared source for the admin flag and the person-in-charge fact
	// (ADR-0017): the same hook gates the warehouse screens, so the sidebar and
	// the pages cannot disagree.
	const { isAppAdmin, isPic, isPending: accessPending } = useWarehouseAccess();
	const { data: myOrgs, isPending: myOrgsPending } = useQuery(myOrganizationsQueryOptions);
	const hasInternalRole = (myOrgs ?? []).some((org) => hasInternalRoleOf(org.role));
	const loading = pending || myOrgsPending || accessPending;

	const sections = filterNav(navSections, {
		can,
		isAppAdmin,
		hasInternalRole,
		isPic,
	});

	return (
		<Sidebar collapsible='icon' {...props}>
			<SidebarHeader>
				<OrganizationSwitcher />
			</SidebarHeader>
			<SidebarContent>
				{loading
					? navSections.map((section) => (
							<SidebarGroup key={section.labelKey}>
								<SidebarGroupLabel>{t(section.labelKey)}</SidebarGroupLabel>
								<SidebarMenu>
									<SidebarMenuItem>
										<Skeleton className='h-8 w-full rounded-md' />
									</SidebarMenuItem>
								</SidebarMenu>
							</SidebarGroup>
						))
					: sections.map((section) => (
							<SidebarSection
								key={section.labelKey}
								labelKey={section.labelKey}
								items={section.items}
							/>
						))}
			</SidebarContent>
			<SidebarRail />
		</Sidebar>
	);
}
