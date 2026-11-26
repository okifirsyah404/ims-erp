import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@ims-erp/ui/components/card';
import { Checkbox } from '@ims-erp/ui/components/checkbox';
import { Dialog, DialogFooter, DialogHeader, DialogTitle } from '@ims-erp/ui/components/dialog';
import { Field, FieldDescription } from '@ims-erp/ui/components/field';
import { Input } from '@ims-erp/ui/components/input';
import { Textarea } from '@ims-erp/ui/components/textarea';
import { useConfirm } from '@/components/confirm-dialog';
import { EmptyState, ErrorState } from '@/components/empty-state';
import { FieldLabel } from '@/components/form/field-label';
import { PoPlaceholderHelp } from '@/components/procurement/po-placeholder-help';
import { ScrollDialogContent } from '@/components/scroll-dialog-content';
import { toast } from '@/components/toast';
import {
	createPurchaseTermTemplate,
	deletePurchaseTermTemplate,
	purchaseTermTemplatesQueryOptions,
	type TPurchaseTermTemplate,
	type TPurchaseTermTemplateInput,
	updatePurchaseTermTemplate,
} from '@/lib/procurement-api';
import { usePermission } from '@/lib/use-permission';

/**
 * `/procurement/term-templates` — reusable payment terms, purchase terms and
 * notes for purchase orders (ERP-0165). Read with `purchase_order:read`,
 * managed with `purchase_order:update`.
 */
export const Route = createFileRoute('/_authed/procurement/term-templates/')({
	component: TermTemplatesPage,
});

function TermTemplatesPage() {
	const { t } = useTranslation(['procurement', 'common']);
	const canEdit = usePermission('purchase_order.update');
	const confirm = useConfirm();
	const queryClient = useQueryClient();
	const templates = useQuery(purchaseTermTemplatesQueryOptions());
	/** `null`: closed; `'new'`: create; otherwise the template being edited. */
	const [editing, setEditing] = useState<TPurchaseTermTemplate | 'new' | null>(null);

	const refresh = () => queryClient.invalidateQueries({ queryKey: purchaseTermTemplatesQueryOptions().queryKey });
	const save = useMutation({
		mutationFn: (input: TPurchaseTermTemplateInput) =>
			editing && editing !== 'new' ? updatePurchaseTermTemplate(editing.id, input) : createPurchaseTermTemplate(input),
		onSuccess: async () => {
			toast.success(t('procurement:termTemplates.saved'));
			setEditing(null);
			await refresh();
		},
		onError: (error) => toast.error(error.message),
	});
	const remove = useMutation({
		mutationFn: (id: string) => deletePurchaseTermTemplate(id),
		onSuccess: async () => {
			toast.success(t('procurement:termTemplates.deleted'));
			await refresh();
		},
		onError: (error) => toast.error(error.message),
	});

	return (
		<div className='flex flex-col gap-6'>
			<div className='flex flex-wrap items-start justify-between gap-4'>
				<div>
					<h1 className='text-2xl font-bold'>{t('procurement:termTemplates.title')}</h1>
					<p className='max-w-3xl text-sm text-muted-foreground'>{t('procurement:termTemplates.description')}</p>
				</div>
				{canEdit && (
					<Button onClick={() => setEditing('new')}>
						<Plus />
						{t('procurement:termTemplates.add')}
					</Button>
				)}
			</div>

			{templates.isError ? (
				<ErrorState error={templates.error} />
			) : templates.data && templates.data.length === 0 ? (
				<EmptyState title={t('procurement:termTemplates.empty')} />
			) : (
				<div className='grid gap-4 lg:grid-cols-2'>
					{(templates.data ?? []).map((template) => (
						<Card key={template.id}>
							<CardHeader className='flex flex-row items-start justify-between gap-2'>
								<div className='flex flex-col gap-1'>
									<CardTitle className='flex items-center gap-2'>
										{template.name}
										{template.isDefault && <Badge>{t('procurement:termTemplates.default')}</Badge>}
									</CardTitle>
									<CardDescription>
										{t('procurement:termTemplates.termsCount', {
											count: (template.terms ?? '').split('\n').filter((line) => line.trim()).length,
										})}
									</CardDescription>
								</div>
								{canEdit && (
									<div className='flex gap-1'>
										<Button variant='ghost' size='icon' aria-label={t('procurement:termTemplates.edit')} onClick={() => setEditing(template)}>
											<Pencil />
										</Button>
										<Button
											variant='ghost'
											size='icon'
											aria-label={t('procurement:termTemplates.delete')}
											disabled={remove.isPending}
											onClick={async () => {
												if (
													await confirm({
														title: t('procurement:termTemplates.deleteConfirm', { name: template.name }),
														destructive: true,
													})
												) {
													remove.mutate(template.id);
												}
											}}
										>
											<Trash2 />
										</Button>
									</div>
								)}
							</CardHeader>
							<CardContent className='flex flex-col gap-2 text-sm'>
								{template.paymentTerms && (
									<p>
										<span className='font-medium'>{t('procurement:po.paymentTerms')}:</span> {template.paymentTerms}
									</p>
								)}
								{template.terms && <p className='whitespace-pre-wrap text-muted-foreground'>{template.terms}</p>}
								{template.notes && <p className='whitespace-pre-wrap italic text-muted-foreground'>{template.notes}</p>}
							</CardContent>
						</Card>
					))}
				</div>
			)}

			{editing && (
				<TermTemplateDialog
					template={editing === 'new' ? null : editing}
					saving={save.isPending}
					onSave={(input) => save.mutate(input)}
					onClose={() => setEditing(null)}
				/>
			)}
		</div>
	);
}

