import type { ReactNode } from 'react';

import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';

import { Button } from '@ims-erp/ui/components/button';

/** The server-side sort of a paginated list. */
export type TServerSort<TKey extends string> = { key: TKey; order: 'asc' | 'desc' };

/**
 * Sortable column header for a **server-paginated** table (ERP-0114).
 *
 * @remarks
 * `DataTableColumnHeader` sorts the rows in memory, which on a paginated
 * table reorders only the current page. This header instead reports the
 * requested `{ key, order }` to the page, which sends it to the API (`sort`,
 * `order`) and resets to page 1. Clicking the active column flips the order;
 * another column starts ascending.
 */
export function ServerSortHeader<TKey extends string>({
	title,
	sortKey,
	sort,
	onSortChange,
}: {
	title: ReactNode;
	sortKey: TKey;
	sort: TServerSort<TKey>;
	onSortChange: (next: TServerSort<TKey>) => void;
}) {
	const active = sort.key === sortKey;
	const next: TServerSort<TKey> = {
		key: sortKey,
		order: active && sort.order === 'asc' ? 'desc' : 'asc',
	};
	return (
		<Button
			variant='ghost'
			size='sm'
			className='-ml-2 h-8'
			aria-sort={active ? (sort.order === 'asc' ? 'ascending' : 'descending') : undefined}
			onClick={() => onSortChange(next)}
		>
			{title}
			{!active ? (
				<ChevronsUpDown className='ml-1 size-3.5 opacity-50' aria-hidden='true' />
			) : sort.order === 'desc' ? (
				<ArrowDown className='ml-1 size-3.5' aria-hidden='true' />
			) : (
				<ArrowUp className='ml-1 size-3.5' aria-hidden='true' />
			)}
		</Button>
	);
}
