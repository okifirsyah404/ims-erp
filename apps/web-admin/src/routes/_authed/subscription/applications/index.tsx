import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import { Checkbox } from '@ims-erp/ui/components/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@ims-erp/ui/components/dialog';
import { Field, FieldDescription, FieldGroup } from '@ims-erp/ui/components/field';
import { FieldLabel } from '@/components/form/field-label';
import { Input } from '@ims-erp/ui/components/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@ims-erp/ui/components/select';
import { Textarea } from '@ims-erp/ui/components/textarea';
import type { CellData, ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/data-table/data-table';
import { DataTableCard } from '@/components/data-table/data-table-card';
import type { DataTableFeatures } from '@/components/data-table/data-table-features';
import { RowActions } from '@/components/data-table/row-actions';
import { Archive, Pencil, RotateCcw } from 'lucide-react';
import { EmptyState, ErrorState } from '@/components/empty-state';
import { toast } from '@/components/toast';
import {
	APPLICATION_SOURCES,
	applicationsQueryOptions,
	createApplication,
	restoreApplication,
	retireApplication,
	type TApplicationSource,
	type TLicensableApplication,
	updateApplication,
} from '@/lib/license-api';
import { usePermission } from '@/lib/use-permission';

/** `/subscription/applications` — the applications licenses are sold for. */
export const Route = createFileRoute('/_authed/subscription/applications/')({
	component: ApplicationsPage,
});

function ApplicationsPage() {
	const { t } = useTranslation(['licensing', 'common']);
	const queryClient = useQueryClient();
	const canManage = usePermission('license.create');
	const [showRetired, setShowRetired] = useState(false);
	const { data, isPending, isError, error } = useQuery(applicationsQueryOptions(showRetired));
	const [editing, setEditing] = useState<TLicensableApplication | 'new' | null>(null);
	const [code, setCode] = useState('');
	const [name, setName] = useState('');
	const [vendor, setVendor] = useState('');
	const [source, setSource] = useState<TApplicationSource>('third_party');
	const [description, setDescription] = useState('');
	const [busy, setBusy] = useState(false);

	const open = (app: TLicensableApplication | 'new') => {
		const current = app === 'new' ? null : app;
		setCode(current?.code ?? '');
		setName(current?.name ?? '');
		setVendor(current?.vendor ?? '');
		setSource(current?.source ?? 'third_party');
		setDescription(current?.description ?? '');
		setEditing(app);
	};
	const run = async (work: () => Promise<unknown>) => {
		setBusy(true);
		try {
			await work();
			await queryClient.invalidateQueries({ queryKey: ['licenses', 'applications'] });
			toast.success(t('licensing:applications.saved'));
			setEditing(null);
		} catch (cause) {
			toast.error(cause instanceof Error ? cause.message : t('common:error.failed'));
		} finally {
			setBusy(false);
		}
	};

	// `open` and `run` are re-created every render and only close over state setters.
	const columns = useMemo<ColumnDef<DataTableFeatures, TLicensableApplication, CellData>[]>(
		() => [
			{
				accessorKey: 'code',
				header: t('licensing:field.code'),
				meta: { cellClassName: 'font-medium' },
			},
			{
				id: 'name',
				header: t('licensing:field.name'),
				cell: ({ row }) => (
					<>
						{row.original.name}
						{row.original.status === 'retired' && (
							<Badge variant='outline' className='ml-2'>
								{t('licensing:applications.retired')}
							</Badge>
						)}
						{row.original.description && (
							<div className='max-w-96 truncate text-xs text-muted-foreground'>
								{row.original.description}
							</div>
						)}
					</>
				),
			},
			{
				id: 'vendor',
				header: t('licensing:field.vendor'),
				cell: ({ row }) => row.original.vendor ?? '—',
			},
			{
				id: 'source',
				header: t('licensing:field.source'),
				cell: ({ row }) => t(`licensing:source.${row.original.source}`),
			},
			{
				id: 'actions',
				header: () => <span className='sr-only'>{t('common:action.actions')}</span>,
				meta: { align: 'right', cellClassName: 'whitespace-nowrap' },
				cell: ({ row }) => {
					const active = row.original.status === 'active';
					return (
						<RowActions
							label={t('common:action.actions')}
							actions={[
								{
									key: 'edit',
									label: t('licensing:action.edit'),
									icon: Pencil,
									hidden: !canManage,
									onSelect: () => open(row.original),
								},
								{
									key: 'retire',
									label: t('licensing:applications.retire'),
									icon: Archive,
									destructive: true,
									disabled: busy,
									hidden: !canManage || !active,
									onSelect: () => void run(() => retireApplication(row.original.id)),
								},
								{
									key: 'restore',
									label: t('licensing:applications.restore'),
									icon: RotateCcw,
									disabled: busy,
									hidden: !canManage || active,
									onSelect: () => void run(() => restoreApplication(row.original.id)),
								},
							]}
						/>
					);
				},
			},
		],
		// eslint-disable-next-line react-hooks/exhaustive-deps -- open/run only close over state setters
		[busy, canManage, t],
	);

	return (
		<div className='flex flex-col gap-6'>
			<div className='flex flex-wrap items-start justify-between gap-2'>
				<div>
					<h1 className='text-2xl font-bold'>{t('licensing:applications.title')}</h1>
					<p className='text-sm text-muted-foreground'>{t('licensing:applications.description')}</p>
				</div>
				{canManage && <Button onClick={() => open('new')}>{t('licensing:applications.new')}</Button>}
			</div>
			<Field orientation='horizontal' className='w-auto'>
				<Checkbox id='applications-show-retired' checked={showRetired} onCheckedChange={(checked) => setShowRetired(checked === true)} />
				<FieldLabel htmlFor='applications-show-retired'>{t('licensing:applications.showRetired')}</FieldLabel>
			</Field>
			<DataTableCard>
				{isError ? (
					<ErrorState error={error} />
				) : !isPending && data.length === 0 ? (
					<EmptyState title={t('licensing:applications.empty')} />
				) : (
					<DataTable columns={columns} data={data ?? []} loading={isPending} getRowId={(row) => row.id} sortable />
				)}
			</DataTableCard>

			<Dialog open={editing !== null} onOpenChange={(next) => !next && setEditing(null)}>
				<DialogContent>
					<form
						onSubmit={(event) => {
							event.preventDefault();
							const input = {
								code: code.trim(),
								name: name.trim(),
								vendor: vendor.trim() || null,
								source,
								description: description.trim() || null,
							};
							void run(() => (editing === 'new' || editing === null ? createApplication(input) : updateApplication(editing.id, input)));
						}}
					>
						<DialogHeader>
							<DialogTitle>{editing === 'new' ? t('licensing:applications.new') : t('licensing:applications.edit')}</DialogTitle>
						</DialogHeader>
						<FieldGroup className='py-4'>
							<Field>
								<FieldLabel htmlFor='app-code'>{t('licensing:field.code')}</FieldLabel>
								<Input
									id='app-code'
									required
									maxLength={32}
									pattern='[A-Za-z0-9._\-]+'
									value={code}
									onChange={(event) => setCode(event.target.value)}
								/>
								<FieldDescription>{t('licensing:applications.codeHint')}</FieldDescription>
							</Field>
							<Field>
								<FieldLabel htmlFor='app-name'>{t('licensing:field.name')}</FieldLabel>
								<Input id='app-name' required maxLength={200} value={name} onChange={(event) => setName(event.target.value)} />
							</Field>
							<Field>
								<FieldLabel htmlFor='app-vendor' optional>{t('licensing:field.vendor')}</FieldLabel>
								<Input id='app-vendor' maxLength={200} value={vendor} onChange={(event) => setVendor(event.target.value)} />
							</Field>
							<Field>
								<FieldLabel htmlFor='app-source'>{t('licensing:field.source')}</FieldLabel>
								<Select value={source} onValueChange={(value: string | null) => setSource(value as TApplicationSource)}>
									<SelectTrigger id='app-source' className='w-full'>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{APPLICATION_SOURCES.map((value) => (
											<SelectItem key={value} value={value}>
												{t(`licensing:source.${value}`)}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</Field>
							<Field>
								<FieldLabel htmlFor='app-description' optional>{t('licensing:field.description')}</FieldLabel>
								<Textarea id='app-description' rows={3} maxLength={2000} value={description} onChange={(event) => setDescription(event.target.value)} />
							</Field>
						</FieldGroup>
						<DialogFooter>
							<Button type='button' variant='outline' onClick={() => setEditing(null)}>
								{t('common:action.cancel')}
							</Button>
							<Button type='submit' disabled={busy || !code.trim() || !name.trim()}>
								{t('common:action.save')}
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>
		</div>
	);
}
