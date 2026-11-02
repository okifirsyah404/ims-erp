import { createFileRoute } from '@tanstack/react-router';

import { BorrowingForm } from '@/components/inventory/borrowing-form';

/**
 * `/inventory/borrowings/new` — raise a borrowing.
 *
 * @remarks
 * Gated server-side on `borrowing:create`. The form only *raises* the document;
 * moving stock is a separate permission (`borrowing:issue`), which is why this
 * page cannot hand a unit out even if the caller holds the create grant alone.
 */
export const Route = createFileRoute('/_authed/inventory/borrowings/new')({
	component: NewBorrowingPage,
});

function NewBorrowingPage() {
	return <BorrowingForm />;
}
