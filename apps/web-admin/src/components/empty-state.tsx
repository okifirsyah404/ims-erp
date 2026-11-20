import type { ReactNode } from 'react';

import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from '@ims-erp/ui/components/empty';
import type { LucideIcon } from 'lucide-react';

/**
 * Shared empty / error state (shadcn `Empty` composition).
 *
 * @remarks
 * One component for every "nothing here" and "could not load" case, so lists,
 * cards and tables all read the same:
 *
 * - `title` is the one-liner; `description` the optional explanation.
 * - `action` is a call to action, typically a single `Button`.
 * - `tone='error'` restyles the title for a failed load.
 * - `size='sm'` is for messages nested inside a card or a table cell.
 * - `bordered` adds the doc's outline variant. Standalone section states pass
 *   it; a state already sitting inside a `Card` or a data-table frame does not.
 *
 * `icon` is optional: a plain sentence ("No invoices yet") does not need one.
 */
export function EmptyState({
	icon: Icon,
	title,
	description,
	action,
	tone = 'default',
	size = 'default',
	bordered = false,
	className,
}: {
	/** Icon shown in a muted square tile. Omit for text-only states. */
	icon?: LucideIcon;
	/** Primary one-liner, e.g. "No warehouses yet". */
	title: ReactNode;
	/** Secondary explanation; keep to one sentence. */
	description?: ReactNode;
	/** Optional call to action, typically a single Button. */
	action?: ReactNode;
	/** `error` restyles the title for a failed load. */
	tone?: 'default' | 'error';
	/** `sm` is a compact variant for use inside a card or table cell. */
	size?: 'default' | 'sm';
	/** Draw the dashed outline (doc's "Outline" variant). */
	bordered?: boolean;
	className?: string;
}) {
	return (
		<Empty
			className={[
				bordered ? 'border' : '',
				size === 'sm' ? 'gap-2 p-4' : '',
				className ?? '',
			]
				.filter(Boolean)
				.join(' ')}
		>
			<EmptyHeader className={size === 'sm' ? 'gap-1' : undefined}>
				{Icon ? (
					<EmptyMedia variant='icon'>
						<Icon />
					</EmptyMedia>
				) : null}
				<EmptyTitle
					className={tone === 'error' ? 'text-destructive' : undefined}
				>
					{title}
				</EmptyTitle>
				{description ? (
					<EmptyDescription>{description}</EmptyDescription>
				) : null}
			</EmptyHeader>
			{action ? <EmptyContent>{action}</EmptyContent> : null}
		</Empty>
	);
}
