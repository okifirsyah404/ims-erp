import { useTranslation } from 'react-i18next';

import type { TCompanyProfile } from '@/lib/company-api';
import { formatBusinessDate } from '@/lib/format';
import type { TQuotationDetail } from '@/lib/quotation-api';
import { terbilangRupiah } from '@/lib/terbilang';

/** Amounts as on the company's SPH: "50,000,000" (the "Rp" sits in its own spot). */
function amount(minor: number): string {
	return new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(minor / 100);
}

/** "Tujuh Ratus Sembilan Puluh Sembilan Juta Rupiah" — every word capitalised, as printed. */
function inWords(minor: number): string {
	return terbilangRupiah(minor).replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());
}

const cell = 'border border-black px-1.5 py-0.5';

function Money({ value, bold }: { value: number; bold?: boolean }) {
	return (
		<div className={`flex justify-between gap-2 whitespace-nowrap ${bold ? 'font-bold' : ''}`}>
			<span>Rp</span>
			<span>{amount(value)}</span>
		</div>
	);
}

/** Shared letterhead: logo, legal name, tagline, double rule. */
export function Letterhead({ profile }: { profile: TCompanyProfile | null | undefined }) {
	return (
		<div className='pb-2'>
			<div className='flex items-center justify-center gap-6'>
				{profile?.logoUrl && <img src={profile.logoUrl} alt='' className='h-[22mm] w-auto object-contain' />}
				<div className='text-center font-serif leading-tight'>
					<div className='text-[24pt] font-bold tracking-wide text-[#1f2a44]'>{profile?.legalName ?? ''}</div>
					{profile?.tagline && <div className='whitespace-pre-line text-[10pt]'>{profile.tagline}</div>}
				</div>
			</div>
			<div className='mx-[15%] mt-1 border-b-[3px] border-double border-gray-600' />
		</div>
	);
}

