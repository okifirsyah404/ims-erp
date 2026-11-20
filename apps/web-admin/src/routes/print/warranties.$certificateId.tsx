import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';

import { RenderReady } from '@/components/print/render-ready';
import { WarrantyDocument } from '@/components/projects/warranty-document';
import { warrantyRenderQueryOptions } from '@/lib/print-render-api';

/**
 * `/print/warranties/$certificateId?token=…` — the warranty certificate exactly as the
 * staff print page shows it, for the backend's PDF renderer (customer portal downloads,
 * ERP-0079). Public: the render token is the only credential.
 */
export const Route = createFileRoute('/print/warranties/$certificateId')({
	validateSearch: z.object({ token: z.string().min(1) }),
	component: WarrantyRenderPage,
});

function WarrantyRenderPage() {
	const { certificateId } = Route.useParams();
	const { token } = Route.useSearch();
	const render = useQuery(warrantyRenderQueryOptions(certificateId, token));

	if (render.isError) return <p className='p-8 text-sm text-destructive'>{render.error.message}</p>;
	if (!render.data) return null;
	return (
		<RenderReady>
			<div className='p-12'>
				<WarrantyDocument warranty={render.data.warranty} profile={render.data.profile} />
			</div>
		</RenderReady>
	);
}
