import { MoneyInput } from '@/components/money-input';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import { Checkbox } from '@ims-erp/ui/components/checkbox';
import { DatePicker } from '@ims-erp/ui/components/date-picker';
import {
	Dialog,
	DialogDescription,
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
import { Plus, Trash2 } from 'lucide-react';
import { FieldLabel } from '@/components/form/field-label';
import { ScrollDialogContent } from '@/components/scroll-dialog-content';
import { toast } from '@/components/toast';
import {
	accountsQueryOptions,
	costCentersQueryOptions,
	createJournalDraft,
	toMinor,
} from '@/lib/finance-api';
import { usePermission } from '@/lib/use-permission';

const NONE = 'none';

type TDraftLine = {
	accountId: string;
	costCenterId: string;
	debit: string;
	credit: string;
};

const emptyLine = (): TDraftLine => ({
	accountId: '',
	costCenterId: '',
	debit: '',
	credit: '',
});

/**
 * Manual journal draft dialog (ERP-0129).
 *
 * @remarks
 * Only drafts are created here; submit/approve happen from the row actions, so
 * maker-checker stays a server-enforced fact. A line carries a debit or a
 * credit, never both, and the draft can only be saved when the two sides tie.
 */
export function JournalEntryDialog({ onClose }: { onClose: () => void }) {
	const { t } = useTranslation(['finance', 'common']);
	const queryClient = useQueryClient();
	const canReadCostCenters = usePermission('cost_center.read');

	const [entryDate, setEntryDate] = useState(() => new Date().toISOString().slice(0, 10));
	const [description, setDescription] = useState('');
	const [isAdjusting, setIsAdjusting] = useState(false);
	const [lines, setLines] = useState<TDraftLine[]>([emptyLine(), emptyLine()]);

	const { data: accounts } = useQuery(accountsQueryOptions({ page: 1, limit: 100 }));
	const { data: costCenters } = useQuery({
		...costCentersQueryOptions({ page: 1, limit: 100, isActive: true }),
		enabled: canReadCostCenters,
	});

	const saveDraft = useMutation({
		mutationFn: () =>
			createJournalDraft({
				entryDate,
				description: description || null,
				isAdjusting,
				lines: lines
					.filter((line) => line.accountId)
					.map((line) => ({
						accountId: line.accountId,
						costCenterId: line.costCenterId || null,
						debit: toMinor(line.debit),
						credit: toMinor(line.credit),
					})),
			}),
		onSuccess: () => {
			toast.success(t('finance:journal.drafted'));
			void queryClient.invalidateQueries({ queryKey: ['journal'] });
			onClose();
		},
		onError: (error: Error) => toast.error(error.message),
	});

	const setLine = (index: number, patch: Partial<TDraftLine>) =>
		setLines((previous) =>
			previous.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)),
		);

	const totalDebit = lines.reduce((sum, line) => sum + toMinor(line.debit), 0);
	const totalCredit = lines.reduce((sum, line) => sum + toMinor(line.credit), 0);
	const balanced = totalDebit === totalCredit && totalDebit > 0;

	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<ScrollDialogContent className='sm:max-w-4xl'>
				<form
					className='flex flex-col gap-4'
					onSubmit={(event) => {
						event.preventDefault();
						if (balanced) saveDraft.mutate();
					}}
				>
					<DialogHeader>
						<DialogTitle>{t('finance:journal.newEntry')}</DialogTitle>
						<DialogDescription>{t('finance:journal.makerChecker')}</DialogDescription>
					</DialogHeader>

					<div className='flex flex-wrap items-end gap-3'>
						<Field className='w-auto'>
							<FieldLabel htmlFor='journal-date'>{t('finance:journal.entryDate')}</FieldLabel>
							<DatePicker className='w-44' value={entryDate} onChange={setEntryDate} />
						</Field>
						<Field className='min-w-64 flex-1'>
							<FieldLabel htmlFor='journal-description'>{t('finance:common.description')}</FieldLabel>
							<Input
								id='journal-description'
								value={description}
								onChange={(event) => setDescription(event.target.value)}
							/>
						</Field>
						<div className='flex items-center gap-2 pb-2'>
							<Checkbox
								id='journal-adjusting'
								checked={isAdjusting}
								onCheckedChange={(checked) => setIsAdjusting(checked === true)}
							/>
							<FieldLabel htmlFor='journal-adjusting'>{t('finance:journal.adjusting')}</FieldLabel>
						</div>
					</div>
					{isAdjusting ? (
						<p className='text-muted-foreground text-xs'>{t('finance:journal.adjustingHint')}</p>
					) : null}

					<div className='space-y-2'>
						{lines.map((line, index) => (
							<div key={index} className='flex flex-wrap items-center gap-2'>
								<Select
									value={line.accountId === '' ? NONE : line.accountId}
									onValueChange={(value: string | null) =>
										setLine(index, {
											accountId: value == null || value === NONE ? '' : value,
										})
									}
								>
									<SelectTrigger className='w-72'>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value={NONE}>{t('finance:journal.line.account')}</SelectItem>
										{accounts?.rows
											.filter((account) => account.isActive && account.isPostable)
											.map((account) => (
												<SelectItem key={account.id} value={account.id}>
													{account.code} — {account.name}
												</SelectItem>
											))}
									</SelectContent>
								</Select>
								{canReadCostCenters ? (
									<Select
										value={line.costCenterId === '' ? NONE : line.costCenterId}
										onValueChange={(value: string | null) =>
											setLine(index, {
												costCenterId: value == null || value === NONE ? '' : value,
											})
										}
									>
										<SelectTrigger className='w-48'>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value={NONE}>{t('finance:journal.line.costCenter')}</SelectItem>
											{costCenters?.rows.map((center) => (
												<SelectItem key={center.id} value={center.id}>
													{center.code} — {center.name}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								) : null}
								<MoneyInput
									className='w-36'
									placeholder={t('finance:journal.debit')}
									value={line.debit}
									onValueChange={(value) => setLine(index, { debit: value, credit: '' })}
								/>
								<MoneyInput
									className='w-36'
									placeholder={t('finance:journal.credit')}
									value={line.credit}
									onValueChange={(value) => setLine(index, { credit: value, debit: '' })}
								/>
								<Button
									type='button'
									variant='ghost'
									size='sm'
									disabled={lines.length <= 2}
									aria-label={t('finance:journal.line.remove')}
									onClick={() =>
										setLines((previous) =>
											previous.filter((_, rowIndex) => rowIndex !== index),
										)
									}
								>
									<Trash2 className='size-4' />
								</Button>
							</div>
						))}
					</div>

					<div className='flex flex-wrap items-center gap-3 text-sm'>
						<Button
							type='button'
							variant='outline'
							size='sm'
							onClick={() => setLines((previous) => [...previous, emptyLine()])}
						>
							<Plus className='size-4' data-icon='inline-start' />
							{t('finance:journal.line.add')}
						</Button>
						<span>
							{t('finance:journal.totalDebit')}: {(totalDebit / 100).toLocaleString()}
						</span>
						<span>
							{t('finance:journal.totalCredit')}: {(totalCredit / 100).toLocaleString()}
						</span>
						<Badge variant={balanced ? 'secondary' : 'destructive'}>
							{balanced ? t('finance:journal.balance') : t('finance:journal.mustBalance')}
						</Badge>
					</div>
					<p className='text-muted-foreground text-xs'>{t('finance:journal.line.oneSideOnly')}</p>

					<DialogFooter>
						<Button type='button' variant='outline' onClick={onClose}>
							{t('common:action.cancel')}
						</Button>
						<Button type='submit' disabled={!balanced || saveDraft.isPending}>
							{saveDraft.isPending
								? t('finance:journal.saving')
								: t('finance:journal.saveDraft')}
						</Button>
					</DialogFooter>
				</form>
			</ScrollDialogContent>
		</Dialog>
	);
}
