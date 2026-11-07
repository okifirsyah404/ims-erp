import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@ims-erp/ui/components/table';
import { PaginationControls } from '@/components/pagination/pagination-controls';
import { toast } from '@/components/toast';
import {
	approvePayment,
	executePayment,
	paymentsQueryOptions,
	submitPayment,
	type TPayment,
	voidExecutedPayment,
	voidPayment,
} from '@/lib/finance-api';
import { usePermission } from '@/lib/use-permission';

const formatMoney = (minor: number) => (minor / 100).toLocaleString();

/** Workflow actions for one payment row (F4/F5/F7). */
function PaymentRowActions({ payment }: { payment: TPayment }) {
	const { t } = useTranslation(['finance', 'common']);
	const queryClient = useQueryClient();
	const canSubmit = usePermission('payment.submit');
	const canApprove = usePermission('payment.approve');

	const invalidate = () =>
		queryClient.invalidateQueries({ queryKey: ['payments'] });

	const act = useMutation({
		mutationFn: async (action: 'submit' | 'approve' | 'execute') => {
			if (action === 'submit') return submitPayment(payment.id);
			if (action === 'approve') return approvePayment(payment.id);
			return executePayment(payment.id);
		},
		onSuccess: async (_data, action) => {
			toast.success(
				action === 'submit'
					? t('finance:payments.submitted')
					: action === 'approve'
						? t('finance:payments.approved')
						: t('finance:payments.executed'),
			);
			await invalidate();
		},
		onError: (mutationError: Error) => toast.error(mutationError.message),
	});

	const voidAct = useMutation({
		mutationFn: async (executed: boolean) => {
			const reason = window.prompt(t('finance:payments.voidPrompt'));
			if (!reason) return null;
			return executed
				? voidExecutedPayment(payment.id, reason)
				: voidPayment(payment.id, reason);
		},
		onSuccess: async (result, executed) => {
			if (result == null) return; // user cancelled the prompt
			toast.success(
				executed
					? t('finance:payments.voidExecutedDone')
					: t('finance:payments.voided'),
			);
			await invalidate();
		},
		onError: (mutationError: Error) => toast.error(mutationError.message),
	});

	const isExecuted = payment.status === 'executed';

	return (
		<span className='flex justify-end gap-1'>
			{payment.status === 'draft' && canSubmit ? (
				<Button
					size='sm'
					variant='outline'
					disabled={act.isPending}
					onClick={() => void act.mutateAsync('submit')}
				>
					{t('finance:payments.submit')}
				</Button>
			) : null}
			{payment.status === 'submitted' && canApprove ? (
				<Button
					size='sm'
					variant='outline'
					disabled={act.isPending}
					onClick={() => void act.mutateAsync('approve')}
				>
					{t('finance:payments.approve')}
				</Button>
			) : null}
			{payment.status === 'approved' && canApprove ? (
				<Button
					size='sm'
					disabled={act.isPending}
					onClick={() => void act.mutateAsync('execute')}
				>
					{t('finance:payments.execute')}
				</Button>
			) : null}
			{!isExecuted && payment.status !== 'void' && canApprove ? (
				<Button
					size='sm'
					variant='ghost'
					disabled={voidAct.isPending}
					onClick={() => void voidAct.mutateAsync(false)}
				>
					{t('finance:payments.void')}
				</Button>
			) : null}
			{isExecuted && canApprove ? (
				<Button
					size='sm'
					variant='ghost'
					disabled={voidAct.isPending}
					onClick={() => {
						if (window.confirm(t('finance:payments.voidExecutedConfirm'))) {
							void voidAct.mutateAsync(true);
						}
					}}
				>
					{t('finance:payments.voidExecuted')}
				</Button>
			) : null}
		</span>
	);
}

/**
 * Paginated payment list with workflow actions, filtered by type. Customer
 * payments render on Receivables, supplier payments on Payables.
 */
export function PaymentsTable({
	paymentType,
	title,
}: {
	paymentType: 'customer_payment' | 'supplier_payment';
	title: string;
}) {
	const { t } = useTranslation(['finance', 'common']);
	const canRead = usePermission('payment.read');
	const [page, setPage] = useState(1);

	const { data, isPending, isError, error } = useQuery({
		...paymentsQueryOptions({ page, limit: 20, paymentType }),
		placeholderData: (previous) => previous,
		enabled: canRead,
	});

	if (!canRead) return null;

	return (
		<div className='space-y-3'>
			<h2 className='pt-2 font-semibold'>{title}</h2>
			{isPending ? null : isError ? (
				<p className='text-muted-foreground text-sm'>{error.message}</p>
			) : (data?.rows.length ?? 0) === 0 ? (
				<p className='text-muted-foreground text-sm'>
					{t('finance:payments.empty')}
				</p>
			) : (
				<>
					<div className='overflow-x-auto rounded-md border'>
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>{t('finance:common.code')}</TableHead>
									<TableHead>{t('finance:common.date')}</TableHead>
									<TableHead className='text-right'>
										{t('finance:common.amount')}
									</TableHead>
									<TableHead>{t('finance:payments.method')}</TableHead>
									<TableHead>{t('finance:common.status')}</TableHead>
									<TableHead className='text-right'>
										{t('finance:common.actions')}
									</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{data?.rows.map((payment) => (
									<TableRow key={payment.id}>
										<TableCell className='font-mono text-xs'>
											{payment.code}
										</TableCell>
										<TableCell>{payment.paymentDate}</TableCell>
										<TableCell className='text-right'>
											{formatMoney(payment.amount)}
										</TableCell>
										<TableCell>
											{t(
												`finance:payments.method.${payment.paymentMethod}` as never,
											)}
										</TableCell>
										<TableCell>
											<Badge
												variant={
													payment.status === 'executed'
														? 'secondary'
														: payment.status === 'void'
															? 'outline'
															: 'destructive'
												}
											>
												{t(`finance:payments.status.${payment.status}`)}
											</Badge>
										</TableCell>
										<TableCell className='text-right'>
											<PaymentRowActions payment={payment} />
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</div>
					<PaginationControls
						page={page}
						totalPages={data?.pagination.totalPages ?? 1}
						onPageChange={setPage}
					/>
				</>
			)}
		</div>
	);
}
