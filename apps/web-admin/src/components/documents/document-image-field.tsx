import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@ims-erp/ui/components/button';
import { toast } from '@/components/toast';
import { DOCUMENT_IMAGE_ACCEPT, DOCUMENT_IMAGE_MAX_BYTES } from '@/lib/document-image-api';

/**
 * Preview, upload and removal of one image printed on documents. The
 * caller does the request and refreshes its data; this only picks and
 * checks the file (the server checks again).
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
	onUpload: (file: File) => Promise<void>;
	onRemove: () => Promise<void>;
}) {
	const { t } = useTranslation('common');
	const id = useId();
	const [busy, setBusy] = useState(false);

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

	return (
		<div className='flex flex-col gap-2'>
			<label htmlFor={id} className='text-sm font-medium'>
				{label}
			</label>
			<div className='flex h-32 w-full max-w-xs items-center justify-center overflow-hidden rounded-md border bg-muted/30'>
				{imageUrl ? (
					<img src={imageUrl} alt={label} className='max-h-full max-w-full object-contain' />
				) : (
					<span className='text-xs text-muted-foreground'>{t('image.none')}</span>
				)}
			</div>
			{!disabled && (
				<div className='flex flex-wrap items-center gap-2'>
					<input
						id={id}
						type='file'
						accept={DOCUMENT_IMAGE_ACCEPT}
						disabled={busy}
						className='text-sm file:mr-2 file:rounded-md file:border file:bg-transparent file:px-3 file:py-1'
						onChange={(event) => {
							const file = event.target.files?.[0];
							event.target.value = '';
							if (!file) return;
							if (file.size > DOCUMENT_IMAGE_MAX_BYTES) {
								toast.error(t('image.tooLarge'));
								return;
							}
							void run(() => onUpload(file));
						}}
					/>
					{imageUrl && (
						<Button type='button' variant='outline' size='sm' disabled={busy} onClick={() => void run(onRemove)}>
							{t('image.remove')}
						</Button>
					)}
				</div>
			)}
			<p className='text-xs text-muted-foreground'>{hint ?? t('image.hint')}</p>
		</div>
	);
}
