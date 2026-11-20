import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDown, ArrowUp, ImagePlus, Images, Plus, Trash2, X } from 'lucide-react';

import type { TContentField } from '@ims-erp/common';
import { Button } from '@ims-erp/ui/components/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@ims-erp/ui/components/dialog';
import { Field, FieldDescription, FieldLabel } from '@ims-erp/ui/components/field';
import { Input } from '@ims-erp/ui/components/input';
import { NativeSelect, NativeSelectOption } from '@ims-erp/ui/components/native-select';
import { Switch } from '@ims-erp/ui/components/switch';
import { Textarea } from '@ims-erp/ui/components/textarea';
import { toast } from '@/components/toast';
import { useFieldLabel } from '@/lib/website-content-form';
import { type TWebAsset, uploadWebAsset, webAssetsQueryOptions } from '@/lib/website-content-api';

/**
 * Editor form rendered from the shared website content-type registry
 * (`WEBSITE_CONTENT_TYPES`, ERP-0071). Empty fields are dropped on save
 * ({@link cleanContent}) so the website keeps its built-in text for them.
 */

type TValue = Record<string, unknown>;

export function ContentFields({
	fields,
	value,
	onChange,
	disabled,
	idPrefix,
}: {
	fields: readonly TContentField[];
	value: TValue;
	onChange: (value: TValue) => void;
	disabled?: boolean;
	idPrefix: string;
}) {
	return (
		<div className='grid gap-4 md:grid-cols-2'>
			{fields.map((field) => (
				<ContentField
					key={field.key}
					field={field}
					id={`${idPrefix}-${field.key}`}
					value={value[field.key]}
					disabled={disabled}
					onChange={(next) => {
						const copy = { ...value };
						if (next === undefined) delete copy[field.key];
						else copy[field.key] = next;
						onChange(copy);
					}}
				/>
			))}
		</div>
	);
}

const WIDE_KINDS = new Set(['textarea', 'paragraphs', 'strings', 'group', 'list', 'images']);

