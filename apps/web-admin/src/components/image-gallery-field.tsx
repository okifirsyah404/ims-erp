import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, ImagePlus, Loader2, X } from 'lucide-react';
import { useEffect, useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@ims-erp/ui/components/badge';
import { Button } from '@ims-erp/ui/components/button';
import { Field, FieldDescription, FieldLabel } from '@ims-erp/ui/components/field';
import { Input } from '@ims-erp/ui/components/input';
import { toast } from '@/components/toast';
import { rejectImageFile } from '@/lib/image-file';
import {
	galleryQueryKey,
	galleryQueryOptions,
	MAX_GALLERY_IMAGES,
	removeGalleryImage,
	reorderGalleryImages,
	updateGalleryCaption,
	uploadGalleryImages,
} from '@/lib/image-gallery-api';

/**
 * Multi-image field for products, components, materials, assets and
 * warehouses (up to {@link MAX_GALLERY_IMAGES}; the first image is the cover).
 *
 * @remarks
 * Two kinds of tiles share one grid:
 * - **saved** images (when `entityPath` is set) are changed immediately:
 *   reorder, caption and remove call the API right away;
 * - **queued** files are picked but not uploaded yet. The owner of the form
 *   holds the `queue` and uploads it with `uploadGalleryImages` once the
 *   record exists (create) or is saved (edit) — pass `immediate` to upload on
 *   pick instead (detail pages).
 */
export function ImageGalleryField({
	label,
	hint,
	entityPath,
	queue,
	onQueueChange,
	immediate = false,
	disabled = false,
}: {
	label: string;
	hint?: string;
	/** API base of the saved record (e.g. `/products/<id>`); absent on create. */
	entityPath?: string;
	queue: File[];
	onQueueChange: (files: File[]) => void;
	/** Upload on pick instead of queueing (needs `entityPath`). */
	immediate?: boolean;
	disabled?: boolean;
}) {
	const { t } = useTranslation('common');
	const queryClient = useQueryClient();
	const inputId = useId();
	const [dragging, setDragging] = useState(false);
	const [uploading, setUploading] = useState(false);

	const { data: saved = [] } = useQuery({
		...galleryQueryOptions(entityPath ?? ''),
		enabled: Boolean(entityPath),
	});

	const previews = useMemo(() => queue.map((file) => URL.createObjectURL(file)), [queue]);
	useEffect(() => () => previews.forEach((url) => URL.revokeObjectURL(url)), [previews]);

	const total = saved.length + queue.length;
	const room = MAX_GALLERY_IMAGES - total;

	/** Refreshes the gallery and every list that shows the cover. */
	async function refresh() {
		if (entityPath) await queryClient.invalidateQueries({ queryKey: galleryQueryKey(entityPath) });
		await queryClient.invalidateQueries();
	}

	const change = useMutation({
		mutationFn: (action: () => Promise<unknown>) => action(),
		onSuccess: refresh,
		onError: (error: Error) => toast.error(error.message),
	});

	async function accept(list: FileList | File[] | null | undefined) {
		const files = Array.from(list ?? []);
		if (!files.length || disabled) return;
		const valid: File[] = [];
		for (const file of files) {
			const rejected = rejectImageFile(file);
			if (rejected === 'type') toast.error(t('image.wrongType'));
			else if (rejected === 'size') toast.error(t('image.sourceTooLarge'));
			else valid.push(file);
		}
		const accepted = valid.slice(0, Math.max(room, 0));
		if (valid.length > accepted.length) toast.error(t('gallery.limit', { max: MAX_GALLERY_IMAGES }));
		if (!accepted.length) return;

		if (immediate && entityPath) {
			setUploading(true);
			try {
				const errors = await uploadGalleryImages(entityPath, accepted);
				if (errors.length) toast.error(errors.join(' '));
				await refresh();
			} finally {
				setUploading(false);
			}
			return;
		}
		onQueueChange([...queue, ...accepted]);
	}

	function move(index: number, by: -1 | 1) {
		if (!entityPath) return;
		const ids = saved.map((image) => image.id);
		const target = index + by;
		if (target < 0 || target >= ids.length) return;
		const moved = ids.splice(index, 1)[0];
		if (moved === undefined) return;
		ids.splice(target, 0, moved);
		change.mutate(() => reorderGalleryImages(entityPath, ids));
	}

	const busy = uploading || change.isPending;
	const tile = 'relative flex aspect-square flex-col overflow-hidden rounded-md border bg-muted/30';

	return (
		<Field>
			<FieldLabel htmlFor={inputId}>
				{label} <span className='text-xs text-muted-foreground'>({total}/{MAX_GALLERY_IMAGES})</span>
			</FieldLabel>
			<div className='grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4'>
				{saved.map((image, index) => (
					<div key={image.id} className='flex flex-col gap-1'>
						<div className={tile}>
							{image.url ? (
								<img src={image.url} alt={image.caption ?? label} className='h-full w-full object-cover' />
							) : null}
							{index === 0 && (
								<Badge className='absolute left-1 top-1' variant='secondary'>
									{t('gallery.cover')}
								</Badge>
							)}
							{!disabled && (
								<div className='absolute inset-x-1 bottom-1 flex items-center justify-between gap-1'>
									<div className='flex gap-1'>
										<Button
											type='button'
											size='icon'
											variant='secondary'
											className='size-6'
											aria-label={t('gallery.moveEarlier')}
											disabled={busy || index === 0}
											onClick={() => move(index, -1)}
										>
											<ArrowLeft className='size-3' />
										</Button>
										<Button
											type='button'
											size='icon'
											variant='secondary'
											className='size-6'
											aria-label={t('gallery.moveLater')}
											disabled={busy || index === saved.length - 1}
											onClick={() => move(index, 1)}
										>
											<ArrowRight className='size-3' />
										</Button>
									</div>
									<Button
										type='button'
										size='icon'
										variant='destructive'
										className='size-6'
										aria-label={t('image.remove')}
										disabled={busy}
										onClick={() => entityPath && change.mutate(() => removeGalleryImage(entityPath, image.id))}
									>
										<X className='size-3' />
									</Button>
								</div>
							)}
						</div>
						{!disabled && entityPath && (
							<Input
								key={`${image.id}:${image.caption ?? ''}`}
								defaultValue={image.caption ?? ''}
								maxLength={200}
								placeholder={t('gallery.caption')}
								className='h-7 text-xs'
								onBlur={(event) => {
									const next = event.target.value.trim() || null;
									if (next !== image.caption) change.mutate(() => updateGalleryCaption(entityPath, image.id, next));
								}}
							/>
						)}
					</div>
				))}

				{queue.map((file, index) => (
					<div key={`${file.name}:${file.size}:${file.lastModified}:${index}`} className={tile}>
						<img src={previews[index]} alt={file.name} className='h-full w-full object-cover' />
						<Badge className='absolute left-1 top-1' variant='outline'>
							{saved.length === 0 && index === 0 ? t('gallery.cover') : t('gallery.pending')}
						</Badge>
						{!disabled && (
							<Button
								type='button'
								size='icon'
								variant='destructive'
								className='absolute bottom-1 right-1 size-6'
								aria-label={t('image.remove')}
								onClick={() => onQueueChange(queue.filter((_, i) => i !== index))}
							>
								<X className='size-3' />
							</Button>
						)}
					</div>
				))}

				{!disabled && room > 0 && (
					<label
						htmlFor={inputId}
						className={`flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed px-2 text-center text-xs text-muted-foreground transition-colors hover:bg-muted/40 ${
							dragging ? 'border-primary bg-primary/5' : ''
						} ${busy ? 'cursor-wait opacity-60' : ''}`}
						onDragOver={(event) => {
							event.preventDefault();
							setDragging(true);
						}}
						onDragLeave={() => setDragging(false)}
						onDrop={(event) => {
							event.preventDefault();
							setDragging(false);
							if (!busy) void accept(event.dataTransfer.files);
						}}
					>
						{uploading ? <Loader2 className='size-5 animate-spin' /> : <ImagePlus className='size-5' />}
						<span>{t('gallery.add')}</span>
					</label>
				)}
			</div>
			<input
				id={inputId}
				type='file'
				accept='image/*'
				multiple
				disabled={disabled || busy}
				className='hidden'
				onChange={(event) => {
					const files = event.target.files;
					void accept(files);
					event.target.value = '';
				}}
			/>
			<FieldDescription>{hint ?? t('gallery.hint', { max: MAX_GALLERY_IMAGES })}</FieldDescription>
		</Field>
	);
}
