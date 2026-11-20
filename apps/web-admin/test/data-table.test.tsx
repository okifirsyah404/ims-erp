import { describe, expect, test } from 'bun:test';
import { renderToString } from 'react-dom/server';
import type { ColumnDef } from '@tanstack/react-table';

import type { DataTableFeatures } from '@/components/data-table/data-table-features';
import { DataTable } from '@/components/data-table/data-table';

type TRow = { id: string; code: string; total: number };

const columns: ColumnDef<DataTableFeatures, TRow, unknown>[] = [
	{ accessorKey: 'code', header: 'Code' },
	{
		accessorKey: 'total',
		header: 'Total',
		meta: { align: 'right', cellClassName: 'font-mono' },
	},
];

const rows: TRow[] = [
	{ id: 'a', code: 'AA-1', total: 10 },
	{ id: 'b', code: 'BB-2', total: 20 },
];

describe('DataTable', () => {
	test('renders one cell per column and row', () => {
		const html = renderToString(
			<DataTable columns={columns} data={rows} getRowId={(row) => row.id} />,
		);
		expect(html).toContain('>Code<');
		expect(html).toContain('>AA-1<');
		expect(html).toContain('>BB-2<');
		expect(html).toContain('>10<');
		expect(html).toContain('>20<');
		expect(html.match(/<tr/g)?.length).toBe(3); // header + 2 rows
	});

	test('applies meta.align to both header and cells', () => {
		const html = renderToString(
			<DataTable columns={columns} data={rows} getRowId={(row) => row.id} />,
		);
		// Header "Total" plus its two cells, all right-aligned.
		expect(html.match(/text-right/g)?.length).toBe(3);
		expect(html.match(/font-mono/g)?.length).toBe(2);
	});

	test('renders the empty state inside the table when there are no rows', () => {
		const html = renderToString(
			<DataTable
				columns={columns}
				data={[]}
				empty={<span>Nothing here</span>}
			/>,
		);
		expect(html).toContain('Nothing here');
		expect(html).toContain('colSpan="2"');
	});

	test('keeps the heading row when loading', () => {
		const html = renderToString(
			<DataTable columns={columns} data={rows} loading empty={<span>Loading</span>} />,
		);
		expect(html).toContain('Loading');
		expect(html).not.toContain('AA-1');
	});

	test('adds the bordered frame only when asked', () => {
		const plain = renderToString(<DataTable columns={columns} data={rows} />);
		const framed = renderToString(
			<DataTable columns={columns} data={rows} bordered />,
		);
		expect(plain).not.toContain('rounded-md border');
		expect(framed).toContain('rounded-md border');
	});

	test('applies rowClassName to the matching row only', () => {
		const html = renderToString(
			<DataTable
				columns={columns}
				data={rows}
				getRowId={(row) => row.id}
				rowClassName={(row) => (row.id === 'b' ? 'is-selected-row' : undefined)}
			/>,
		);
		expect(html.match(/is-selected-row/g)?.length).toBe(1);
	});
});
