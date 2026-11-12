import { Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { pickImageFile } from '@/lib/image-file';

/**
 * Click-or-drag image picker (ERP-0041). Presentational only: the caller owns
 * the file (and therefore the encode/upload timing). A `<button>` wraps the
 * area so keyboard users get Enter/Space for free; the hidden file input is
 * the single source of selection for both click and drop.
 */
export function ImageDropzone({
	previewUrl = null,
	disabled = false,
	hint,
	label,
	variant = 'card',
	onSelect,
	onReject,
}: {
	previewUrl?: string | null;
	disabled?: boolean;
	hint: string;
	label: string;
	variant?: 'card' | 'compact';
	onSelect: (file: File) => void;
	onReject: () => void;
}) {
	const input = useRef<HTMLInputElement>(null);
	const [dragging, setDragging] = useState(false);

	const size = variant === 'compact' ? 'h-20 w-20' : 'h-32 w-32';

	function accept(file: File | undefined) {
		const picked = pickImageFile(file);
		if (!picked) {
			if (file) onReject();
			return;
		}
		onSelect(picked);
	}

	return (
		<button
			type='button'
			disabled={disabled}
			onClick={() => input.current?.click()}
			onDragEnter={(event) => {
				event.preventDefault();
				setDragging(true);
			}}
			onDragOver={(event) => event.preventDefault()}
			onDragLeave={() => setDragging(false)}
			onDrop={(event) => {
				event.preventDefault();
				setDragging(false);
				accept(event.dataTransfer.files[0]);
			}}
			className={`${size} shrink-0 rounded-md border border-dashed grid place-items-center overflow-hidden text-center transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 ${
				dragging ? 'border-primary bg-accent' : 'hover:bg-accent/50'
			}`}
			aria-label={label}
		>
			<input
				ref={input}
				type='file'
				accept='image/*'
				hidden
				onChange={(event) => {
					accept(event.target.files?.[0]);
					event.target.value = '';
				}}
			/>
			{previewUrl ? (
				<span className='relative h-full w-full'>
					<img
						src={previewUrl}
						alt={label}
						className='h-full w-full object-cover'
					/>
					<span className='absolute inset-0 grid place-items-center bg-background/60 opacity-0 hover:opacity-100'>
						<Upload className='h-5 w-5' />
					</span>
				</span>
			) : (
				<span className='flex flex-col items-center gap-1 p-2 text-muted-foreground'>
					<Upload className='h-5 w-5' />
					{variant === 'card' && (
						<span className='text-xs leading-tight'>{hint}</span>
					)}
				</span>
			)}
		</button>
	);
}
