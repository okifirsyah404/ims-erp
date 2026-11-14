import { useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@ims-erp/ui/components/button';
import { Card, CardContent, CardHeader, CardTitle } from '@ims-erp/ui/components/card';
import { DatePicker } from '@ims-erp/ui/components/date-picker';
import { Field, FieldLabel } from '@ims-erp/ui/components/field';
import { Input } from '@ims-erp/ui/components/input';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@ims-erp/ui/components/select';
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@ims-erp/ui/components/table';
import { toast } from '@/components/toast';
import { formatBusinessDate, formatIdr, todayBusinessDate } from '@/lib/format';
import { addCost, COST_CATEGORIES, type TCostCategory, type TProjectDetail, voidCost } from '@/lib/project-api';
import { usePermission } from '@/lib/use-permission';

/**
 * Direct costs (only rendered when the server returned them, i.e. with
 * `project:read_cost`), the material value shipped by the order's delivery
 * notes, and the total against the contract value.
 */
export function ProjectCostsCard({ project }: { project: TProjectDetail & { costs: NonNullable<TProjectDetail['costs']> } }) {
	const { t, i18n } = useTranslation(['projects', 'common']);
	const queryClient = useQueryClient();
	const canRecord = usePermission('project.update');
	const active = project.status === 'active';
	const costs = project.costs;
	const receiptRef = useRef<HTMLInputElement>(null);
	const [category, setCategory] = useState<TCostCategory>('transport');
	const [costDate, setCostDate] = useState(todayBusinessDate());
	const [amount, setAmount] = useState('');
	const [description, setDescription] = useState('');
	const [receipt, setReceipt] = useState<File | null>(null);
	const [busy, setBusy] = useState(false);

	const run = async (work: () => Promise<unknown>, done: string) => {
		setBusy(true);
		try {
			await work();
			await queryClient.invalidateQueries({ queryKey: ['projects'] });
			toast.success(done);
		} catch (cause) {
			toast.error(cause instanceof Error ? cause.message : t('common:error.failed'));
		} finally {
			setBusy(false);
		}
	};
	const margin = costs.contractValue - costs.total;

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t('projects:costs.title')}</CardTitle>
			</CardHeader>
			<CardContent className='flex flex-col gap-4'>
				<dl className='grid gap-3 text-sm sm:grid-cols-5'>
					{[
						[t('projects:costs.contract'), costs.contractValue],
						[t('projects:costs.direct'), costs.directTotal],
						[t('projects:costs.materials'), costs.materialTotal],
						[t('projects:costs.total'), costs.total],
						[t('projects:costs.margin'), margin],
					].map(([label, value]) => (
						<div key={label as string}>
							<dt className='text-muted-foreground'>{label}</dt>
							<dd className='font-semibold'>{formatIdr(value as number)}</dd>
						</div>
					))}
				</dl>
				{costs.materials.length > 0 && (
					<p className='text-xs text-muted-foreground'>
						{t('projects:costs.materialNote', { notes: costs.materials.map((note) => note.code).join(', ') })}
					</p>
				)}
				{costs.entries.length === 0 ? (
					<p className='text-sm text-muted-foreground'>{t('projects:costs.empty')}</p>
				) : (
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>{t('projects:costs.date')}</TableHead>
								<TableHead>{t('projects:costs.category')}</TableHead>
								<TableHead>{t('projects:costs.description')}</TableHead>
								<TableHead className='text-right'>{t('projects:costs.amount')}</TableHead>
								<TableHead />
							</TableRow>
						</TableHeader>
						<TableBody>
							{costs.entries.map((cost) => (
								<TableRow key={cost.id} className={cost.voidedAt ? 'text-muted-foreground line-through' : undefined}>
									<TableCell>{formatBusinessDate(cost.costDate, i18n.language)}</TableCell>
									<TableCell>{t(`projects:costCategory.${cost.category}`)}</TableCell>
									<TableCell>
										{cost.description}
										{cost.voidReason && <div className='text-xs no-underline'>{cost.voidReason}</div>}
									</TableCell>
									<TableCell className='text-right'>{formatIdr(cost.amount)}</TableCell>
									<TableCell className='flex justify-end gap-2'>
										{cost.receiptUrl && (
											<a href={cost.receiptUrl} target='_blank' rel='noreferrer' className='text-sm hover:underline'>
												{t('projects:costs.view')}
											</a>
										)}
										{active && canRecord && !cost.voidedAt && (
											<Button
												variant='ghost'
												size='sm'
												disabled={busy}
												onClick={() => {
													const reason = window.prompt(t('projects:costs.voidReason'));
													if (reason?.trim()) void run(() => voidCost(project.id, cost.id, reason.trim()), t('projects:costs.voided'));
												}}
											>
												{t('projects:costs.void')}
											</Button>
										)}
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				)}
				{active && canRecord && (
					<form
						className='grid gap-3 rounded-md border p-3 sm:grid-cols-3'
						onSubmit={(event) => {
							event.preventDefault();
							void run(async () => {
								await addCost(project.id, {
									category,
									costDate,
									// Rupiah as typed → IDR minor units (ADR-0002).
									amount: Math.round(Number(amount) * 100),
									description: description.trim(),
									receipt,
								});
								setAmount('');
								setDescription('');
								setReceipt(null);
								if (receiptRef.current) receiptRef.current.value = '';
							}, t('projects:costs.added'));
						}}
					>
						<Field>
							<FieldLabel htmlFor='cost-category'>{t('projects:costs.category')}</FieldLabel>
							<Select value={category} onValueChange={(value: string | null) => setCategory(value as TCostCategory)}>
								<SelectTrigger id='cost-category' className='w-full'>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{COST_CATEGORIES.map((value) => (
										<SelectItem key={value} value={value}>
											{t(`projects:costCategory.${value}`)}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</Field>
						<Field>
							<FieldLabel htmlFor='cost-date'>{t('projects:costs.date')}</FieldLabel>
							<DatePicker id='cost-date' required value={costDate} onChange={setCostDate} />
						</Field>
						<Field>
							<FieldLabel htmlFor='cost-amount'>{t('projects:costs.amountRp')}</FieldLabel>
							<Input
								id='cost-amount'
								type='number'
								required
								min='0.01'
								step='0.01'
								inputMode='decimal'
								value={amount}
								onChange={(event) => setAmount(event.target.value)}
							/>
						</Field>
						<Field className='sm:col-span-2'>
							<FieldLabel htmlFor='cost-description'>{t('projects:costs.description')}</FieldLabel>
							<Input id='cost-description' required maxLength={300} value={description} onChange={(event) => setDescription(event.target.value)} />
						</Field>
						<Field>
							<FieldLabel htmlFor='cost-receipt'>{t('projects:costs.receipt')}</FieldLabel>
							<Input
								ref={receiptRef}
								id='cost-receipt'
								type='file'
								accept='image/jpeg,image/png,image/webp,application/pdf'
								onChange={(event) => setReceipt(event.target.files?.[0] ?? null)}
							/>
						</Field>
						<div className='sm:col-span-3 flex justify-end'>
							<Button type='submit' disabled={busy || !amount || !description.trim()}>
								{t('projects:costs.add')}
							</Button>
						</div>
					</form>
				)}
			</CardContent>
		</Card>
	);
}
