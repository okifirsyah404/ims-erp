import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@ims-erp/ui/components/card';
import { Checkbox } from '@ims-erp/ui/components/checkbox';
import { Dialog, DialogFooter, DialogHeader, DialogTitle } from '@ims-erp/ui/components/dialog';
import { Field, FieldDescription } from '@ims-erp/ui/components/field';
import { Input } from '@ims-erp/ui/components/input';
import { useConfirm } from '@/components/confirm-dialog';
import { EmptyState, ErrorState } from '@/components/empty-state';
import { FieldLabel } from '@/components/form/field-label';
import { ScrollDialogContent } from '@/components/scroll-dialog-content';
import { toast } from '@/components/toast';
import { rejectImageFile } from '@/lib/image-file';
import {
	createLetterhead,
	deleteLetterhead,
	LETTERHEAD_IMAGE_MAX_BYTES,
	letterheadImagePart,
	letterheadsQueryOptions,
	removeLetterheadFooter,
	replaceLetterheadImage,
	type TLetterhead,
	updateLetterhead,
} from '@/lib/letterhead-api';

/**
 * Letterhead (kop surat) template library (ERP-0165) on `/settings/documents`.
 *
 * @remarks
 * Every member may see the list (prints need it); `company:update` manages it.
 * A picked image is downscaled to WebP in the browser before it is sent, and
 * the server normalises it again.
 */
export function LetterheadLibraryCard({ canEdit }: { canEdit: boolean }) {
	const { t } = useTranslation(['settings', 'common']);
	const queryClient = useQueryClient();
	const letterheads = useQuery(letterheadsQueryOptions());
	const [creating, setCreating] = useState(false);
	const [renaming, setRenaming] = useState<TLetterhead | null>(null);

	const refresh = () => queryClient.invalidateQueries({ queryKey: letterheadsQueryOptions().queryKey });
	const run = useMutation({
		mutationFn: (action: () => Promise<unknown>) => action(),
		onSuccess: async () => {
			toast.success(t('settings:document.letterheads.saved'));
			await refresh();
		},
		onError: (error) => toast.error(error.message),
	});

	return (
		<Card>
			<CardHeader className='flex flex-row flex-wrap items-start justify-between gap-4'>
				<div className='flex flex-col gap-1'>
					<CardTitle>{t('settings:document.letterheads.title')}</CardTitle>
					<CardDescription className='max-w-3xl'>{t('settings:document.letterheads.description')}</CardDescription>
				</div>
				{canEdit && (
					<Button onClick={() => setCreating(true)}>
						<Plus />
						{t('settings:document.letterheads.add')}
					</Button>
				)}
			</CardHeader>
			<CardContent className='flex flex-col gap-4'>
				{letterheads.isError ? (
					<ErrorState error={letterheads.error} />
				) : letterheads.data?.length === 0 ? (
					<EmptyState title={t('settings:document.letterheads.empty')} />
				) : (
					(letterheads.data ?? []).map((letterhead) => (
						<LetterheadRow
							key={letterhead.id}
							letterhead={letterhead}
							canEdit={canEdit}
							busy={run.isPending}
							onAction={(action) => run.mutate(action)}
							onRename={() => setRenaming(letterhead)}
							onDeleted={refresh}
						/>
					))
				)}
			</CardContent>
			{creating && <CreateLetterheadDialog onClose={() => setCreating(false)} onCreated={refresh} />}
			{renaming && (
				<RenameDialog
					letterhead={renaming}
					onClose={() => setRenaming(null)}
					onSave={(name) => {
						run.mutate(() => updateLetterhead(renaming.id, { name }));
						setRenaming(null);
					}}
				/>
			)}
		</Card>
	);
}

/** Validates a picked image and turns it into the WebP part; toasts and returns `null` when refused. */
async function toPart(file: File | null | undefined, t: (key: 'common:image.wrongType' | 'common:image.sourceTooLarge' | 'common:image.tooLarge') => string) {
	const rejected = rejectImageFile(file);
	if (rejected === 'type') {
		toast.error(t('common:image.wrongType'));
		return null;
	}
	if (rejected === 'size' || !file) {
		toast.error(t('common:image.sourceTooLarge'));
		return null;
	}
	const part = await letterheadImagePart(file);
	if (part.size > LETTERHEAD_IMAGE_MAX_BYTES) {
		toast.error(t('common:image.tooLarge'));
		return null;
	}
	return part;
}

