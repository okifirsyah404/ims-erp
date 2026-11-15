/**
 * Item/asset picture with an initials fallback.
 *
 * @remarks
 * Item photos are optional (`image_url` is nullable), so every list that shows
 * one needs the same "no photo" block — two muted initials, not a broken image
 * icon. `variant='cover'` is the card header (fixed height, full width);
 * `variant='thumb'` is the inline list square.
 */
export function ItemThumb({
	src,
	name,
	variant = 'thumb',
	className,
}: {
	src?: string | null;
	name: string;
	variant?: 'thumb' | 'cover';
	className?: string;
}) {
	const shape =
		variant === 'cover' ? 'h-40 w-full rounded-none' : 'size-10 rounded';

	if (src) {
		return (
			<img
				src={src}
				alt={name}
				loading='lazy'
				className={`${shape} object-cover ${className ?? ''}`}
			/>
		);
	}

	return (
		<div
			aria-hidden='true'
			className={`${shape} flex items-center justify-center bg-muted text-xs font-medium text-muted-foreground ${className ?? ''}`}
		>
			{name.slice(0, 2).toUpperCase()}
		</div>
	);
}
