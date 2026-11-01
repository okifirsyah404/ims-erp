'use client';

import { useRouter } from '@tanstack/react-router';
import { Bell, ChevronsUpDown, LogOut, User } from 'lucide-react';

import { authClient } from '@/lib/auth-client';
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
import ThemeSwitcher from './theme-switcher';

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
						className='w-(--anchor-width) min-w-56'
						side={isMobile ? 'bottom' : 'right'}
						align='end'
						sideOffset={4}
					>
						<DropdownMenuGroup>
							<DropdownMenuLabel
								className='p-0 font-normal select-none'
								onClick={() => router.navigate({ to: '/profiles' })}
							>
								<div className='flex items-center gap-2 p-2 text-left text-sm'>
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
						</DropdownMenuGroup>
						<DropdownMenuSeparator />
						<DropdownMenuGroup>
							<ThemeSwitcher />
						</DropdownMenuGroup>
						<DropdownMenuSeparator />
						<DropdownMenuGroup>
							<DropdownMenuItem
								onClick={() => router.navigate({ to: '/account' })}
							>
								<User />
								Account
							</DropdownMenuItem>
							<DropdownMenuItem
							// onClick={() => router.navigate({ to: '/notifications' })}
							>
								<Bell />
								Notifications
							</DropdownMenuItem>
						</DropdownMenuGroup>
						<DropdownMenuSeparator />
						<DropdownMenuItem onClick={handleSignOut} className='text-red-600'>
							<LogOut />
							Log out
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</SidebarMenuItem>
		</SidebarMenu>
	);
}
