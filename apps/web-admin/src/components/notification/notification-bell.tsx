'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { cn } from 'cn';
import { Bell } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from '@ims-erp/ui/components/popover';
import { Separator } from '@ims-erp/ui/components/separator';
import { Skeleton } from '@ims-erp/ui/components/skeleton';
import {
	markAllNotificationsRead,
	markNotificationRead,
	notificationsQueryOptions,
	refreshNotifications,
	unreadCountQueryOptions,
	type TNotification,
} from '@/lib/notification-api';
import { notificationText } from '@/lib/notification-text';
import { useRealtimeStore } from '@/lib/realtime/realtime-store';

/**
 * Where a notification points, derived from `sourceType` / `sourceId`.
 *
 * @remarks
 * Deliberately shallow: `organization_member`'s id is the member row, which no
 * route accepts without its organization id, so it falls back to the
 * organization list. Unknown sources (including the seeded demo rows) are not
 * navigable — the item still marks itself read.
 */
function navigateToSource(
	navigate: ReturnType<typeof useNavigate>,
	notification: TNotification,
): void {
	if (notification.sourceType === 'organization' && notification.sourceId) {
		void navigate({
			to: '/organizations/$organizationId',
			params: { organizationId: notification.sourceId },
		});
		return;
	}
	if (notification.sourceType === 'organization_member') {
		void navigate({ to: '/organizations' });
	}
}

/** One inbox row: title, body, tags, age, unread dot. */
function NotificationItem({
	notification,
	onSelect,
}: {
	notification: TNotification;
	onSelect: () => void;
}) {
	const { t } = useTranslation('notifications');
	const unread = notification.status !== 'read';
	const { title, body } = notificationText(t, notification);

	return (
		<li>
			<button
				type='button'
				onClick={onSelect}
				className={cn(
					'flex w-full flex-col items-start gap-1 px-3 py-2 text-left transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none',
					unread && 'bg-muted/40',
				)}
			>
				<span className='flex w-full items-start justify-between gap-2'>
					<span className='flex items-start gap-1.5 text-sm font-medium'>
						{unread && (
							<span
								aria-hidden='true'
								className='mt-1.5 size-1.5 shrink-0 rounded-full bg-primary'
							/>
						)}
						{title}
					</span>
					<time className='shrink-0 text-xs text-muted-foreground'>
						{new Date(notification.createdAt).toLocaleString()}
					</time>
				</span>
				{body && (
					<span className='line-clamp-2 text-xs text-muted-foreground'>
						{body}
					</span>
				)}
				{notification.tags.length > 0 && (
					<span className='flex flex-wrap gap-1 pt-0.5'>
						{notification.tags.map((tag) => (
							<Badge key={tag} variant='outline'>
								{tag}
							</Badge>
						))}
					</span>
				)}
			</button>
		</li>
	);
}

/**
 * Header notification bell (ERP-0047 Phase 7).
 *
 * @remarks
 * Icon-only trigger so the header stays short on mobile. The badge is the
 * server's own unread count, refetched when a realtime frame arrives — no
 * polling. The disconnected dot exists because a badge that silently stops
 * updating is worse than one that admits it.
 */
export function NotificationBell() {
	const { t } = useTranslation('notifications');
	const navigate = useNavigate();
	const [open, setOpen] = useState(false);
	const connection = useRealtimeStore((state) => state.status);

	const { data: unread = 0 } = useQuery(unreadCountQueryOptions);
	const {
		data: items = [],
		isPending,
		isError,
	} = useQuery(notificationsQueryOptions);

	const markRead = useMutation({
		mutationFn: markNotificationRead,
		onSuccess: () => refreshNotifications(),
	});
	const markAllRead = useMutation({
		mutationFn: markAllNotificationsRead,
		onSuccess: () => refreshNotifications(),
	});

	async function handleSelect(notification: TNotification) {
		setOpen(false);
		if (notification.status !== 'read') {
			await markRead.mutateAsync(notification.id).catch(() => undefined);
		}
		navigateToSource(navigate, notification);
	}

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger
				render={
					<Button
						variant='ghost'
						size='icon'
						className='relative'
						aria-label={
							unread > 0 ? t('unreadLabel', { count: unread }) : t('title')
						}
					/>
				}
			>
				<Bell />
				{unread > 0 && (
					<Badge
						variant='destructive'
						className='absolute -top-1 -right-1 h-4 min-w-4 px-1 tabular-nums'
					>
						{unread > 99 ? '99+' : unread}
					</Badge>
				)}
				{connection !== 'open' && (
					<>
						<span
							aria-hidden='true'
							className='absolute right-0 bottom-0 size-1.5 rounded-full bg-amber-500'
						/>
						<span className='sr-only'>{t('offline')}</span>
					</>
				)}
			</PopoverTrigger>
			<PopoverContent
				align='end'
				className='w-96 max-w-[calc(100vw-2rem)] gap-0 p-0'
			>
				<div className='flex items-center justify-between gap-2 px-3 py-2'>
					<span className='text-sm font-medium'>{t('title')}</span>
					<Button
						variant='ghost'
						size='xs'
						disabled={unread === 0 || markAllRead.isPending}
						onClick={() => markAllRead.mutate()}
					>
						{t('markAllRead')}
					</Button>
				</div>
				<Separator />
				<div className='max-h-96 overflow-y-auto'>
					{isPending ? (
						<div className='flex flex-col gap-2 p-3'>
							<Skeleton className='h-12 w-full' />
							<Skeleton className='h-12 w-full' />
							<Skeleton className='h-12 w-full' />
						</div>
					) : isError ? (
						<p className='px-3 py-6 text-center text-sm text-muted-foreground'>
							{t('loadFailed')}
						</p>
					) : items.length === 0 ? (
						<p className='px-3 py-6 text-center text-sm text-muted-foreground'>
							{t('empty')}
						</p>
					) : (
						<ul className='flex flex-col divide-y'>
							{items.map((notification) => (
								<NotificationItem
									key={notification.id}
									notification={notification}
									onSelect={() => void handleSelect(notification)}
								/>
							))}
						</ul>
					)}
				</div>
			</PopoverContent>
		</Popover>
	);
}
