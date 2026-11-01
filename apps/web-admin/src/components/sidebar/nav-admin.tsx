'use client';

import { Link } from '@tanstack/react-router';
import { Building2, ScrollText, Settings, Users } from 'lucide-react';

import {
	SidebarGroup,
	SidebarGroupLabel,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from '@ims-erp/ui/components/sidebar';
import type { SidebarItem } from './sidebar-item';

/**
 * Administration navigation (platform admins only).
 *
 * Visibility is gated by `main-sidebar` on the self user's platform role
 * (`user.role === 'admin'`). UX only - the backend enforces every
 * operation behind these routes.
 */
const items: SidebarItem[] = [
	{
		title: 'Organization',
		url: '/organizations',
		icon: Building2,
	},
	{
		title: 'Users',
		url: '/users',
		icon: Users,
	},
	{
		title: 'Audit Log',
		url: '/audit',
		icon: ScrollText,
	},
	{
		title: 'Settings',
		url: '#',
		icon: Settings,
	},
];

export function NavAdmin() {
	return (
		<SidebarGroup>
			<SidebarGroupLabel>Administration</SidebarGroupLabel>
			<SidebarMenu>
				{items.map((item) => (
					<SidebarMenuItem key={item.title}>
						<SidebarMenuButton
							tooltip={item.title}
							render={
								item.url === '#' ? undefined : (
									<Link to={item.url} activeProps={{ 'data-active': true }} />
								)
							}
						>
							{item.icon && <item.icon />}
							<span>{item.title}</span>
						</SidebarMenuButton>
					</SidebarMenuItem>
				))}
			</SidebarMenu>
		</SidebarGroup>
	);
}
