import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { z } from 'zod';

import { QuotationDocument } from '@/components/sales/quotation-document';
import { quotationRenderQueryOptions } from '@/lib/quotation-api';

/** The backend appends its short-lived render token as `?token=…`. */
const printSearchSchema = z.object({
	token: z.string().min(1),
});

/**
 * `/print/quotations/$quotationId?token=…` — the SPH exactly as the print
 * page shows it, for the backend's PDF renderer (ERP-0067).
 *
 * @remarks
 * Public: the render token is the only credential (no session, no app
 * shell). Once the document and every image have loaded the page marks
 * itself `data-render-ready="true"`, which is what the renderer waits for.
 */
export const Route = createFileRoute('/print/quotations/$quotationId')({
	validateSearch: printSearchSchema,
	component: QuotationRenderPage,
});

function QuotationRenderPage() {
	const { quotationId } = Route.useParams();
	const { token } = Route.useSearch();
	const render = useQuery(quotationRenderQueryOptions(quotationId, token));
	const [ready, setReady] = useState(false);

	// The PDF prints backgrounds (for the coloured SPH bars), so the app's
	// page background must be white here, like paper.
	useEffect(() => {
		const { body } = document;
		const previous = body.style.background;
		body.style.background = 'white';
		return () => {
			body.style.background = previous;
		};
	}, []);

	useEffect(() => {
		if (!render.data) return;
		let cancelled = false;
		const pending = Array.from(document.images)
			.filter((image) => !image.complete)
			.map(
				(image) =>
					new Promise((resolve) => {
						// A broken image must not hold the PDF back forever.
						image.addEventListener('load', resolve, { once: true });
						image.addEventListener('error', resolve, { once: true });
					}),
			);
		void Promise.all(pending).then(() => {
			if (!cancelled) setReady(true);
		});
		return () => {
			cancelled = true;
		};
	}, [render.data]);

	if (render.isError) return <p className='p-8 text-sm text-destructive'>{render.error.message}</p>;
	if (!render.data) return null;
	return (
		<div data-render-ready={ready ? 'true' : 'false'}>
			<QuotationDocument quotation={render.data.quotation} profile={render.data.profile} />
		</div>
	);
}