function LetterheadRow({
	letterhead,
	canEdit,
	busy,
	onAction,
	onRename,
	onDeleted,
}: {
	letterhead: TLetterhead;
	canEdit: boolean;
	busy: boolean;
	onAction: (action: () => Promise<unknown>) => void;
	onRename: () => void;
	onDeleted: () => Promise<unknown>;
}) {
	const { t } = useTranslation(['settings', 'common']);
	const confirm = useConfirm();
	const headerInput = useRef<HTMLInputElement>(null);
	const footerInput = useRef<HTMLInputElement>(null);

	async function replace(kind: 'header' | 'footer', file: File | undefined) {
		const part = await toPart(file, t);
		if (part) onAction(() => replaceLetterheadImage(letterhead.id, kind, part));
	}

	return (
		<div className='flex flex-col gap-3 rounded-md border p-3'>
			<div className='flex flex-wrap items-center justify-between gap-2'>
				<div className='flex items-center gap-2 font-medium'>
					{letterhead.name}
					{letterhead.isDefault && <Badge>{t('settings:document.letterheads.default')}</Badge>}
				</div>
				{canEdit && (
					<div className='flex flex-wrap gap-2'>
						{!letterhead.isDefault && (
							<Button size='sm' variant='outline' disabled={busy} onClick={() => onAction(() => updateLetterhead(letterhead.id, { isDefault: true }))}>
								{t('settings:document.letterheads.makeDefault')}
							</Button>
						)}
						<Button size='sm' variant='outline' disabled={busy} onClick={onRename}>
							{t('settings:document.letterheads.rename')}
						</Button>
						<Button size='sm' variant='outline' disabled={busy} onClick={() => headerInput.current?.click()}>
							{t('settings:document.letterheads.replaceHeader')}
						</Button>
						<Button size='sm' variant='outline' disabled={busy} onClick={() => footerInput.current?.click()}>
							{letterhead.footerUrl ? t('settings:document.letterheads.replaceFooter') : t('settings:document.letterheads.addFooter')}
						</Button>
						{letterhead.footerUrl && (
							<Button size='sm' variant='outline' disabled={busy} onClick={() => onAction(() => removeLetterheadFooter(letterhead.id))}>
								{t('settings:document.letterheads.removeFooter')}
							</Button>
						)}
						<Button
							size='sm'
							variant='destructive'
							disabled={busy}
							onClick={async () => {
								if (
									await confirm({
										title: t('settings:document.letterheads.deleteConfirm', { name: letterhead.name }),
										destructive: true,
									})
								) {
									try {
										await deleteLetterhead(letterhead.id);
										toast.success(t('settings:document.letterheads.deleted'));
										await onDeleted();
									} catch (error) {
										toast.error(error instanceof Error ? error.message : t('common:error.failed'));
									}
								}
							}}
						>
							{t('settings:document.letterheads.delete')}
						</Button>
						{(['header', 'footer'] as const).map((kind) => (
							<input
								key={kind}
								ref={kind === 'header' ? headerInput : footerInput}
								type='file'
								accept='image/*'
								className='hidden'
								onChange={(event) => {
									const file = event.target.files?.[0];
									event.target.value = '';
									void replace(kind, file);
								}}
							/>
						))}
					</div>
				)}
			</div>
			{/* Shown at the page's proportions: A4 content width, white paper. */}
			<div className='flex max-w-3xl flex-col gap-2 rounded border bg-white p-2'>
				{letterhead.headerUrl && <img src={letterhead.headerUrl} alt={t('settings:document.letterheads.header')} className='h-auto w-full' />}
				<div className='h-10 border-y border-dashed' />
				{letterhead.footerUrl ? (
					<img src={letterhead.footerUrl} alt={t('settings:document.letterheads.footer')} className='h-auto w-full' />
				) : (
					<p className='text-center text-xs text-muted-foreground'>{t('settings:document.letterheads.noFooter')}</p>
				)}
			</div>
		</div>
	);
}

