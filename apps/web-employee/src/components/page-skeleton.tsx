import { useTranslation } from 'react-i18next';

import { Card, CardContent, CardHeader } from '@ims-erp/ui/components/card';
import { Skeleton } from '@ims-erp/ui/components/skeleton';

const PULSE = 'motion-reduce:animate-none';

/**
 * Loading placeholder for a detail or edit page: a heading plus content cards.
 *
 * @remarks
 * Replaces `if (isPending) return null`, which left the page blank until the
 * query resolved. `cards` is the number of content cards; `lines` the text rows
 * in each. Announces itself to assistive tech with a screen-reader-only
 * `common:state.loading`.
 */
export function PageSkeleton({
	cards = 2,
	lines = 4,
}: {
	cards?: number;
	lines?: number;
}) {
	const { t } = useTranslation('common');
	return (
		<div className='flex flex-col gap-6' aria-busy='true'>
			<span className='sr-only'>{t('state.loading')}</span>
			<div className='flex flex-col gap-2' aria-hidden='true'>
				<Skeleton className={`h-7 w-56 ${PULSE}`} />
				<Skeleton className={`h-4 w-80 max-w-full ${PULSE}`} />
			</div>
			{Array.from({ length: cards }, (_, cardIndex) => (
				<Card key={cardIndex} aria-hidden='true'>
					<CardHeader>
						<Skeleton className={`h-5 w-40 ${PULSE}`} />
					</CardHeader>
					<CardContent className='flex flex-col gap-3'>
						{Array.from({ length: lines }, (_, lineIndex) => (
							<Skeleton
								key={lineIndex}
								className={`h-4 ${lineIndex % 3 === 2 ? 'w-2/3' : 'w-full'} ${PULSE}`}
							/>
						))}
					</CardContent>
				</Card>
			))}
		</div>
	);
}

/**
 * Compact loading placeholder for a small section inside a card or popover.
 *
 * @remarks
 * A few muted lines; use it where a list used to print "Loading…" as text.
 */
export function SectionSkeleton({ lines = 3 }: { lines?: number }) {
	const { t } = useTranslation('common');
	return (
		<div className='flex flex-col gap-2' aria-busy='true'>
			<span className='sr-only'>{t('state.loading')}</span>
			{Array.from({ length: lines }, (_, index) => (
				<Skeleton
					key={index}
					aria-hidden='true'
					className={`h-4 ${index % 3 === 2 ? 'w-2/3' : 'w-full'} ${PULSE}`}
				/>
			))}
		</div>
	);
}
