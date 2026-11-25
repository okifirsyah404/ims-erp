import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import { Card, CardContent, CardHeader, CardTitle } from '@ims-erp/ui/components/card';
import { Field, FieldGroup, FieldLabel } from '@ims-erp/ui/components/field';
import { Input } from '@ims-erp/ui/components/input';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@ims-erp/ui/components/select';
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@ims-erp/ui/components/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@ims-erp/ui/components/tabs';
import { useConfirm } from '@/components/confirm-dialog';
import { EmptyState, ErrorState } from '@/components/empty-state';
import { PageSkeleton } from '@/components/page-skeleton';
import { SelfieCapture, locate } from '@/components/projects/selfie-capture';
import { TaskDialog } from '@/components/projects/task-dialog';
import { toast } from '@/components/toast';
import { formatBusinessDate } from '@/lib/format';
import {
	addProjectEvidence,
	checkInToSite,
	checkOutOfSite,
	EVIDENCE_KINDS,
	myProjectQueryOptions,
	PROJECT_TASK_STATUSES,
	projectSiteAttendanceQueryOptions,
	removeProjectTask,
	setProjectTaskStatus,
	type TEvidenceKind,
	type TPosition,
	type TProjectTask,
	type TProjectTaskStatus,
} from '@/lib/project-api';

/**
 * `/projects/$projectId` — detail, tasks, PIC management and site attendance.
 *
 * @remarks
 * Task create/edit lives in {@link TaskDialog} (a dialog, like web-admin's
 * record forms) instead of an inline form above the list: the list stays the
 * subject of the page and a half-filled form cannot sit under a scroll
 * position. Inline selects still move a task's status and its assignee, because
 * those are one-click actions, not data entry.
 */
