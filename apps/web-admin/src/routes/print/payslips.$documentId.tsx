import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { z } from 'zod';

import { ErrorState } from '@/components/empty-state';
import { PayslipDocument } from '@/components/hr/payslip-document';
import { payslipRenderQueryOptions } from '@/lib/hr-records-api';

/** The backend appends its short-lived render token as `?token=…`. */
const printSearchSchema = z.object({
	token: z.string().min(1),
});

/**
 * `/print/payslips/$documentId?token=…` — the payslip for the backend's
 * PDF renderer (ERP-0122), same contract as the
 * quotation print view: public, the render token is the only credential, and
 * the page marks itself `data-render-ready="true"` once its images loaded.
 */
export const Route = createFileRoute('/print/payslips/$documentId')({
	validateSearch: printSearchSchema,
	component: PayslipRenderPage,
});

function PayslipRenderPage() {
	const { documentId } = Route.useParams();
	const { token } = Route.useSearch();
	const render = useQuery(payslipRenderQueryOptions(documentId, token));
	const [ready, setReady] = useState(false);

	// Printed like paper: a white page background.
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

	if (render.isError) {
		return (
			<div className='p-8'>
				<ErrorState error={render.error} />
			</div>
		);
	}
	if (!render.data) return null;
	return (
		<div data-render-ready={ready ? 'true' : 'false'}>
			<PayslipDocument data={render.data} />
		</div>
	);
}