function ImagePicker({
	id,
	label,
	hint,
	file,
	onPick,
}: {
	id: string;
	label: string;
	hint: string;
	file: File | null;
	onPick: (file: File | null) => void;
}) {
	const { t } = useTranslation(['settings']);
	const preview = file ? URL.createObjectURL(file) : null;
	return (
		<Field>
			<FieldLabel htmlFor={id}>{label}</FieldLabel>
			{preview && <img src={preview} alt='' className='h-auto w-full rounded border bg-white' onLoad={() => URL.revokeObjectURL(preview)} />}
			<input
				id={id}
				type='file'
				accept='image/*'
				className='text-sm'
				aria-label={t('settings:document.letterheads.pickImage')}
				onChange={(event) => onPick(event.target.files?.[0] ?? null)}
			/>
			<FieldDescription>{hint}</FieldDescription>
		</Field>
	);
}

function CreateLetterheadDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => Promise<unknown> }) {
	const { t } = useTranslation(['settings', 'common']);
	const idPrefix = useId();
	const [name, setName] = useState('');
	const [header, setHeader] = useState<File | null>(null);
	const [footer, setFooter] = useState<File | null>(null);
	const [isDefault, setIsDefault] = useState(false);
	const [saving, setSaving] = useState(false);

	async function save() {
		if (!header) {
			toast.error(t('settings:document.letterheads.headerRequired'));
			return;
		}
		setSaving(true);
		try {
			const headerPart = await toPart(header, t);
			const footerPart = footer ? await toPart(footer, t) : null;
			if (!headerPart || (footer && !footerPart)) return;
			await createLetterhead({ name: name.trim(), isDefault, header: headerPart, footer: footerPart });
			toast.success(t('settings:document.letterheads.saved'));
			await onCreated();
			onClose();
		} catch (error) {
			toast.error(error instanceof Error ? error.message : t('common:error.failed'));
		} finally {
			setSaving(false);
		}
	}

	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<ScrollDialogContent className='sm:max-w-2xl'>
				<form
					className='flex flex-col gap-4'
					onSubmit={(event) => {
						event.preventDefault();
						void save();
					}}
				>
					<DialogHeader>
						<DialogTitle>{t('settings:document.letterheads.add')}</DialogTitle>
					</DialogHeader>
					<Field>
						<FieldLabel htmlFor={`${idPrefix}-name`}>{t('settings:document.letterheads.name')}</FieldLabel>
						<Input id={`${idPrefix}-name`} required maxLength={100} value={name} onChange={(event) => setName(event.target.value)} />
					</Field>
					<ImagePicker
						id={`${idPrefix}-header`}
						label={t('settings:document.letterheads.header')}
						hint={t('settings:document.letterheads.headerHint')}
						file={header}
						onPick={setHeader}
					/>
					<ImagePicker
						id={`${idPrefix}-footer`}
						label={t('settings:document.letterheads.footer')}
						hint={t('settings:document.letterheads.footerHint')}
						file={footer}
						onPick={setFooter}
					/>
					<label className='flex items-center gap-2 text-sm'>
						<Checkbox checked={isDefault} onCheckedChange={(checked) => setIsDefault(checked === true)} />
						{t('settings:document.letterheads.isDefault')}
					</label>
					<DialogFooter className='pb-4'>
						<Button type='button' variant='outline' onClick={onClose}>
							{t('common:action.cancel')}
						</Button>
						<Button type='submit' disabled={saving || !name.trim() || !header}>
							{t('common:action.save')}
						</Button>
					</DialogFooter>
				</form>
			</ScrollDialogContent>
		</Dialog>
	);
}

function RenameDialog({ letterhead, onClose, onSave }: { letterhead: TLetterhead; onClose: () => void; onSave: (name: string) => void }) {
	const { t } = useTranslation(['settings', 'common']);
	const [name, setName] = useState(letterhead.name);
	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<ScrollDialogContent className='sm:max-w-md'>
				<form
					className='flex flex-col gap-4'
					onSubmit={(event) => {
						event.preventDefault();
						onSave(name.trim());
					}}
				>
					<DialogHeader>
						<DialogTitle>{t('settings:document.letterheads.rename')}</DialogTitle>
					</DialogHeader>
					<Field>
						<FieldLabel htmlFor='letterhead-rename'>{t('settings:document.letterheads.name')}</FieldLabel>
						<Input id='letterhead-rename' required maxLength={100} value={name} onChange={(event) => setName(event.target.value)} />
					</Field>
					<DialogFooter className='pb-4'>
						<Button type='button' variant='outline' onClick={onClose}>
							{t('common:action.cancel')}
						</Button>
						<Button type='submit' disabled={!name.trim()}>
							{t('common:action.save')}
						</Button>
					</DialogFooter>
				</form>
			</ScrollDialogContent>
		</Dialog>
	);
}
