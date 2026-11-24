import { MoneyInput } from '@/components/money-input';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import { Card, CardContent, CardHeader, CardTitle } from '@ims-erp/ui/components/card';
import { DatePicker } from '@ims-erp/ui/components/date-picker';
import { Dialog, DialogFooter, DialogHeader, DialogTitle } from '@ims-erp/ui/components/dialog';
import { Field } from '@ims-erp/ui/components/field';
import { Textarea } from '@ims-erp/ui/components/textarea';
import { FieldLabel } from '@/components/form/field-label';
import { ScrollDialogContent } from '@/components/scroll-dialog-content';
import { useConfirm } from '@/components/confirm-dialog';
import { toast } from '@/components/toast';
import {
	applyCreditMemo,
	approveWriteOff,
	cancelWriteOff,
	createCreditMemo,
	creditMemosQueryOptions,
	requestWriteOff,
	toMinor,
	voidCreditMemo,
	writeOffRequestsQueryOptions,
} from '@/lib/finance-api';
import { usePermission } from '@/lib/use-permission';
import { useSession } from '@/lib/auth-client';
import { ReasonDialog } from './reason-dialog';

const today = () => new Date().toISOString().slice(0, 10);
const money = (minor: number) => (minor / 100).toLocaleString();

/**
 * Credit memos and the write-off request of one issued invoice (ERP-0135).
 * Every rule (open amount, maker-checker) is enforced by the server.
 */
