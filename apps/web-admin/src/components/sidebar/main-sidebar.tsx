'use client';

import {
	BookOpen,
	Bot,
	Frame,
	Map,
	PieChart,
	Settings2,
	SquareTerminal,
} from 'lucide-react';
import * as React from 'react';

import { NavAdmin } from '@/components/sidebar/nav-admin';
import { NavMain } from '@/components/sidebar/nav-main';
import { NavProjects } from '@/components/sidebar/nav-project';
import { NavUser } from '@/components/sidebar/nav-user';
import { OrganizationSwitcher } from '@/components/sidebar/organization-switcher';
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarHeader,
	SidebarRail,
} from '@ims-erp/ui/components/sidebar';

import { selfUserQueryOptions } from '@/lib/user-api';
import { useQuery } from '@tanstack/react-query';

// Sample nav/projects data; user data comes from the backend (`/users/me`).
const data = {
	navMain: [
		{
			title: 'Playground',
			url: '#',
			icon: SquareTerminal,
			isActive: true,
			items: [
				{
					title: 'History',
					url: '#',
				},
				{
					title: 'Starred',
					url: '#',
				},
				{
					title: 'Settings',
					url: '#',
				},
			],
		},
		{
			title: 'Models',
			url: '#',
			icon: Bot,
			items: [
				{
					title: 'Genesis',
					url: '#',
				},
				{
					title: 'Explorer',
					url: '#',
				},
				{
					title: 'Quantum',
					url: '#',
				},
			],
		},
		{
			title: 'Documentation',
			url: '#',
			icon: BookOpen,
			items: [
				{
					title: 'Introduction',
					url: '#',
				},
				{
					title: 'Get Started',
					url: '#',
				},
				{
					title: 'Tutorials',
					url: '#',
				},
				{
					title: 'Changelog',
					url: '#',
				},
			],
		},
		{
			title: 'Settings',
			url: '#',
			icon: Settings2,
			items: [
				{
					title: 'General',
					url: '#',
				},
				{
					title: 'Team',
					url: '#',
				},
				{
					title: 'Billing',
					url: '#',
				},
				{
					title: 'Limits',
					url: '#',
				},
			],
		},
	],
	projects: [
		{
			name: 'Design Engineering',
			url: '#',
			icon: Frame,
		},
		{
			name: 'Sales & Marketing',
			url: '#',
			icon: PieChart,
		},
		{
			name: 'Travel',
			url: '#',
			icon: Map,
		},
	],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
	const { data: user, isPending, isError } = useQuery(selfUserQueryOptions);

	return (
		<Sidebar collapsible='icon' {...props}>
			<SidebarHeader>
				<OrganizationSwitcher />
			</SidebarHeader>
			<SidebarContent>
				<NavMain items={data.navMain} />
				<NavProjects projects={data.projects} />
				{user?.role === 'admin' && <NavAdmin />}
			</SidebarContent>
			<SidebarFooter>
				<NavUser
					user={{
						name: user?.name ?? '…',
						email: user?.email ?? '',
						avatar: user?.image ?? '',
					}}
					loading={isPending && !user}
					errored={isError && !user}
				/>
			</SidebarFooter>
			<SidebarRail />
		</Sidebar>
	);
}
