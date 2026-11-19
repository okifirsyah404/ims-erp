import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import { Card, CardContent, CardHeader, CardTitle } from '@ims-erp/ui/components/card';
import { DatePicker } from '@ims-erp/ui/components/date-picker';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@ims-erp/ui/components/dialog';
import { Field, FieldGroup, FieldLabel } from '@ims-erp/ui/components/field';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@ims-erp/ui/components/select';
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@ims-erp/ui/components/table';
import { Textarea } from '@ims-erp/ui/components/textarea';
import { toast } from '@/components/toast';
import { authClient } from '@/lib/auth-client';
import { formatBusinessDate, formatIdr, todayBusinessDate } from '@/lib/format';
import {
	cancelSalesReturn,
	decideSalesReturn,
	receiveSalesReturn,
	SALES_RETURN_STATUS_VARIANT,
	salesReturnQueryOptions,
	submitSalesReturn,
	type TSalesReturnCondition,
} from '@/lib/sales-return-api';
import { usePermission } from '@/lib/use-permission';

/** `/sales/returns/$salesReturnId` — one customer return: approval and receiving (ERP-0065). */
export const Route = createFileRoute('/_authed/sales/returns/$salesReturnId/')({
	component: SalesReturnDetailPage,
});

function Detail({ label, value }: { label: string; value: string | null | undefined }) {
	return (
		<div>
			<div className='text-muted-foreground'>{label}</div>
			<div className='whitespace-pre-line'>{value || '—'}</div>
		</div>
	);
}

type TLineChoice = { condition: TSalesReturnCondition; binId: string };

