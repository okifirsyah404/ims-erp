import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download } from 'lucide-react';

import { Button } from '@ims-erp/ui/components/button';
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@ims-erp/ui/components/dialog';
import { Field } from '@ims-erp/ui/components/field';
import { Input } from '@ims-erp/ui/components/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@ims-erp/ui/components/select';
import { FieldLabel } from '@/components/form/field-label';
import { ScrollDialogContent } from '@/components/scroll-dialog-content';
import { toast } from '@/components/toast';
import { downloadFile } from '@/lib/download';
import { CORETAX_STATUSES, type TCoretaxStatus, type TWithholdingRecord, updateWithholdingCoretax } from '@/lib/tax-api';
import { usePermission } from '@/lib/use-permission';

/** Period picker plus the two Coretax XML downloads (ERP-0140). */
export function CoretaxDownloads() {
	const { t } = useTranslation(['tax', 'common']);
	const canExport = usePermission('tax.export');
	const now = new Date();
	const [year, setYear] = useState(String(now.getFullYear()));
	const [month, setMonth] = useState(String(now.getMonth() + 1));
	if (!canExport) return null;
	const period = `year=${Number(year)}&month=${Number(month)}`;
	const name = `${year}-${month.padStart(2, '0')}`;
	const download = (kind: 'faktur' | 'bupot') =>
		void downloadFile(`/taxes/coretax/${kind}.xml?${period}`, `coretax-${kind}-${name}.xml`).catch((e: Error) =>
			toast.error(e.message),
		);
	return (
		<div className='space-y-2 rounded-md border p-3'>
			<div className='flex flex-wrap items-center gap-2'>
				<Input className='w-24' aria-label={t('tax:coretax.year')} value={year} onChange={(event) => setYear(event.target.value)} />
				<Input className='w-16' aria-label={t('tax:coretax.month')} value={month} onChange={(event) => setMonth(event.target.value)} />
				<Button size='sm' variant='outline' onClick={() => download('faktur')}>
					<Download className='size-4' data-icon='inline-start' />
					{t('tax:coretax.faktur')}
				</Button>
				<Button size='sm' variant='outline' onClick={() => download('bupot')}>
					<Download className='size-4' data-icon='inline-start' />
					{t('tax:coretax.bupot')}
				</Button>
			</div>
			<p className='text-muted-foreground text-xs'>{t('tax:coretax.hint')}</p>
		</div>
	);
}

/** Bukti-potong data and Coretax status of one withholding (ERP-0140). */
export function CoretaxDialog({ record, onClose }: { record: TWithholdingRecord; onClose: () => void }) {
	const { t } = useTranslation(['tax', 'common']);
	const queryClient = useQueryClient();
	const [status, setStatus] = useState<TCoretaxStatus>(record.coretaxStatus ?? 'not_exported');
	const [slip, setSlip] = useState(record.withholdingSlipNumber ?? '');
	const [tin, setTin] = useState(record.counterpartyTaxId ?? '');
	const [objectCode, setObjectCode] = useState(record.taxObjectCode ?? '');
	const save = useMutation({
		mutationFn: () =>
			updateWithholdingCoretax(record.id, {
				coretaxStatus: status,
				withholdingSlipNumber: slip.trim() || null,
				counterpartyTaxId: tin.trim() || null,
				taxObjectCode: objectCode.trim() || null,
			}),
		onSuccess: () => {
			toast.success(t('tax:coretax.saved'));
			void queryClient.invalidateQueries({ queryKey: ['tax-withholding'] });
			onClose();
		},
		onError: (e: Error) => toast.error(e.message),
	});
	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<ScrollDialogContent className='sm:max-w-lg'>
				<form
					className='flex flex-col gap-4'
					onSubmit={(event) => {
						event.preventDefault();
						save.mutate();
					}}
				>
					<DialogHeader>
						<DialogTitle>{t('tax:coretax.dialogTitle')}</DialogTitle>
						<DialogDescription>{record.code}</DialogDescription>
					</DialogHeader>
					<Field>
						<FieldLabel htmlFor='coretax-object'>{t('tax:coretax.taxObjectCode')}</FieldLabel>
						<Input id='coretax-object' maxLength={20} value={objectCode} onChange={(event) => setObjectCode(event.target.value)} />
					</Field>
					<Field>
						<FieldLabel htmlFor='coretax-tin'>{t('tax:coretax.counterpartyTaxId')}</FieldLabel>
						<Input id='coretax-tin' maxLength={32} value={tin} onChange={(event) => setTin(event.target.value)} />
					</Field>
					<Field>
						<FieldLabel htmlFor='coretax-slip'>{t('tax:coretax.slipNumber')}</FieldLabel>
						<Input id='coretax-slip' maxLength={40} value={slip} onChange={(event) => setSlip(event.target.value)} />
					</Field>
					<Field>
						<FieldLabel htmlFor='coretax-status'>{t('tax:coretax.status')}</FieldLabel>
						<Select value={status} onValueChange={(value: string | null) => value && setStatus(value as TCoretaxStatus)}>
							<SelectTrigger id='coretax-status'>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{CORETAX_STATUSES.map((value) => (
									<SelectItem key={value} value={value}>
										{t(`tax:coretax.statusValue.${value}`)}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</Field>
					<DialogFooter>
						<Button type='button' variant='outline' onClick={onClose}>
							{t('common:action.cancel')}
						</Button>
						<Button type='submit' disabled={save.isPending}>
							{save.isPending ? t('common:action.saving') : t('common:action.save')}
						</Button>
					</DialogFooter>
				</form>
			</ScrollDialogContent>
		</Dialog>
	);
}
