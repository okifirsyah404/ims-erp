import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Button } from '@ims-erp/ui/components/button';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@ims-erp/ui/components/dialog';
import { Field, FieldGroup, FieldLabel } from '@ims-erp/ui/components/field';
import { Input } from '@ims-erp/ui/components/input';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@ims-erp/ui/components/select';
import { toast } from '@/components/toast';
import {
	addProjectTask,
	PROJECT_STAGES,
	projectStaffQueryOptions,
	updateProjectTask,
	type TProjectStage,
	type TProjectTask,
} from '@/lib/project-api';

/** The task fields, as the dialog edits them (empty string = unset). */
type TTaskDraft = {
	title: string;
	stage: TProjectStage;
	assigneeUserId: string;
	dueDate: string;
};

function draftOf(task: TProjectTask | null): TTaskDraft {
	return {
		title: task?.title ?? '',
		// `warranty` is reached by closing a project, never by hand.
		stage: task?.stage ?? 'installation',
		assigneeUserId: task?.assigneeUserId ?? '',
		dueDate: task?.dueDate ?? '',
	};
}

/**
 * Create/edit a project task in a dialog, the way web-admin edits records.
 *
 * @remarks
 * A dialog rather than an inline form: the list stays the page's subject, the
 * form cannot be left half-filled under a scroll position, and the same
 * component serves both create and edit (`task` decides which). PIC-only; the
 * server refuses a non-PIC anyway.
 */
export function TaskDialog({
	open,
	onOpenChange,
	projectId,
	task,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	projectId: string;
	/** `null` creates, a task edits. */
	task: TProjectTask | null;
}) {
	const { t } = useTranslation('employee');
	const queryClient = useQueryClient();
	const staff = useQuery({ ...projectStaffQueryOptions, enabled: open });
	const [draft, setDraft] = useState<TTaskDraft>(() => draftOf(task));

	const save = useMutation({
		mutationFn: () => {
			const body = {
				title: draft.title.trim(),
				stage: draft.stage,
				assigneeUserId: draft.assigneeUserId || null,
				dueDate: draft.dueDate || null,
			};
			return task
				? updateProjectTask(projectId, task.id, body)
				: addProjectTask(projectId, body);
		},
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: ['employee-portal', 'project', projectId] });
			onOpenChange(false);
		},
		onError: (error) => toast.error(error instanceof Error ? error.message : ''),
	});

	return (
		<Dialog
			open={open}
			onOpenChange={(next) => {
				// Re-seed on open so a cancelled edit never leaks into the next one.
				if (next) setDraft(draftOf(task));
				onOpenChange(next);
			}}
		>
			<DialogContent className='sm:max-w-lg'>
				<DialogHeader>
					<DialogTitle>{task ? t('projects.editTask') : t('projects.addTask')}</DialogTitle>
					<DialogDescription>{t('projects.taskDialogHint')}</DialogDescription>
				</DialogHeader>
				<form
					className='space-y-4'
					onSubmit={(event) => {
						event.preventDefault();
						save.mutate();
					}}
				>
					<FieldGroup className='grid gap-4 sm:grid-cols-2'>
						<Field className='sm:col-span-2'>
							<FieldLabel htmlFor='task-title'>{t('projects.taskTitle')}</FieldLabel>
							<Input
								id='task-title'
								required
								maxLength={300}
								value={draft.title}
								onChange={(event) => setDraft({ ...draft, title: event.target.value })}
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor='task-stage'>{t('projects.stage')}</FieldLabel>
							<Select
								value={draft.stage}
								onValueChange={(value) => setDraft({ ...draft, stage: value as TProjectStage })}
							>
								<SelectTrigger id='task-stage' className='w-full'>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{PROJECT_STAGES.filter((stage) => stage !== 'warranty').map((stage) => (
										<SelectItem key={stage} value={stage}>
											{t(`projects.stage.${stage}` as const)}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</Field>
						<Field>
							<FieldLabel htmlFor='task-due'>{t('projects.dueDate')}</FieldLabel>
							<Input
								id='task-due'
								type='date'
								value={draft.dueDate}
								onChange={(event) => setDraft({ ...draft, dueDate: event.target.value })}
							/>
						</Field>
						<Field className='sm:col-span-2'>
							<FieldLabel htmlFor='task-assignee'>{t('projects.assignee')}</FieldLabel>
							<Select
								value={draft.assigneeUserId || 'none'}
								onValueChange={(value) =>
									setDraft({ ...draft, assigneeUserId: value == null || value === 'none' ? '' : value })
								}
							>
								<SelectTrigger id='task-assignee' className='w-full'>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value='none'>{t('projects.unassigned')}</SelectItem>
									{(staff.data?.workers ?? []).map((person) => (
										<SelectItem key={person.userId} value={person.userId}>
											{person.name}
										</SelectItem>
									))}
									{task?.assignee &&
									!staff.data?.workers.some((person) => person.userId === task.assigneeUserId) ? (
										<SelectItem value={task.assignee.userId}>{task.assignee.name}</SelectItem>
									) : null}
								</SelectContent>
							</Select>
						</Field>
					</FieldGroup>
					<DialogFooter>
						<Button type='button' variant='outline' onClick={() => onOpenChange(false)}>
							{t('projects.cancel')}
						</Button>
						<Button type='submit' disabled={draft.title.trim() === '' || save.isPending}>
							{t('projects.save')}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
