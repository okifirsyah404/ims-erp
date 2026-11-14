import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import { Card, CardContent } from '@ims-erp/ui/components/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@ims-erp/ui/components/dialog';
import { Field, FieldGroup, FieldLabel } from '@ims-erp/ui/components/field';
import { Input } from '@ims-erp/ui/components/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@ims-erp/ui/components/table';
import { Textarea } from '@ims-erp/ui/components/textarea';
import { EmployeeSelect } from '@/components/hr/employee-select';
import { PaginationControls } from '@/components/pagination/pagination-controls';
import { toast } from '@/components/toast';
import { formatBusinessDate, todayBusinessDate } from '@/lib/format';
import { createTask, setTaskStatus, TASK_STATUSES, tasksQueryOptions, type TTaskStatus } from '@/lib/hr-records-api';
import { usePermission } from '@/lib/use-permission';

/** `/hr/tasks` — simple tasks for employees outside projects (M08). */
export const Route = createFileRoute('/_authed/hr/tasks/')({
	component: TasksPage,
});

const STATUS_VARIANT: Record<TTaskStatus, 'default' | 'secondary' | 'outline'> = { open: 'secondary', done: 'default', cancelled: 'outline' };

function TasksPage() {
	const { t, i18n } = useTranslation(['hr', 'common']);
	const queryClient = useQueryClient();
	const canCreate = usePermission('task.create');
	const canUpdate = usePermission('task.update');
	const [page, setPage] = useState(1);
	const [status, setStatus] = useState<TTaskStatus | ''>('open');
	const [employeeFilter, setEmployeeFilter] = useState('');
	const { data, isPending, isError, error } = useQuery(
		tasksQueryOptions({ page, status: status || undefined, employeeId: employeeFilter || undefined }),
	);
	const [creating, setCreating] = useState(false);
	const [employeeId, setEmployeeId] = useState('');
	const [title, setTitle] = useState('');
	const [description, setDescription] = useState('');
	const [dueDate, setDueDate] = useState('');
	const [busy, setBusy] = useState(false);
	const today = todayBusinessDate();

	const run = async (work: () => Promise<unknown>, done: string) => {
		setBusy(true);
		try {
			await work();
			await queryClient.invalidateQueries({ queryKey: ['hr', 'tasks'] });
			toast.success(done);
			return true;
		} catch (cause) {
			toast.error(cause instanceof Error ? cause.message : t('common:error.failed'));
			return false;
		} finally {
			setBusy(false);
		}
	};

	return (
		<div className='flex flex-col gap-6 p-6'>
			<div className='flex flex-wrap items-start justify-between gap-2'>
				<div>
					<h1 className='text-2xl font-bold'>{t('hr:tasks.title')}</h1>
					<p className='text-sm text-muted-foreground'>{t('hr:tasks.description')}</p>
				</div>
				{canCreate && <Button onClick={() => setCreating(true)}>{t('hr:tasks.new')}</Button>}
			</div>
			<div className='flex flex-wrap gap-2'>
				<select
					aria-label={t('hr:field.status')}
					className='h-9 rounded-md border bg-transparent px-3 text-sm'
					value={status}
					onChange={(event) => {
						setStatus(event.target.value as TTaskStatus | '');
						setPage(1);
					}}
				>
					<option value=''>{t('hr:tasks.allStatuses')}</option>
					{TASK_STATUSES.map((value) => (
						<option key={value} value={value}>
							{t(`hr:taskStatus.${value}`)}
						</option>
					))}
				</select>
				<EmployeeSelect
					className='h-9 max-w-xs rounded-md border bg-transparent px-3 text-sm'
					value={employeeFilter}
					allowAll={t('hr:field.employee')}
					onChange={(value) => {
						setEmployeeFilter(value);
						setPage(1);
					}}
				/>
			</div>
			{isPending ? null : isError ? (
				<p className='text-sm text-destructive'>{error.message}</p>
			) : data.rows.length === 0 ? (
				<Card>
					<CardContent className='py-8 text-center text-sm text-muted-foreground'>{t('hr:tasks.empty')}</CardContent>
				</Card>
			) : (
				<>
					<Card>
						<CardContent className='p-0'>
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>{t('hr:tasks.taskTitle')}</TableHead>
										<TableHead>{t('hr:field.employee')}</TableHead>
										<TableHead>{t('hr:tasks.due')}</TableHead>
										<TableHead>{t('hr:field.status')}</TableHead>
										<TableHead />
									</TableRow>
								</TableHeader>
								<TableBody>
									{data.rows.map((task) => (
										<TableRow key={task.id}>
											<TableCell>
												<div className='font-medium'>{task.title}</div>
												{task.description && <div className='max-w-96 truncate text-xs text-muted-foreground'>{task.description}</div>}
											</TableCell>
											<TableCell>{task.employee?.fullName ?? '—'}</TableCell>
											<TableCell className={task.status === 'open' && task.dueDate && task.dueDate < today ? 'text-destructive' : ''}>
												{formatBusinessDate(task.dueDate, i18n.language)}
											</TableCell>
											<TableCell>
												<Badge variant={STATUS_VARIANT[task.status]}>{t(`hr:taskStatus.${task.status}`)}</Badge>
											</TableCell>
											<TableCell className='text-right whitespace-nowrap'>
												{canUpdate && task.status === 'open' && (
													<>
														<Button size='sm' disabled={busy} onClick={() => void run(() => setTaskStatus(task.id, 'done'), t('hr:taskStatus.done'))}>
															{t('hr:tasks.markDone')}
														</Button>
														<Button
															size='sm'
															variant='ghost'
															disabled={busy}
															onClick={() => void run(() => setTaskStatus(task.id, 'cancelled'), t('hr:taskStatus.cancelled'))}
														>
															{t('hr:tasks.cancel')}
														</Button>
													</>
												)}
												{canUpdate && task.status !== 'open' && (
													<Button size='sm' variant='ghost' disabled={busy} onClick={() => void run(() => setTaskStatus(task.id, 'open'), t('hr:taskStatus.open'))}>
														{t('hr:tasks.reopen')}
													</Button>
												)}
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						</CardContent>
					</Card>
					{data.pagination.totalPages > 1 && (
						<PaginationControls page={data.pagination.page} totalPages={data.pagination.totalPages} onPageChange={setPage} />
					)}
				</>
			)}
			<Dialog open={creating} onOpenChange={setCreating}>
				<DialogContent>
					<form
						onSubmit={async (event) => {
							event.preventDefault();
							const done = await run(
								() => createTask({ employeeId, title: title.trim(), description: description.trim() || null, dueDate: dueDate || null }),
								t('hr:tasks.created'),
							);
							if (done) {
								setCreating(false);
								setTitle('');
								setDescription('');
								setDueDate('');
							}
						}}
					>
						<DialogHeader>
							<DialogTitle>{t('hr:tasks.new')}</DialogTitle>
						</DialogHeader>
						<FieldGroup className='py-4'>
							<Field>
								<FieldLabel htmlFor='task-employee'>{t('hr:field.employee')}</FieldLabel>
								<EmployeeSelect id='task-employee' required value={employeeId} onChange={setEmployeeId} />
							</Field>
							<Field>
								<FieldLabel htmlFor='task-title'>{t('hr:tasks.taskTitle')}</FieldLabel>
								<Input id='task-title' required maxLength={200} value={title} onChange={(event) => setTitle(event.target.value)} />
							</Field>
							<Field>
								<FieldLabel htmlFor='task-detail'>{t('hr:tasks.detail')}</FieldLabel>
								<Textarea id='task-detail' rows={3} maxLength={2000} value={description} onChange={(event) => setDescription(event.target.value)} />
							</Field>
							<Field>
								<FieldLabel htmlFor='task-due'>{t('hr:tasks.due')}</FieldLabel>
								<Input id='task-due' type='date' value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
							</Field>
						</FieldGroup>
						<DialogFooter>
							<Button type='button' variant='outline' onClick={() => setCreating(false)}>
								{t('common:action.cancel')}
							</Button>
							<Button type='submit' disabled={busy || !employeeId || !title.trim()}>
								{t('hr:tasks.new')}
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>
		</div>
	);
}
