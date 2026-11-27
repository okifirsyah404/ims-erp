import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, Upload } from 'lucide-react';

import { Badge } from '@ims-erp/ui/components/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@ims-erp/ui/components/card';
import { Button } from '@ims-erp/ui/components/button';
import { DatePicker } from '@ims-erp/ui/components/date-picker';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@ims-erp/ui/components/table';
import { toast } from '@/components/toast';
import { downloadFile } from '@/lib/download';
import {
	discardOpeningSubledger,
	importOpeningSubledger,
	openingSubledgerQueryOptions,
	type TOpeningSubledgerImportResult,
	type TSubledger,
} from '@/lib/finance-api';

const rupiah = (minor: number) => (minor / 100).toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

/** Error codes of `OpeningSubledgerService.import`. */
type TImportErrorCode = 'partyUnknown' | 'documentInvalid' | 'dateInvalid' | 'afterAsOf' | 'dueDateInvalid' | 'amountInvalid' | 'duplicate';

/**
 * AR / AP detail behind the opening balance (ERP-0142): one CSV per ledger,
 * its total against the control account's opening row. The batch cannot be
 * posted until every ledger ties.
 */
export function OpeningSubledgerCard({ canEdit }: { canEdit: boolean }) {
	const { t } = useTranslation(['finance', 'common']);
	const queryClient = useQueryClient();
	const query = useQuery(openingSubledgerQueryOptions());
	const [asOfDate, setAsOfDate] = useState(() => new Date().toISOString().slice(0, 10));
	const inputs = { ar: useRef<HTMLInputElement>(null), ap: useRef<HTMLInputElement>(null) };
	const [busy, setBusy] = useState(false);
	const [result, setResult] = useState<{ ledger: TSubledger; outcome: TOpeningSubledgerImportResult } | null>(null);

	const refresh = () => queryClient.invalidateQueries({ queryKey: ['opening-balances'] });
	const upload = async (ledger: TSubledger, file: File) => {
		setBusy(true);
		try {
			const outcome = await importOpeningSubledger(ledger, asOfDate, file);
			setResult({ ledger, outcome });
			if (outcome.errors.length === 0) {
				toast.success(t('finance:openingSubledger.imported', { count: outcome.imported }));
				await refresh();
			}
		} catch (cause) {
			toast.error(cause instanceof Error ? cause.message : t('common:error.failed'));
		} finally {
			setBusy(false);
			const input = inputs[ledger].current;
			if (input) input.value = '';
		}
	};

	if (!query.data) return null;
	return (
		<Card>
			<CardHeader>
				<CardTitle>{t('finance:openingSubledger.title')}</CardTitle>
			</CardHeader>
			<CardContent className='space-y-3'>
			<div className='flex flex-wrap items-end justify-between gap-3'>
				<div>
					<p className='text-muted-foreground text-sm'>{t('finance:openingSubledger.hint')}</p>
				</div>
				<DatePicker
					className='w-40'
					value={asOfDate}
					onChange={setAsOfDate}
					disabled={!canEdit}
				/>
			</div>
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>{t('finance:openingSubledger.ledger')}</TableHead>
						<TableHead className='text-right'>{t('finance:openingSubledger.items')}</TableHead>
						<TableHead className='text-right'>{t('finance:openingSubledger.detailTotal')}</TableHead>
						<TableHead className='text-right'>{t('finance:openingSubledger.controlRow')}</TableHead>
						<TableHead>{t('finance:openingSubledger.tie')}</TableHead>
						<TableHead />
					</TableRow>
				</TableHeader>
				<TableBody>
					{query.data.ledgers.map((tie) => (
						<TableRow key={tie.ledger}>
							<TableCell>{t(`finance:openingSubledger.ledgerName.${tie.ledger}`)}</TableCell>
							<TableCell className='text-right tabular-nums'>{tie.items}</TableCell>
							<TableCell className='text-right tabular-nums'>{rupiah(tie.total)}</TableCell>
							<TableCell className='text-right tabular-nums'>{rupiah(tie.control)}</TableCell>
							<TableCell>
								{tie.posted > 0 ? (
									<Badge variant='secondary'>{t('finance:openingSubledger.posted')}</Badge>
								) : tie.tied ? (
									<Badge>{t('finance:openingSubledger.tied')}</Badge>
								) : (
									<Badge variant='destructive'>{t('finance:openingSubledger.notTied')}</Badge>
								)}
							</TableCell>
							<TableCell className='text-right'>
								<div className='flex justify-end gap-1'>
									<Button
										size='sm'
										variant='ghost'
										onClick={() =>
											void downloadFile(
												`/finance/ledger/opening-balances/subledger/template.csv?ledger=${tie.ledger}`,
												`opening-${tie.ledger}-template.csv`,
											).catch((e: Error) => toast.error(e.message))
										}
									>
										<Download className='size-4' data-icon='inline-start' />
										{t('finance:openingSubledger.template')}
									</Button>
									{canEdit && tie.posted === 0 ? (
										<>
											<input
												ref={inputs[tie.ledger]}
												type='file'
												accept='.csv,text/csv'
												className='hidden'
												onChange={(event) => {
													const file = event.target.files?.[0];
													if (file) void upload(tie.ledger, file);
												}}
											/>
											<Button size='sm' variant='outline' disabled={busy} onClick={() => inputs[tie.ledger].current?.click()}>
												<Upload className='size-4' data-icon='inline-start' />
												{t('finance:openingSubledger.import')}
											</Button>
											{tie.items > 0 ? (
												<Button
													size='sm'
													variant='ghost'
													disabled={busy}
													onClick={() =>
														void discardOpeningSubledger(tie.ledger)
															.then(refresh)
															.catch((e: Error) => toast.error(e.message))
													}
												>
													{t('finance:openingSubledger.discard')}
												</Button>
											) : null}
										</>
									) : null}
								</div>
							</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>
			{result && result.outcome.errors.length > 0 ? (
				<div className='rounded-md border border-destructive/40 p-3 text-sm'>
					<p className='font-medium'>{t('finance:openingSubledger.rejected')}</p>
					<ul className='mt-2 list-disc space-y-1 pl-5'>
						{result.outcome.errors.slice(0, 50).map((error) => (
							<li key={`${error.row}-${error.code}-${error.value}`}>
								{t('finance:openingSubledger.row', { row: error.row })}{' '}
								{t(`finance:openingSubledger.error.${error.code as TImportErrorCode}`)}
								{error.value ? ` (${error.value})` : ''}
							</li>
						))}
					</ul>
				</div>
			) : null}
			<p className='text-muted-foreground text-xs'>{t('finance:openingSubledger.scopeNote')}</p>
			</CardContent>
		</Card>
	);
}
