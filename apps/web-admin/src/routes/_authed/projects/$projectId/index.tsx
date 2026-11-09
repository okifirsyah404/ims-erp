import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import { Card, CardContent, CardHeader, CardTitle } from '@ims-erp/ui/components/card';
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@ims-erp/ui/components/dialog';
import { Field, FieldGroup, FieldLabel } from '@ims-erp/ui/components/field';
import { Input } from '@ims-erp/ui/components/input';
import { Textarea } from '@ims-erp/ui/components/textarea';
import { ProjectCostsCard } from '@/components/projects/project-costs-card';
import { ProjectDocumentsCard } from '@/components/projects/project-documents-card';
import { ProjectEvidenceCard } from '@/components/projects/project-evidence-card';
import { ProjectTasksCard } from '@/components/projects/project-tasks-card';
import { toast } from '@/components/toast';
import { authClient } from '@/lib/auth-client';
import { formatBusinessDate, formatIdr } from '@/lib/format';
import {
	cancelProject,
	closeProject,
	PROJECT_STAGES,
	PROJECT_STATUS_VARIANT,
	projectQueryOptions,
	projectStaffQueryOptions,
	type TProjectDetail,
	type TProjectStage,
	updateProject,
} from '@/lib/project-api';
import { usePermission } from '@/lib/use-permission';

/** `/projects/$projectId` — one project: stages, tasks, evidence, costs. */
export const Route = createFileRoute('/_authed/projects/$projectId/')({
	component: ProjectDetailPage,
});

function Detail({ label, value }: { label: string; value: string | null | undefined }) {
	return (
		<div>
			<div className='text-muted-foreground'>{label}</div>
			<div className='whitespace-pre-line'>{value || '—'}</div>
		</div>
	);
}

type TDialog = 'edit' | 'close' | 'cancel' | null;
const select = 'h-9 w-full rounded-md border bg-transparent px-3 text-sm';

function EditFields({ project, onChange }: { project: TProjectDetail; onChange: (draft: TDraft) => void }) {
	const { t } = useTranslation(['projects']);
	const staff = useQuery(projectStaffQueryOptions());
	const [draft, setDraft] = useState<TDraft>({
		picUserId: project.picUserId,
		siteName: project.siteName ?? '',
		targetStartDate: project.targetStartDate ?? '',
		targetEndDate: project.targetEndDate ?? '',
		stage: project.stage === 'warranty' ? 'handover' : project.stage,
		notes: project.notes ?? '',
	});
	const set = (patch: Partial<TDraft>) => {
		const next = { ...draft, ...patch };
		setDraft(next);
		onChange(next);
	};
	return (
		<FieldGroup className='grid gap-4 py-4 sm:grid-cols-2'>
			<Field>
				<FieldLabel htmlFor='edit-pic'>{t('projects:field.pic')}</FieldLabel>
				<select id='edit-pic' className={select} value={draft.picUserId} onChange={(event) => set({ picUserId: event.target.value })}>
					{!staff.data?.pics.some((person) => person.userId === draft.picUserId) && project.pic && (
						<option value={project.pic.userId}>{project.pic.name}</option>
					)}
					{(staff.data?.pics ?? []).map((person) => (
						<option key={person.userId} value={person.userId}>
							{person.name}
						</option>
					))}
				</select>
			</Field>
			<Field>
				<FieldLabel htmlFor='edit-stage'>{t('projects:field.stage')}</FieldLabel>
				<select id='edit-stage' className={select} value={draft.stage} onChange={(event) => set({ stage: event.target.value as TProjectStage })}>
					{PROJECT_STAGES.filter((stage) => stage !== 'warranty').map((stage) => (
						<option key={stage} value={stage}>
							{t(`projects:stage.${stage}`)}
						</option>
					))}
				</select>
			</Field>
			<Field className='sm:col-span-2'>
				<FieldLabel htmlFor='edit-site'>{t('projects:field.site')}</FieldLabel>
				<Input id='edit-site' maxLength={200} value={draft.siteName} onChange={(event) => set({ siteName: event.target.value })} />
			</Field>
			<Field>
				<FieldLabel htmlFor='edit-start'>{t('projects:field.targetStart')}</FieldLabel>
				<Input id='edit-start' type='date' value={draft.targetStartDate} onChange={(event) => set({ targetStartDate: event.target.value })} />
			</Field>
			<Field>
				<FieldLabel htmlFor='edit-end'>{t('projects:field.targetEnd')}</FieldLabel>
				<Input
					id='edit-end'
					type='date'
					min={draft.targetStartDate || undefined}
					value={draft.targetEndDate}
					onChange={(event) => set({ targetEndDate: event.target.value })}
				/>
			</Field>
			<Field className='sm:col-span-2'>
				<FieldLabel htmlFor='edit-notes'>{t('projects:field.notes')}</FieldLabel>
				<Textarea id='edit-notes' rows={3} maxLength={4000} value={draft.notes} onChange={(event) => set({ notes: event.target.value })} />
			</Field>
		</FieldGroup>
	);
}

