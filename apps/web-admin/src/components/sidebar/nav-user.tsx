'use client';

import { useRouter } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Bell, ChevronsUpDown, LogOut, User } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { authClient } from '@/lib/auth-client';
import { selfUserQueryOptions, type TSelfUser } from '@/lib/user-api';
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
import LanguageSwitcher from '../language-switcher';
import ThemeSwitcher from './theme-switcher';

/** Initials for the avatar fallback; falls back to `?` for blank names. */
function initials(name: string): string {
	const parts = name.trim().split(/\s+/).filter(Boolean);
	if (parts.length === 0) return '?';
	const first = parts[0]![0];
	const second = parts[1]?.[0];
	return (first + (second ?? '')).toUpperCase();
}

/**
 * Identity block shown both in the trigger and inside the menu. Pending
 * renders a skeleton that mirrors the real geometry (so nothing shifts when
 * data lands); errors fall back to neutral labels instead of blanking or
 * crashing the sidebar. Skeletons are never shown for a terminal error, or
 * the UI would look like it is loading forever.
 */
function UserIdentity({
	user,
	isPending,
	isError,
}: {
	user: TSelfUser | undefined;
	isPending: boolean;
	isError: boolean;
}) {
	const { t } = useTranslation('nav');

	if (isPending) {
		return (
			<div
				className='flex flex-1 items-center gap-2'
				aria-busy='true'
				data-slot='user-identity-skeleton'
			>
				<div aria-hidden='true' className='contents'>
					<Skeleton className='h-8 w-8 shrink-0 rounded-lg motion-reduce:animate-none' />
					<div className='grid flex-1 gap-1 text-left leading-tight'>
						<Skeleton className='h-3.5 w-24 rounded-sm motion-reduce:animate-none' />
						<Skeleton className='h-3 w-32 rounded-sm motion-reduce:animate-none' />
					</div>
				</div>
				<span className='sr-only'>{t('user.loadingAccount')}</span>
			</div>
		);
	}

	const name = user?.name ?? '';
	const email = user?.email ?? '';

	return (
		<>
			<Avatar className='h-8 w-8 rounded-lg'>
				{user?.image && !isError && (
					<AvatarImage src={user.image} alt={name} />
				)}
				<AvatarFallback className='rounded-lg'>
					{initials(name)}
				</AvatarFallback>
			</Avatar>
			<div className='grid flex-1 text-left text-sm leading-tight'>
				<span className='truncate font-medium'>
					{isError ? t('user.account') : name}
				</span>
				<span className='truncate text-xs'>{isError ? '' : email}</span>
			</div>
		</>
	);
}

export function NavUser() {
	const { data: user, isPending, isError } = useQuery(selfUserQueryOptions);

	const { isMobile } = useSidebar();
	const router = useRouter();
	const { t } = useTranslation(['nav', 'common']);

	async function handleSignOut() {
		await authClient.signOut();
		router.navigate({ to: '/login', search: { redirect: undefined } });
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
						<UserIdentity user={user} isPending={isPending} isError={isError} />
						<ChevronsUpDown className='ml-auto size-4' />
					</DropdownMenuTrigger>
					<DropdownMenuContent
						className='w-(--anchor-width) min-w-56'
						side={isMobile ? 'bottom' : 'right'}
						align='end'
						sideOffset={4}
					>
						{/* Profile row: a real menu item (not a label), so it is
						    focusable and announced as an action. */}
						<DropdownMenuItem
							className='gap-2 p-2'
							onClick={() => router.navigate({ to: '/profiles' })}
						>
							<UserIdentity
								user={user}
								isPending={isPending}
								isError={isError}
							/>
						</DropdownMenuItem>
						<DropdownMenuSeparator />
						<DropdownMenuGroup>
							<ThemeSwitcher />
						</DropdownMenuGroup>
						<DropdownMenuSeparator />
						{/* Language lives next to the theme control: both are
						    preferences about how the shell is presented. */}
						<DropdownMenuGroup>
							<LanguageSwitcher />
						</DropdownMenuGroup>
						<DropdownMenuSeparator />
						<DropdownMenuGroup>
							<DropdownMenuItem
								onClick={() => router.navigate({ to: '/account' })}
							>
								<User />
								{t('user.account')}
							</DropdownMenuItem>
							<DropdownMenuItem
							// onClick={() => router.navigate({ to: '/notifications' })}
							>
								<Bell />
								{t('user.notifications')}
							</DropdownMenuItem>
						</DropdownMenuGroup>
						<DropdownMenuSeparator />
						<DropdownMenuItem onClick={handleSignOut} className='text-red-600'>
							<LogOut />
							{t('user.logOut')}
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</SidebarMenuItem>
		</SidebarMenu>
	);
}
