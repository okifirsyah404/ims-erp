import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import { Checkbox } from '@ims-erp/ui/components/checkbox';
import {
	Dialog,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@ims-erp/ui/components/dialog';
import { Field } from '@ims-erp/ui/components/field';
import { Input } from '@ims-erp/ui/components/input';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@ims-erp/ui/components/select';
import type { CellData, ColumnDef } from '@tanstack/react-table';
import { Archive, Pencil, Plus, Route as RouteIcon } from 'lucide-react';
import { RowActions } from '@/components/data-table/row-actions';
import { DataTable } from '@/components/data-table/data-table';
import { DataTableCard } from '@/components/data-table/data-table-card';
import type { DataTableFeatures } from '@/components/data-table/data-table-features';
import { EmptyState, ErrorState } from '@/components/empty-state';
import { useConfirm } from '@/components/confirm-dialog';
import { toast } from '@/components/toast';
import { FieldLabel } from '@/components/form/field-label';
import { ScrollDialogContent } from '@/components/scroll-dialog-content';
import {
	accountsQueryOptions,
	archivePostingRule,
	createPostingRule,
	POSTING_DISCRIMINATORS,
	POSTING_EVENT_TYPES,
	POSTING_ROLES,
	postingRulesQueryOptions,
	type TAccount,
	type TPostingDiscriminator,
	type TPostingEventType,
	type TPostingRole,
	type TPostingRule,
	updatePostingRule,
} from '@/lib/finance-api';
import { usePermission } from '@/lib/use-permission';

const NONE = 'none';

/**
 * Posting rules (ERP-0128): the account each business-event role posts to.
 * The server resolves the most specific active rule; this page lists them,
 * remaps an account, adds refinements and archives rules.
 */
export function PostingRulesPage() {
	const { t } = useTranslation(['finance', 'common']);
	const confirm = useConfirm();
	const queryClient = useQueryClient();
	const canRead = usePermission('posting_rule.read');
	const canUpdate = usePermission('posting_rule.update');
	const [showInactive, setShowInactive] = useState(false);
	const [dialog, setDialog] = useState<{ rule: TPostingRule | null } | null>(null);

	const { data, isPending, isError, error } = useQuery({
		...postingRulesQueryOptions({ includeInactive: showInactive }),
		enabled: canRead,
	});
	const { data: accounts } = useQuery({ ...accountsQueryOptions({ page: 1, limit: 100 }), enabled: canRead });
	const accountById = useMemo(() => new Map((accounts?.rows ?? []).map((a) => [a.id, a])), [accounts]);

	const invalidate = () => void queryClient.invalidateQueries({ queryKey: ['posting-rules'] });
	const archive = useMutation({
		mutationFn: (id: string) => archivePostingRule(id),
		onSuccess: () => {
			toast.success(t('finance:postingRules.archived'));
			invalidate();
		},
		onError: (e: Error) => toast.error(e.message),
	});

	const columns = useMemo<ColumnDef<DataTableFeatures, TPostingRule, CellData>[]>(() => {
		const base: ColumnDef<DataTableFeatures, TPostingRule, CellData>[] = [
			{
				id: 'role',
				header: t('finance:postingRules.role'),
				cell: ({ row }) => t(`finance:postingRules.role.${row.original.role}`),
			},
			{
				id: 'event',
				header: t('finance:postingRules.eventType'),
				cell: ({ row }) => t(`finance:postingRules.event.${row.original.eventType}`),
			},
			{
				id: 'discriminator',
				header: t('finance:postingRules.discriminator'),
				cell: ({ row }) =>
					row.original.discriminatorType === ''
						? t('finance:common.none')
						: `${t(`finance:postingRules.discriminator.${row.original.discriminatorType}`)}: ${row.original.discriminatorValue}`,
			},
			{
				id: 'account',
				header: t('finance:postingRules.account'),
				cell: ({ row }) => {
					const account = accountById.get(row.original.accountId);
					return (
						<div className='flex items-center gap-2'>
							<span className='font-mono text-xs'>
								{account ? `${account.code} — ${account.name}` : row.original.accountId}
							</span>
							{row.original.isActive ? null : <Badge variant='outline'>{t('finance:postingRules.inactive')}</Badge>}
						</div>
					);
				},
			},
		];
		if (!canUpdate) return base;
		return [
			...base,
			{
				id: 'actions',
				header: () => <span className='sr-only'>{t('finance:common.actions')}</span>,
				meta: { align: 'right' },
				cell: ({ row }) => (
					<RowActions
						label={t('finance:common.actions')}
						disabled={archive.isPending}
						actions={[
							{
								key: 'edit',
								label: t('finance:postingRules.edit'),
								icon: Pencil,
								onSelect: () => setDialog({ rule: row.original }),
							},
							{
								key: 'archive',
								label: t('finance:postingRules.archive'),
								icon: Archive,
								destructive: true,
								onSelect: async () => {
									if (await confirm({ title: t('finance:postingRules.archiveConfirm'), destructive: true })) {
										void archive.mutateAsync(row.original.id);
									}
								},
							},
						]}
					/>
				),
			},
		];
	}, [accountById, archive, canUpdate, confirm, t]);

	if (!canRead) {
		return <EmptyState icon={RouteIcon} title={t('finance:postingRules.title')} bordered />;
	}

	return (
		<div className='space-y-4'>
			<div className='flex items-start justify-between gap-4'>
				<div>
					<h1 className='text-xl font-semibold'>{t('finance:postingRules.title')}</h1>
					<p className='text-muted-foreground text-sm'>{t('finance:postingRules.description')}</p>
				</div>
				{canUpdate ? (
					<Button size='sm' onClick={() => setDialog({ rule: null })}>
						<Plus className='size-4' data-icon='inline-start' />
						{t('finance:postingRules.create')}
					</Button>
				) : null}
			</div>
			<div className='flex items-center gap-2'>
				<Checkbox
					id='posting-rules-inactive'
					checked={showInactive}
					onCheckedChange={(checked) => setShowInactive(checked === true)}
				/>
				<FieldLabel htmlFor='posting-rules-inactive'>{t('finance:postingRules.showInactive')}</FieldLabel>
			</div>
			<DataTableCard>
				{isError ? (
					<ErrorState error={error} />
				) : !isPending && (data?.length ?? 0) === 0 ? (
					<EmptyState icon={RouteIcon} title={t('finance:postingRules.empty')} />
				) : (
					<DataTable columns={columns} data={data ?? []} loading={isPending} getRowId={(row) => row.id} />
				)}
			</DataTableCard>
			{dialog ? (
				<PostingRuleDialog
					rule={dialog.rule}
					accounts={(accounts?.rows ?? []).filter((a) => a.isActive && a.isPostable)}
					onClose={() => setDialog(null)}
					onSaved={() => {
						setDialog(null);
						invalidate();
					}}
				/>
			) : null}
		</div>
	);
}

function PostingRuleDialog({
	rule,
	accounts,
	onClose,
	onSaved,
}: {
	rule: TPostingRule | null;
	accounts: TAccount[];
	onClose: () => void;
	onSaved: () => void;
}) {
	const { t } = useTranslation(['finance', 'common']);
	const [role, setRole] = useState<TPostingRole>(rule?.role ?? 'revenue');
	const [eventType, setEventType] = useState<TPostingEventType>(rule?.eventType ?? '*');
	const [discriminatorType, setDiscriminatorType] = useState<TPostingDiscriminator>(rule?.discriminatorType ?? '');
	const [discriminatorValue, setDiscriminatorValue] = useState(rule?.discriminatorValue ?? '');
	const [accountId, setAccountId] = useState(rule?.accountId ?? '');
	const [isActive, setIsActive] = useState(rule?.isActive ?? true);

	const save = useMutation({
		mutationFn: () =>
			rule
				? updatePostingRule(rule.id, { accountId, isActive })
				: createPostingRule({
						role,
						eventType,
						discriminatorType,
						discriminatorValue: discriminatorType === '' ? '' : discriminatorValue.trim(),
						accountId,
						description: null,
					}),
		onSuccess: () => {
			toast.success(t('finance:postingRules.saved'));
			onSaved();
		},
		onError: (e: Error) => toast.error(e.message),
	});

	const valid = accountId !== '' && (discriminatorType === '' || discriminatorValue.trim() !== '');

	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<ScrollDialogContent className='sm:max-w-lg'>
				<form
					className='flex flex-col gap-4'
					onSubmit={(event) => {
						event.preventDefault();
						if (valid) void save.mutateAsync();
					}}
				>
					<DialogHeader>
						<DialogTitle>{rule ? t('finance:postingRules.edit') : t('finance:postingRules.create')}</DialogTitle>
					</DialogHeader>
					<Field>
						<FieldLabel htmlFor='rule-role'>{t('finance:postingRules.role')}</FieldLabel>
						<Select value={role} disabled={rule != null} onValueChange={(v: string | null) => v && setRole(v as TPostingRole)}>
							<SelectTrigger id='rule-role'>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{POSTING_ROLES.map((value) => (
									<SelectItem key={value} value={value}>
										{t(`finance:postingRules.role.${value}`)}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</Field>
					<Field>
						<FieldLabel htmlFor='rule-event'>{t('finance:postingRules.eventType')}</FieldLabel>
						<Select
							value={eventType}
							disabled={rule != null}
							onValueChange={(v: string | null) => v && setEventType(v as TPostingEventType)}
						>
							<SelectTrigger id='rule-event'>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{POSTING_EVENT_TYPES.map((value) => (
									<SelectItem key={value} value={value}>
										{t(`finance:postingRules.event.${value}`)}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</Field>
					<div className='grid gap-3 sm:grid-cols-2'>
						<Field>
							<FieldLabel htmlFor='rule-disc'>{t('finance:postingRules.discriminator')}</FieldLabel>
							<Select
								value={discriminatorType === '' ? NONE : discriminatorType}
								disabled={rule != null}
								onValueChange={(v: string | null) =>
									setDiscriminatorType(v == null || v === NONE ? '' : (v as TPostingDiscriminator))
								}
							>
								<SelectTrigger id='rule-disc'>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{POSTING_DISCRIMINATORS.map((value) => (
										<SelectItem key={value || NONE} value={value || NONE}>
											{t(`finance:postingRules.discriminator.${value || 'none'}`)}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</Field>
						<Field>
							<FieldLabel htmlFor='rule-disc-value'>{t('finance:postingRules.discriminatorValue')}</FieldLabel>
							<Input
								id='rule-disc-value'
								value={discriminatorValue}
								disabled={rule != null || discriminatorType === ''}
								onChange={(event) => setDiscriminatorValue(event.target.value)}
							/>
						</Field>
					</div>
					<Field>
						<FieldLabel htmlFor='rule-account'>{t('finance:postingRules.account')}</FieldLabel>
						<Select value={accountId === '' ? NONE : accountId} onValueChange={(v: string | null) => setAccountId(v == null || v === NONE ? '' : v)}>
							<SelectTrigger id='rule-account'>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value={NONE}>{t('finance:postingRules.account')}</SelectItem>
								{accounts.map((account) => (
									<SelectItem key={account.id} value={account.id}>
										{account.code} — {account.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</Field>
					{rule ? (
						<Field orientation='horizontal'>
							<Checkbox id='rule-active' checked={isActive} onCheckedChange={(checked) => setIsActive(checked === true)} />
							<FieldLabel htmlFor='rule-active'>{t('finance:costCenters.active')}</FieldLabel>
						</Field>
					) : null}
					<DialogFooter>
						<Button type='button' variant='outline' onClick={onClose}>
							{t('common:action.cancel')}
						</Button>
						<Button type='submit' disabled={!valid || save.isPending}>
							{save.isPending ? t('common:action.saving') : t('common:action.save')}
						</Button>
					</DialogFooter>
				</form>
			</ScrollDialogContent>
		</Dialog>
	);
}
