import type { ReactNode } from 'react';

import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@ims-erp/ui/components/card';

/**
 * The list-page frame used by `/admin/users`: a titled card holding the table,
 * its empty/error states and the pagination.
 *
 * @remarks
 * Keeping one wrapper means every list page has the same header rhythm and the
 * table never sits bare on the page background. Pass the table (and the
 * `PaginationControls` right after it) as `children`.
 */
export function DataTableCard({
	title,
	description,
	children,
}: {
	/** Card heading; omit when the page's `<h1>` already names the list. */
	title?: ReactNode;
	description?: ReactNode;
	children: ReactNode;
}) {
	return (
		<Card>
			{title || description ? (
				<CardHeader>
					{title ? <CardTitle>{title}</CardTitle> : null}
					{description ? <CardDescription>{description}</CardDescription> : null}
				</CardHeader>
			) : null}
			<CardContent>{children}</CardContent>
		</Card>
	);
}
