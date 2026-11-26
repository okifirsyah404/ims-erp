import type { ReactNode } from 'react';

import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from '@ims-erp/ui/components/empty';
import { CircleAlert, Inbox, type LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

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
 * `icon` defaults to {@link Inbox}: an empty state always shows a mark, never
 * bare text. Pass a more specific icon (`SearchX` for "not found",
 * `MonitorOff` for "no sessions") when it reads better.
 */
export function EmptyState({
	icon: Icon = Inbox,
	title,
	description,
	action,
	tone = 'default',
	size = 'default',
	bordered = false,
	className,
}: {
	/** Icon shown in a muted square tile; defaults to `Inbox`. */
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

/** Readable message for whatever a failed query threw. */
export function errorMessage(error: unknown): string {
	if (error instanceof Error) return error.message || 'Something went wrong';
	if (typeof error === 'string' && error) return error;
	return 'Something went wrong';
}

/**
 * Shared "could not load" state: `EmptyState` with the error styling.
 *
 * @remarks
 * Title is always `common:error.failed`; the thrown message goes in the
 * description. Use it wherever a query's `isError` branch used to print the
 * message as bare text. Inline mutation failures (a button action, a form
 * submit) are not load failures and keep their own inline message.
 */
export function ErrorState({
	error,
	size = 'default',
	bordered = false,
	className,
}: {
	/** The thrown value, usually `query.error`. */
	error: unknown;
	/** `sm` inside a card, popover or table cell. */
	size?: 'default' | 'sm';
	/** Dashed outline for a standalone section state. */
	bordered?: boolean;
	className?: string;
}) {
	const { t } = useTranslation('common');
	return (
		<EmptyState
			icon={CircleAlert}
			tone='error'
			title={t('error.failed')}
			description={errorMessage(error)}
			size={size}
			bordered={bordered}
			className={className}
		/>
	);
}
