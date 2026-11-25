import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, Upload } from 'lucide-react';

import { Button } from '@ims-erp/ui/components/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@ims-erp/ui/components/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@ims-erp/ui/components/table';
import { ErrorState } from '@/components/empty-state';
import { PageSkeleton } from '@/components/page-skeleton';
import { toast } from '@/components/toast';
import { downloadFile } from '@/lib/download';
import { importTerRates, pph21TablesQueryOptions, type TTerImportResult } from '@/lib/tax-api';
import { usePermission } from '@/lib/use-permission';

/** Import error codes the backend returns (`Pph21TableService.importTer`). */
type TTerImportErrorCode = 'terCategoryInvalid' | 'amountInvalid' | 'rateInvalid' | 'dateInvalid' | 'duplicate' | 'terStartMissing';

const rupiah = (minor: number) => (minor / 100).toLocaleString('id-ID');
const percent = (rate: string) => `${Number(rate).toLocaleString('id-ID', { maximumFractionDigits: 4 })}%`;

/**
 * `/finance/tax/pph21` — PPh 21 tables in force (ERP-0138): PTKP and Pasal 17
 * are seeded; the TER table is imported by finance from the official
 * PP 58/2023 table and never invented by the system.
 */
export function Pph21Tables() {
	const { t } = useTranslation(['tax', 'common']);
	const queryClient = useQueryClient();
	const canImport = usePermission('tax.update');
	const query = useQuery(pph21TablesQueryOptions());
	const input = useRef<HTMLInputElement>(null);
	const [busy, setBusy] = useState(false);
	const [result, setResult] = useState<TTerImportResult | null>(null);

	const upload = async (file: File) => {
		setBusy(true);
		try {
			const outcome = await importTerRates(file);
			setResult(outcome);
			if (outcome.errors.length === 0) {
				toast.success(t('tax:pph21.imported', { count: outcome.imported }));
				await queryClient.invalidateQueries({ queryKey: ['tax', 'pph21'] });
			}
		} catch (cause) {
			toast.error(cause instanceof Error ? cause.message : t('common:error.failed'));
		} finally {
			setBusy(false);
			if (input.current) input.current.value = '';
		}
	};

	if (query.isPending) return <PageSkeleton cards={3} />;
	if (query.isError) return <ErrorState error={query.error} bordered />;
	const tables = query.data;
	const categories = [...new Set(tables.ter.map((row) => row.category))];

	return (
		<div className='flex flex-col gap-6 p-6'>
			<div>
				<h1 className='text-2xl font-bold'>{t('tax:pph21.title')}</h1>
				<p className='text-sm text-muted-foreground'>{t('tax:pph21.description')}</p>
			</div>

			<Card>
				<CardHeader>
					<CardTitle>{t('tax:pph21.terTitle')}</CardTitle>
					<CardDescription>
						{tables.terEffectiveFrom
							? t('tax:pph21.terInForce', { date: tables.terEffectiveFrom })
							: t('tax:pph21.terMissing')}
					</CardDescription>
				</CardHeader>
				<CardContent className='space-y-4'>
					<p className='text-sm text-muted-foreground'>{t('tax:pph21.terHint')}</p>
					<div className='flex flex-wrap gap-2'>
						<Button
							size='sm'
							variant='outline'
							onClick={() =>
								void downloadFile('/taxes/pph21/ter-rates/template.csv', 'ter-template.csv').catch((e: Error) => toast.error(e.message))
							}
						>
							<Download className='size-4' data-icon='inline-start' />
							{t('tax:pph21.template')}
						</Button>
						{canImport ? (
							<>
								<input
									ref={input}
									type='file'
									accept='.csv,text/csv'
									className='hidden'
									onChange={(event) => {
										const file = event.target.files?.[0];
										if (file) void upload(file);
									}}
								/>
								<Button size='sm' disabled={busy} onClick={() => input.current?.click()}>
									<Upload className='size-4' data-icon='inline-start' />
									{t('tax:pph21.import')}
								</Button>
							</>
						) : null}
					</div>
					{result && result.errors.length > 0 ? (
						<div className='rounded-md border border-destructive/40 p-3 text-sm'>
							<p className='font-medium'>{t('tax:pph21.importRejected')}</p>
							<ul className='mt-2 list-disc space-y-1 pl-5'>
								{result.errors.slice(0, 50).map((error) => (
									<li key={`${error.row}-${error.code}-${error.value}`}>
										{error.row > 0 ? t('tax:pph21.row', { row: error.row }) : null} {t(`tax:pph21.importError.${error.code as TTerImportErrorCode}`)}
										{error.value ? ` (${error.value})` : ''}
									</li>
								))}
							</ul>
						</div>
					) : null}
					{tables.terVersions.length > 0 ? (
						<p className='text-xs text-muted-foreground'>
							{t('tax:pph21.versions')}{' '}
							{tables.terVersions.map((version) => `${version.effectiveFrom} (${version.rows})`).join(', ')}
						</p>
					) : null}
					{categories.map((category) => (
						<div key={category}>
							<p className='mb-1 text-sm font-medium'>{t('tax:pph21.category', { category })}</p>
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>{t('tax:pph21.monthlyGrossFrom')}</TableHead>
										<TableHead className='text-right'>{t('tax:pph21.rate')}</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{tables.ter
										.filter((row) => row.category === category)
										.map((row) => (
											<TableRow key={row.lowerBound}>
												<TableCell>{rupiah(row.lowerBound)}</TableCell>
												<TableCell className='text-right'>{percent(row.rate)}</TableCell>
											</TableRow>
										))}
								</TableBody>
							</Table>
						</div>
					))}
				</CardContent>
			</Card>

			<div className='grid gap-6 lg:grid-cols-2'>
				<Card>
					<CardHeader>
						<CardTitle>{t('tax:pph21.ptkpTitle')}</CardTitle>
						<CardDescription>{tables.ptkpEffectiveFrom ? t('tax:pph21.since', { date: tables.ptkpEffectiveFrom }) : '—'}</CardDescription>
					</CardHeader>
					<CardContent>
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>{t('tax:pph21.status')}</TableHead>
									<TableHead className='text-right'>{t('tax:pph21.annualPtkp')}</TableHead>
									<TableHead className='text-right'>{t('tax:pph21.terCategory')}</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{tables.ptkp.map((row) => (
									<TableRow key={row.statusCode}>
										<TableCell className='font-mono'>{row.statusCode}</TableCell>
										<TableCell className='text-right'>{rupiah(row.annualAmount)}</TableCell>
										<TableCell className='text-right'>{row.terCategory}</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</CardContent>
				</Card>
				<Card>
					<CardHeader>
						<CardTitle>{t('tax:pph21.bracketsTitle')}</CardTitle>
						<CardDescription>
							{tables.bracketsEffectiveFrom ? t('tax:pph21.since', { date: tables.bracketsEffectiveFrom }) : '—'}
						</CardDescription>
					</CardHeader>
					<CardContent>
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>{t('tax:pph21.pkpFrom')}</TableHead>
									<TableHead className='text-right'>{t('tax:pph21.rate')}</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{tables.brackets.map((row) => (
									<TableRow key={row.lowerBound}>
										<TableCell>{rupiah(row.lowerBound)}</TableCell>
										<TableCell className='text-right'>{percent(row.rate)}</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
