'use client';

import { useRouter } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { cn } from 'cn';
import { LogOut, User } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { authClient } from '@/lib/auth-client';
import { selfUserQueryOptions, type TSelfUser } from '@/lib/user-api';
import {
	Avatar,
	AvatarFallback,
	AvatarImage,
} from '@ims-erp/ui/components/avatar';
import { Button } from '@ims-erp/ui/components/button';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@ims-erp/ui/components/dropdown-menu';
import { useSidebar } from '@ims-erp/ui/components/sidebar';
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
 * crashing the shell. Skeletons are never shown for a terminal error, or
 * the UI would look like it is loading forever.
 */
function UserIdentity({
	user,
	isPending,
	isError,
	className,
}: {
	user: TSelfUser | undefined;
	isPending: boolean;
	isError: boolean;
	/** Applied to the text block, so the header trigger can hide it on mobile. */
	className?: string;
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
					<div className={cn('grid flex-1 gap-1 text-left leading-tight', className)}>
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
			<div
				className={cn('grid flex-1 text-left text-sm leading-tight', className)}
			>
				<span className='truncate font-medium'>
					{isError ? t('user.account') : name}
				</span>
				<span className='truncate text-xs'>{isError ? '' : email}</span>
			</div>
		</>
	);
}

/**
 * Account menu in the top header (moved out of the sidebar footer in
 * ERP-0047 Phase 7 so notifications and identity share one place).
 */
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
		<DropdownMenu>
			{/* Header trigger is avatar-only; name and email live in the menu. */}
			<DropdownMenuTrigger
				render={
					<Button
						variant='ghost'
						className='h-auto p-1'
						aria-label={user?.name ?? t('user.account')}
						aria-busy={isPending || undefined}
					/>
				}
			>
				{isPending ? (
					<Skeleton className='h-8 w-8 rounded-lg motion-reduce:animate-none' />
				) : (
					<Avatar className='h-8 w-8 rounded-lg'>
						{user?.image && !isError && (
							<AvatarImage src={user.image} alt={user.name} />
						)}
						<AvatarFallback className='rounded-lg'>
							{initials(user?.name ?? '')}
						</AvatarFallback>
					</Avatar>
				)}
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
					<UserIdentity user={user} isPending={isPending} isError={isError} />
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
				</DropdownMenuGroup>
				<DropdownMenuSeparator />
				<DropdownMenuItem onClick={handleSignOut} className='text-red-600'>
					<LogOut />
					{t('user.logOut')}
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
