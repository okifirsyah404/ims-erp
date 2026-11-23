import { Worker } from 'bullmq';
import { container } from 'tsyringe';
import { pinoLogger } from '@providers/logger/logger';
import { queueConnection } from '@providers/queue/queue.connection';
import type { QueueWorker } from '@providers/queue/worker-registry';
import { AGREEMENT_PDF_SERVICE_TOKEN } from '../constants/di';
import { AGREEMENT_PDF_QUEUE_NAME, type TAgreementPdfJob } from './agreement-pdf.queue';

/**
 * Renders employment-agreement PDFs (ERP-0121). Like the quotation PDF
 * worker it always runs (it is not a scheduled job); without Chromium or a
 * render base URL every job ends as `skipped` and the document keeps no file
 * until "Regenerate PDF" is used on a configured server.
 */
export function startAgreementPdfWorker(): QueueWorker {
	const service = container.resolve(AGREEMENT_PDF_SERVICE_TOKEN);
	const worker = new Worker<TAgreementPdfJob>(
		AGREEMENT_PDF_QUEUE_NAME,
		async (job) => {
			const outcome = await service.render(job.data.documentId);
			pinoLogger.info({ documentId: job.data.documentId, outcome }, 'agreement PDF job');
			return outcome;
		},
		{ connection: queueConnection, concurrency: 1 },
	);
	return {
		onError: (listener) => {
			worker.on('error', listener);
		},
		close: () => worker.close(),
	};
}
