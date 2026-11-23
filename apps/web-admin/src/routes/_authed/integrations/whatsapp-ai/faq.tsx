import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import { Checkbox } from '@ims-erp/ui/components/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@ims-erp/ui/components/dialog';
import { Field, FieldDescription, FieldGroup } from '@ims-erp/ui/components/field';
import { FieldLabel } from '@/components/form/field-label';
import { Input } from '@ims-erp/ui/components/input';
import { Textarea } from '@ims-erp/ui/components/textarea';
import type { CellData, ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/data-table/data-table';
import { DataTableCard } from '@/components/data-table/data-table-card';
import type { DataTableFeatures } from '@/components/data-table/data-table-features';
import { RowActions } from '@/components/data-table/row-actions';
import { Pencil, Trash2 } from 'lucide-react';
import { EmptyState, ErrorState } from '@/components/empty-state';
import { useConfirm } from '@/components/confirm-dialog';
import { toast } from '@/components/toast';
import { usePermission } from '@/lib/use-permission';
import { createFaq, faqQueryOptions, removeFaq, type TFaqEntry, type TFaqInput, updateFaq } from '@/lib/whatsapp-api';

/** `/integrations/whatsapp-ai/faq` — the answers the WhatsApp assistant may use (M04 stage 2). */
export const Route = createFileRoute('/_authed/integrations/whatsapp-ai/faq')({
	component: FaqPage,
});

function FaqPage() {
	const { t } = useTranslation(['integrations', 'common']);
	const queryClient = useQueryClient();
	const confirm = useConfirm();
	const canManage = usePermission('whatsapp.manage_faq');
	const { data, isPending, isError, error } = useQuery(faqQueryOptions());
	const [editing, setEditing] = useState<{ entry: TFaqEntry | null } | null>(null);
	const [busy, setBusy] = useState(false);

	const run = useCallback(
		async (work: () => Promise<unknown>, done: string) => {
			setBusy(true);
			try {
				await work();
				await queryClient.invalidateQueries({ queryKey: ['whatsapp', 'faq'] });
				toast.success(done);
				return true;
			} catch (cause) {
				toast.error(cause instanceof Error ? cause.message : t('common:error.failed'));
				return false;
			} finally {
				setBusy(false);
			}
		},
		[queryClient, t],
	);

	const columns = useMemo<ColumnDef<DataTableFeatures, TFaqEntry, CellData>[]>(
		() => [
			{
				accessorKey: 'question',
				header: t('integrations:faq.question'),
				meta: { cellClassName: 'max-w-64 font-medium' },
			},
			{
				accessorKey: 'answer',
				header: t('integrations:faq.answer'),
				meta: { cellClassName: 'max-w-96 truncate text-sm' },
			},
			{
				id: 'state',
				header: t('integrations:faq.state'),
				cell: ({ row }) => (
					<Badge variant={row.original.isActive ? 'default' : 'outline'}>
						{row.original.isActive ? t('integrations:faq.active') : t('integrations:faq.inactive')}
					</Badge>
				),
			},
			{
				id: 'actions',
				header: () => <span className='sr-only'>{t('common:action.actions')}</span>,
				meta: { align: 'right' },
				cell: ({ row }) => (
					<RowActions
						label={t('common:action.actions')}
						actions={[
							{
								key: 'edit',
								label: t('integrations:faq.edit'),
								icon: Pencil,
								hidden: !canManage,
								onSelect: () => setEditing({ entry: row.original }),
							},
							{
								key: 'remove',
								label: t('integrations:faq.remove'),
								icon: Trash2,
								destructive: true,
								disabled: busy,
								hidden: !canManage,
								onSelect: async () => {
									if (await confirm({ title: t('integrations:faq.confirmRemove'), destructive: true })) {
										void run(() => removeFaq(row.original.id), t('integrations:faq.removed'));
									}
								},
							},
						]}
					/>
				),
			},
		],
		[t, busy, canManage, confirm, run],
	);

	return (
		<div className='flex flex-col gap-6 p-6'>
			<div className='flex flex-wrap items-start justify-between gap-2'>
				<div>
					<Link to='/integrations/whatsapp-ai' className='text-sm text-muted-foreground hover:underline'>
						← {t('integrations:whatsapp.title')}
					</Link>
					<h1 className='text-2xl font-bold'>{t('integrations:faq.title')}</h1>
					<p className='text-sm text-muted-foreground'>{t('integrations:faq.description')}</p>
				</div>
				{canManage && <Button onClick={() => setEditing({ entry: null })}>{t('integrations:faq.new')}</Button>}
			</div>
			<DataTableCard>
				{isError ? (
					<ErrorState error={error} />
				) : !isPending && data.length === 0 ? (
					<EmptyState title={t('integrations:faq.empty')} />
				) : (
					<DataTable columns={columns} data={data ?? []} getRowId={(row) => row.id} loading={isPending} sortable />
				)}
			</DataTableCard>
			{editing && (
				<FaqDialog
					entry={editing.entry}
					busy={busy}
					onClose={() => setEditing(null)}
					onSave={async (input) => {
						const saved = await run(
							() => (editing.entry ? updateFaq(editing.entry.id, input) : createFaq(input)),
							t('integrations:faq.saved'),
						);
						if (saved) setEditing(null);
					}}
				/>
			)}
		</div>
	);
}

function FaqDialog({ entry, busy, onClose, onSave }: { entry: TFaqEntry | null; busy: boolean; onClose: () => void; onSave: (input: TFaqInput) => Promise<void> }) {
	const { t } = useTranslation(['integrations', 'common']);
	const [question, setQuestion] = useState(entry?.question ?? '');
	const [answer, setAnswer] = useState(entry?.answer ?? '');
	const [keywords, setKeywords] = useState(entry?.keywords ?? '');
	const [isActive, setIsActive] = useState(entry?.isActive ?? true);
	const [sortOrder, setSortOrder] = useState(String(entry?.sortOrder ?? 0));

	return (
		<Dialog open onOpenChange={(next) => !next && onClose()}>
			<DialogContent className='sm:max-w-xl'>
				<form
					onSubmit={(event) => {
						event.preventDefault();
						void onSave({
							question: question.trim(),
							answer: answer.trim(),
							keywords: keywords.trim() || null,
							isActive,
							sortOrder: Number(sortOrder) || 0,
						});
					}}
				>
					<DialogHeader>
						<DialogTitle>{entry ? t('integrations:faq.edit') : t('integrations:faq.new')}</DialogTitle>
					</DialogHeader>
					<FieldGroup className='py-4'>
						<Field>
							<FieldLabel htmlFor='faq-question'>{t('integrations:faq.question')}</FieldLabel>
							<Input id='faq-question' required maxLength={300} value={question} onChange={(event) => setQuestion(event.target.value)} />
						</Field>
						<Field>
							<FieldLabel htmlFor='faq-answer'>{t('integrations:faq.answer')}</FieldLabel>
							<Textarea id='faq-answer' required maxLength={4000} rows={5} value={answer} onChange={(event) => setAnswer(event.target.value)} />
							<FieldDescription>{t('integrations:faq.answerHint')}</FieldDescription>
						</Field>
						<Field>
							<FieldLabel htmlFor='faq-keywords' optional>{t('integrations:faq.keywords')}</FieldLabel>
							<Input id='faq-keywords' maxLength={500} value={keywords} onChange={(event) => setKeywords(event.target.value)} />
							<FieldDescription>{t('integrations:faq.keywordsHint')}</FieldDescription>
						</Field>
						<div className='grid gap-4 sm:grid-cols-2'>
							<Field>
								<FieldLabel htmlFor='faq-order' optional>{t('integrations:faq.order')}</FieldLabel>
								<Input
									id='faq-order'
									type='number'
									min='0'
									max='10000'
									step='1'
									inputMode='numeric'
									value={sortOrder}
									onChange={(event) => setSortOrder(event.target.value)}
								/>
							</Field>
							<Field orientation='horizontal' className='self-end pb-2'>
								<Checkbox id='faq-active' checked={isActive} onCheckedChange={(checked) => setIsActive(checked === true)} />
								<FieldLabel htmlFor='faq-active'>{t('integrations:faq.activeLabel')}</FieldLabel>
							</Field>
						</div>
					</FieldGroup>
					<DialogFooter>
						<Button type='button' variant='outline' onClick={onClose}>
							{t('common:action.cancel')}
						</Button>
						<Button type='submit' disabled={busy || !question.trim() || !answer.trim()}>
							{t('common:action.save')}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