export function ProjectDetailPage() {
	const { projectId } = Route.useParams();
	const { t, i18n } = useTranslation('employee');
	const queryClient = useQueryClient();
	const confirm = useConfirm();
	const project = useQuery(myProjectQueryOptions(projectId));
	const visits = useQuery(projectSiteAttendanceQueryOptions(projectId));

	const refresh = async () => {
		await queryClient.invalidateQueries({ queryKey: ['employee-portal', 'project', projectId] });
		await queryClient.invalidateQueries({ queryKey: ['employee-portal', 'site-attendance'] });
	};

	const [dialog, setDialog] = useState<{ open: boolean; task: TProjectTask | null }>({
		open: false,
		task: null,
	});
	const [evidence, setEvidence] = useState<{ file: File | null; kind: TEvidenceKind; taskId: string; note: string }>({
		file: null,
		kind: 'photo',
		taskId: '',
		note: '',
	});
	const [position, setPosition] = useState<TPosition | null>(null);
	const [selfie, setSelfie] = useState<File | null>(null);
	const [visitNote, setVisitNote] = useState('');

	const removeTask = useMutation({
		mutationFn: (taskId: string) => removeProjectTask(projectId, taskId),
		onSuccess: refresh,
		onError: (error) => toast.error(error instanceof Error ? error.message : ''),
	});
	const moveTask = useMutation({
		mutationFn: ({ taskId, status }: { taskId: string; status: TProjectTaskStatus }) =>
			setProjectTaskStatus(projectId, taskId, status),
		onSuccess: refresh,
		onError: (error) => toast.error(error instanceof Error ? error.message : ''),
	});
	const uploadEvidence = useMutation({
		mutationFn: () => {
			if (!evidence.file) throw new Error(t('projects.selfieRequired'));
			return addProjectEvidence(projectId, {
				file: evidence.file,
				kind: evidence.kind,
				taskId: evidence.taskId || undefined,
				note: evidence.note || undefined,
			});
		},
		onSuccess: async () => {
			setEvidence({ file: null, kind: 'photo', taskId: '', note: '' });
			await refresh();
		},
		onError: (error) => toast.error(error instanceof Error ? error.message : ''),
	});
	const checkIn = useMutation({
		mutationFn: () => {
			if (!position) throw new Error(t('projects.locationRequired'));
			if (!selfie) throw new Error(t('projects.selfieRequired'));
			return checkInToSite({
				projectId,
				latitude: position.latitude,
				longitude: position.longitude,
				accuracyMeters: position.accuracyMeters,
				note: visitNote || null,
				selfie,
			});
		},
		onSuccess: async () => {
			toast.success(t('projects.checkInSuccess'));
			setSelfie(null);
			setVisitNote('');
			await refresh();
		},
		onError: (error) => toast.error(error instanceof Error ? error.message : ''),
	});
	const checkOut = useMutation({
		mutationFn: async (id: string) => {
			const fix = await locate();
			return checkOutOfSite(id, {
				latitude: fix.latitude,
				longitude: fix.longitude,
				accuracyMeters: fix.accuracyMeters,
			});
		},
		onSuccess: async () => {
			toast.success(t('projects.checkOutSuccess'));
			await refresh();
		},
		onError: (error) => toast.error(error instanceof Error ? error.message : ''),
	});

	if (project.isPending) return <PageSkeleton cards={2} />;
	if (project.isError) return <ErrorState error={project.error} />;
	const detail = project.data;

	return (
		<div className='flex flex-col gap-4 md:gap-6'>
			<header className='space-y-2'>
				<div className='flex flex-wrap items-center gap-2'>
					<h1 className='text-xl font-semibold md:text-2xl'>{detail.title}</h1>
					{detail.isPic ? <Badge>{t('projects.picBadge')}</Badge> : null}
					<Badge variant='secondary'>{t(`projects.status.${detail.status}` as const)}</Badge>
					<Badge variant='outline'>{t(`projects.stage.${detail.stage}` as const)}</Badge>
				</div>
				<p className='text-sm text-muted-foreground'>
					{detail.code} · {detail.customerName}
					{detail.siteName ? ` · ${detail.siteName}` : ''}
				</p>
			</header>

			<Tabs defaultValue='tasks'>
				<TabsList>
					<TabsTrigger value='tasks'>{t('projects.tasks')}</TabsTrigger>
					<TabsTrigger value='evidence'>{t('projects.evidence')}</TabsTrigger>
					<TabsTrigger value='attendance'>{t('projects.myVisits')}</TabsTrigger>
				</TabsList>

				<TabsContent value='tasks'>
					<Card>
						<CardHeader className='flex-row items-center justify-between gap-2'>
							<CardTitle className='text-base'>{t('projects.tasks')}</CardTitle>
							{detail.isPic ? (
								<Button size='sm' onClick={() => setDialog({ open: true, task: null })}>
									<Plus /> {t('projects.addTask')}
								</Button>
							) : null}
						</CardHeader>
						<CardContent>
							{detail.tasks.length === 0 ? (
								<EmptyState title={t('projects.noTasks')} bordered />
							) : (
								<ul className='flex flex-col divide-y text-sm'>
									{detail.tasks.map((task) => {
										const mine = task.assigneeUserId === detail.picUserId ? false : true;
										const canMove = detail.isPic || mine;
										return (
											<li key={task.id} className='flex flex-wrap items-center gap-3 py-2'>
												<div className='min-w-48 flex-1'>
													<div className={task.status === 'done' ? 'text-muted-foreground line-through' : 'font-medium'}>
														{task.title}
													</div>
													<div className='text-xs text-muted-foreground'>
														{t(`projects.stage.${task.stage}` as const)}
														{task.assignee ? ` · ${task.assignee.name}` : ` · ${t('projects.unassigned')}`}
														{task.dueDate ? ` · ${formatBusinessDate(task.dueDate, i18n.language)}` : ''}
													</div>
												</div>
												{canMove ? (
													<Select
														value={task.status}
														onValueChange={(value) =>
															moveTask.mutate({ taskId: task.id, status: value as TProjectTaskStatus })
														}
													>
														<SelectTrigger className='h-8 w-36' aria-label={t('projects.taskTitle')}>
															<SelectValue />
														</SelectTrigger>
														<SelectContent>
															{PROJECT_TASK_STATUSES.map((status) => (
																<SelectItem key={status} value={status}>
																	{t(`projects.task.${status}` as const)}
																</SelectItem>
															))}
														</SelectContent>
													</Select>
												) : (
													<Badge variant={task.status === 'done' ? 'default' : 'secondary'}>
														{t(`projects.task.${task.status}` as const)}
													</Badge>
												)}
												{detail.isPic ? (
													<>
														<Button
															size='sm'
															variant='outline'
															onClick={() => setDialog({ open: true, task })}
														>
															{t('projects.editTask')}
														</Button>
														<Button
															size='sm'
															variant='ghost'
															disabled={removeTask.isPending}
															onClick={async () => {
																if (await confirm({ title: t('projects.deleteTaskConfirm') }))
																	removeTask.mutate(task.id);
															}}
														>
															{t('projects.deleteTask')}
														</Button>
													</>
												) : null}
											</li>
										);
									})}
								</ul>
							)}
						</CardContent>
					</Card>
				</TabsContent>

				<TabsContent value='evidence' className='space-y-4'>
					<Card>
						<CardHeader>
							<CardTitle className='text-base'>{t('projects.uploadEvidence')}</CardTitle>
						</CardHeader>
						<CardContent>
							<form
								className='space-y-4'
								onSubmit={(event) => {
									event.preventDefault();
									uploadEvidence.mutate();
								}}
							>
								<FieldGroup className='grid gap-4 sm:grid-cols-2'>
									<Field>
										<FieldLabel>{t('projects.selfie')}</FieldLabel>
										<Input
											type='file'
											accept='image/*,application/pdf'
											onChange={(event) => setEvidence({ ...evidence, file: event.target.files?.[0] ?? null })}
										/>
									</Field>
									<Field>
										<FieldLabel>{t('projects.evidenceKind')}</FieldLabel>
										<Select
											value={evidence.kind}
											onValueChange={(value) => setEvidence({ ...evidence, kind: value as TEvidenceKind })}
										>
											<SelectTrigger>
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												{EVIDENCE_KINDS.map((kind) => (
													<SelectItem key={kind} value={kind}>
														{t(`projects.evidenceKind.${kind}` as const)}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</Field>
									<Field>
										<FieldLabel>{t('projects.tasks')}</FieldLabel>
										<Select
											value={evidence.taskId || 'none'}
											onValueChange={(value) => setEvidence({ ...evidence, taskId: value === 'none' ? '' : (value ?? '') })}
										>
											<SelectTrigger>
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value='none'>{t('projects.unassigned')}</SelectItem>
												{detail.tasks.map((task) => (
													<SelectItem key={task.id} value={task.id}>
														{task.title}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</Field>
									<Field>
										<FieldLabel>{t('projects.note')}</FieldLabel>
										<Input value={evidence.note} onChange={(event) => setEvidence({ ...evidence, note: event.target.value })} />
									</Field>
								</FieldGroup>
								<Button type='submit' disabled={!evidence.file || uploadEvidence.isPending}>
									{t('projects.uploadEvidence')}
								</Button>
							</form>
						</CardContent>
					</Card>

					{detail.evidence.length === 0 ? (
						<EmptyState title={t('projects.noEvidence')} bordered />
					) : (
						<ul className='divide-y rounded-lg border'>
							{detail.evidence.map((file) => (
								<li key={file.id} className='flex items-center justify-between gap-2 p-3 text-sm'>
									<div>
										<a href={file.url} target='_blank' rel='noreferrer' className='font-medium underline-offset-4 hover:underline'>
											{file.fileName}
										</a>
										<p className='text-xs text-muted-foreground'>
											{t(`projects.evidenceKind.${file.kind}` as const)}
											{file.uploader ? ` · ${file.uploader.name}` : ''}
										</p>
									</div>
								</li>
							))}
						</ul>
					)}
				</TabsContent>

				<TabsContent value='attendance' className='space-y-4'>
					<Card>
						<CardHeader>
							<CardTitle className='text-base'>{t('projects.checkInTitle')}</CardTitle>
						</CardHeader>
						<CardContent className='space-y-4'>
							<div className='flex flex-wrap items-center gap-2'>
								<Button
									type='button'
									variant='outline'
									onClick={async () => {
										try {
											setPosition(await locate());
										} catch {
											toast.error(t('projects.locationRequired'));
										}
									}}
								>
									{t('projects.location')}
								</Button>
								{position ? (
									<p className='text-xs text-muted-foreground'>
										{t('projects.locationReady', { accuracy: position.accuracyMeters ?? '—' })}
									</p>
								) : null}
							</div>
							<SelfieCapture onCapture={setSelfie} />
							<Field>
								<FieldLabel>{t('projects.note')}</FieldLabel>
								<Input value={visitNote} onChange={(event) => setVisitNote(event.target.value)} />
							</Field>
							<Button onClick={() => checkIn.mutate()} disabled={!position || !selfie || checkIn.isPending}>
								{t('projects.checkIn')}
							</Button>
						</CardContent>
					</Card>

					{visits.isPending ? (
						<PageSkeleton cards={1} />
					) : visits.isError ? (
						<ErrorState error={visits.error} />
					) : (visits.data ?? []).length === 0 ? (
						<EmptyState title={t('projects.emptyVisits')} bordered />
					) : (
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>{t('projects.myVisits')}</TableHead>
									<TableHead>{t('projects.distanceHeader')}</TableHead>
									<TableHead>{t('projects.stage')}</TableHead>
									<TableHead />
								</TableRow>
							</TableHeader>
							<TableBody>
								{(visits.data ?? []).map((visit) => (
									<TableRow key={visit.id}>
										<TableCell>
											{visit.businessDate}
											{visit.checkOutAt ? '' : ` · ${t('projects.openVisit')}`}
										</TableCell>
										<TableCell>
											{t('projects.distance', { distance: visit.distance.toFixed(0) })}
											<br />
											<span className='text-xs text-muted-foreground'>
												{t('projects.radius', { radius: visit.radius })}
											</span>
										</TableCell>
										<TableCell>
											<Badge variant={visit.status === 'verified' ? 'default' : 'destructive'}>
												{visit.status === 'verified' ? t('projects.verified') : t('projects.outOfRange')}
											</Badge>
										</TableCell>
										<TableCell className='text-right'>
											{visit.checkOutAt ? null : (
												<Button size='sm' variant='outline' onClick={() => checkOut.mutate(visit.id)}>
													{t('projects.checkOut')}
												</Button>
											)}
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					)}
				</TabsContent>
			</Tabs>

			<TaskDialog
				open={dialog.open}
				onOpenChange={(open) => setDialog({ open, task: open ? dialog.task : null })}
				projectId={projectId}
				task={dialog.task}
			/>
		</div>
	);
}

export const Route = createFileRoute('/_authed/projects/$projectId')({
	component: ProjectDetailPage,
});
