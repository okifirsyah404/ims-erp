import type { TTx } from '@drizzle/types';
import type { TPaginationResult } from '@ims-erp/common';
import type {
	LeadActivityType,
	LeadChannel,
	LeadSource,
	LeadStatus,
	TLeadActivitySelect,
	TLeadAttachmentSelect,
	TLeadSelect,
} from '@drizzle/schemas/project.schema';

export type TLeadPaginationRequest = {
	page: number;
	limit: number;
	search?: string;
	status?: LeadStatus;
	source?: LeadSource;
	/** `null` = unassigned only; `undefined` = everyone. */
	ownerUserId?: string | null;
	/** Open leads whose next follow-up is at or before this instant. */
	followUpDueBefore?: Date;
};

export type TLeadCreateData = {
	name: string;
	companyName: string | null;
	phone: string | null;
	whatsapp: string | null;
	email: string | null;
	source: LeadSource;
	needs: string | null;
	estimatedValue?: number | null;
	nextFollowUpAt?: Date | null;
	ownerUserId: string | null;
	createdBy: string;
};

export type TLeadUpdateData = Partial<
	Omit<TLeadCreateData, 'ownerUserId' | 'createdBy'>
>;

/** A website submission (always unassigned, source `website`). */
export type TInquiryCreateData = {
	channel: LeadChannel;
	name: string;
	companyName: string | null;
	phone: string | null;
	whatsapp: string | null;
	email: string | null;
	needs: string;
	submission: Record<string, unknown>;
	reference: string;
	idempotencyKey: string | null;
};

export type TLeadAttachmentData = {
	fileName: string;
	contentType: string;
	sizeBytes: number;
	storageKey: string;
};

/** Persistence port for `project.leads` (live rows only). */
export interface ILeadRepository {
	paginate(request: TLeadPaginationRequest): Promise<TPaginationResult<TLeadSelect>>;

	findById(id: string): Promise<TLeadSelect | null>;
	/**
	 * Open leads (not won or lost) whose next follow-up is at or before
	 * `until` (ERP-0066), oldest first.
	 */
	listFollowUpsDue(until: Date): Promise<TLeadSelect[]>;

	findByIdempotencyKey(idempotencyKey: string): Promise<TLeadSelect | null>;

	create(data: TLeadCreateData): Promise<TLeadSelect>;

	/** A website submission as a lead; joins `tx` so its attachments commit with it. */
	createInquiry(data: TInquiryCreateData, tx?: TTx): Promise<TLeadSelect>;

	/** `null` when the lead is missing or already converted. */
	update(id: string, patch: TLeadUpdateData): Promise<TLeadSelect | null>;

	/** `null` when the lead is missing or already converted. */
	setStatus(id: string, status: LeadStatus, lostReason: string | null): Promise<TLeadSelect | null>;

	/** `new | contacted | survey` → `quotation`; `null` when the lead was elsewhere (no change). */
	markQuoted(id: string): Promise<TLeadSelect | null>;

	assign(id: string, ownerUserId: string | null): Promise<TLeadSelect | null>;

	/** Open → `won` with the customer; `null` when not open (race). */
	markConverted(id: string, customerId: string): Promise<TLeadSelect | null>;

	softDelete(id: string): Promise<boolean>;
}

/** Persistence port for `project.lead_attachments`. */
export interface ILeadAttachmentRepository {
	listByLead(leadId: string): Promise<TLeadAttachmentSelect[]>;

	/** Stores the metadata of files already put in object storage. */
	createMany(leadId: string, files: TLeadAttachmentData[], tx?: TTx): Promise<void>;
}

/** Persistence port for `project.lead_activities`. */
export interface ILeadActivityRepository {
	/** Newest first. */
	listByLead(leadId: string): Promise<TLeadActivitySelect[]>;

	create(data: {
		leadId: string;
		activityType: LeadActivityType;
		notes: string;
		occurredAt: Date;
		createdBy: string;
	}): Promise<TLeadActivitySelect>;
}
