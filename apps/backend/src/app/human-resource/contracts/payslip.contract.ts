import { z } from 'zod';

/**
 * Payslips (ERP-0122, grill-me Q32-Q37): one `issued` `payslip` document per
 * approved salary record (`source_type = employee_salary_record`), its PDF
 * rendered by a queue after the period is approved.
 */
export const PAYSLIP_DOCUMENT_TYPE = 'payslip';
export const PAYSLIP_SOURCE = 'employee_salary_record';

export const payslipZipQuerySchema = z.object({ period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'YYYY-MM') });

/** Enqueue seam of the payslip PDF job; never throws into the approval. */
export interface IPayslipQueue {
	enqueue(recordId: string): Promise<void>;
}

/** One payslip in the self-service list. */
export type TMyPayslip = {
	recordId: string;
	period: string;
	netPay: number;
	/** False until the PDF exists (rendering or failed). */
	ready: boolean;
};
