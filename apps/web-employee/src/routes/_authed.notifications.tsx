import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { createFileRoute } from '@tanstack/react-router';
import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import { EmptyState, ErrorState } from '@/components/empty-state';
import { PageSkeleton } from '@/components/page-skeleton';
import { notificationText } from '@/lib/notification-text';
import {
	markAllNotificationsRead,
	markNotificationRead,
	notificationKeys,
	notificationsQueryOptions,
} from '@/lib/notification-api';

/** `/notifications` — the full inbox (the header bell shows a short preview). */
export function NotificationsPage() {
	const { t } = useTranslation('notifications');
	const queryClient = useQueryClient();
	const { data, isPending, isError, error } = useQuery(notificationsQueryOptions);

	const refresh = async () => {
		await queryClient.invalidateQueries({ queryKey: notificationKeys.list });
		await queryClient.invalidateQueries({ queryKey: notificationKeys.unreadCount });
	};

	return (
		<div className='flex flex-col gap-4 md:gap-6'>
			<header className='flex flex-wrap items-center justify-between gap-2'>
				<h1 className='text-xl font-semibold md:text-2xl'>{t('title')}</h1>
				<Button
					variant='outline'
					size='sm'
					onClick={async () => {
						await markAllNotificationsRead();
						await refresh();
					}}
				>
					{t('markAllRead')}
				</Button>
			</header>

			{isPending ? (
				<PageSkeleton cards={1} />
			) : isError ? (
				<ErrorState error={error} />
			) : (data ?? []).length === 0 ? (
				<EmptyState title={t('empty')} bordered />
			) : (
				<ul className='divide-y rounded-lg border'>
					{(data ?? []).map((notification) => {
						const copy = notificationText(t, notification);
						return (
							<li
								key={notification.id}
								className='flex flex-wrap items-start justify-between gap-2 p-3 text-sm'
							>
								<div className='space-y-1'>
									<p className='font-medium'>{copy.title}</p>
									{copy.body ? <p className='text-muted-foreground'>{copy.body}</p> : null}
								</div>
								{notification.readAt ? null : (
									<Button
										variant='ghost'
										size='sm'
										onClick={async () => {
											await markNotificationRead(notification.id);
											await refresh();
										}}
									>
										<Badge variant='secondary'>{t('markAllRead')}</Badge>
									</Button>
								)}
							</li>
						);
					})}
				</ul>
			)}
		</div>
	);
}



export const Route = createFileRoute('/_authed/notifications')({
	component: NotificationsPage,
});
