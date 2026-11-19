import { isUniqueViolation } from '@drizzle/errors';
import type { LeadChannel } from '@drizzle/schemas/project.schema';
import { type ITransactionRunner, TRANSACTION_RUNNER_TOKEN } from '@providers/database/transaction-runner';
import type { CodeType } from '@shared/numbering';
import { type IObjectStorage, OBJECT_STORAGE_TOKEN } from '@providers/s3/object-storage';
import { OUTBOX_SERVICE_TOKEN } from '@app/automation/constants/di';
import { leadCreatedEvent } from '../utils/lead-event';
import type { OutboxService } from '@app/automation/services/outbox.service';
import { inject, injectable } from 'tsyringe';
import {
	LEAD_ATTACHMENT_REPOSITORY_TOKEN,
	LEAD_REPOSITORY_TOKEN,
	PROJECT_NUMBERING_SERVICE_TOKEN,
} from '../constants/di';
import type {
	ILeadAttachmentRepository,
	ILeadRepository,
	TInquiryCreateData,
	TLeadAttachmentData,
} from '../contracts/lead.repository.interface';
import type { ProjectNumberingService } from './project-numbering.service';
import {
	RFQ_ATTACHMENT_LIMITS,
	type TContactMessage,
	type TDemoRequest,
	type TRfqSubmission,
} from '../contracts/website-inquiry.contract';
import { WebsiteInquiryError } from '../errors/lead.errors';

export type TInquiryReceipt = {
	reference: string;
	/** True when an earlier request with the same Idempotency-Key answered. */
	replayed: boolean;
};

const REFERENCE_TYPE: Record<LeadChannel, CodeType> = {
	rfq: 'web_rfq',
	contact: 'web_contact',
	demo: 'web_demo',
};

// The lead summary is business data shown to Indonesian sales staff, not UI
// copy: it is stored once, in the business language.
const PROJECT_TYPE_LABEL: Record<TRfqSubmission['project']['type'], string> = {
	'new-installation': 'Instalasi baru',
	upgrade: 'Upgrade',
	'multi-site': 'Multi-lokasi',
	government: 'Pemerintahan',
};
const CONTACT_TOPIC_LABEL: Record<TContactMessage['topic'], string> = {
	sales: 'Penjualan',
	support: 'Dukungan',
	partnership: 'Kemitraan',
	careers: 'Karier',
};
const DEMO_FORMAT_LABEL: Record<TDemoRequest['format'], string> = {
	online: 'Online',
	onsite: 'Di lokasi',
	showroom: 'Showroom',
};

const lines = (...parts: (string | false | undefined)[]) =>
	parts.filter((part): part is string => Boolean(part)).join('\n');

/** Readable summary stored as the lead's `needs` (max 2000 chars). */
function rfqNeeds(s: TRfqSubmission): string {
	return lines(
		`[RFQ] ${PROJECT_TYPE_LABEL[s.project.type]} - ${s.project.siteLocation}`,
		s.project.siteName && `Lokasi/gedung: ${s.project.siteName}`,
		s.project.targetInstallation && `Target instalasi: ${s.project.targetInstallation}`,
		s.project.budgetRange && `Anggaran: ${s.project.budgetRange}`,
		s.items.length > 0 && `Produk: ${s.items.map((i) => `${i.productSlug} x${i.quantity}`).join(', ')}`,
		(s.solutions?.length ?? 0) > 0 && `Solusi: ${s.solutions?.join(', ')}`,
		s.notes && `Catatan: ${s.notes}`,
	).slice(0, 2000);
}

function contactNeeds(m: TContactMessage): string {
	return `[Kontak - ${CONTACT_TOPIC_LABEL[m.topic]}] ${m.message}`.slice(0, 2000);
}

function demoNeeds(d: TDemoRequest): string {
	return lines(
		`[Demo ${DEMO_FORMAT_LABEL[d.format]}] ${d.date} ${d.time} WIB`,
		d.jobTitle && `Jabatan: ${d.jobTitle}`,
		d.industry && `Industri: ${d.industry}`,
		d.interests.length > 0 && `Minat: ${d.interests.join(', ')}`,
		d.sites && `Jumlah lokasi: ${d.sites}`,
		d.dailyEntries && `Akses harian: ${d.dailyEntries}`,
	).slice(0, 2000);
}

/** Keeps a safe display name; the storage key never uses it. */
function cleanFileName(name: string): string {
	const base = name.split(/[\\/]/).pop() ?? 'file';
	const cleaned = base.replace(/[^\w.\- ()]/g, '_').trim();
	return (cleaned || 'file').slice(-200);
}

const CONTENT_TYPES: Record<string, string> = {
	pdf: 'application/pdf',
	dwg: 'image/vnd.dwg',
	jpg: 'image/jpeg',
	jpeg: 'image/jpeg',
	png: 'image/png',
};

/**
 * Captures website RFQ / contact / demo submissions as leads (source
 * `website`, unassigned, status `new`) and hands back the public reference.
 *
 * @remarks
 * Called only by the public API (server-to-server key). Idempotent per
 * `Idempotency-Key`: a replay returns the original reference without a
 * second lead or upload. Files are stored before the lead row, so a storage
 * failure leaves no lead; an orphan object after a database failure is
 * harmless.
 */
