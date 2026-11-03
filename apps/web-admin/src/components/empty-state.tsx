import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from '@ims-erp/ui/components/empty';

/**
 * Shared empty/error state for list pages and empty sections.
 *
 * @remarks
 * Thin wrapper over the `@ims-erp/ui` Empty composition (shadcn Base Empty)
 * so every page renders the same dashed placeholder: icon in a muted tile,
 * title, optional description, optional action (e.g. a create button).
 * Pass `className='border'` (or any override) via `className` — the base
 * `Empty` only styles the dash pattern, not the border width, so a boxed
 * look needs it.
 */
export function EmptyState({
	icon: Icon,
	title,
	description,
	action,
	className,
}: {
	/** Icon shown in a muted square tile. */
	icon: LucideIcon;
	/** Primary one-liner, e.g. "No warehouses yet". */
	title: string;
	/** Secondary explanation; keep to one sentence. */
	description?: string;
	/** Optional call to action, typically a single Button. */
	action?: ReactNode;
	className?: string;
}) {
	return (
		<Empty className={className}>
			<EmptyHeader>
				<EmptyMedia variant='icon'>
					<Icon />
				</EmptyMedia>
				<EmptyTitle>{title}</EmptyTitle>
				{description ? (
					<EmptyDescription>{description}</EmptyDescription>
				) : null}
			</EmptyHeader>
			{action ? <EmptyContent>{action}</EmptyContent> : null}
		</Empty>
	);
}
