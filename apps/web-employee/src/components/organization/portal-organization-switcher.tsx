'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Building2, Check, ChevronsUpDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuShortcut,
	DropdownMenuTrigger,
} from '@ims-erp/ui/components/dropdown-menu';
import {
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	useSidebar,
} from '@ims-erp/ui/components/sidebar';
import { Skeleton } from '@ims-erp/ui/components/skeleton';
import { Spinner } from '@ims-erp/ui/components/spinner';
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from '@ims-erp/ui/components/empty';
import { myOrganizationsQueryOptions } from '@/lib/organization-api';
import { myContextQueryOptions } from '@/lib/portal-api';
import { useOrganizationSwitch } from '@/lib/use-organization-switch';
import { OrgLogo } from './org-logo';

/**
 * Organization switcher (sidebar header), the same control web-admin uses.
 *
 * @remarks
 * Same geometry as the admin's: a `size="lg"` menu button holding the org logo
 * in a `size-8` primary tile, name over slug, and a dropdown that marks the
 * active row with a check (or a spinner while switching).
 *
 * The list is narrower than the admin's on purpose: only organizations where the
 * caller has an employee record are offered, because a membership without one
 * answers 403 on every portal route. `myOrganizationsQueryOptions` supplies the
 * display fields; `/human-resources/me/context` decides which are usable.
 */
export function PortalOrganizationSwitcher() {
	const { isMobile } = useSidebar();
	const { t } = useTranslation(['nav', 'employee']);
	const { data: context, isPending } = useQuery(myContextQueryOptions);
	const { data: memberships, isPending: membershipsPending } = useQuery(myOrganizationsQueryOptions);
	const { switchOrganization, switching } = useOrganizationSwitch();
	const [switchingTo, setSwitchingTo] = useState<string | null>(null);

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
		const membership = memberships?.find((org) => org.id === entry.organizationId);
		return {
			id: entry.organizationId,
			name: membership?.name ?? entry.organizationId,
			slug: membership?.slug ?? entry.employeeCode,
			logo: membership?.logo ?? null,
			role: membership?.role ?? '',
		};
	});
	const active = organizations.find((org) => org.id === context?.organizationId) ?? organizations[0];

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
							<EmptyDescription className='text-xs'>{t('employee:org.noRecord')}</EmptyDescription>
						</EmptyHeader>
					</Empty>
				</SidebarMenuItem>
			</SidebarMenu>
		);
	}

	const handleSwitch = async (organizationId: string) => {
		if (organizationId === active.id || switchingTo) return;
		setSwitchingTo(organizationId);
		try {
			await switchOrganization(organizationId);
		} finally {
			setSwitchingTo(null);
		}
	};

	return (
		<SidebarMenu>
			<SidebarMenuItem>
				<DropdownMenu>
					<DropdownMenuTrigger
						render={
							<SidebarMenuButton
								size='lg'
								className='data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground'
							/>
						}
					>
						<div className='flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground'>
							<OrgLogo src={active.logo} className='size-4' />
						</div>
						<div className='grid flex-1 text-left text-sm leading-tight'>
							<span className='truncate font-medium'>{active.name}</span>
							<span className='truncate text-xs'>{active.slug}</span>
						</div>
						<ChevronsUpDown className='ml-auto' />
					</DropdownMenuTrigger>
					<DropdownMenuContent
						className='w-(--anchor-width) min-w-56 rounded-lg'
						align='start'
						side={isMobile ? 'bottom' : 'right'}
						sideOffset={4}
					>
						<DropdownMenuGroup>
							<DropdownMenuLabel className='text-xs text-muted-foreground'>
								{t('employee:org.switch')}
							</DropdownMenuLabel>
							{organizations.map((org) => {
								const isActive = org.id === active.id;
								const isSwitching = org.id === switchingTo;
								return (
									<DropdownMenuItem
										key={org.id}
										onClick={() => void handleSwitch(org.id)}
										aria-current={isActive ? 'true' : undefined}
										aria-busy={isSwitching || undefined}
										disabled={switching}
										className='gap-2 p-2'
									>
										<div className='flex size-6 items-center justify-center rounded-md border'>
											<OrgLogo src={org.logo} className='size-3.5 shrink-0' />
										</div>
										<span className='truncate'>{org.name}</span>
										{isSwitching ? (
											<Spinner className='ml-auto size-3.5' />
										) : isActive ? (
											<Check className='ml-auto size-3.5' />
										) : null}
										{org.role ? (
											<DropdownMenuShortcut>{org.role.split(',')[0]}</DropdownMenuShortcut>
										) : null}
									</DropdownMenuItem>
								);
							})}
						</DropdownMenuGroup>
					</DropdownMenuContent>
				</DropdownMenu>
			</SidebarMenuItem>
		</SidebarMenu>
	);
}
