'use client';

import * as React from 'react';

import { NavAdmin } from '@/components/sidebar/nav-admin';
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
import { NavInventory } from './nav-inventory';

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
				{/* <NavMain items={data.navMain} />
				<NavProjects projects={data.projects} /> */}
				<NavInventory />
				<NavAdmin />
			</SidebarContent>
			<SidebarFooter>
				<NavUser />
			</SidebarFooter>
			<SidebarRail />
		</Sidebar>
	);
}