export function ReceivableAdjustmentsCard({
	invoiceId,
	outstandingTotal,
	open,
}: {
	invoiceId: string;
	outstandingTotal: number;
	/** True while the invoice is issued or partially paid. */
	open: boolean;
}) {
	const { t } = useTranslation(['finance', 'common']);
	const confirm = useConfirm();
	const queryClient = useQueryClient();
	const session = useSession();
	const canReadMemos = usePermission('credit_memo.read');
	const canCreateMemo = usePermission('credit_memo.create');
	const canApplyMemo = usePermission('credit_memo.apply');
	const canVoidMemo = usePermission('credit_memo.void');
	const canRequestWriteOff = usePermission('ar_write_off.request');
	const canApproveWriteOff = usePermission('ar_write_off.approve');
	const canReadWriteOffs = usePermission('ar_write_off.read');
	const [dialog, setDialog] = useState<'memo' | 'writeOff' | { voidMemo: string } | null>(null);
	const [amount, setAmount] = useState('');
	const [memoDate, setMemoDate] = useState(today());
	const [reason, setReason] = useState('');

	const { data: memos } = useQuery({
		...creditMemosQueryOptions({ page: 1, limit: 50, invoiceId }),
		enabled: canReadMemos,
	});
	const { data: requests } = useQuery({
		...writeOffRequestsQueryOptions(),
		enabled: canReadWriteOffs,
	});
	const request = requests?.find((item) => item.invoiceId === invoiceId) ?? null;

	const refresh = () => {
		void queryClient.invalidateQueries({ queryKey: ['credit-memos'] });
		void queryClient.invalidateQueries({ queryKey: ['write-offs'] });
		void queryClient.invalidateQueries({ queryKey: ['invoice'] });
		void queryClient.invalidateQueries({ queryKey: ['invoices'] });
	};
	const action = useMutation({
		mutationFn: (work: () => Promise<unknown>) => work(),
		onSuccess: () => {
			setDialog(null);
			refresh();
		},
		onError: (e: Error) => toast.error(e.message),
	});

	if (!canReadMemos && !canRequestWriteOff && !canApproveWriteOff) return null;

	return (
		<Card>
			<CardHeader className='flex flex-row flex-wrap items-center justify-between gap-2'>
				<CardTitle>{t('finance:adjustments.title')}</CardTitle>
				<div className='flex flex-wrap gap-2'>
					{open && canCreateMemo ? (
						<Button
							size='sm'
							variant='outline'
							onClick={() => {
								setAmount('');
								setReason('');
								setDialog('memo');
							}}
						>
							{t('finance:adjustments.newCreditMemo')}
						</Button>
					) : null}
					{open && canRequestWriteOff && !request ? (
						<Button size='sm' variant='outline' onClick={() => setDialog('writeOff')}>
							{t('finance:adjustments.requestWriteOff')}
						</Button>
					) : null}
				</div>
			</CardHeader>
			<CardContent className='space-y-3 text-sm'>
				{request ? (
					<div className='flex flex-wrap items-center justify-between gap-2 rounded-md border p-3'>
						<div>
							<div className='font-medium'>{t('finance:adjustments.writeOffPending')}</div>
							<div className='text-muted-foreground'>
								{money(request.outstandingAmount)} · {request.writeOffReason}
							</div>
						</div>
						<div className='flex gap-2'>
							{canRequestWriteOff ? (
								<Button size='sm' variant='ghost' disabled={action.isPending} onClick={() => action.mutate(() => cancelWriteOff(invoiceId))}>
									{t('finance:adjustments.cancelWriteOff')}
								</Button>
							) : null}
							{canApproveWriteOff && request.writeOffRequestedBy !== session.data?.user.id ? (
								<Button
									size='sm'
									variant='destructive'
									disabled={action.isPending}
									onClick={async () => {
										if (await confirm({ title: t('finance:adjustments.approveWriteOffConfirm'), destructive: true })) {
											action.mutate(async () => {
												await approveWriteOff(invoiceId);
												toast.success(t('finance:adjustments.writtenOff'));
											});
										}
									}}
								>
									{t('finance:adjustments.approveWriteOff')}
								</Button>
							) : null}
						</div>
					</div>
				) : null}
				{(memos?.rows.length ?? 0) === 0 ? (
					<p className='text-muted-foreground'>{t('finance:adjustments.noCreditMemos')}</p>
				) : (
					<div className='space-y-2'>
						{memos?.rows.map((memo) => (
							<div key={memo.id} className='flex flex-wrap items-center justify-between gap-2 border-b pb-2 last:border-0'>
								<div>
									<span className='font-mono text-xs'>{memo.code}</span> · {money(memo.amount)} · {memo.reason}
									<Badge className='ml-2' variant={memo.status === 'applied' ? 'secondary' : 'outline'}>
										{t(`finance:adjustments.memoStatus.${memo.status}`)}
									</Badge>
								</div>
								<div className='flex gap-2'>
									{memo.status === 'draft' && canApplyMemo ? (
										<Button
											size='sm'
											disabled={action.isPending}
											onClick={() =>
												action.mutate(async () => {
													await applyCreditMemo(memo.id);
													toast.success(t('finance:adjustments.applied'));
												})
											}
										>
											{t('finance:adjustments.apply')}
										</Button>
									) : null}
									{(memo.status === 'draft' || memo.status === 'applied') && canVoidMemo ? (
										<Button size='sm' variant='ghost' disabled={action.isPending} onClick={() => setDialog({ voidMemo: memo.id })}>
											{t('finance:adjustments.voidMemo')}
										</Button>
									) : null}
								</div>
							</div>
						))}
					</div>
				)}
			</CardContent>

			{dialog === 'memo' ? (
				<Dialog open onOpenChange={(value) => !value && setDialog(null)}>
					<ScrollDialogContent className='sm:max-w-lg'>
						<form
							className='flex flex-col gap-4'
							onSubmit={(event) => {
								event.preventDefault();
								action.mutate(async () => {
									await createCreditMemo({ invoiceId, memoDate, amount: toMinor(amount), reason: reason.trim() });
									toast.success(t('finance:adjustments.created'));
								});
							}}
						>
							<DialogHeader>
								<DialogTitle>{t('finance:adjustments.newCreditMemo')}</DialogTitle>
							</DialogHeader>
							<p className='text-muted-foreground text-sm'>
								{t('finance:adjustments.openAmount')}: {money(outstandingTotal)}
							</p>
							<Field>
								<FieldLabel htmlFor='memo-date'>{t('finance:common.date')}</FieldLabel>
								<DatePicker value={memoDate} onChange={setMemoDate} />
							</Field>
							<Field>
								<FieldLabel htmlFor='memo-amount'>{t('finance:common.amount')}</FieldLabel>
								<MoneyInput value={amount} onValueChange={setAmount} />
							</Field>
							<Field>
								<FieldLabel htmlFor='memo-reason'>{t('finance:journal.reason')}</FieldLabel>
								<Textarea id='memo-reason' value={reason} onChange={(event) => setReason(event.target.value)} />
							</Field>
							<DialogFooter>
								<Button type='button' variant='outline' onClick={() => setDialog(null)}>
									{t('common:action.cancel')}
								</Button>
								<Button
									type='submit'
									disabled={action.isPending || toMinor(amount) <= 0 || toMinor(amount) > outstandingTotal || !reason.trim()}
								>
									{t('common:action.save')}
								</Button>
							</DialogFooter>
						</form>
					</ScrollDialogContent>
				</Dialog>
			) : null}
			{dialog === 'writeOff' ? (
				<ReasonDialog
					title={t('finance:adjustments.requestWriteOff')}
					description={t('finance:adjustments.writeOffHint')}
					confirmLabel={t('finance:adjustments.requestWriteOff')}
					submitting={action.isPending}
					onClose={() => setDialog(null)}
					onConfirm={(value) =>
						action.mutate(async () => {
							await requestWriteOff(invoiceId, value);
							toast.success(t('finance:adjustments.writeOffRequested'));
						})
					}
				/>
			) : null}
			{dialog && typeof dialog === 'object' ? (
				<ReasonDialog
					title={t('finance:adjustments.voidMemo')}
					confirmLabel={t('finance:adjustments.voidMemo')}
					submitting={action.isPending}
					onClose={() => setDialog(null)}
					onConfirm={(value) => action.mutate(() => voidCreditMemo(dialog.voidMemo, value))}
				/>
			) : null}
		</Card>
	);
}
