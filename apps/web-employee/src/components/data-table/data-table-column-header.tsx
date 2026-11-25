import type { ReactNode } from 'react';

import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';

import { Button } from '@ims-erp/ui/components/button';
import type { Column, RowData } from '@tanstack/react-table';
import type { DataTableFeatures } from './data-table-features';

/**
 * Sortable column header button, following the shadcn Data Table guide.
 *
 * @remarks
 * Only use it on tables that sort **client-side**. Tables whose ordering comes
 * from the server keep a plain `header` string.
 */
export function DataTableColumnHeader<TData extends RowData, TValue>({
	column,
	title,
}: {
	column: Column<DataTableFeatures, TData, TValue>;
	title: ReactNode;
}) {
	if (!column.getCanSort()) return title;

	const sorted = column.getIsSorted();
	return (
		<Button
			variant='ghost'
			size='sm'
			className='-ml-2 h-8 data-[state=open]:bg-accent'
			onClick={() => column.toggleSorting(sorted === 'asc')}
		>
			{title}
			{sorted === 'desc' ? (
				<ArrowDown className='ml-1 size-3.5' aria-hidden='true' />
			) : sorted === 'asc' ? (
				<ArrowUp className='ml-1 size-3.5' aria-hidden='true' />
			) : (
				<ChevronsUpDown className='ml-1 size-3.5 opacity-50' aria-hidden='true' />
			)}
		</Button>
	);
}
