import { Worker } from 'bullmq';
import { container } from 'tsyringe';
import { pinoLogger } from '@providers/logger/logger';
import { queueConnection } from '@providers/queue/queue.connection';
import type { QueueWorker } from '@providers/queue/worker-registry';
import { PAYSLIP_SERVICE_TOKEN } from '../constants/di';
import { PAYSLIP_PDF_QUEUE_NAME, type TPayslipPdfJob } from './payslip-pdf.queue';

/**
 * Renders payslip PDFs after a payroll period is approved (ERP-0122). Always
 * runs like the other PDF workers; without Chromium or a render base URL a job
 * registers the payslip document and ends as `skipped`.
 */
export function startPayslipPdfWorker(): QueueWorker {
	const service = container.resolve(PAYSLIP_SERVICE_TOKEN);
	const worker = new Worker<TPayslipPdfJob>(
		PAYSLIP_PDF_QUEUE_NAME,
		async (job) => {
			const outcome = await service.render(job.data.recordId);
			pinoLogger.info({ recordId: job.data.recordId, outcome }, 'payslip PDF job');
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
