import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@ims-erp/ui/components/button';
import {
	Pagination,
	PaginationContent,
	PaginationEllipsis,
	PaginationItem,
} from '@ims-erp/ui/components/pagination';
import { cn } from 'cn';

/** A page number or an ellipsis gap marker in the page window. */
type TPageEntry = number | 'ellipsis';

/**
 * Builds the visible page entries for the classic
 * `1 … 4 5 6 … 12` pattern: first and last pages are always shown,
 * a ±1 window surrounds the current page, and ellipses fill the gaps.
 * Small page counts render every number.
 *
 * @example
 * pageWindow(1, 12)  // [1, 2, 3, 'ellipsis', 12]
 * pageWindow(5, 12)  // [1, 'ellipsis', 4, 5, 6, 'ellipsis', 12]
 * pageWindow(12, 12) // [1, 'ellipsis', 10, 11, 12]
 */
export function pageWindow(page: number, totalPages: number): TPageEntry[] {
	if (totalPages <= 7) {
		return Array.from({ length: totalPages }, (_, index) => index + 1);
	}

	const entries: TPageEntry[] = [1];
	// A fixed 3-number window, clamped so it never touches the first/last
	// entries it duplicates (page 1 shows 2 3 4, page 12 shows 10 11 12).
	const start = Math.max(2, Math.min(page - 1, totalPages - 2));
	const end = Math.min(totalPages - 1, start + 2);
	if (start > 2) entries.push('ellipsis');
	for (let number = start; number <= end; number++) entries.push(number);
	if (end < totalPages - 1) entries.push('ellipsis');
	entries.push(totalPages);
	return entries;
}

/**
 * Shared pagination control for web-admin list pages, built on the
 * `@ims-erp/ui` pagination primitives (nav/content/item/ellipsis) with
 * `Button`-based links so SPA navigation can disable bounds and swap
 * pages through `onPageChange` (no `<a href>` anchors).
 *
 * Renders nothing when there is at most one page — callers don't need
 * their own guard.
 */
export function PaginationControls({
	page,
	totalPages,
	onPageChange,
	className,
}: {
	page: number;
	totalPages: number;
	onPageChange: (page: number) => void;
	className?: string;
}) {
	const { t } = useTranslation('common');

	if (totalPages <= 1) return null;

	return (
		<div className={cn('mt-4 flex items-center justify-end gap-2', className)}>
			<span className='text-xs text-muted-foreground'>
				{t('pagination.summary', { page, totalPages })}
			</span>
			<Pagination className='mx-0 w-auto'>
				<PaginationContent>
					<PaginationItem>
						<Button
							variant='outline'
							size='sm'
							disabled={page <= 1}
							aria-label={t('action.previous')}
							onClick={() => onPageChange(page - 1)}
						>
							<ChevronLeft className='size-4' data-icon='inline-start' />
							{t('action.previous')}
						</Button>
					</PaginationItem>
					{pageWindow(page, totalPages).map((entry, index) =>
						entry === 'ellipsis' ? (
							<PaginationItem key={`ellipsis-${index}`}>
								<PaginationEllipsis />
							</PaginationItem>
						) : (
							<PaginationItem key={entry}>
								<Button
									variant={entry === page ? 'outline' : 'ghost'}
									size='icon-sm'
									aria-label={t('pagination.goto', { page: entry })}
									aria-current={entry === page ? 'page' : undefined}
									onClick={() => onPageChange(entry)}
								>
									{entry}
								</Button>
							</PaginationItem>
						),
					)}
					<PaginationItem>
						<Button
							variant='outline'
							size='sm'
							disabled={page >= totalPages}
							aria-label={t('action.next')}
							onClick={() => onPageChange(page + 1)}
						>
							{t('action.next')}
							<ChevronRight className='size-4' data-icon='inline-end' />
						</Button>
					</PaginationItem>
				</PaginationContent>
			</Pagination>
		</div>
	);
}
