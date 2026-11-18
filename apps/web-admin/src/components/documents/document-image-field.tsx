import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@ims-erp/ui/components/button';
import { Field, FieldDescription, FieldLabel } from '@ims-erp/ui/components/field';
import { toast } from '@/components/toast';
import { DOCUMENT_IMAGE_MAX_BYTES } from '@/lib/document-image-api';
import { encodeWebp, rejectImageFile } from '@/lib/image-file';

/**
 * Preview, upload and removal of one image printed on documents (company
 * logo and signature, item photos).
 *
 * @remarks
 * The picked file is converted to WebP **here**, so every caller (and every
 * future one) gets a small, predictable upload without repeating the canvas
 * code: longest side 1024px, quality 0.9. The caller only does the request and
 * refreshes its data; the server validates the bytes again.
 */
export function DocumentImageField({
	label,
	hint,
	imageUrl,
	disabled,
	onUpload,
	onRemove,
}: {
	label: string;
	hint?: string;
	imageUrl: string | null | undefined;
	disabled?: boolean;
	/** Receives the WebP-converted file, named `<original>.webp`. */
	onUpload: (file: File) => Promise<void>;
	onRemove: () => Promise<void>;
}) {
	const { t } = useTranslation('common');
	const id = useId();
	const [busy, setBusy] = useState(false);
	const [dragging, setDragging] = useState(false);

	async function run(action: () => Promise<void>) {
		setBusy(true);
		try {
			await action();
		} catch (cause) {
			toast.error(cause instanceof Error ? cause.message : t('error.failed'));
		} finally {
			setBusy(false);
		}
	}

	/** Validates, converts to WebP, then hands the result to the caller. */
	async function accept(file: File | null | undefined) {
		const rejected = rejectImageFile(file);
		if (rejected === 'type') {
			toast.error(t('image.wrongType'));
			return;
		}
		if (rejected === 'size' || !file) {
			toast.error(t('image.sourceTooLarge'));
			return;
		}

		await run(async () => {
			const webp = await encodeWebp(file);
			if (webp.size > DOCUMENT_IMAGE_MAX_BYTES) {
				toast.error(t('image.tooLarge'));
				return;
			}
			const name = `${file.name.replace(/\.[^.]+$/, '')}.webp`;
			await onUpload(new File([webp], name, { type: 'image/webp' }));
		});
	}

	return (
		<Field>
			<FieldLabel htmlFor={id}>{label}</FieldLabel>
			<label
				htmlFor={id}
				className={`flex h-32 w-full max-w-xs cursor-pointer flex-col items-center justify-center gap-1 overflow-hidden rounded-md border border-dashed bg-muted/30 px-3 text-center transition-colors ${
					dragging ? 'border-primary bg-primary/5' : ''
				} ${busy ? 'cursor-wait opacity-60' : ''}`}
				onDragOver={(event) => {
					event.preventDefault();
					if (!disabled) setDragging(true);
				}}
				onDragLeave={() => setDragging(false)}
				onDrop={(event) => {
					event.preventDefault();
					setDragging(false);
					if (disabled || busy) return;
					void accept(event.dataTransfer.files?.[0]);
				}}
			>
				{imageUrl ? (
					<img src={imageUrl} alt={label} className='max-h-full max-w-full object-contain' />
				) : (
					<>
						<span className='text-xs text-muted-foreground'>{t('image.none')}</span>
						{!disabled && (
							<span className='text-xs text-muted-foreground'>{t('image.drop')}</span>
						)}
					</>
				)}
			</label>
			{!disabled && (
				<div className='flex flex-wrap items-center gap-2'>
					<input
						id={id}
						type='file'
						accept='image/*'
						disabled={busy}
						className='hidden'
						onChange={(event) => {
							const file = event.target.files?.[0];
							event.target.value = '';
							if (!file) return;
							void accept(file);
						}}
					/>
					<Button
						type='button'
						variant='outline'
						size='sm'
						disabled={busy}
						onClick={() => document.getElementById(id)?.click()}
					>
						{busy ? t('image.converting') : imageUrl ? t('image.replace') : t('image.choose')}
					</Button>
					{imageUrl && (
						<Button
							type='button'
							variant='outline'
							size='sm'
							disabled={busy}
							onClick={() => void run(onRemove)}
						>
							{t('image.remove')}
						</Button>
					)}
				</div>
			)}
			<FieldDescription>{hint ?? t('image.hint')}</FieldDescription>
		</Field>
	);
}
