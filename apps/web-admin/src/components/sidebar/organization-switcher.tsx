'use client';

import { useQuery } from '@tanstack/react-query';
import { Building2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import {
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from '@ims-erp/ui/components/sidebar';
import { Skeleton } from '@ims-erp/ui/components/skeleton';
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from '@ims-erp/ui/components/empty';
import { myOrganizationsQueryOptions } from '@/lib/organization-api';
import { hasInternalRole } from '@/lib/internal-role';
import { useOrganizationStore } from '@/lib/organization-store';
import { OrgLogo } from './org-logo';

/**
 * Company identity in the sidebar header.
 *
 * @remarks
 * This ERP serves a single company (K12, M12-2), so there is nothing to
 * switch between: the header shows the active organization only. The session
 * still carries `activeOrganizationId` (a server fact), which is what the
 * store below mirrors — organization-scoped permissions keep reading it.
 */
export function OrganizationSwitcher() {
	const { t } = useTranslation('nav');
	const activeOrganizationId = useOrganizationStore(
		(state) => state.activeOrganizationId,
	);

	const { data: myOrgs, isPending } = useQuery(myOrganizationsQueryOptions);
	const organizations = (myOrgs ?? []).filter((org) => hasInternalRole(org.role));
	const activeOrganization = organizations.find(
		(org) => org.id === activeOrganizationId,
	);

	if (isPending) {
		return (
			<SidebarMenu>
				<SidebarMenuItem>
					<Skeleton className='h-12 w-full rounded-md' />
				</SidebarMenuItem>
			</SidebarMenu>
		);
	}

	if (!activeOrganization) {
		return (
			<SidebarMenu>
				<SidebarMenuItem>
					<Empty className='gap-3 rounded-md border p-3'>
						<EmptyHeader className='gap-1'>
							<EmptyMedia variant='icon'>
								<Building2 />
							</EmptyMedia>
							<EmptyTitle className='text-xs'>
								{t('organization.none')}
							</EmptyTitle>
							<EmptyDescription className='text-xs'>
								{t('organization.setUp')}
							</EmptyDescription>
						</EmptyHeader>
					</Empty>
				</SidebarMenuItem>
			</SidebarMenu>
		);
	}

	return (
		<SidebarMenu>
			<SidebarMenuItem>
				<SidebarMenuButton size='lg' className='cursor-default'>
					<div className='flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground'>
						<OrgLogo src={activeOrganization.logo} className='size-4' />
					</div>
					<div className='grid flex-1 text-left text-sm leading-tight'>
						<span className='truncate font-medium'>
							{activeOrganization.name}
						</span>
						<span className='truncate text-xs'>{activeOrganization.slug}</span>
					</div>
				</SidebarMenuButton>
			</SidebarMenuItem>
		</SidebarMenu>
	);
}
