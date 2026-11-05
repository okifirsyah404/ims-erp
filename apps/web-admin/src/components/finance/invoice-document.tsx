import { useTranslation } from 'react-i18next';

import type { TCompanyProfile } from '@/lib/company-settings-api';
import { formatBusinessDate } from '@/lib/format';
import type { TInvoiceDetail, TScheduleRow } from '@/lib/invoice-api';
import { terbilangRupiah } from '@/lib/terbilang';

/** Amounts as on the company's invoice: "Rp 36.100.000" (cents only when present). */
function rp(minor: number): string {
	return `Rp ${new Intl.NumberFormat('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(minor / 100)}`;
}

/** Percent text without trailing zeros: 3000 → "30". */
const percent = (bps: number) => String(Number((bps / 100).toFixed(2)));

const box = 'border border-[#c9d1dc]';
const cell = `${box} px-2 py-1.5 align-top`;
const navyHead = 'bg-[#1f3657] text-left font-bold text-white print:bg-[#1f3657]';

function Section({ children }: { children: React.ReactNode }) {
	return <h2 className='mt-5 mb-2 text-[11pt] font-bold'>{children}</h2>;
}

/**
 * Invoice print laid out exactly like the company's invoice sample
 * (`.agents/samples-private/`, not committed). Page 1: company block,
 * INVOICE, "Ditujukan kepada / Informasi invoice", item lines of the order,
 * billing summary, terbilang. Page 2 ("INVOICE - LANJUTAN"): payment
 * schedule, bank accounts, signatures, terms. "Halaman x dari y" bottom
 * right on every page.
 *
 * @remarks
 * Labels come from the `id` bundle (`getFixedT`): the company's documents
 * are Indonesian whatever the UI language.
 */
