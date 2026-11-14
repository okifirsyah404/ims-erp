import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@ims-erp/ui/components/button';
import { Card, CardContent, CardHeader, CardTitle } from '@ims-erp/ui/components/card';
import { Field, FieldLabel } from '@ims-erp/ui/components/field';
import { Input } from '@ims-erp/ui/components/input';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@ims-erp/ui/components/select';
import { toast } from '@/components/toast';
import { formatBusinessDate } from '@/lib/format';
import {
	addTask,
	PROJECT_STAGES,
	projectStaffQueryOptions,
	removeTask,
	setTaskStatus,
	TASK_STATUSES,
	type TProjectDetail,
	type TProjectStage,
	type TProjectTask,
	type TTaskStatus,
	updateTask,
} from '@/lib/project-api';
import { usePermission } from '@/lib/use-permission';

/**
 * The project checklist. `task:assign` holders assign, reschedule and
 * remove tasks and move any of them; assignees move their own (the server
 * enforces the same rule).
 */
export function ProjectTasksCard({ project, actorUserId }: { project: TProjectDetail; actorUserId: string | undefined }) {
	const { t, i18n } = useTranslation(['projects', 'common']);
	const queryClient = useQueryClient();
	const canAssign = usePermission('task.assign');
	const canCreate = usePermission('task.create');
	const active = project.status === 'active';
	const staff = useQuery({ ...projectStaffQueryOptions(), enabled: active && (canAssign || canCreate) });
	const [title, setTitle] = useState('');
	const [stage, setStage] = useState<TProjectStage>('installation');
	const [assigneeUserId, setAssigneeUserId] = useState('');
	const [busy, setBusy] = useState(false);

	const run = async (work: () => Promise<unknown>, done?: string) => {
		setBusy(true);
		try {
			await work();
			await queryClient.invalidateQueries({ queryKey: ['projects'] });
			if (done) toast.success(done);
		} catch (cause) {
			toast.error(cause instanceof Error ? cause.message : t('common:error.failed'));
		} finally {
			setBusy(false);
		}
	};
	const input = (task: TProjectTask, patch: Partial<{ assigneeUserId: string | null; dueDate: string | null }>) => ({
		title: task.title,
		stage: task.stage,
		assigneeUserId: task.assigneeUserId,
		dueDate: task.dueDate,
		...patch,
	});

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t('projects:tasks.title')}</CardTitle>
			</CardHeader>
			<CardContent className='flex flex-col gap-3'>
				<ul className='flex flex-col divide-y text-sm'>
					{project.tasks.map((task) => {
						const mine = task.assigneeUserId === actorUserId;
						return (
							<li key={task.id} className='flex flex-wrap items-center gap-3 py-2'>
								<div className='min-w-48 flex-1'>
									<div className={task.status === 'done' ? 'text-muted-foreground line-through' : 'font-medium'}>{task.title}</div>
									<div className='text-xs text-muted-foreground'>
										{t(`projects:stage.${task.stage}`)}
										{task.dueDate ? ` · ${t('projects:tasks.due')} ${formatBusinessDate(task.dueDate, i18n.language)}` : ''}
									</div>
								</div>
								{active && canAssign ? (
									<Select
										value={task.assigneeUserId ?? 'none'}
										disabled={busy}
										onValueChange={(value: string | null) =>
											void run(() => updateTask(project.id, task.id, input(task, { assigneeUserId: value == null || value === 'none' ? null : value })))
										}
									>
										<SelectTrigger aria-label={t('projects:tasks.assigneeOf', { task: task.title })}>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value='none'>{t('projects:tasks.unassigned')}</SelectItem>
											{(staff.data?.workers ?? []).map((person) => (
												<SelectItem key={person.userId} value={person.userId}>
													{person.name}
												</SelectItem>
											))}
											{task.assignee && !staff.data?.workers.some((person) => person.userId === task.assigneeUserId) && (
												<SelectItem value={task.assignee.userId}>{task.assignee.name}</SelectItem>
											)}
										</SelectContent>
									</Select>
								) : (
									<span className='text-muted-foreground'>{task.assignee?.name ?? t('projects:tasks.unassigned')}</span>
								)}
								{active && (canAssign || mine) ? (
									<Select
										value={task.status}
										disabled={busy}
										onValueChange={(value: string | null) =>
											void run(() => setTaskStatus(project.id, task.id, value as TTaskStatus))
										}
									>
										<SelectTrigger aria-label={t('projects:tasks.statusOf', { task: task.title })}>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{TASK_STATUSES.map((status) => (
												<SelectItem key={status} value={status}>
													{t(`projects:taskStatus.${status}`)}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								) : (
									<span className='text-xs'>{t(`projects:taskStatus.${task.status}`)}</span>
								)}
								{active && canAssign && (
									<Button
										variant='ghost'
										size='sm'
										disabled={busy}
										onClick={() => void run(() => removeTask(project.id, task.id), t('projects:tasks.removed'))}
									>
										{t('projects:tasks.remove')}
									</Button>
								)}
							</li>
						);
					})}
				</ul>
				{active && canCreate && (
					<form
						className='grid gap-3 rounded-md border p-3 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end'
						onSubmit={(event) => {
							event.preventDefault();
							void run(async () => {
								await addTask(project.id, { title: title.trim(), stage, assigneeUserId: assigneeUserId || null, dueDate: null });
								setTitle('');
								setAssigneeUserId('');
							}, t('projects:tasks.added'));
						}}
					>
						<Field>
							<FieldLabel htmlFor='task-title'>{t('projects:tasks.newTitle')}</FieldLabel>
							<Input id='task-title' required maxLength={300} value={title} onChange={(event) => setTitle(event.target.value)} />
						</Field>
						<Field>
							<FieldLabel htmlFor='task-stage'>{t('projects:field.stage')}</FieldLabel>
							<Select value={stage} onValueChange={(value: string | null) => setStage(value as TProjectStage)}>
								<SelectTrigger id='task-stage' className='w-full'>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{PROJECT_STAGES.filter((value) => value !== 'warranty').map((value) => (
										<SelectItem key={value} value={value}>
											{t(`projects:stage.${value}`)}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</Field>
						<Field>
							<FieldLabel htmlFor='task-assignee'>{t('projects:tasks.assignee')}</FieldLabel>
							<Select
								value={assigneeUserId === '' ? 'none' : assigneeUserId}
								onValueChange={(value: string | null) => setAssigneeUserId(value == null || value === 'none' ? '' : value)}
							>
								<SelectTrigger id='task-assignee' className='w-full'>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value='none'>{t('projects:tasks.unassigned')}</SelectItem>
									{(staff.data?.workers ?? []).map((person) => (
										<SelectItem key={person.userId} value={person.userId}>
											{person.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</Field>
						<Button type='submit' disabled={busy || title.trim() === ''}>
							{t('projects:tasks.add')}
						</Button>
					</form>
				)}
			</CardContent>
		</Card>
	);
}
