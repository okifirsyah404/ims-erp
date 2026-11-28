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
import { myContextQueryOptions } from '@/lib/portal-api';
import { OrgLogo } from './org-logo';

/**
 * Company identity in the employee portal sidebar header.
 *
 * @remarks
 * One company per installation (K12, M12-2): there is no switcher, only the
 * active organization's name and logo. The employee context still decides
 * which organization is usable (`/human-resources/me/context`).
 */
export function PortalOrganizationSwitcher() {
	const { t } = useTranslation(['nav', 'employee']);
	const { data: context, isPending } = useQuery(myContextQueryOptions);
	const { data: memberships, isPending: membershipsPending } = useQuery(
		myOrganizationsQueryOptions,
	);

	if (isPending || (membershipsPending && !context)) {
		return (
			<SidebarMenu>
				<SidebarMenuItem>
					<Skeleton className='h-12 w-full rounded-md' />
				</SidebarMenuItem>
			</SidebarMenu>
		);
	}

	const organizations = (context?.organizations ?? []).map((entry) => {
		const membership = memberships?.find(
			(org) => org.id === entry.organizationId,
		);
		return {
			id: entry.organizationId,
			name: membership?.name ?? entry.organizationId,
			slug: membership?.slug ?? entry.employeeCode,
			logo: membership?.logo ?? null,
		};
	});
	const active =
		organizations.find((org) => org.id === context?.organizationId) ??
		organizations[0];

	if (!active) {
		return (
			<SidebarMenu>
				<SidebarMenuItem>
					<Empty className='gap-2 rounded-md border p-3'>
						<EmptyHeader className='gap-1'>
							<EmptyMedia variant='icon'>
								<Building2 />
							</EmptyMedia>
							<EmptyTitle className='text-xs'>{t('employee:org.title')}</EmptyTitle>
							<EmptyDescription className='text-xs'>
								{t('employee:org.noRecord')}
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
						<OrgLogo src={active.logo} className='size-4' />
					</div>
					<div className='grid flex-1 text-left text-sm leading-tight'>
						<span className='truncate font-medium'>{active.name}</span>
						<span className='truncate text-xs'>{active.slug}</span>
					</div>
				</SidebarMenuButton>
			</SidebarMenuItem>
		</SidebarMenu>
	);
}
