import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { createFileRoute } from '@tanstack/react-router';
import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import { Card, CardContent } from '@ims-erp/ui/components/card';
import { EmptyState, ErrorState, errorMessage } from '@/components/empty-state';
import { PageSkeleton } from '@/components/page-skeleton';
import { toast } from '@/components/toast';
import { taskStatusLabel } from '@/lib/labels';
import { myTasksQueryOptions, setMyTaskStatus, type TTaskStatus } from '@/lib/portal-api';

const VARIANTS: Record<TTaskStatus, 'default' | 'secondary' | 'outline'> = {
	open: 'secondary',
	done: 'default',
	cancelled: 'outline',
};

/** `/tasks` — HR tasks assigned to the caller; open tasks can be closed. */
export function TasksPage() {
	const { t } = useTranslation('employee');
	const queryClient = useQueryClient();
	const { data, isPending, isError, error } = useQuery(myTasksQueryOptions());

	const mutation = useMutation({
		mutationFn: ({ id, status }: { id: string; status: TTaskStatus }) => setMyTaskStatus(id, status),
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: ['employee-portal', 'tasks'] });
		},
		onError: (mutationError) => toast.error(errorMessage(mutationError)),
	});

	return (
		<div className='flex flex-col gap-4 md:gap-6'>
			<header className='space-y-1'>
				<h1 className='text-xl font-semibold md:text-2xl'>{t('tasks.title')}</h1>
				<p className='text-sm text-muted-foreground'>{t('tasks.subtitle')}</p>
			</header>

			{isPending ? (
				<PageSkeleton cards={1} />
			) : isError ? (
				<ErrorState error={error} />
			) : (data ?? []).length === 0 ? (
				<EmptyState title={t('tasks.empty')} bordered />
			) : (
				<ul className='flex flex-col gap-2'>
					{(data ?? []).map((task) => (
						<li key={task.id}>
							<Card>
								<CardContent className='flex flex-wrap items-start justify-between gap-3 p-4'>
									<div className='space-y-1'>
										<p className='font-medium'>{task.title}</p>
										{task.notes ? (
											<p className='text-sm text-muted-foreground'>{task.notes}</p>
										) : null}
										{task.dueDate ? (
											<p className='text-xs text-muted-foreground'>
												{t('tasks.due', { date: task.dueDate })}
											</p>
										) : null}
									</div>
									<div className='flex items-center gap-2'>
										<Badge variant={VARIANTS[task.status]}>
											{taskStatusLabel(t, task.status)}
										</Badge>
										{task.status === 'open' ? (
											<Button
												size='sm'
												onClick={() => mutation.mutate({ id: task.id, status: 'done' })}
												disabled={mutation.isPending}
											>
												{t('tasks.markDone')}
											</Button>
										) : task.status === 'done' ? (
											<Button
												size='sm'
												variant='outline'
												onClick={() => mutation.mutate({ id: task.id, status: 'open' })}
												disabled={mutation.isPending}
											>
												{t('tasks.reopen')}
											</Button>
										) : null}
									</div>
								</CardContent>
							</Card>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}




export const Route = createFileRoute('/_authed/tasks')({
	component: TasksPage,
});