/**
 * Quotation (SPH) print, laid out exactly like the company's own SPH
 * (`.agents/samples-private/`, not committed): letterhead repeated on every
 * page; amber heading bar; Kepada/Up/Telp/Hal and Date/Ref/Payment/Guaranty;
 * an item table where each item has a bold header row (name, price, qty,
 * unit, subtotal) and a detail row (specification and photo in "Gambar");
 * terbilang and total in the last row; terms and the signature below.
 *
 * @remarks
 * The company's documents are Indonesian whatever the UI language, so the
 * labels come from the `id` bundle (`getFixedT`). Only snapshotted data is
 * rendered, so a print matches what was approved. The SUBTOTAL column shows
 * quantity × price; discounts and VAT, when present, get their own rows above
 * the total. Like the sample, nothing extra is printed when VAT is off:
 * the terms say so.
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
	const summary: { label: string; value: number }[] = [];
	if (quotation.discountTotal > 0 || quotation.vatEnabled) summary.push({ label: t('doc.summarySubtotal'), value: quotation.subtotal });
	if (quotation.discountTotal > 0) summary.push({ label: t('doc.discount'), value: -quotation.discountTotal });
	if (quotation.vatEnabled) summary.push({ label: t('doc.vat', { percent: quotation.vatRateBps / 100 }), value: quotation.taxTotal });
	const rows = summary.length + 1;
	const info: [string, string | null][] = [
		[t('doc.to'), customer.name],
		[t('doc.date'), formatBusinessDate(quotation.quotationDate, 'id')],
		[t('doc.attention'), quotation.attention],
		[t('doc.ref'), quotation.code],
		[t('doc.phone'), customer.phone ?? customer.whatsapp],
		[t('doc.payment'), quotation.paymentTerms],
		[t('doc.subject'), quotation.title],
		[t('doc.guarantee'), quotation.guarantee],
	];

	return (
		<article className='bg-white [-webkit-print-color-adjust:exact] [print-color-adjust:exact] font-[Arial,Helvetica,sans-serif] text-[10.5pt] leading-snug text-black'>
			<style>{'@page { size: A4; margin: 16mm 18mm; }'}</style>
			{/* A table header repeats on every printed page: that is the letterhead. */}
			<table className='w-full border-collapse'>
				<thead>
					<tr>
						<td>
							<Letterhead profile={profile} />
						</td>
					</tr>
				</thead>
				<tbody>
					<tr>
						<td>
							<div className='mt-2 bg-[#ffc000] py-1 text-center font-bold print:bg-[#ffc000]'>
								{quotation.heading ?? t('doc.heading')}
							</div>

							<div className='mt-2 grid grid-cols-[13%_49%_12%_26%] gap-y-1.5 font-bold'>
								{info.map(([label, value]) => (
									<div key={label} className='contents'>
										<div>{label}</div>
										<div>: {value ?? ''}</div>
									</div>
								))}
							</div>
							<div className='mt-1 mb-2 border-b-4 border-double border-[#9dc3e6]' />

							<table className='w-full table-fixed border-collapse border border-black text-[10pt]'>
								<colgroup>
									<col className='w-[4%]' />
									<col className='w-[33%]' />
									<col className='w-[18%]' />
									<col className='w-[16%]' />
									<col className='w-[5%]' />
									<col className='w-[6%]' />
									<col className='w-[18%]' />
								</colgroup>
								<thead className='[display:table-row-group]'>
									<tr className='text-center font-bold'>
										<th className={cell}>{t('doc.no')}</th>
										<th className={cell}>{t('doc.description')}</th>
										<th className={cell}>{t('doc.picture')}</th>
										<th className={cell}>{t('doc.price')}</th>
										<th className={cell} colSpan={2}>
											{t('doc.qty')}
										</th>
										<th className={cell}>{t('doc.subtotal')}</th>
									</tr>
								</thead>
								{/* One body per item, so a page break never parts a name from its specification. */}
								{quotation.items.map((item, index) => (
									<ItemRows key={item.id} number={index + 1} item={item} />
								))}
								<tbody>
									{[...summary, { label: t('doc.total'), value: quotation.grandTotal }].map((row, index) => (
										<tr key={row.label} className='font-bold'>
											{index === 0 && (
												<td className={`${cell} py-1.5`} colSpan={4} rowSpan={rows}>
													{t('doc.inWords')} : {inWords(quotation.grandTotal)}.
												</td>
											)}
											<td className={`${cell} whitespace-nowrap text-center`} colSpan={2}>
												{row.label}
											</td>
											<td className={cell}>
												{row.value < 0 ? (
													<div className='flex justify-between gap-2 whitespace-nowrap'>
														<span>Rp</span>
														<span>({amount(-row.value)})</span>
													</div>
												) : (
													<Money value={row.value} />
												)}
											</td>
										</tr>
									))}
								</tbody>
							</table>

							<div className='mt-3 grid grid-cols-[1fr_32%] gap-6 [break-inside:avoid]'>
								<div className='text-[10pt]'>
									{quotation.terms && (
										<>
											<div className='font-bold underline'>{t('doc.terms')}</div>
											<div className='whitespace-pre-wrap'>{quotation.terms}</div>
										</>
									)}
									{quotation.notes && <div className='mt-2 whitespace-pre-wrap'>{quotation.notes}</div>}
								</div>
								<div className='text-center text-[11pt]'>
									<div>{t('doc.regards')}</div>
									<div className='flex h-[28mm] items-center justify-center'>
										{profile?.signatureUrl && (
											<img src={profile.signatureUrl} alt='' className='max-h-full max-w-full object-contain' />
										)}
									</div>
									<div className='font-bold underline'>{profile?.signatoryName ?? ''}</div>
									{profile?.signatoryTitle && <div>{profile.signatoryTitle}</div>}
								</div>
							</div>
						</td>
					</tr>
				</tbody>
			</table>
		</article>
	);
}

/** One item: a bold header row, then specification and photo below it. */
function ItemRows({ number, item }: { number: number; item: TQuotationDetail['items'][number] }) {
	const quantity = Number(item.quantity);
	const gross = item.lineTotal + item.discountAmount;
	const side = 'border-x border-black';
	return (
		<tbody className='[break-inside:avoid]'>
			<tr className='font-bold'>
				<td className={`${cell} text-center`}>{number}</td>
				<td className={cell} colSpan={2}>
					{item.name}
				</td>
				<td className={cell}>
					<Money value={item.unitPrice} />
				</td>
				<td className={`${cell} text-center`}>{quantity.toLocaleString('en-US')}</td>
				<td className={`${cell} text-center capitalize`}>{item.unit}</td>
				<td className={cell}>
					<Money value={gross} />
				</td>
			</tr>
			{(item.specification || item.imageUrl) && (
				<tr className='align-top'>
					<td className={side} />
					<td className={`${side} whitespace-pre-line px-1.5 py-0.5 text-[10pt]`}>{item.specification}</td>
					<td className={`${side} p-1 text-center align-middle`}>
						{item.imageUrl && <img src={item.imageUrl} alt='' className='mx-auto max-h-[42mm] max-w-full object-contain' />}
					</td>
					<td className={side} />
					<td className={side} />
					<td className={side} />
					<td className={side} />
				</tr>
			)}
		</tbody>
	);
}