function SalesReturnDetailPage() {
	const { t, i18n } = useTranslation(['sales', 'common']);
	const { salesReturnId } = Route.useParams();
	const queryClient = useQueryClient();
	const { data: session } = authClient.useSession();
	const canUpdate = usePermission('sales_return.update');
	const canSubmit = usePermission('sales_return.submit');
	const canApprove = usePermission('sales_return.approve');
	const canReceive = usePermission('sales_return.receive');
	const canCancel = usePermission('sales_return.cancel');
	const canSeeCost = usePermission('product.read_cost');
	const [dialog, setDialog] = useState<'reject' | 'cancel' | 'receive' | null>(null);
	const [reason, setReason] = useState('');
	const [receivedDate, setReceivedDate] = useState(todayBusinessDate());
	const [choices, setChoices] = useState<Record<string, TLineChoice>>({});
	const [busy, setBusy] = useState(false);
	const { data, isPending, isError, error } = useQuery(salesReturnQueryOptions(salesReturnId));
	const language = i18n.language === 'en' ? 'en-GB' : 'id-ID';

	async function run(action: () => Promise<unknown>, message: string) {
		setBusy(true);
		try {
			await action();
			await queryClient.invalidateQueries({ queryKey: ['sales'] });
			toast.success(message);
			setDialog(null);
			setReason('');
		} catch (cause) {
			toast.error(cause instanceof Error ? cause.message : t('common:error.failed'));
		} finally {
			setBusy(false);
		}
	}

	if (isPending) return null;
	if (isError) return <p className='text-sm text-destructive'>{error.message}</p>;

	const own = data.createdBy === session?.user.id;
	const cancellable = ['draft', 'submitted', 'approved'].includes(data.status);
	const storages = data.warehouse?.storages ?? [];
	const choice = (id: string): TLineChoice => choices[id] ?? { condition: 'good', binId: '' };
	const setChoice = (id: string, patch: Partial<TLineChoice>) => setChoices((current) => ({ ...current, [id]: { ...choice(id), ...patch } }));
	const binCode = (id: string | null) => storages.find((storage) => storage.id === id)?.code ?? null;

	return (
		<div className='flex flex-col gap-6'>
			<Link to='/sales/returns' className='text-sm text-muted-foreground hover:underline'>
				{t('sales:returns.back')}
			</Link>
			<div className='flex flex-wrap items-start justify-between gap-4'>
				<div>
					<h1 className='text-2xl font-bold'>{data.code ?? t('sales:return.noNumber')}</h1>
					<p className='text-sm text-muted-foreground'>{data.reason}</p>
					<Badge className='mt-2' variant={SALES_RETURN_STATUS_VARIANT[data.status]}>
						{t(`sales:returnStatus.${data.status}`)}
					</Badge>
				</div>
				<div className='flex flex-wrap gap-2'>
					{data.status === 'draft' && canUpdate && (
						<Button
							variant='outline'
							render={<Link to='/sales/returns/$salesReturnId/edit' params={{ salesReturnId }} />}
							nativeButton={false}
						>
							{t('common:action.edit')}
						</Button>
					)}
					{data.status === 'draft' && canSubmit && (
						<Button disabled={busy} onClick={() => void run(() => submitSalesReturn(salesReturnId), t('sales:returns.submitted'))}>
							{t('sales:returns.submit')}
						</Button>
					)}
					{data.status === 'submitted' && canApprove && !own && (
						<>
							<Button disabled={busy} onClick={() => void run(() => decideSalesReturn(salesReturnId, 'approve'), t('sales:returns.approved'))}>
								{t('sales:returns.approve')}
							</Button>
							<Button variant='outline' disabled={busy} onClick={() => setDialog('reject')}>
								{t('sales:returns.reject')}
							</Button>
						</>
					)}
					{data.status === 'approved' && canReceive && (
						<Button disabled={busy} onClick={() => setDialog('receive')}>
							{t('sales:returns.receive')}
						</Button>
					)}
					{cancellable && canCancel && (
						<Button variant='outline' disabled={busy} onClick={() => setDialog('cancel')}>
							{t('sales:returns.cancel')}
						</Button>
					)}
				</div>
			</div>
			{data.status === 'submitted' && canApprove && own && <p className='text-sm text-muted-foreground'>{t('sales:returns.ownNoApprove')}</p>}
			{data.status === 'draft' && data.rejectionReason && (
				<p className='text-sm text-destructive'>
					{t('sales:return.rejectionReason')}: {data.rejectionReason}
				</p>
			)}
			{data.status === 'cancelled' && data.cancelledReason && (
				<p className='text-sm text-muted-foreground'>
					{t('sales:return.cancelledReason')}: {data.cancelledReason}
				</p>
			)}
			{data.status === 'received' && <p className='text-sm text-muted-foreground'>{t('sales:returns.receivedHint')}</p>}

			<Card>
				<CardHeader>
					<CardTitle>{t('sales:returns.source')}</CardTitle>
				</CardHeader>
				<CardContent className='grid gap-3 text-sm sm:grid-cols-3'>
					<div>
						<div className='text-muted-foreground'>{t('sales:delivery.code')}</div>
						<Link to='/sales/deliveries/$deliveryNoteId' params={{ deliveryNoteId: data.deliveryNoteId }} className='hover:underline'>
							{data.deliveryNoteCode}
						</Link>
					</div>
					<div>
						<div className='text-muted-foreground'>{t('sales:return.order')}</div>
						<Link to='/sales/orders/$orderId' params={{ orderId: data.orderId }} className='hover:underline'>
							{data.orderCode}
						</Link>
					</div>
					<Detail label={t('sales:return.customer')} value={data.customerName} />
					<Detail label={t('sales:return.date')} value={formatBusinessDate(data.returnDate, i18n.language)} />
					<Detail label={t('sales:return.warehouse')} value={data.warehouse ? `${data.warehouse.code} — ${data.warehouse.name}` : null} />
				</CardContent>
			</Card>

			<Card>
				<CardContent className='p-0'>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>{t('sales:return.item')}</TableHead>
								<TableHead className='text-right'>{t('sales:return.quantity')}</TableHead>
								{canSeeCost && <TableHead className='text-right'>{t('sales:return.unitCost')}</TableHead>}
								<TableHead className='text-right'>{t('sales:return.lineTotal')}</TableHead>
								<TableHead>{t('sales:return.serialNumbers')}</TableHead>
								<TableHead>{t('sales:return.condition')}</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{data.items.map((item) => (
								<TableRow key={item.id}>
									<TableCell>
										<div className='font-medium'>{item.name}</div>
										<div className='text-xs text-muted-foreground'>{item.sku}</div>
									</TableCell>
									<TableCell className='text-right'>
										{Number(item.quantity).toLocaleString(language)} {item.unit}
									</TableCell>
									{canSeeCost && <TableCell className='text-right'>{formatIdr(item.unitCost)}</TableCell>}
									<TableCell className='text-right'>{formatIdr(item.lineTotal)}</TableCell>
									<TableCell className='text-sm'>{item.serialNumbers?.join(', ') ?? '—'}</TableCell>
									<TableCell className='text-sm'>
										{item.condition ? t(`sales:returnCondition.${item.condition}`) : '—'}
										{item.binId ? ` · ${binCode(item.binId) ?? ''}` : ''}
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
					<dl className='ml-auto flex max-w-sm flex-col gap-1 p-4 text-sm'>
						<div className='flex justify-between border-t pt-1 text-base font-bold'>
							<dt>{t('sales:return.total')}</dt>
							<dd>{formatIdr(data.totalAmount)}</dd>
						</div>
					</dl>
				</CardContent>
			</Card>
			{data.notes && <p className='text-sm text-muted-foreground'>{data.notes}</p>}

			<Dialog open={dialog !== null} onOpenChange={(open) => !open && setDialog(null)}>
				<DialogContent className={dialog === 'receive' ? 'sm:max-w-2xl' : undefined}>
					<form
						onSubmit={(event) => {
							event.preventDefault();
							if (dialog === 'receive') {
								void run(
									() =>
										receiveSalesReturn(salesReturnId, {
											receivedDate,
											lines: data.items.map((item) => ({
												salesReturnItemId: item.id,
												condition: choice(item.id).condition,
												binId: choice(item.id).binId || null,
											})),
										}),
									t('sales:returns.received'),
								);
								return;
							}
							void run(
								() =>
									dialog === 'reject'
										? decideSalesReturn(salesReturnId, 'reject', reason.trim())
										: cancelSalesReturn(salesReturnId, reason.trim()),
								dialog === 'reject' ? t('sales:returns.rejected') : t('sales:returns.cancelled'),
							);
						}}
					>
						<DialogHeader>
							<DialogTitle>
								{dialog === 'receive' ? t('sales:returns.receive') : dialog === 'reject' ? t('sales:returns.reject') : t('sales:returns.cancel')}
							</DialogTitle>
							{dialog === 'receive' && <DialogDescription>{t('sales:returns.receiveHint')}</DialogDescription>}
						</DialogHeader>
						<FieldGroup className='py-4'>
							{dialog === 'receive' ? (
								<>
									<Field>
										<FieldLabel htmlFor='srt-received-date'>{t('sales:returns.receivedDate')}</FieldLabel>
										<DatePicker id='srt-received-date' required value={receivedDate} onChange={setReceivedDate} />
									</Field>
									{data.items.map((item) => (
										<div key={item.id} className='grid gap-3 rounded-md border p-3 sm:grid-cols-2'>
											<div className='text-sm sm:col-span-2'>
												<span className='font-medium'>{item.name}</span>
												<span className='text-muted-foreground'>
													{' '}
													· {Number(item.quantity).toLocaleString(language)} {item.unit}
													{item.serialNumbers?.length ? ` · ${item.serialNumbers.join(', ')}` : ''}
												</span>
											</div>
											<Field>
												<FieldLabel htmlFor={`srt-condition-${item.id}`}>{t('sales:return.condition')}</FieldLabel>
												<Select
													value={choice(item.id).condition}
													onValueChange={(value: string | null) => setChoice(item.id, { condition: value === 'damaged' ? 'damaged' : 'good' })}
												>
													<SelectTrigger id={`srt-condition-${item.id}`} className='w-full'>
														<SelectValue />
													</SelectTrigger>
													<SelectContent>
														<SelectItem value='good'>{t('sales:returnCondition.good')}</SelectItem>
														<SelectItem value='damaged'>{t('sales:returnCondition.damaged')}</SelectItem>
													</SelectContent>
												</Select>
											</Field>
											<Field>
												<FieldLabel htmlFor={`srt-bin-${item.id}`}>{t('sales:return.bin')}</FieldLabel>
												<Select
													value={choice(item.id).binId || 'none'}
													onValueChange={(value: string | null) => setChoice(item.id, { binId: value === 'none' || value == null ? '' : value })}
												>
													<SelectTrigger id={`srt-bin-${item.id}`} className='w-full'>
														<SelectValue />
													</SelectTrigger>
													<SelectContent>
														<SelectItem value='none'>{t('sales:returns.noBin')}</SelectItem>
														{storages.map((storage) => (
															<SelectItem key={storage.id} value={storage.id}>
																{storage.code}
																{storage.name ? ` — ${storage.name}` : ''}
															</SelectItem>
														))}
													</SelectContent>
												</Select>
											</Field>
										</div>
									))}
								</>
							) : (
								<Field>
									<FieldLabel htmlFor='srt-dialog-reason'>{t('sales:return.decisionReason')}</FieldLabel>
									<Textarea id='srt-dialog-reason' required maxLength={1000} value={reason} onChange={(event) => setReason(event.target.value)} />
								</Field>
							)}
						</FieldGroup>
						<DialogFooter>
							<Button type='button' variant='outline' onClick={() => setDialog(null)}>
								{t('common:action.cancel')}
							</Button>
							<Button type='submit' disabled={busy || (dialog !== 'receive' && reason.trim() === '')}>
								{dialog === 'receive' ? t('sales:returns.receive') : t('common:action.save')}
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>
		</div>
	);
}
