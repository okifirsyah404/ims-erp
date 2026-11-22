import { Package, type LucideIcon } from 'lucide-react';
import { useState } from 'react';

/**
 * Item/asset/warehouse picture with an icon fallback.
 *
 * @remarks
 * Photos are optional, and a signed photo URL can also fail (it expires after
 * an hour, or the object was removed), so every list that shows one needs the
 * same "no photo" block: a muted tile with the entity's icon, never a broken
 * image. `variant='cover'` is the card header (fixed height, full width);
 * `variant='thumb'` is the inline list square.
 *
 * A load error is remembered per `src`, so a refreshed URL gets a fresh try.
 */
export function ItemThumb({
	src,
	name,
	variant = 'thumb',
	icon: Icon = Package,
	className,
}: {
	src?: string | null;
	name: string;
	variant?: 'thumb' | 'cover';
	/** Shown when there is no photo or it failed to load. */
	icon?: LucideIcon;
	className?: string;
}) {
	const [failedSrc, setFailedSrc] = useState<string | null>(null);
	const shape =
		variant === 'cover' ? 'h-40 w-full rounded-none' : 'size-10 rounded';

	if (src && failedSrc !== src) {
		return (
			<img
				src={src}
				alt={name}
				loading='lazy'
				onError={() => setFailedSrc(src)}
				className={`${shape} object-cover ${className ?? ''}`}
			/>
		);
	}

	return (
		<div
			aria-hidden='true'
			className={`${shape} flex items-center justify-center bg-muted text-muted-foreground ${className ?? ''}`}
		>
			<Icon className={variant === 'cover' ? 'size-10' : 'size-5'} />
		</div>
	);
}
