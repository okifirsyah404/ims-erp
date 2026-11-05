import { useTranslation } from 'react-i18next';

import type { TCompanyProfile } from '@/lib/company-settings-api';
import { formatBusinessDate, formatIdr } from '@/lib/format';
import type { TQuotationDetail } from '@/lib/quotation-api';
import { terbilangRupiah } from '@/lib/terbilang';

function Row({ label, value }: { label: string; value: string | null | undefined }) {
	return (
		<div className='grid grid-cols-[6.5rem_1fr] gap-1'>
			<span>{label}</span>
			<span className='font-medium'>: {value || '-'}</span>
		</div>
	);
}

/**
 * Quotation (SPH) document in the company's own format: letterhead; Kepada /
 * Up / Telp / Hal and Date / Ref / Payment / Guaranty; items with a bold name
 * and specification; totals, terbilang, terms and the signatory.
 *
 * @remarks
 * The company's documents are Indonesian whatever the UI language, so the
 * labels come from the `id` bundle (`getFixedT`). Only snapshotted data is
 * rendered, so a print matches what was approved.
 */
export function QuotationDocument({
	quotation,
	profile,
}: {
	quotation: TQuotationDetail;
	profile: TCompanyProfile | null | undefined;
}) {
	const { i18n } = useTranslation();
	const t = i18n.getFixedT('id', 'sales');
	const customer = quotation.customerSnapshot;
	const hasDiscount = quotation.discountTotal > 0;
	const companyName = profile?.legalName ?? '—';
	const contact = [profile?.addressLine, profile?.phone, profile?.email, profile?.website].filter(Boolean).join(' · ');

	return (
		<article className='flex flex-col gap-4 bg-background text-sm text-foreground'>
			<header className='border-b-2 border-foreground/70 pb-3 text-center'>
				<div className='font-serif text-2xl font-bold tracking-wide'>{companyName}</div>
				{profile?.tagline && <div className='whitespace-pre-line text-xs'>{profile.tagline}</div>}
				{contact && <div className='mt-1 text-xs text-muted-foreground'>{contact}</div>}
			</header>
			<div className='bg-amber-400 py-1 text-center font-bold text-black print:bg-amber-400'>{t('doc.heading')}</div>

			<section className='grid gap-x-8 gap-y-1 sm:grid-cols-2 print:grid-cols-2'>
				<div className='flex flex-col gap-1'>
					<Row label={t('doc.to')} value={customer.name} />
					<Row label={t('doc.attention')} value={quotation.attention} />
					<Row label={t('doc.phone')} value={customer.phone ?? customer.whatsapp} />
					<Row label={t('doc.subject')} value={quotation.title} />
				</div>
				<div className='flex flex-col gap-1'>
					<Row label={t('doc.date')} value={formatBusinessDate(quotation.quotationDate, 'id')} />
					<Row label={t('doc.ref')} value={quotation.code} />
					<Row label={t('doc.payment')} value={quotation.paymentTerms} />
					<Row label={t('doc.guarantee')} value={quotation.guarantee} />
				</div>
			</section>

			<table className='w-full border-collapse border text-sm'>
				<thead>
					<tr className='border bg-muted text-center print:bg-gray-100'>
						<th className='w-10 border px-2 py-1'>{t('doc.no')}</th>
						<th className='border px-2 py-1'>{t('doc.description')}</th>
						<th className='border px-2 py-1'>{t('doc.price')}</th>
						<th className='border px-2 py-1'>{t('doc.qty')}</th>
						{hasDiscount && <th className='border px-2 py-1'>{t('doc.discount')}</th>}
						<th className='border px-2 py-1'>{t('doc.subtotal')}</th>
					</tr>
				</thead>
				<tbody>
					{quotation.items.map((item, index) => (
						<tr key={item.id} className='align-top'>
							<td className='border px-2 py-1 text-center'>{index + 1}</td>
							<td className='border px-2 py-1'>
								<div className='font-semibold'>{item.name}</div>
								{item.specification && <div className='whitespace-pre-line text-xs'>{item.specification}</div>}
							</td>
							<td className='whitespace-nowrap border px-2 py-1 text-right'>{formatIdr(item.unitPrice)}</td>
							<td className='whitespace-nowrap border px-2 py-1 text-center'>
								{Number(item.quantity).toLocaleString('id-ID')} {item.unit}
							</td>
							{hasDiscount && (
								<td className='whitespace-nowrap border px-2 py-1 text-right'>
									{item.discountAmount ? formatIdr(item.discountAmount) : '—'}
								</td>
							)}
							<td className='whitespace-nowrap border px-2 py-1 text-right'>{formatIdr(item.lineTotal)}</td>
						</tr>
					))}
				</tbody>
			</table>

			<section className='grid gap-4 sm:grid-cols-[1fr_auto] print:grid-cols-[1fr_auto]'>
				<div className='font-medium italic'>
					{t('doc.inWords')}: {terbilangRupiah(quotation.grandTotal)}.
				</div>
				<div className='flex min-w-64 flex-col gap-1'>
					{(hasDiscount || quotation.vatEnabled) && (
						<div className='flex justify-between'>
							<span>{t('doc.subtotal')}</span>
							<span>{formatIdr(quotation.subtotal)}</span>
						</div>
					)}
					{hasDiscount && (
						<div className='flex justify-between'>
							<span>{t('doc.discount')}</span>
							<span>− {formatIdr(quotation.discountTotal)}</span>
						</div>
					)}
					{quotation.vatEnabled && (
						<div className='flex justify-between'>
							<span>{t('doc.vat', { percent: quotation.vatRateBps / 100 })}</span>
							<span>{formatIdr(quotation.taxTotal)}</span>
						</div>
					)}
					<div className='flex justify-between border-t pt-1 text-base font-bold'>
						<span>{t('doc.total')}</span>
						<span>{formatIdr(quotation.grandTotal)}</span>
					</div>
					{!quotation.vatEnabled && <div className='text-xs text-muted-foreground'>{t('doc.excludesVat')}</div>}
				</div>
			</section>

			<section className='grid gap-6 sm:grid-cols-[1fr_auto] print:grid-cols-[1fr_auto]'>
				<div>
					{quotation.terms && (
						<>
							<div className='font-semibold underline'>{t('doc.terms')}</div>
							<p className='whitespace-pre-wrap text-xs'>{quotation.terms}</p>
						</>
					)}
					{quotation.notes && <p className='mt-2 whitespace-pre-wrap text-xs'>{quotation.notes}</p>}
				</div>
				<div className='text-center text-sm'>
					<div>{t('doc.regards')}</div>
					<div className='mt-16 font-semibold underline'>{profile?.signatoryName ?? companyName}</div>
					{profile?.signatoryTitle && <div>{profile.signatoryTitle}</div>}
				</div>
			</section>
		</article>
	);
}