function ContentField({
	field,
	id,
	value,
	onChange,
	disabled,
}: {
	field: TContentField;
	id: string;
	value: unknown;
	onChange: (value: unknown) => void;
	disabled?: boolean;
}) {
	const { t } = useTranslation('integrations');
	const label = useFieldLabel();
	const title = `${label(field.key)}${field.required ? ' *' : ''}`;
	const wide = WIDE_KINDS.has(field.kind) ? 'md:col-span-2' : undefined;
	const text = typeof value === 'string' ? value : '';
	const lines = Array.isArray(value) ? (value as string[]) : [];

	switch (field.kind) {
		case 'group':
			return (
				<fieldset className='rounded-lg border p-4 md:col-span-2'>
					<legend className='px-1 text-sm font-medium'>{title}</legend>
					<ContentFields fields={field.fields ?? []} value={(value as TValue) ?? {}} onChange={onChange} disabled={disabled} idPrefix={id} />
				</fieldset>
			);
		case 'list':
			return <ListField field={field} id={id} title={title} value={Array.isArray(value) ? (value as TValue[]) : []} onChange={onChange} disabled={disabled} />;
		case 'image':
			return (
				<Field className={wide}>
					<FieldLabel htmlFor={id}>{title}</FieldLabel>
					<ImageInput id={id} value={text} onChange={(next) => onChange(next || undefined)} disabled={disabled} />
				</Field>
			);
		case 'images':
			return (
				<Field className={wide}>
					<FieldLabel>{title}</FieldLabel>
					<div className='flex flex-col gap-2'>
						{lines.map((entry, index) => (
							<div key={index} className='flex items-start gap-2'>
								<ImageInput
									id={`${id}-${index}`}
									value={entry}
									disabled={disabled}
									onChange={(next) => onChange(lines.map((line, at) => (at === index ? next : line)))}
								/>
								<Button type='button' size='icon' variant='ghost' disabled={disabled} aria-label={t('website.content.list.remove')} onClick={() => onChange(lines.filter((_, at) => at !== index))}>
									<Trash2 />
								</Button>
							</div>
						))}
						<Button type='button' variant='outline' size='sm' className='w-fit' disabled={disabled || lines.length >= (field.max ?? 12)} onClick={() => onChange([...lines, ''])}>
							<Plus /> {t('website.content.image.add')}
						</Button>
					</div>
				</Field>
			);
		case 'textarea':
			return (
				<Field className={wide}>
					<FieldLabel htmlFor={id}>{title}</FieldLabel>
					<Textarea id={id} value={text} maxLength={field.max} required={field.required} disabled={disabled} onChange={(event) => onChange(event.target.value)} />
				</Field>
			);
		case 'paragraphs':
			return (
				<Field className={wide}>
					<FieldLabel htmlFor={id}>{title}</FieldLabel>
					<Textarea id={id} rows={8} value={lines.join('\n\n')} disabled={disabled} onChange={(event) => onChange(event.target.value.split(/\n[ \t]*\n/))} />
					<FieldDescription>{t('website.content.paragraphs.hint')}</FieldDescription>
				</Field>
			);
		case 'strings':
			return (
				<Field className={wide}>
					<FieldLabel htmlFor={id}>{title}</FieldLabel>
					<Textarea id={id} rows={4} value={lines.join('\n')} disabled={disabled} onChange={(event) => onChange(event.target.value.split('\n'))} />
					<FieldDescription>{t('website.content.strings.hint')}</FieldDescription>
				</Field>
			);
		case 'number':
			return (
				<Field>
					<FieldLabel htmlFor={id}>{title}</FieldLabel>
					<Input
						id={id}
						type='number'
						inputMode='numeric'
						min={0}
						max={field.max}
						step={1}
						value={typeof value === 'number' ? value : ''}
						disabled={disabled}
						onChange={(event) => onChange(event.target.value === '' ? undefined : Math.trunc(Number(event.target.value)))}
					/>
				</Field>
			);
		case 'boolean':
			return (
				<Field orientation='horizontal'>
					<Switch id={id} checked={value === true} disabled={disabled} onCheckedChange={(checked) => onChange(checked ? true : undefined)} />
					<FieldLabel htmlFor={id}>{title}</FieldLabel>
				</Field>
			);
		case 'date':
			return (
				<Field>
					<FieldLabel htmlFor={id}>{title}</FieldLabel>
					<Input id={id} type='date' value={text} required={field.required} disabled={disabled} onChange={(event) => onChange(event.target.value || undefined)} />
				</Field>
			);
		case 'icon':
		case 'select':
			return (
				<Field>
					<FieldLabel htmlFor={id}>{title}</FieldLabel>
					<NativeSelect id={id} className='w-full' value={text} required={field.required} disabled={disabled} onChange={(event) => onChange(event.target.value || undefined)}>
						<NativeSelectOption value=''>{t('website.content.none')}</NativeSelectOption>
						{(field.options ?? []).map((option) => (
							<NativeSelectOption key={option} value={option}>
								{option}
							</NativeSelectOption>
						))}
					</NativeSelect>
				</Field>
			);
		case 'url':
			return (
				<Field className={wide}>
					<FieldLabel htmlFor={id}>{title}</FieldLabel>
					{/* Site paths (`/contact`) are valid too, so not `type='url'`. */}
					<Input id={id} type='text' inputMode='url' placeholder='/path · https://…' value={text} disabled={disabled} onChange={(event) => onChange(event.target.value)} />
				</Field>
			);
		default:
			return (
				<Field className={wide}>
					<FieldLabel htmlFor={id}>{title}</FieldLabel>
					<Input id={id} type='text' value={text} maxLength={field.max} required={field.required} disabled={disabled} onChange={(event) => onChange(event.target.value)} />
				</Field>
			);
	}
}

function ListField({
	field,
	id,
	title,
	value,
	onChange,
	disabled,
}: {
	field: TContentField;
	id: string;
	title: string;
	value: TValue[];
	onChange: (value: unknown) => void;
	disabled?: boolean;
}) {
	const { t } = useTranslation('integrations');
	const max = field.max ?? 50;
	const move = (from: number, to: number) => {
		const next = [...value];
		const [entry] = next.splice(from, 1);
		next.splice(to, 0, entry!);
		onChange(next);
	};
	return (
		<fieldset className='flex flex-col gap-3 rounded-lg border p-4 md:col-span-2'>
			<legend className='px-1 text-sm font-medium'>{title}</legend>
			{value.map((entry, index) => (
				<div key={index} className='bg-muted/30 flex flex-col gap-3 rounded-md border p-3'>
					<div className='flex items-center justify-between'>
						<span className='text-muted-foreground text-xs font-medium'>#{index + 1}</span>
						<div className='flex gap-1'>
							<Button type='button' size='icon' variant='ghost' disabled={disabled || index === 0} aria-label={t('website.content.list.up')} onClick={() => move(index, index - 1)}>
								<ArrowUp />
							</Button>
							<Button
								type='button'
								size='icon'
								variant='ghost'
								disabled={disabled || index === value.length - 1}
								aria-label={t('website.content.list.down')}
								onClick={() => move(index, index + 1)}
							>
								<ArrowDown />
							</Button>
							<Button type='button' size='icon' variant='ghost' disabled={disabled} aria-label={t('website.content.list.remove')} onClick={() => onChange(value.filter((_, at) => at !== index))}>
								<Trash2 />
							</Button>
						</div>
					</div>
					<ContentFields
						fields={field.fields ?? []}
						value={entry}
						disabled={disabled}
						idPrefix={`${id}-${index}`}
						onChange={(next) => onChange(value.map((current, at) => (at === index ? next : current)))}
					/>
				</div>
			))}
			<div className='flex items-center gap-3'>
				<Button type='button' variant='outline' size='sm' disabled={disabled || value.length >= max} onClick={() => onChange([...value, {}])}>
					<Plus /> {t('website.content.list.add')}
				</Button>
				<span className='text-muted-foreground text-xs'>{t('website.content.list.max', { max })}</span>
			</div>
		</fieldset>
	);
}

