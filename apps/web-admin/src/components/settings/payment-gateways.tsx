import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import { Checkbox } from '@ims-erp/ui/components/checkbox';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@ims-erp/ui/components/dialog';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@ims-erp/ui/components/field';
import { Input } from '@ims-erp/ui/components/input';
import { NativeSelect, NativeSelectOption } from '@ims-erp/ui/components/native-select';
import type { CellData, ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/data-table/data-table';
import { DataTableCard } from '@/components/data-table/data-table-card';
import { ErrorState } from '@/components/empty-state';
import { SectionSkeleton } from '@/components/page-skeleton';
import type { DataTableFeatures } from '@/components/data-table/data-table-features';
import { RowActions } from '@/components/data-table/row-actions';
import { Pencil, Star } from 'lucide-react';
import { toast } from '@/components/toast';
import {
	createGateway,
	GATEWAY_MODES,
	GATEWAY_PROVIDERS,
	gatewaysQueryOptions,
	setDefaultGateway,
	updateGateway,
	type TGateway,
	type TGatewayMode,
	type TGatewayProvider,
} from '@/lib/payment-api';

/**
 * The configured payment gateways. Secrets are write-only: the list shows only
 * whether one is loaded (and its last four characters), and the dialogs use
 * password inputs that are never pre-filled.
 */
export function PaymentGatewaysPanel({ canEdit }: { canEdit: boolean }) {
	const { t } = useTranslation(['settings', 'common']);
	const queryClient = useQueryClient();
	const { data = [], isPending, isError, error } = useQuery(gatewaysQueryOptions());
	const [dialog, setDialog] = useState<{ gateway: TGateway | null } | null>(null);
	const refresh = () => queryClient.invalidateQueries({ queryKey: gatewaysQueryOptions().queryKey });

	async function makeDefault(gateway: TGateway) {
		try {
			await setDefaultGateway(gateway.id);
			await refresh();
			toast.success(t('settings:paymentGateways.defaultSet'));
		} catch (cause) {
			toast.error(cause instanceof Error ? cause.message : t('common:error.failed'));
		}
	}

	const columns = useMemo<ColumnDef<DataTableFeatures, TGateway, CellData>[]>(() => {
		const base: ColumnDef<DataTableFeatures, TGateway, CellData>[] = [
			{
				id: 'name',
				header: t('settings:paymentGateways.name'),
				cell: ({ row }) => (
					<>
						<div className='font-medium'>{row.original.name}</div>
						<div className='font-mono text-xs text-muted-foreground'>{row.original.code}</div>
					</>
				),
			},
			{
				accessorKey: 'provider',
				header: t('settings:paymentGateways.provider'),
				meta: { cellClassName: 'font-mono text-xs' },
			},
			{
				id: 'mode',
				header: t('settings:paymentGateways.mode'),
				cell: ({ row }) =>
					row.original.mode === 'live'
						? t('settings:paymentGateways.modeLive')
						: t('settings:paymentGateways.modeSandbox'),
			},
			{
				id: 'status',
				header: t('settings:paymentGateways.status'),
				cell: ({ row }) => (
					<div className='flex flex-wrap gap-1'>
						<Badge variant={row.original.isActive ? 'default' : 'secondary'}>
							{row.original.isActive ? t('common:status.active') : t('common:status.inactive')}
						</Badge>
						{row.original.isDefault && (
							<Badge variant='outline'>{t('settings:paymentGateways.defaultBadge')}</Badge>
						)}
					</div>
				),
			},
			{
				id: 'secret',
				header: t('settings:paymentGateways.secret'),
				cell: ({ row }) =>
					row.original.hasSecret
						? row.original.secretLast4
							? t('settings:paymentGateways.configuredLast4', { last4: row.original.secretLast4 })
							: t('settings:paymentGateways.configured')
						: t('settings:paymentGateways.notConfigured'),
			},
			{
				id: 'webhookToken',
				header: t('settings:paymentGateways.webhookToken'),
				cell: ({ row }) =>
					row.original.hasWebhookToken
						? t('settings:paymentGateways.configured')
						: t('settings:paymentGateways.notConfigured'),
			},
			{
				id: 'rotatedAt',
				header: t('settings:paymentGateways.rotatedAt'),
				cell: ({ row }) =>
					row.original.rotatedAt
						? new Date(row.original.rotatedAt).toLocaleString()
						: t('settings:paymentGateways.neverRotated'),
			},
		];
		if (!canEdit) return base;
		return [
			...base,
			{
				id: 'actions',
				header: () => <span className='sr-only'>{t('common:action.actions')}</span>,
				meta: { align: 'right' },
				cell: ({ row }) => (
					<RowActions
						label={t('common:action.actions')}
						actions={[
							{
								key: 'default',
								label: t('settings:paymentGateways.makeDefault'),
								icon: Star,
								hidden: row.original.isDefault || !row.original.isActive,
								onSelect: () => void makeDefault(row.original),
							},
							{
								key: 'edit',
								label: t('common:action.edit'),
								icon: Pencil,
								onSelect: () => setDialog({ gateway: row.original }),
							},
						]}
					/>
				),
			},
		];
		// makeDefault only closes over t/refresh, which are stable per render of t.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [canEdit, t]);

	if (isPending) return <SectionSkeleton lines={5} />;
	if (isError) return <ErrorState error={error} bordered />;

	return (
		<div className='flex flex-col gap-4'>
			{canEdit && (
				<div>
					<Button onClick={() => setDialog({ gateway: null })}>{t('settings:paymentGateways.add')}</Button>
				</div>
			)}
			<DataTableCard title={t('settings:paymentGateways.title')}>
				{data.length === 0 ? (
					<p className='text-sm text-muted-foreground'>{t('settings:paymentGateways.empty')}</p>
				) : (
					<DataTable columns={columns} data={data} getRowId={(row) => row.id} sortable />
				)}
			</DataTableCard>
			{dialog && (
				<GatewayDialog
					gateway={dialog.gateway}
					onClose={() => setDialog(null)}
					onSaved={() => {
						setDialog(null);
						void refresh();
						toast.success(t('settings:paymentGateways.saved'));
					}}
				/>
			)}
		</div>
	);
}

function GatewayDialog({
	gateway,
	onClose,
	onSaved,
}: {
	gateway: TGateway | null;
	onClose: () => void;
	onSaved: () => void;
}) {
	const { t } = useTranslation(['settings', 'common']);
	const isNew = gateway === null;
	const [provider, setProvider] = useState<TGatewayProvider>(gateway?.provider ?? 'xendit');
	const [code, setCode] = useState(gateway?.code ?? '');
	const [name, setName] = useState(gateway?.name ?? '');
	const [mode, setMode] = useState<TGatewayMode>(gateway?.mode ?? 'sandbox');
	const [isActive, setIsActive] = useState(gateway?.isActive ?? true);
	// Secrets start empty and are never filled from the server.
	const [secret, setSecret] = useState('');
	const [webhookToken, setWebhookToken] = useState('');
	const [submitting, setSubmitting] = useState(false);

	async function submit(event: React.FormEvent) {
		event.preventDefault();
		setSubmitting(true);
		try {
			const secrets = {
				...(secret ? { secret } : {}),
				...(webhookToken ? { webhookToken } : {}),
			};
			if (gateway) {
				await updateGateway(gateway.id, { name, mode, isActive, ...secrets });
			} else {
				await createGateway({ provider, code, name, mode, isActive, ...secrets });
			}
			onSaved();
		} catch (cause) {
			toast.error(cause instanceof Error ? cause.message : t('common:error.failed'));
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<DialogContent className='sm:max-w-lg'>
				<form onSubmit={(event) => void submit(event)}>
					<DialogHeader>
						<DialogTitle>
							{isNew
								? t('settings:paymentGateways.createTitle')
								: t('settings:paymentGateways.editTitle', { name: gateway.name })}
						</DialogTitle>
						<DialogDescription>{t('settings:paymentGateways.dialogDescription')}</DialogDescription>
					</DialogHeader>
					<FieldGroup className='py-4'>
						{isNew && (
							<>
								<Field>
									<FieldLabel htmlFor='gateway-provider'>{t('settings:paymentGateways.provider')}</FieldLabel>
									<NativeSelect
										id='gateway-provider'
										className='w-full'
										value={provider}
										onChange={(event) => setProvider(event.target.value as TGatewayProvider)}
									>
										{GATEWAY_PROVIDERS.map((value) => (
											<NativeSelectOption key={value} value={value}>
												{value}
											</NativeSelectOption>
										))}
									</NativeSelect>
								</Field>
								<Field>
									<FieldLabel htmlFor='gateway-code'>{t('settings:paymentGateways.code')}</FieldLabel>
									<Input
										id='gateway-code'
										className='font-mono'
										required
										minLength={2}
										maxLength={32}
										pattern='[A-Za-z0-9_\-]+'
										value={code}
										onChange={(event) => setCode(event.target.value)}
									/>
									<FieldDescription>{t('settings:paymentGateways.codeHint')}</FieldDescription>
								</Field>
							</>
						)}
						<Field>
							<FieldLabel htmlFor='gateway-name'>{t('settings:paymentGateways.name')}</FieldLabel>
							<Input
								id='gateway-name'
								required
								minLength={2}
								maxLength={120}
								value={name}
								onChange={(event) => setName(event.target.value)}
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor='gateway-mode'>{t('settings:paymentGateways.mode')}</FieldLabel>
							<NativeSelect
								id='gateway-mode'
								className='w-full'
								value={mode}
								onChange={(event) => setMode(event.target.value as TGatewayMode)}
							>
								{GATEWAY_MODES.map((value) => (
									<NativeSelectOption key={value} value={value}>
										{value === 'live'
											? t('settings:paymentGateways.modeLive')
											: t('settings:paymentGateways.modeSandbox')}
									</NativeSelectOption>
								))}
							</NativeSelect>
						</Field>
						<Field orientation='horizontal'>
							<Checkbox
								id='gateway-active'
								checked={isActive}
								onCheckedChange={(checked) => setIsActive(checked === true)}
							/>
							<FieldLabel htmlFor='gateway-active'>{t('common:status.active')}</FieldLabel>
						</Field>
						<Field>
							<FieldLabel htmlFor='gateway-secret'>{t('settings:paymentGateways.secret')}</FieldLabel>
							<Input
								id='gateway-secret'
								type='password'
								autoComplete='new-password'
								minLength={8}
								maxLength={512}
								value={secret}
								onChange={(event) => setSecret(event.target.value)}
							/>
							<FieldDescription>
								{isNew
									? t('settings:paymentGateways.secretHintNew')
									: t('settings:paymentGateways.secretHintRotate')}
							</FieldDescription>
						</Field>
						<Field>
							<FieldLabel htmlFor='gateway-webhook-token'>{t('settings:paymentGateways.webhookToken')}</FieldLabel>
							<Input
								id='gateway-webhook-token'
								type='password'
								autoComplete='new-password'
								minLength={8}
								maxLength={512}
								value={webhookToken}
								onChange={(event) => setWebhookToken(event.target.value)}
							/>
							<FieldDescription>
								{isNew
									? t('settings:paymentGateways.secretHintNew')
									: t('settings:paymentGateways.secretHintRotate')}
							</FieldDescription>
						</Field>
					</FieldGroup>
					<DialogFooter>
						<Button type='button' variant='outline' onClick={onClose}>
							{t('common:action.cancel')}
						</Button>
						<Button type='submit' disabled={submitting}>
							{submitting ? t('common:action.saving') : t('common:action.save')}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
