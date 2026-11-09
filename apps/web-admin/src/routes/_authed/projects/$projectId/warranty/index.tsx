import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@ims-erp/ui/components/button';
import { Card, CardContent, CardHeader, CardTitle } from '@ims-erp/ui/components/card';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@ims-erp/ui/components/field';
import { Input } from '@ims-erp/ui/components/input';
import { Textarea } from '@ims-erp/ui/components/textarea';
import { DocumentItemsEditor } from '@/components/projects/document-items-editor';
import { toast } from '@/components/toast';
import { formatBusinessDate } from '@/lib/format';
import {
	projectBastsQueryOptions,
	saveWarranty,
	type TWarrantyDraft,
	warrantyDraftQueryOptions,
	warrantyQueryOptions,
} from '@/lib/handover-api';

/** `/projects/$projectId/warranty` — create or edit the warranty certificate. */
export const Route = createFileRoute('/_authed/projects/$projectId/warranty/')({
	component: WarrantyPage,
});

const select = 'h-9 w-full rounded-md border bg-transparent px-3 text-sm';

function WarrantyForm({ projectId, initial }: { projectId: string; initial: TWarrantyDraft }) {
	const { t, i18n } = useTranslation(['projects', 'common']);
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const basts = useQuery(projectBastsQueryOptions(projectId));
	const issued = (basts.data ?? []).filter((bast) => bast.status === 'issued');
	const [value, setValue] = useState<TWarrantyDraft>(initial);
	const [busy, setBusy] = useState(false);
	const set = (patch: Partial<TWarrantyDraft>) => setValue((current) => ({ ...current, ...patch }));
	// Default to the latest issued BAST once the list arrives.
	const bastId = value.bastId ?? issued[0]?.id ?? '';
	const texts = [
		['coverage', t('projects:warranty.coverage')],
		['exclusions', t('projects:warranty.exclusions')],
		['serviceTerms', t('projects:warranty.serviceTerms')],
	] as const;

	return (
		<form
			className='flex flex-col gap-6'
			onSubmit={async (event) => {
				event.preventDefault();
				setBusy(true);
				try {
					await saveWarranty(projectId, { ...value, bastId, projectLocation: value.projectLocation?.trim() || null });
					await queryClient.invalidateQueries({ queryKey: ['projects'] });
					toast.success(t('projects:warranty.saved'));
					void navigate({ to: '/projects/$projectId/warranty/print', params: { projectId } });
				} catch (cause) {
					toast.error(cause instanceof Error ? cause.message : t('common:error.failed'));
				} finally {
					setBusy(false);
				}
			}}
		>
			<Card>
				<CardContent className='pt-6'>
					<FieldGroup className='grid gap-4 sm:grid-cols-3'>
						<Field>
							<FieldLabel htmlFor='warranty-bast'>{t('projects:warranty.bast')}</FieldLabel>
							<select id='warranty-bast' required className={select} value={bastId} onChange={(event) => set({ bastId: event.target.value })}>
								<option value=''>{t('projects:warranty.pickBast')}</option>
								{issued.map((bast) => (
									<option key={bast.id} value={bast.id}>
										{bast.code} — {formatBusinessDate(bast.bastDate, i18n.language)}
									</option>
								))}
							</select>
							<FieldDescription>{t('projects:warranty.bastHint')}</FieldDescription>
						</Field>
						<Field>
							<FieldLabel htmlFor='warranty-issue'>{t('projects:warranty.issueDate')}</FieldLabel>
							<Input id='warranty-issue' type='date' required value={value.issueDate} onChange={(event) => set({ issueDate: event.target.value })} />
						</Field>
						<Field>
							<FieldLabel htmlFor='warranty-months'>{t('projects:warranty.months')}</FieldLabel>
							<Input
								id='warranty-months'
								type='number'
								required
								min={1}
								max={120}
								step={1}
								value={value.months}
								onChange={(event) => set({ months: Number(event.target.value) })}
							/>
						</Field>
						<Field className='sm:col-span-3'>
							<FieldLabel htmlFor='warranty-product'>{t('projects:warranty.productSummary')}</FieldLabel>
							<Input id='warranty-product' required maxLength={300} value={value.productSummary} onChange={(event) => set({ productSummary: event.target.value })} />
						</Field>
						<Field>
							<FieldLabel htmlFor='warranty-project'>{t('projects:warranty.projectName')}</FieldLabel>
							<Input id='warranty-project' required maxLength={300} value={value.projectName} onChange={(event) => set({ projectName: event.target.value })} />
						</Field>
						<Field>
							<FieldLabel htmlFor='warranty-location'>{t('projects:warranty.projectLocation')}</FieldLabel>
							<Input
								id='warranty-location'
								maxLength={200}
								value={value.projectLocation ?? ''}
								onChange={(event) => set({ projectLocation: event.target.value })}
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor='warranty-owner'>{t('projects:warranty.projectOwner')}</FieldLabel>
							<Input id='warranty-owner' required maxLength={200} value={value.projectOwner} onChange={(event) => set({ projectOwner: event.target.value })} />
						</Field>
					</FieldGroup>
				</CardContent>
			</Card>
			<Card>
				<CardHeader>
					<CardTitle>{t('projects:warranty.items')}</CardTitle>
				</CardHeader>
				<CardContent>
					<DocumentItemsEditor idPrefix='warranty-item' value={value.items} onChange={(items) => set({ items })} />
				</CardContent>
			</Card>
			<Card>
				<CardHeader>
					<CardTitle>{t('projects:warranty.terms')}</CardTitle>
				</CardHeader>
				<CardContent className='flex flex-col gap-4'>
					<FieldDescription>{t('projects:warranty.textHint')}</FieldDescription>
					{texts.map(([key, label]) => (
						<Field key={key}>
							<FieldLabel htmlFor={`warranty-${key}`}>{label}</FieldLabel>
							<Textarea id={`warranty-${key}`} rows={6} required maxLength={6000} value={value[key]} onChange={(event) => set({ [key]: event.target.value })} />
						</Field>
					))}
				</CardContent>
			</Card>
			<div className='flex justify-end gap-2'>
				<Button type='button' variant='outline' onClick={() => void navigate({ to: '/projects/$projectId', params: { projectId } })}>
					{t('common:action.cancel')}
				</Button>
				<Button type='submit' disabled={busy || !bastId}>
					{t('projects:warranty.save')}
				</Button>
			</div>
		</form>
	);
}

function WarrantyPage() {
	const { t } = useTranslation(['projects']);
	const { projectId } = Route.useParams();
	const existing = useQuery(warrantyQueryOptions(projectId));
	const draft = useQuery({ ...warrantyDraftQueryOptions(projectId), enabled: existing.data === null });
	const initial = existing.data ?? draft.data;

	return (
		<div className='flex flex-col gap-6'>
			<div>
				<h1 className='text-2xl font-bold'>{existing.data ? existing.data.code : t('projects:warranty.new')}</h1>
				<p className='text-sm text-muted-foreground'>{t('projects:warranty.hint')}</p>
			</div>
			{existing.isError ? (
				<p className='text-sm text-destructive'>{existing.error.message}</p>
			) : draft.isError ? (
				<p className='text-sm text-destructive'>{draft.error.message}</p>
			) : initial ? (
				<WarrantyForm projectId={projectId} initial={initial} />
			) : null}
		</div>
	);
}