export function InvoiceDocument({ invoice, profile }: { invoice: TInvoiceDetail; profile: TCompanyProfile | null | undefined }) {
	const { i18n } = useTranslation();
	const t = i18n.getFixedT('id', 'finance');
	const order = invoice.order;
	const customer = invoice.customerSnapshot;
	const discountBps = order && order.subtotal > 0 ? Math.round((order.discountTotal * 10_000) / order.subtotal) : 0;
	const banks = profile?.bankAccounts;
	const vatPercent = percent(invoice.vatRateBps || 1100);
	type TRow = { term: TScheduleRow; payment: TScheduleRow['payments'][number] | null };
	const payments: TRow[] = (order?.schedule ?? []).flatMap((term): TRow[] =>
		term.payments.length ? term.payments.map((payment) => ({ term, payment })) : [{ term, payment: null }],
	);
	const totalPaid = (order?.schedule ?? []).reduce(
		(sum, term) => sum + term.payments.reduce((inner, payment) => inner + payment.amount, 0),
		0,
	);
	const stage = (description: string) => description.replace(/\s*\d+([.,]\d+)?\s*%\s*$/, '') || description;
	const company = [profile?.addressLine, profile?.postalCode].filter(Boolean).join(' ');
	const contact = [profile?.phone ? `${t('doc.phone')}: ${profile.phone}` : null, profile?.email ? `${t('doc.email')}: ${profile.email}` : null]
		.filter(Boolean)
		.join(' | ');

	return (
		<article className='bg-white font-[Arial,Helvetica,sans-serif] text-[9.5pt] leading-snug text-black'>
			<style>
				{`@page { size: A4; margin: 12mm 14mm 16mm; @bottom-right { content: "${t('doc.page')} " counter(page) " ${t('doc.of')} " counter(pages); font: 8pt Arial, sans-serif; color: #888; } }`}
			</style>

			<header className='mb-6'>
				<div className='font-bold'>{profile?.legalName ?? ''}</div>
				{company && <div>{company}</div>}
				{contact && <div>{contact}</div>}
				{profile?.website && (
					<div>
						{t('doc.web')}: {profile.website.replace(/^https?:\/\//, '')}
					</div>
				)}
			</header>

			<h1 className='mb-4 text-center text-[20pt] font-bold'>{t('doc.title')}</h1>

			<table className={`w-full table-fixed border-collapse ${box}`}>
				<tbody>
					<tr className='font-bold'>
						<td className={cell}>{t('doc.billTo')}</td>
						<td className={cell}>{t('doc.invoiceInfo')}</td>
					</tr>
					<tr>
						<td className={cell}>
							<div>{customer.name}</div>
							<div>
								{t('doc.attention')}: {order?.attention ?? '-'}
							</div>
							<div>
								{t('doc.email')}: {customer.email ?? '-'}
							</div>
						</td>
						<td className={cell}>
							<div>
								{t('doc.date')}: {formatBusinessDate(invoice.issueDate, 'id')}
							</div>
							<div>
								{t('doc.invoiceNo')}: {invoice.code ?? '-'}
							</div>
							<div>
								{t('doc.refNo')}: {invoice.quotationCode}
							</div>
							<div>
								{t('doc.status')}: {invoice.status === 'paid' ? t('doc.paid') : t('doc.unpaid')}
							</div>
						</td>
					</tr>
					<tr>
						<td className={cell}>
							<span className='font-bold'>{t('doc.subject')}:</span> {t('doc.payment')} {invoice.description} {invoice.title}
						</td>
						<td className={cell}>
							<span className='font-bold'>{t('doc.term')}:</span> {invoice.description}
						</td>
					</tr>
				</tbody>
			</table>

			<Section>{t('doc.items')}</Section>
			<table className={`w-full table-fixed border-collapse ${box}`}>
				<colgroup>
					<col className='w-[7%]' />
					<col className='w-[48%]' />
					<col className='w-[10%]' />
					<col className='w-[17%]' />
					<col className='w-[18%]' />
				</colgroup>
				<thead className='[display:table-row-group]'>
					<tr className={navyHead}>
						<th className='px-2 py-1.5'>{t('doc.no')}</th>
						<th className='px-2 py-1.5'>{t('doc.itemName')}</th>
						<th className='px-2 py-1.5'>{t('doc.qty')}</th>
						<th className='px-2 py-1.5'>{t('doc.unitPrice')}</th>
						<th className='px-2 py-1.5'>{t('doc.subtotal')}</th>
					</tr>
				</thead>
				<tbody>
					{(order?.items ?? []).map((item, index) => (
						<tr key={item.id} className='[break-inside:avoid]'>
							<td className={cell}>{index + 1}</td>
							<td className={cell}>
								<div className='text-[10pt]'>{item.name}</div>
								{item.specification && <div className='whitespace-pre-line text-[8pt]'>{item.specification}</div>}
							</td>
							<td className={`${cell} capitalize`}>
								{Number(item.quantity).toLocaleString('id-ID')} {item.unit}
							</td>
							<td className={cell}>{rp(item.unitPrice)}</td>
							<td className={cell}>{rp(item.lineTotal + item.discountAmount)}</td>
						</tr>
					))}
				</tbody>
			</table>

			<div className='[break-inside:avoid]'>
				<Section>{t('doc.summary')}</Section>
				<table className={`w-full table-fixed border-collapse ${box}`}>
					<colgroup>
						<col className='w-[65%]' />
						<col className='w-[35%]' />
					</colgroup>
					<tbody>
						{order && (
							<>
								<tr>
									<td className={cell}>{t('doc.subTotal')}</td>
									<td className={`${cell} text-right`}>{rp(order.subtotal)}</td>
								</tr>
								<tr>
									<td className={cell}>{t('doc.discount', { percent: percent(discountBps) })}</td>
									<td className={`${cell} text-right`}>{rp(order.discountTotal)}</td>
								</tr>
								<tr>
									<td className={cell}>{t('doc.totalAmount')}</td>
									<td className={`${cell} text-right`}>{rp(order.subtotal - order.discountTotal)}</td>
								</tr>
							</>
						)}
						<tr>
							<td className={cell}>{invoice.description}</td>
							<td className={`${cell} text-right`}>{rp(invoice.subtotal)}</td>
						</tr>
						<tr>
							<td className={cell}>{t('doc.vat', { percent: percent(invoice.vatEnabled ? invoice.vatRateBps : 0) })}</td>
							<td className={`${cell} text-right`}>{rp(invoice.taxTotal)}</td>
						</tr>
						<tr className='font-bold'>
							<td className={cell}>{t('doc.amountDue')}</td>
							<td className={cell}>{rp(invoice.grandTotal)}</td>
						</tr>
					</tbody>
				</table>
				<p className='mt-3 text-[8.5pt]'>
					<span className='font-bold'>{t('doc.inWords')}:</span> {terbilangRupiah(invoice.grandTotal).toLowerCase().replace(/^\S/, (letter) => letter.toUpperCase())}.
				</p>
			</div>

			{/* Page 2 of the sample. */}
			<section className='break-before-page pt-2'>
				<h1 className='mb-3 text-center text-[20pt] font-bold'>{t('doc.continued')}</h1>
				<div>
					{customer.name} | {t('doc.ref')}: {invoice.quotationCode}
				</div>

				<Section>{t('doc.schedule')}</Section>
				<table className={`w-full table-fixed border-collapse ${box}`}>
					<colgroup>
						<col className='w-[7%]' />
						<col className='w-[23%]' />
						<col className='w-[11%]' />
						<col className='w-[14%]' />
						<col className='w-[17%]' />
						<col className='w-[28%]' />
					</colgroup>
					<thead>
						<tr className={navyHead}>
							<th className='px-2 py-1.5'>{t('doc.no')}</th>
							<th className='px-2 py-1.5'>{t('doc.paymentDate')}</th>
							<th className='px-2 py-1.5'>{t('doc.term')}</th>
							<th className='px-2 py-1.5'>{t('doc.stage')}</th>
							<th className='px-2 py-1.5'>{t('doc.method')}</th>
							<th className='px-2 py-1.5'>{t('doc.nominal')}</th>
						</tr>
					</thead>
					<tbody>
						{payments.map(({ term, payment }, index) => (
							<tr key={`${term.id}-${index}`}>
								<td className={cell}>{index + 1}</td>
								<td className={cell}>{payment ? formatBusinessDate(payment.receivedDate, 'id') : '-'}</td>
								<td className={cell}>{term.percentageBps ? `${percent(term.percentageBps)}%` : '-'}</td>
								<td className={cell}>{stage(term.description)}</td>
								<td className={cell}>{payment ? t(`method.${payment.method}` as const) : '-'}</td>
								<td className={cell}>{rp(payment ? payment.amount : term.grandTotal)}</td>
							</tr>
						))}
					</tbody>
				</table>
				<p className='mt-2'>
					<span className='font-bold'>{t('doc.totalPaid')}:</span> {rp(totalPaid)} | <span className='font-bold'>{t('doc.change')}:</span> -
				</p>

				{banks && (banks.nonVat || banks.vat) && (
					<>
						<Section>{t('doc.banks')}</Section>
						<table className={`w-full table-fixed border-collapse ${box}`}>
							<tbody>
								<tr>
									{banks.nonVat && (
										<td className={cell}>
											<div className='font-bold'>
												{t('doc.nonVatBank')} ({banks.nonVat.bankName})
											</div>
											<div>
												{t('doc.accountName')}: {banks.nonVat.accountHolder}
											</div>
											<div>
												{t('doc.accountNo')}: {banks.nonVat.accountNumber} (IDR)
											</div>
										</td>
									)}
									{banks.vat && (
										<td className={cell}>
											<div className='font-bold'>
												{t('doc.vatBank', { percent: vatPercent })} ({banks.vat.bankName})
											</div>
											<div>
												{t('doc.accountName')}: {banks.vat.accountHolder}
											</div>
											<div>
												{t('doc.accountNo')}: {banks.vat.accountNumber} (IDR)
											</div>
										</td>
									)}
								</tr>
							</tbody>
						</table>
					</>
				)}

				<Section>{t('doc.signatures')}</Section>
				<table className={`w-full table-fixed border-collapse ${box}`}>
					<tbody>
						<tr className='font-bold'>
							<td className={cell}>{t('doc.receiver')}</td>
							<td className={cell}>{t('doc.regards')}</td>
						</tr>
						<tr>
							<td className={`${box} h-[20mm] px-2 py-1.5 align-bottom`}>{t('doc.customer')}</td>
							<td className={`${box} h-[20mm] px-2 py-1.5 align-bottom`}>{profile?.signatoryName ?? ''}</td>
						</tr>
					</tbody>
				</table>

				{invoice.terms && (
					<>
						<Section>{t('doc.terms')}</Section>
						<div className='whitespace-pre-wrap text-[8.5pt]'>{invoice.terms}</div>
					</>
				)}
				<p className='mt-8 text-[8.5pt]'>{t('doc.thanks')}</p>
			</section>
		</article>
	);
}