function TermTemplateDialog({
	template,
	saving,
	onSave,
	onClose,
}: {
	template: TPurchaseTermTemplate | null;
	saving: boolean;
	onSave: (input: TPurchaseTermTemplateInput) => void;
	onClose: () => void;
}) {
	const { t } = useTranslation(['procurement', 'common']);
	const [name, setName] = useState(template?.name ?? '');
	const [paymentTerms, setPaymentTerms] = useState(template?.paymentTerms ?? '');
	const [terms, setTerms] = useState(template?.terms ?? '');
	const [notes, setNotes] = useState(template?.notes ?? '');
	const [isDefault, setIsDefault] = useState(template?.isDefault ?? false);
	const text = (value: string) => value.trim() || null;

	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<ScrollDialogContent className='sm:max-w-2xl'>
				<form
					className='flex flex-col gap-4'
					onSubmit={(event) => {
						event.preventDefault();
						onSave({ name: name.trim(), paymentTerms: text(paymentTerms), terms: text(terms), notes: text(notes), isDefault });
					}}
				>
					<DialogHeader>
						<DialogTitle>{template ? t('procurement:termTemplates.edit') : t('procurement:termTemplates.add')}</DialogTitle>
					</DialogHeader>
					<Field>
						<FieldLabel htmlFor='term-template-name'>{t('procurement:termTemplates.name')}</FieldLabel>
						<Input id='term-template-name' required maxLength={100} value={name} onChange={(event) => setName(event.target.value)} />
					</Field>
					<Field>
						<FieldLabel htmlFor='term-template-payment' optional>
							{t('procurement:po.paymentTerms')}
						</FieldLabel>
						<Input id='term-template-payment' maxLength={500} value={paymentTerms} onChange={(event) => setPaymentTerms(event.target.value)} />
						<FieldDescription>{t('procurement:po.paymentTermsHint')}</FieldDescription>
					</Field>
					<Field>
						<FieldLabel htmlFor='term-template-terms' optional>
							{t('procurement:po.terms')}
						</FieldLabel>
						<Textarea id='term-template-terms' rows={7} maxLength={8000} value={terms} onChange={(event) => setTerms(event.target.value)} />
						<FieldDescription>{t('procurement:po.termsHint')}</FieldDescription>
					</Field>
					<Field>
						<FieldLabel htmlFor='term-template-notes' optional>
							{t('procurement:po.notes')}
						</FieldLabel>
						<Textarea id='term-template-notes' rows={3} maxLength={4000} value={notes} onChange={(event) => setNotes(event.target.value)} />
					</Field>
					<PoPlaceholderHelp />
					<label className='flex items-center gap-2 text-sm'>
						<Checkbox checked={isDefault} onCheckedChange={(checked) => setIsDefault(checked === true)} />
						{t('procurement:termTemplates.isDefault')}
					</label>
					<DialogFooter className='pb-4'>
						<Button type='button' variant='outline' onClick={onClose}>
							{t('common:action.cancel')}
						</Button>
						<Button type='submit' disabled={saving || !name.trim()}>
							{t('common:action.save')}
						</Button>
					</DialogFooter>
				</form>
			</ScrollDialogContent>
		</Dialog>
	);
}
