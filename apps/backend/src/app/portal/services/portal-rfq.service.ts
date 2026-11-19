import { createHash, randomInt, timingSafeEqual } from 'node:crypto';
import { WEBSITE_INQUIRY_SERVICE_TOKEN } from '@app/crm';
import type { TPortalRfq, WebsiteInquiryService } from '@app/crm';
import { CUSTOMER_SALES_SERVICE_TOKEN } from '@app/sales/constants/di';
import type { CustomerSalesService } from '@app/sales/services/customer-sales.service';
import { PORTAL_MAILER_TOKEN } from '@app/user/constants/di';
import type { IPortalMailer } from '@app/user/contracts/portal-account.contract';
import type { PortalContext } from '@authorization/portal-auth';
import type { ICacheClient } from '@cache/cache.client';
import { CACHE_CLIENT_TOKEN } from '@di/tokens';
import { inject, injectable } from 'tsyringe';

/** A claim code lives 15 minutes and allows 5 attempts. */
export const RFQ_CLAIM_CODE_TTL_SECONDS = 15 * 60;
export const RFQ_CLAIM_MAX_ATTEMPTS = 5;

export type TPortalRfqStatus = 'received' | 'in_review' | 'quoted' | 'closed';
export type TPortalRfqView = TPortalRfq & { portalStatus: TPortalRfqStatus; quotationId: string | null };
export type TRfqClaimChallenge = { reference: string; maskedEmail: string; expiresInMinutes: number };

type TPendingClaim = { leadId: string; codeHash: string; attempts: number };

const hashCode = (leadId: string, code: string) => createHash('sha256').update(`${leadId}:${code}`).digest('hex');

/** `sari@example.com` → `s***@example.com`. */
export function maskEmail(email: string): string {
	const [local = '', domain = ''] = email.split('@');
	return `${local.slice(0, 1)}***@${domain}`;
}

/** Lead status (CRM) → what the customer sees; an SPH sent for the RFQ makes it `quoted`. */
function portalStatus(rfq: TPortalRfq, quoted: boolean): TPortalRfqStatus {
	if (rfq.status === 'won' || rfq.status === 'lost') return 'closed';
	if (quoted || rfq.status === 'quotation') return 'quoted';
	if (rfq.status === 'new') return 'received';
	return 'in_review';
}

/**
 * Website RFQs in the customer portal (ERP-0072): the account's RFQs (submitted
 * signed in, or claimed) with the SPH sent for each, and the guest-RFQ claim —
 * a one-time code mailed to the address on the RFQ proves the person adding it
 * owns it. Owns no data: CRM holds the RFQ, Sales the SPH.
 */
@injectable()
export class PortalRfqService {
	constructor(
		@inject(WEBSITE_INQUIRY_SERVICE_TOKEN)
		private readonly inquiries: Pick<WebsiteInquiryService, 'listPortalRfqs' | 'findClaimableRfq' | 'claimRfq'>,
		@inject(CUSTOMER_SALES_SERVICE_TOKEN) private readonly sales: Pick<CustomerSalesService, 'listQuotations'>,
		@inject(PORTAL_MAILER_TOKEN) private readonly mailer: Pick<IPortalMailer, 'sendRfqClaimCode'>,
		@inject(CACHE_CLIENT_TOKEN) private readonly cache: Pick<ICacheClient, 'get' | 'set' | 'del'>,
	) {}

	async list(portal: PortalContext): Promise<TPortalRfqView[]> {
		const [rfqs, quotations] = await Promise.all([this.inquiries.listPortalRfqs(portal.customerId), this.sales.listQuotations(portal.customerId)]);
		// The newest SPH the customer can see (drafts are internal) per RFQ lead.
		const sent = new Map<string, string>();
		for (const quotation of [...quotations].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())) {
			if (quotation.leadId && quotation.status !== 'draft') sent.set(quotation.leadId, quotation.id);
		}
		return rfqs.map((rfq) => {
			const quotationId = sent.get(rfq.id) ?? null;
			return { ...rfq, quotationId, portalStatus: portalStatus(rfq, quotationId !== null) };
		});
	}

	private claimKey(portal: PortalContext, reference: string): string {
		return `portal:rfq-claim:${portal.customerId}:${reference.trim().toUpperCase()}`;
	}

	/**
	 * Mails a code to the address on a guest RFQ. `null` (the portal says "not
	 * found") when the reference is unknown, already in an account, or has no email.
	 */
	async requestClaim(portal: PortalContext, reference: string): Promise<TRfqClaimChallenge | null> {
		const rfq = await this.inquiries.findClaimableRfq(reference);
		if (!rfq || rfq.linked || !rfq.email) return null;
		const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
		await this.cache.set<TPendingClaim>(this.claimKey(portal, rfq.reference), { leadId: rfq.id, codeHash: hashCode(rfq.id, code), attempts: 0 }, RFQ_CLAIM_CODE_TTL_SECONDS);
		await this.mailer.sendRfqClaimCode({ to: rfq.email, name: rfq.name, code, reference: rfq.reference });
		return { reference: rfq.reference, maskedEmail: maskEmail(rfq.email), expiresInMinutes: RFQ_CLAIM_CODE_TTL_SECONDS / 60 };
	}

	/** `true` when the code matches and the RFQ joined the account; a wrong code counts an attempt. */
	async confirmClaim(portal: PortalContext, reference: string, code: string): Promise<boolean> {
		const key = this.claimKey(portal, reference);
		const pending = await this.cache.get<TPendingClaim>(key);
		if (!pending) return false;
		const given = Buffer.from(hashCode(pending.leadId, code.trim()));
		const expected = Buffer.from(pending.codeHash);
		if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
			const attempts = pending.attempts + 1;
			if (attempts >= RFQ_CLAIM_MAX_ATTEMPTS) await this.cache.del(key);
			else await this.cache.set<TPendingClaim>(key, { ...pending, attempts }, RFQ_CLAIM_CODE_TTL_SECONDS);
			return false;
		}
		await this.cache.del(key);
		return this.inquiries.claimRfq(pending.leadId, portal.customerId);
	}
}
