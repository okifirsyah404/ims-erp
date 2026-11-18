import type { ApiClient } from "./client";

/**
 * Request-for-quotation payload sent from the public website.
 * The ERP endpoint path is injected by the app (env), never hard-coded here,
 * because the ERP contract has not been published yet.
 */
export type RfqItem = {
  /** Website product slug; the ERP maps it to its own SKU. */
  productSlug: string;
  quantity: number;
  options?: Record<string, string>;
};

export type RfqSubmission = {
  company: {
    /** Optional for individuals and guests. */
    name?: string;
    contactName: string;
    email: string;
    /** WhatsApp number, normalised to +62… by the website. */
    phone: string;
  };
  project: {
    siteName?: string;
    siteLocation: string;
    targetInstallation?: string;
    budgetRange?: string;
    type: "new-installation" | "upgrade" | "multi-site" | "government";
  };
  items: RfqItem[];
  /** Software solutions of interest (website solution slugs). */
  solutions?: string[];
  /** Customer requirements (required on the guest form). */
  notes?: string;
  sendCopyToPortal: boolean;
  source: "web";
};

export type RfqReceipt = {
  /** ERP reference shown to the customer, e.g. "RFQ-2026-00123". */
  reference: string;
  /** `true` when the RFQ was linked to the signed-in customer's account. */
  linkedToAccount?: boolean;
};

export function createRfqService(client: ApiClient, config: { path: string }) {
  return {
    /** Submits an RFQ; attachments (if any) are sent as multipart alongside the JSON payload. */
    async submit(submission: RfqSubmission, attachments: File[] = []): Promise<RfqReceipt> {
      if (attachments.length === 0) return client.post<RfqReceipt>(config.path, submission);
      const form = new FormData();
      form.set("payload", JSON.stringify(submission));
      attachments.forEach((file) => form.append("attachments", file, file.name));
      return client.post<RfqReceipt>(config.path, form);
    },
  };
}
