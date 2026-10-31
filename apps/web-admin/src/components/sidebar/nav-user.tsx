'use client';

import { BadgeCheck, Bell, ChevronsUpDown, LogOut } from 'lucide-react';
import { useRouter } from '@tanstack/react-router';

import {
	Avatar,
	AvatarFallback,
	AvatarImage,
} from '@ims-erp/ui/components/avatar';
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
import { authClient } from '@/lib/auth-client';

/** Initials for the avatar fallback; falls back to `?` for blank names. */
function initials(name: string): string {
	const parts = name.trim().split(/\s+/).filter(Boolean);
	if (parts.length === 0) return '?';
	const first = parts[0]![0];
	const second = parts[1]?.[0];
	return (first + (second ?? '')).toUpperCase();
}

export function NavUser({
	user,
	loading = false,
	errored = false,
}: {
	user: {
		name: string;
		email: string;
		avatar: string;
	};
	/** Session user not loaded yet — render skeleton, never block. */
	loading?: boolean;
	/** `/users/me` failed — degrade to initials, keep the sidebar usable. */
	errored?: boolean;
}) {
	const { isMobile } = useSidebar();
	const router = useRouter();

	async function handleSignOut() {
		await authClient.signOut();
		router.navigate({ to: '/login' });
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
						<Avatar className='h-8 w-8 rounded-lg'>
							{user.avatar && !errored && (
								<AvatarImage src={user.avatar} alt={user.name} />
							)}
							<AvatarFallback className='rounded-lg'>
								{loading ? '…' : initials(user.name)}
							</AvatarFallback>
						</Avatar>
						<div className='grid flex-1 text-left text-sm leading-tight'>
							<span className='truncate font-medium'>{user.name}</span>
							<span className='truncate text-xs'>
								{errored ? '' : user.email}
							</span>
						</div>
						<ChevronsUpDown className='ml-auto size-4' />
					</DropdownMenuTrigger>
					<DropdownMenuContent
						className='w-(--anchor-width) min-w-56 rounded-lg'
						side={isMobile ? 'bottom' : 'right'}
						align='end'
						sideOffset={4}
					>
						<DropdownMenuLabel className='p-0 font-normal'>
							<div className='flex items-center gap-2 px-1 py-1.5 text-left text-sm'>
								<Avatar className='h-8 w-8 rounded-lg'>
									{user.avatar && !errored && (
										<AvatarImage src={user.avatar} alt={user.name} />
									)}
									<AvatarFallback className='rounded-lg'>
										{loading ? '…' : initials(user.name)}
									</AvatarFallback>
								</Avatar>
								<div className='grid flex-1 text-left text-sm leading-tight'>
									<span className='truncate font-medium'>{user.name}</span>
									<span className='truncate text-xs'>
										{errored ? '' : user.email}
									</span>
								</div>
							</div>
						</DropdownMenuLabel>
						<DropdownMenuSeparator />
						<DropdownMenuGroup>
							<DropdownMenuItem>
								<BadgeCheck />
								Account
							</DropdownMenuItem>
							<DropdownMenuItem>
								<Bell />
								Notifications
							</DropdownMenuItem>
						</DropdownMenuGroup>
						<DropdownMenuSeparator />
						<DropdownMenuItem onClick={handleSignOut}>
							<LogOut />
							Log out
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</SidebarMenuItem>
		</SidebarMenu>
	);
}
