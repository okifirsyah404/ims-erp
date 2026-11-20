import type { ReactNode } from 'react';

import {
	type CellData,
	type ColumnDef,
	type RowData,
	useTable,
} from '@tanstack/react-table';

import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@ims-erp/ui/components/table';
import { Skeleton } from '@ims-erp/ui/components/skeleton';
import { type DataTableFeatures, features } from './data-table-features';

const ALIGN_CLASS = {
	left: 'text-left',
	right: 'text-right',
	center: 'text-center',
} as const;

/** Alignment/classes for a cell, from `columnDef.meta`. */
function cellClasses(
	meta: { align?: 'left' | 'right' | 'center'; cellClassName?: string } | undefined,
) {
	return [meta?.align ? ALIGN_CLASS[meta.align] : '', meta?.cellClassName ?? '']
		.filter(Boolean)
		.join(' ');
}

/** Alignment/classes for a header cell: alignment only, plus head overrides. */
function headClasses(
	meta: { align?: 'left' | 'right' | 'center'; headClassName?: string } | undefined,
) {
	return [meta?.align ? ALIGN_CLASS[meta.align] : '', meta?.headClassName ?? '']
		.filter(Boolean)
		.join(' ');
}

/**
 * The single table renderer for `web-admin` (shadcn Data Table guide).
 *
 * @remarks
 * `@ims-erp/ui` `Table` supplies the markup; TanStack Table v9 supplies the
 * column model. Column alignment comes from `meta.align` so the header and the
 * cells can never drift apart (the old tables repeated `text-right` on both).
 *
 * Wrap it in a `Card` when the table is a page's main region:
 * `<Card className='gap-0 py-0'><CardContent className='p-0'><DataTable …/>`.
 */
export function DataTable<TData extends RowData>({
	columns,
	data,
	getRowId,
	empty,
	loading,
	skeletonRows = 5,
	bordered = false,
	rowClassName,
}: {
	/** Column definitions; build with `useMemo` so headers can use `t()`. */
	columns: ColumnDef<DataTableFeatures, TData, CellData>[];
	/** Rows already narrowed/filtered by the server for the current page. */
	data: TData[];
	/** Stable row id, usually `(row) => row.id`. */
	getRowId?: (row: TData) => string;
	/** Rendered inside the table when `data` is empty. */
	empty?: ReactNode;
	/** Renders `Skeleton` rows (one cell per column) in place of data. */
	loading?: boolean;
	/** How many placeholder rows to show while `loading` (default 5). */
	skeletonRows?: number;
	/** Draw the shadcn guide's `rounded-md border` frame around the table. */
	bordered?: boolean;
	/** Extra classes for a row, e.g. highlighting the selected record. */
	rowClassName?: (row: TData) => string | undefined;
}) {
	const table = useTable({ features, columns, data, getRowId });
	const headers = table.getHeaderGroups()[0]?.headers ?? [];
	const columnCount = Math.max(table.getAllLeafColumns().length, 1);
	const rows = table.getRowModel().rows;

	return (
		<div className={bordered ? 'overflow-hidden rounded-md border' : undefined}>
			<Table aria-busy={loading || undefined}>
				<TableHeader>
					<TableRow>
						{headers.map((header) => {
							const meta = header.column.columnDef.meta;
							return (
								<TableHead
									key={header.id}
									colSpan={header.colSpan}
									className={headClasses(meta)}
								>
									{header.isPlaceholder ? null : (
										<table.FlexRender header={header} />
									)}
								</TableHead>
							);
						})}
					</TableRow>
				</TableHeader>
				<TableBody>
					{loading ? (
						Array.from({ length: skeletonRows }, (_, rowIndex) => (
							<TableRow key={rowIndex} aria-hidden='true'>
								{table.getVisibleLeafColumns().map((column) => {
									const meta = column.columnDef.meta;
									return (
										<TableCell key={column.id} className={cellClasses(meta)}>
											<Skeleton
												className={`${meta?.skeletonClassName ?? 'h-4 w-full'} ${
													meta?.align === 'right' ? 'ml-auto' : ''
												} motion-reduce:animate-none`}
											/>
										</TableCell>
									);
								})}
							</TableRow>
						))
					) : rows.length === 0 ? (
						<TableRow>
							<TableCell
								colSpan={columnCount}
								className='h-24 text-center text-muted-foreground'
							>
								{empty}
							</TableCell>
						</TableRow>
					) : (
						rows.map((row) => (
							<TableRow key={row.id} className={rowClassName?.(row.original)}>
								{row.getVisibleCells().map((cell) => (
									<TableCell
										key={cell.id}
										className={cellClasses(cell.column.columnDef.meta)}
									>
										<table.FlexRender cell={cell} />
									</TableCell>
								))}
							</TableRow>
						))
					)}
				</TableBody>
			</Table>
		</div>
	);
}
