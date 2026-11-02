'use client';

import { useQuery } from '@tanstack/react-query';
import { Building2, ScrollText, Settings, Users } from 'lucide-react';

import { selfUserQueryOptions } from '@/lib/user-api';
import type { SidebarItem } from './sidebar-item';
import SidebarSection from './sidebar-section';

/**
 * Administration navigation (platform admins only).
 *
 * Visibility is gated here on the self user's platform role
 * (`user.role === 'admin'`). The gate fails closed: while the query is
 * pending or errored nothing renders, so a non-admin never sees the
 * section flash in. UX only - the backend enforces every operation behind
 * these routes.
 */
const items: SidebarItem[] = [
	{
		titleKey: 'item.organizations',
		url: '/organizations',
		icon: Building2,
	},
	{
		titleKey: 'item.users',
		url: '/admin/users',
		icon: Users,
	},
	{
		titleKey: 'item.auditLog',
		url: '/admin/audit',
		icon: ScrollText,
	},
	{
		titleKey: 'item.settings',
		url: '#',
		icon: Settings,
	},
];

export function NavAdmin() {
	const { data: user } = useQuery(selfUserQueryOptions);
	if (user?.role !== 'admin') return null;

	return <SidebarSection labelKey='section.administration' items={items} />;
}