/** An image: an uploaded asset (`asset:<id>`), a site path or an https link. */
function ImageInput({ id, value, onChange, disabled }: { id: string; value: string; onChange: (value: string) => void; disabled?: boolean }) {
	const { t } = useTranslation(['integrations', 'common']);
	const queryClient = useQueryClient();
	const fileRef = useRef<HTMLInputElement>(null);
	const [libraryOpen, setLibraryOpen] = useState(false);
	const [uploading, setUploading] = useState(false);
	const assets = useQuery({ ...webAssetsQueryOptions(), enabled: value.startsWith('asset:') || libraryOpen });

	const preview = value.startsWith('asset:') ? assets.data?.find((asset) => asset.ref === value)?.url : value.startsWith('https://') ? value : undefined;

	const upload = async (file: File) => {
		setUploading(true);
		try {
			const asset = await uploadWebAsset(file);
			await queryClient.invalidateQueries({ queryKey: ['website', 'assets'] });
			onChange(asset.ref);
			toast.success(t('website.content.image.uploaded'));
		} catch (cause) {
			toast.error(cause instanceof Error ? cause.message : t('common:error.failed'));
		} finally {
			setUploading(false);
		}
	};

	return (
		<div className='flex w-full flex-col gap-2'>
			<div className='flex items-start gap-3'>
				<div className='bg-muted flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-md border'>
					{preview ? <img src={preview} alt='' className='size-full object-cover' /> : <Images className='text-muted-foreground size-5' />}
				</div>
				<div className='flex min-w-0 flex-1 flex-col gap-2'>
					<Input id={id} type='text' inputMode='url' placeholder='/images/… · https://…' value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} />
					<div className='flex flex-wrap gap-2'>
						<Button type='button' size='sm' variant='outline' disabled={disabled || uploading} onClick={() => fileRef.current?.click()}>
							<ImagePlus /> {t('website.content.image.upload')}
						</Button>
						<Button type='button' size='sm' variant='outline' disabled={disabled} onClick={() => setLibraryOpen(true)}>
							<Images /> {t('website.content.image.choose')}
						</Button>
						{value ? (
							<Button type='button' size='sm' variant='ghost' disabled={disabled} onClick={() => onChange('')}>
								<X /> {t('website.content.image.clear')}
							</Button>
						) : null}
					</div>
				</div>
			</div>
			<input
				ref={fileRef}
				type='file'
				accept='image/*'
				className='hidden'
				onChange={(event) => {
					const file = event.target.files?.[0];
					event.target.value = '';
					if (file) void upload(file);
				}}
			/>
			<FieldDescription>{t('website.content.image.hint')}</FieldDescription>
			<ImageLibrary
				open={libraryOpen}
				onOpenChange={setLibraryOpen}
				assets={assets.data ?? []}
				loading={assets.isPending}
				onPick={(asset) => {
					onChange(asset.ref);
					setLibraryOpen(false);
				}}
			/>
		</div>
	);
}

function ImageLibrary({
	open,
	onOpenChange,
	assets,
	loading,
	onPick,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	assets: TWebAsset[];
	loading: boolean;
	onPick: (asset: TWebAsset) => void;
}) {
	const { t } = useTranslation(['integrations', 'common']);
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className='sm:max-w-3xl'>
				<DialogHeader>
					<DialogTitle>{t('website.content.image.library')}</DialogTitle>
					<DialogDescription>{t('website.content.image.hint')}</DialogDescription>
				</DialogHeader>
				{loading ? (
					<p className='text-muted-foreground text-sm'>{t('common:state.loading')}</p>
				) : assets.length === 0 ? (
					<p className='text-muted-foreground text-sm'>{t('website.content.image.libraryEmpty')}</p>
				) : (
					<div className='grid max-h-[60vh] grid-cols-3 gap-3 overflow-y-auto sm:grid-cols-4'>
						{assets.map((asset) => (
							<button
								key={asset.id}
								type='button'
								className='hover:ring-primary flex flex-col gap-1 rounded-md border p-1 text-left hover:ring-2'
								onClick={() => onPick(asset)}
							>
								<img src={asset.url} alt={asset.altText ?? ''} className='aspect-square w-full rounded object-cover' />
								<span className='truncate text-xs'>{asset.fileName}</span>
							</button>
						))}
					</div>
				)}
			</DialogContent>
		</Dialog>
	);
}
