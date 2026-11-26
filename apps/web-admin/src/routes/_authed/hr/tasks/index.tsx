import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { CellData, ColumnDef } from '@tanstack/react-table';

import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import { DatePicker } from '@ims-erp/ui/components/date-picker';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@ims-erp/ui/components/dialog';
import { Field, FieldGroup } from '@ims-erp/ui/components/field';
import { FieldLabel } from '@/components/form/field-label';
import { Input } from '@ims-erp/ui/components/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@ims-erp/ui/components/select';
import { Textarea } from '@ims-erp/ui/components/textarea';
import { Ban, Check, Pencil, RotateCcw, Trash2 } from 'lucide-react';
import { DataTable } from '@/components/data-table/data-table';
import { DataTableCard } from '@/components/data-table/data-table-card';
import type { DataTableFeatures } from '@/components/data-table/data-table-features';
import { RowActions } from '@/components/data-table/row-actions';
import { EmployeeSelect } from '@/components/hr/employee-select';
import { PaginationControls } from '@/components/pagination/pagination-controls';
import { toast } from '@/components/toast';
import { formatBusinessDate, todayBusinessDate } from '@/lib/format';
import { useConfirm } from '@/components/confirm-dialog';
import {
	createTask,
	removeTask,
	setTaskStatus,
	TASK_STATUSES,
	tasksQueryOptions,
	type TTask,
	type TTaskStatus,
	updateTask,
} from '@/lib/hr-records-api';
import { usePermission } from '@/lib/use-permission';
import { EmptyState, ErrorState } from '@/components/empty-state';

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
	/** The task being edited; `null` while the dialog creates a new one. */
	const [editing, setEditing] = useState<TTask | null>(null);
	const confirm = useConfirm();
	const [employeeId, setEmployeeId] = useState('');
	const [title, setTitle] = useState('');
	const [description, setDescription] = useState('');
	const [dueDate, setDueDate] = useState('');
	const [busy, setBusy] = useState(false);
	const today = todayBusinessDate();

	const openEdit = useCallback((task: TTask) => {
		setEditing(task);
		setEmployeeId(task.employeeId);
		setTitle(task.title);
		setDescription(task.description ?? '');
		setDueDate(task.dueDate ?? '');
		setCreating(true);
	}, []);

	const openCreate = () => {
		setEditing(null);
		setTitle('');
		setDescription('');
		setDueDate('');
		setCreating(true);
	};

	const run = useCallback(
		async (work: () => Promise<unknown>, done: string) => {
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
		},
		[queryClient, t],
	);

	const columns = useMemo<ColumnDef<DataTableFeatures, TTask, CellData>[]>(
		() => [
			{
				id: 'title',
				header: t('hr:tasks.taskTitle'),
				cell: ({ row }) => (
					<>
						<div className='font-medium'>{row.original.title}</div>
						{row.original.description && (
							<div className='max-w-96 truncate text-xs text-muted-foreground'>{row.original.description}</div>
						)}
					</>
				),
			},
			{
				id: 'employee',
				header: t('hr:field.employee'),
				cell: ({ row }) => row.original.employee?.fullName ?? '—',
			},
			{
				id: 'due',
				header: t('hr:tasks.due'),
				cell: ({ row }) => (
					<span
						className={
							row.original.status === 'open' && row.original.dueDate && row.original.dueDate < today
								? 'text-destructive'
								: undefined
						}
					>
						{formatBusinessDate(row.original.dueDate, i18n.language)}
					</span>
				),
			},
			{
				id: 'status',
				header: t('hr:field.status'),
				cell: ({ row }) => (
					<Badge variant={STATUS_VARIANT[row.original.status]}>{t(`hr:taskStatus.${row.original.status}`)}</Badge>
				),
			},
			{
				id: 'actions',
				header: () => <span className='sr-only'>{t('hr:tasks.actions')}</span>,
				meta: { align: 'right', cellClassName: 'whitespace-nowrap' },
				cell: ({ row }) => (
					<RowActions
						label={t('hr:tasks.actions')}
						disabled={busy}
						actions={[
							{
								key: 'edit',
								label: t('hr:tasks.edit'),
								icon: Pencil,
								hidden: !canUpdate,
								onSelect: () => openEdit(row.original),
							},
							{
								key: 'done',
								label: t('hr:tasks.markDone'),
								icon: Check,
								hidden: !(canUpdate && row.original.status === 'open'),
								onSelect: () =>
									void run(() => setTaskStatus(row.original.id, 'done'), t('hr:taskStatus.done')),
							},
							{
								key: 'cancel',
								label: t('hr:tasks.cancel'),
								icon: Ban,
								destructive: true,
								hidden: !(canUpdate && row.original.status === 'open'),
								onSelect: () =>
									void run(() => setTaskStatus(row.original.id, 'cancelled'), t('hr:taskStatus.cancelled')),
							},
							{
								key: 'reopen',
								label: t('hr:tasks.reopen'),
								icon: RotateCcw,
								hidden: !(canUpdate && row.original.status !== 'open'),
								onSelect: () =>
									void run(() => setTaskStatus(row.original.id, 'open'), t('hr:taskStatus.open')),
							},
							{
								key: 'delete',
								label: t('hr:tasks.delete'),
								icon: Trash2,
								destructive: true,
								hidden: !canUpdate,
								onSelect: async () => {
									if (await confirm({ title: t('hr:tasks.deleteConfirm', { title: row.original.title }), destructive: true })) {
										void run(() => removeTask(row.original.id), t('hr:tasks.deleted'));
									}
								},
							},
						]}
					/>
				),
			},
		],
		[busy, canUpdate, confirm, i18n.language, openEdit, run, t, today],
	);

	return (
		<div className='flex flex-col gap-6 p-6'>
			<div className='flex flex-wrap items-start justify-between gap-2'>
				<div>
					<h1 className='text-2xl font-bold'>{t('hr:tasks.title')}</h1>
					<p className='text-sm text-muted-foreground'>{t('hr:tasks.description')}</p>
				</div>
				{canCreate && <Button onClick={openCreate}>{t('hr:tasks.new')}</Button>}
			</div>
			<div className='flex flex-wrap gap-2'>
				<Select
					value={status || 'all'}
					onValueChange={(value: string | null) => {
						setStatus(value === null || value === 'all' ? '' : (value as TTaskStatus));
						setPage(1);
					}}
				>
					<SelectTrigger aria-label={t('hr:field.status')}>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value='all'>{t('hr:tasks.allStatuses')}</SelectItem>
						{TASK_STATUSES.map((value) => (
							<SelectItem key={value} value={value}>
								{t(`hr:taskStatus.${value}`)}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
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
			<DataTableCard>
				{isError ? (
					<ErrorState error={error} />
				) : !isPending && data.rows.length === 0 ? (
					<EmptyState title={t('hr:tasks.empty')} />
				) : (
					<>
						<DataTable columns={columns} data={data?.rows ?? []} getRowId={(task) => task.id} loading={isPending} />
						{data && data.pagination.totalPages > 1 && (
							<PaginationControls page={data.pagination.page} totalPages={data.pagination.totalPages} onPageChange={setPage} />
						)}
					</>
				)}
			</DataTableCard>
			<Dialog open={creating} onOpenChange={setCreating}>
				<DialogContent>
					<form
						onSubmit={async (event) => {
							event.preventDefault();
							const input = { employeeId, title: title.trim(), description: description.trim() || null, dueDate: dueDate || null };
							const done = await run(
								() => (editing ? updateTask(editing.id, input) : createTask(input)),
								editing ? t('hr:tasks.updated') : t('hr:tasks.created'),
							);
							if (done) {
								setCreating(false);
								setEditing(null);
								setTitle('');
								setDescription('');
								setDueDate('');
							}
						}}
					>
						<DialogHeader>
							<DialogTitle>{editing ? t('hr:tasks.edit') : t('hr:tasks.new')}</DialogTitle>
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
								<FieldLabel htmlFor='task-detail' optional>{t('hr:tasks.detail')}</FieldLabel>
								<Textarea id='task-detail' rows={3} maxLength={2000} value={description} onChange={(event) => setDescription(event.target.value)} />
							</Field>
							<Field>
								<FieldLabel htmlFor='task-due' optional>{t('hr:tasks.due')}</FieldLabel>
								<DatePicker id='task-due' value={dueDate} onChange={setDueDate} />
							</Field>
						</FieldGroup>
						<DialogFooter>
							<Button type='button' variant='outline' onClick={() => setCreating(false)}>
								{t('common:action.cancel')}
							</Button>
							<Button type='submit' disabled={busy || !employeeId || !title.trim()}>
								{editing ? t('common:action.save') : t('hr:tasks.new')}
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>
		</div>
	);
}
