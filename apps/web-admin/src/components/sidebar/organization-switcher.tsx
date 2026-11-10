'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronsUpDown, Building2, Plus, Settings } from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { toast } from '@/components/toast';

import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@ims-erp/ui/components/dropdown-menu';
import {
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	useSidebar,
} from '@ims-erp/ui/components/sidebar';
import { Skeleton } from '@ims-erp/ui/components/skeleton';
import { useSession } from '@/lib/auth-client';
import { organizationsQueryOptions } from '@/lib/organization-api';
import {
	switchOrganization,
	useOrganizations,
} from '@/lib/use-permission';

/**
 * Organization switcher (sidebar header).
 *
 * @remarks
 * Lists the organizations the caller can switch into:
 * - Application admins (`user.role === 'admin'`) see EVERY live organization,
 *   because they can fully administer all of them (ADR-0007).
 * - Everyone else sees only their memberships, via Better Auth
 *   (`organization.list`).
 *
 * Switching goes through `organization.setActive` (server-side session fact)
 * and invalidates permission queries via the `usePermission` query key. The
 * "Manage" entry routes to `/organizations`. Soft-deleted organizations are
 * never offered: they have no usable context.
 */
export function OrganizationSwitcher() {
	const { isMobile } = useSidebar();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const { t } = useTranslation('nav');
	const { data: session, isPending: sessionPending } = useSession();
	const isAppAdmin = session?.user?.role === 'admin';

	const { data: memberships, isPending: orgsPending } = useOrganizations();
	const { data: allOrganizations, isPending: allOrgsPending } = useQuery({
		...organizationsQueryOptions,
		// Only application admins may read the full organization list.
		enabled: isAppAdmin,
	});

	const activeOrganizationId = session?.session?.activeOrganizationId;
	const organizations_ = isAppAdmin
		? (allOrganizations?.rows ?? []).filter((org) => !org.deletedAt)
		: (memberships ?? []);
	const pending = isAppAdmin ? allOrgsPending : orgsPending;
	const activeOrganization = organizations_.find(
		(org) => org.id === activeOrganizationId,
	);

	const handleSwitch = async (organizationId: string) => {
		if (organizationId === activeOrganizationId) return;
		try {
			await switchOrganization(organizationId);
			// Permissions are organization-scoped: refresh both caches.
			await Promise.all([
				queryClient.invalidateQueries({ queryKey: ['erp-has-permission'] }),
				queryClient.invalidateQueries({ queryKey: ['erp-organizations'] }),
			]);
			toast.success(t('organization.switched'));
		} catch {
			toast.error(t('organization.switchFailed'));
		}
	};

	if (sessionPending || (pending && !activeOrganization)) {
		return (
			<SidebarMenu>
				<SidebarMenuItem>
					<Skeleton className='h-12 w-full rounded-md' />
				</SidebarMenuItem>
			</SidebarMenu>
		);
	}

	if (!activeOrganization) {
		// No membership yet: route the user to the organizations page.
		return (
			<SidebarMenu>
				<SidebarMenuItem>
					<SidebarMenuButton
						size='lg'
						onClick={() => navigate({ to: '/organizations' })}
					>
						<div className='flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground'>
							<Building2 className='size-4' />
						</div>
						<div className='grid flex-1 text-left text-sm leading-tight'>
							<span className='truncate font-medium'>
								{t('organization.none')}
							</span>
							<span className='truncate text-xs text-muted-foreground'>
								{t('organization.setUp')}
							</span>
						</div>
					</SidebarMenuButton>
				</SidebarMenuItem>
			</SidebarMenu>
		);
	}

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
							<Building2 className='size-4' />
						</div>
						<div className='grid flex-1 text-left text-sm leading-tight'>
							<span className='truncate font-medium'>
								{activeOrganization.name}
							</span>
							<span className='truncate text-xs'>
								{activeOrganization.slug}
							</span>
						</div>
						<ChevronsUpDown className='ml-auto' />
					</DropdownMenuTrigger>
					<DropdownMenuContent
						className='w-(--anchor-width) min-w-56 rounded-lg'
						align='start'
						side={isMobile ? 'bottom' : 'right'}
						sideOffset={4}
					>
						{/* Menu.GroupLabel requires a group context (base-ui
						    MenuGroupContext) — without it the console warns on every
						    open. */}
						<DropdownMenuGroup>
							<DropdownMenuLabel className='text-xs text-muted-foreground'>
								{t('breadcrumb.organizations')}
							</DropdownMenuLabel>
							{organizations_.map((org) => (
								<DropdownMenuItem
									key={org.id}
									onClick={() => void handleSwitch(org.id)}
									className='gap-2 p-2'
								>
									<div className='flex size-6 items-center justify-center rounded-md border'>
										<Building2 className='size-3.5 shrink-0' />
									</div>
									{org.name}
								</DropdownMenuItem>
							))}
						</DropdownMenuGroup>
						<DropdownMenuSeparator />
						<DropdownMenuItem
							className='gap-2 p-2'
							onClick={() => navigate({ to: '/organizations' })}
						>
							<div className='flex size-6 items-center justify-center rounded-md border bg-transparent'>
								<Settings className='size-4' />
							</div>
							<div className='font-medium text-muted-foreground'>
								{t('organization.manage')}
							</div>
						</DropdownMenuItem>
						{/* New organization: application admins only (ADR-0007). */}
						{isAppAdmin && (
							<DropdownMenuItem
								className='gap-2 p-2'
								onClick={() => navigate({ to: '/organizations/new' })}
							>
								<div className='flex size-6 items-center justify-center rounded-md border bg-transparent'>
									<Plus className='size-4' />
								</div>
								<div className='font-medium text-muted-foreground'>
									{t('organization.new')}
								</div>
							</DropdownMenuItem>
						)}
					</DropdownMenuContent>
				</DropdownMenu>
			</SidebarMenuItem>
		</SidebarMenu>
	);
}