type TDraft = { picUserId: string; siteName: string; targetStartDate: string; targetEndDate: string; stage: TProjectStage; notes: string };

function ProjectDetailPage() {
	const { t, i18n } = useTranslation(['projects', 'common']);
	const { projectId } = Route.useParams();
	const queryClient = useQueryClient();
	const { data: session } = authClient.useSession();
	const canUpdate = usePermission('project.update');
	const canClose = usePermission('project.close');
	const [dialog, setDialog] = useState<TDialog>(null);
	const [draft, setDraft] = useState<TDraft | null>(null);
	const [reason, setReason] = useState('');
	const [busy, setBusy] = useState(false);
	const { data, isPending, isError, error } = useQuery(projectQueryOptions(projectId));

	if (isPending) return null;
	if (isError) {
		return (
			<div className='flex flex-col gap-4 p-6'>
				<p className='text-sm text-destructive'>{error.message}</p>
				<Link to='/projects' className='text-sm hover:underline'>
					{t('projects:detail.back')}
				</Link>
			</div>
		);
	}

	const active = data.status === 'active';
	const stageIndex = PROJECT_STAGES.indexOf(data.stage);
	const run = async () => {
		setBusy(true);
		try {
			if (dialog === 'edit' && draft) {
				await updateProject(projectId, {
					picUserId: draft.picUserId,
					siteName: draft.siteName.trim() || null,
					targetStartDate: draft.targetStartDate || null,
					targetEndDate: draft.targetEndDate || null,
					stage: draft.stage,
					notes: draft.notes.trim() || null,
				});
			}
			if (dialog === 'close') await closeProject(projectId);
			if (dialog === 'cancel') await cancelProject(projectId, reason.trim());
			await queryClient.invalidateQueries({ queryKey: ['projects'] });
			toast.success(
				t(dialog === 'edit' ? 'projects:detail.saved' : dialog === 'close' ? 'projects:detail.closed' : 'projects:detail.cancelled'),
			);
			setDialog(null);
		} catch (cause) {
			toast.error(cause instanceof Error ? cause.message : t('common:error.failed'));
		} finally {
			setBusy(false);
		}
	};
	const title = dialog === 'edit' ? t('projects:detail.edit') : dialog === 'close' ? t('projects:detail.close') : t('projects:detail.cancel');

	return (
		<div className='flex flex-col gap-6 p-6'>
			<Link to='/projects' className='text-sm text-muted-foreground hover:underline'>
				{t('projects:detail.back')}
			</Link>
			<div className='flex flex-wrap items-start justify-between gap-4'>
				<div>
					<h1 className='text-2xl font-bold'>{data.code}</h1>
					<p className='text-sm text-muted-foreground'>
						{data.title} · {data.customerName}
					</p>
					<div className='mt-2'>
						<Badge variant={PROJECT_STATUS_VARIANT[data.status]}>{t(`projects:status.${data.status}`)}</Badge>
					</div>
				</div>
				{active && (
					<div className='flex flex-wrap gap-2'>
						{canUpdate && (
							<Button variant='outline' onClick={() => setDialog('edit')}>
								{t('projects:detail.edit')}
							</Button>
						)}
						{canClose && (
							<>
								<Button variant='outline' onClick={() => setDialog('cancel')}>
									{t('projects:detail.cancel')}
								</Button>
								<Button disabled={!data.canClose} title={data.canClose ? undefined : t('projects:detail.closeHint')} onClick={() => setDialog('close')}>
									{t('projects:detail.close')}
								</Button>
							</>
						)}
					</div>
				)}
			</div>
			{data.status === 'cancelled' && data.cancelReason && (
				<p className='text-sm text-muted-foreground'>
					{t('projects:detail.cancelReason')}: {data.cancelReason}
				</p>
			)}

			<ol aria-label={t('projects:detail.stages')} className='flex flex-wrap gap-2 text-xs'>
				{PROJECT_STAGES.map((stage, index) => (
					<li
						key={stage}
						aria-current={index === stageIndex ? 'step' : undefined}
						className={`rounded-full border px-3 py-1 ${
							index === stageIndex ? 'border-primary bg-primary text-primary-foreground' : index < stageIndex ? 'bg-muted' : 'text-muted-foreground'
						}`}
					>
						{index + 1}. {t(`projects:stage.${stage}`)}
					</li>
				))}
			</ol>

			<Card>
				<CardHeader>
					<CardTitle>{t('projects:detail.info')}</CardTitle>
				</CardHeader>
				<CardContent className='grid gap-3 text-sm sm:grid-cols-3'>
					<div>
						<div className='text-muted-foreground'>{t('projects:field.deal')}</div>
						<Link to='/sales/orders/$orderId' params={{ orderId: data.salesOrderId }} className='hover:underline'>
							{data.salesOrderCode}
						</Link>
						{data.quotationCode && <div className='text-xs text-muted-foreground'>{data.quotationCode}</div>}
					</div>
					<Detail label={t('projects:field.pic')} value={data.pic?.name} />
					<Detail label={t('projects:field.site')} value={data.siteName} />
					<Detail label={t('projects:field.targetStart')} value={data.targetStartDate ? formatBusinessDate(data.targetStartDate, i18n.language) : null} />
					<Detail label={t('projects:field.targetEnd')} value={data.targetEndDate ? formatBusinessDate(data.targetEndDate, i18n.language) : null} />
					{data.costs && <Detail label={t('projects:field.contractValue')} value={formatIdr(data.contractValue)} />}
					<div className='sm:col-span-3'>
						<Detail label={t('projects:field.notes')} value={data.notes} />
					</div>
				</CardContent>
			</Card>

			<ProjectTasksCard project={data} actorUserId={session?.user.id} />
			<ProjectEvidenceCard project={data} actorUserId={session?.user.id} />
			<ProjectDocumentsCard project={data} />
			{data.costs && <ProjectCostsCard project={{ ...data, costs: data.costs }} />}

			<Dialog open={dialog !== null} onOpenChange={(open) => !open && setDialog(null)}>
				<DialogContent className='sm:max-w-xl'>
					<form
						onSubmit={(event) => {
							event.preventDefault();
							void run();
						}}
					>
						<DialogHeader>
							<DialogTitle>{title}</DialogTitle>
						</DialogHeader>
						{dialog === 'edit' && <EditFields project={data} onChange={setDraft} />}
						{dialog === 'close' && <p className='py-4 text-sm text-muted-foreground'>{t('projects:detail.closeConfirm')}</p>}
						{dialog === 'cancel' && (
							<FieldGroup className='py-4'>
								<p className='text-sm text-muted-foreground'>{t('projects:detail.cancelHint')}</p>
								<Field>
									<FieldLabel htmlFor='project-cancel-reason'>{t('projects:detail.cancelReason')}</FieldLabel>
									<Textarea id='project-cancel-reason' required maxLength={1000} value={reason} onChange={(event) => setReason(event.target.value)} />
								</Field>
							</FieldGroup>
						)}
						<DialogFooter>
							<Button type='button' variant='outline' onClick={() => setDialog(null)}>
								{t('common:action.cancel')}
							</Button>
							<Button type='submit' disabled={busy || (dialog === 'cancel' && reason.trim() === '') || (dialog === 'edit' && !draft)}>
								{dialog === 'edit' ? t('projects:detail.save') : title}
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>
		</div>
	);
}
