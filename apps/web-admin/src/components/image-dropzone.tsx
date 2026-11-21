import { Loader2, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { pickImageFile, rejectImageFile, type TImageRejectReason } from '@/lib/image-file';

/**
 * Click-or-drag image picker (ERP-0041; shared with the self profile avatar
 * since ERP-0107). Presentational only: the caller owns
 * the file (and therefore the encode/upload timing). A `<button>` wraps the
 * area so keyboard users get Enter/Space for free; the hidden file input is
 * the single source of selection for both click and drop.
 *
 * @remarks
 * `dragleave` also fires when the pointer crosses a child element, so the
 * highlight is driven by a depth counter instead of a boolean — otherwise the
 * dashed border flickers while the cursor moves inside the zone.
 */
export function ImageDropzone({
	previewUrl = null,
	disabled = false,
	busy = false,
	hint,
	label,
	variant = 'card',
	onSelect,
	onReject,
}: {
	previewUrl?: string | null;
	disabled?: boolean;
	/** Encode/upload in flight: shows a spinner and ignores input. */
	busy?: boolean;
	hint: string;
	label: string;
	variant?: 'card' | 'compact';
	onSelect: (file: File) => void;
	onReject: (reason: TImageRejectReason) => void;
}) {
	const input = useRef<HTMLInputElement>(null);
	const dragDepth = useRef(0);
	const [dragging, setDragging] = useState(false);
	const locked = disabled || busy;

	const size = variant === 'compact' ? 'h-20 w-20' : 'h-32 w-32';

	function accept(file: File | undefined) {
		if (!file || locked) return;
		const reason = rejectImageFile(file);
		if (reason) {
			onReject(reason);
			return;
		}
		const picked = pickImageFile(file);
		if (picked) onSelect(picked);
	}

	function endDrag() {
		dragDepth.current = 0;
		setDragging(false);
	}

	return (
		<button
			type='button'
			disabled={locked}
			onClick={() => input.current?.click()}
			onDragEnter={(event) => {
				event.preventDefault();
				dragDepth.current += 1;
				setDragging(true);
			}}
			onDragOver={(event) => event.preventDefault()}
			onDragLeave={(event) => {
				event.preventDefault();
				dragDepth.current -= 1;
				if (dragDepth.current <= 0) endDrag();
			}}
			onDrop={(event) => {
				event.preventDefault();
				endDrag();
				accept(event.dataTransfer.files[0]);
			}}
			className={`${size} shrink-0 rounded-md border border-dashed grid place-items-center overflow-hidden text-center transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${
				dragging ? 'border-primary bg-accent' : 'hover:bg-accent/50'
			}`}
			aria-label={label}
			aria-busy={busy}
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
			{busy ? (
				<span className='flex flex-col items-center gap-1 p-2 text-muted-foreground'>
					<Loader2 className='h-5 w-5 animate-spin' />
				</span>
			) : previewUrl ? (
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