@injectable()
export class WebsiteInquiryService {
	constructor(
		@inject(LEAD_REPOSITORY_TOKEN)
		private readonly leads: Pick<ILeadRepository, 'createInquiry' | 'findByIdempotencyKey'>,
		@inject(LEAD_ATTACHMENT_REPOSITORY_TOKEN)
		private readonly attachmentRows: Pick<ILeadAttachmentRepository, 'createMany'>,
		@inject(PROJECT_NUMBERING_SERVICE_TOKEN)
		private readonly numbering: Pick<ProjectNumberingService, 'next'>,
		@inject(TRANSACTION_RUNNER_TOKEN)
		private readonly transactions: ITransactionRunner,
		@inject(OBJECT_STORAGE_TOKEN)
		private readonly storage: Pick<IObjectStorage, 'put'>,
		@inject(OUTBOX_SERVICE_TOKEN)
		private readonly outbox: Pick<OutboxService, 'publish'>,
	) {}

	async submitRfq(submission: TRfqSubmission, files: File[], idempotencyKey: string | null) {
		this.assertAttachments(files);
		return this.capture(
			idempotencyKey,
			{
				channel: 'rfq',
				name: submission.company.contactName,
				companyName: submission.company.name ?? null,
				phone: submission.company.phone,
				whatsapp: submission.company.phone,
				email: submission.company.email,
				needs: rfqNeeds(submission),
				submission: submission as Record<string, unknown>,
			},
			files,
		);
	}

	sendContactMessage(message: TContactMessage, idempotencyKey: string | null) {
		return this.capture(idempotencyKey, {
			channel: 'contact',
			name: message.name,
			companyName: message.company ?? null,
			phone: message.phone ?? null,
			whatsapp: null,
			email: message.email,
			needs: contactNeeds(message),
			submission: message as Record<string, unknown>,
		});
	}

	requestDemo(request: TDemoRequest, idempotencyKey: string | null) {
		return this.capture(idempotencyKey, {
			channel: 'demo',
			name: request.name,
			companyName: request.organisation,
			phone: null,
			whatsapp: request.whatsapp,
			email: request.email,
			needs: demoNeeds(request),
			submission: request as Record<string, unknown>,
		});
	}

	private assertAttachments(files: File[]) {
		const { maxFiles, maxBytes, extensions } = RFQ_ATTACHMENT_LIMITS;
		if (files.length > maxFiles) throw new WebsiteInquiryError('tooManyFiles', { max: maxFiles });
		for (const file of files) {
			if (file.size > maxBytes) throw new WebsiteInquiryError('fileTooLarge');
			if (file.size === 0 || !extensions.test(file.name)) throw new WebsiteInquiryError('fileType');
		}
	}

	private async capture(
		idempotencyKey: string | null,
		lead: Omit<TInquiryCreateData, 'reference' | 'idempotencyKey'>,
		files: File[] = [],
	): Promise<TInquiryReceipt> {
		if (idempotencyKey) {
			const existing = await this.replay(idempotencyKey);
			if (existing) return existing;
		}
		const attachments = await this.upload(files);
		let reference: string;
		try {
			// One transaction: the reference number, the lead and its files commit
			// together, so a failure leaves no gap in the sequence and no half lead.
			const result = await this.transactions.run(async (tx) => {
				const number = await this.numbering.next(REFERENCE_TYPE[lead.channel], tx);
				const row = await this.leads.createInquiry({ ...lead, reference: number, idempotencyKey }, tx);
				await this.attachmentRows.createMany(row.id, attachments, tx);
				return { created: row, reference: number };
			});
			reference = result.reference;
			const { created } = result;
			// n8n notifies the sales admin (M04); never fails the submission.
			await this.outbox.publish('lead.created', { type: 'lead', id: created.id }, leadCreatedEvent(created));
		} catch (error) {
			if (idempotencyKey && isUniqueViolation(error)) {
				// A concurrent retry with the same key won the insert.
				const existing = await this.replay(idempotencyKey);
				if (existing) return existing;
			}
			throw error;
		}
		return { reference, replayed: false };
	}

	private async replay(idempotencyKey: string): Promise<TInquiryReceipt | null> {
		const existing = await this.leads.findByIdempotencyKey(idempotencyKey);
		return existing?.reference ? { reference: existing.reference, replayed: true } : null;
	}

	private upload(files: File[]): Promise<TLeadAttachmentData[]> {
		const batch = Bun.randomUUIDv7();
		return Promise.all(
			files.map(async (file, index) => {
				const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
				const contentType = CONTENT_TYPES[extension] ?? 'application/octet-stream';
				const storageKey = `lead-inquiry/${batch}/${index + 1}.${extension}`;
				await this.storage.put(storageKey, file, contentType);
				return { fileName: cleanFileName(file.name), contentType, sizeBytes: file.size, storageKey };
			}),
		);
	}
}
