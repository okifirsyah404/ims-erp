import { useTranslation } from 'react-i18next';

import type { TCompanyProfile } from '@/lib/company-api';
import { formatBusinessDate } from '@/lib/format';
import type { TPurchaseOrderDetail } from '@/lib/procurement-api';
import { terbilangRupiah } from '@/lib/terbilang';

/** Amounts as on the company's PO: "Rp1.900.000". */
function rp(minor: number): string {
	return `Rp${new Intl.NumberFormat('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(minor / 100)}`;
}

const teal = 'text-[#118a8c]';
const navy = 'bg-[#13243f] text-white print:bg-[#13243f]';

/**
 * Purchase order print laid out exactly like the company's PO sample
 * (`.agents/samples-private/`, not committed): IMS | company header and
 * "PURCHASE ORDER", teal bar, the PO facts grid, buyer and supplier blocks,
 * the order lines on a navy header, subtotal / PPN / TOTAL PURCHASE ORDER,
 * terbilang, numbered purchase terms, notes, signatures, and the footer
 * line on every page.
 *
 * @remarks
 * Labels come from the `id` bundle (`getFixedT`): the company's documents
 * are Indonesian whatever the UI language.
 */
export function PurchaseOrderDocument({ order, profile }: { order: TPurchaseOrderDetail; profile: TCompanyProfile | null | undefined }) {
	const { i18n } = useTranslation();
	const t = i18n.getFixedT('id', 'procurement');
	const supplier = order.supplierSnapshot;
	const company = profile?.legalName ?? '';
	const footer = [company, profile?.tradingName, profile?.website?.replace(/^https?:\/\//, ''), profile?.email]
		.filter(Boolean)
		.join('  |  ');
	const facts: [string, string | null][] = [
		[t('doc.number'), order.code],
		[t('doc.date'), formatBusinessDate(order.orderDate, 'id')],
		[t('doc.subject'), order.subject],
		[t('doc.currency'), t('doc.idr')],
		[t('doc.quoteRef'), order.supplierQuoteRef],
		[t('doc.quoteDate'), order.supplierQuoteDate ? formatBusinessDate(order.supplierQuoteDate, 'id') : null],
		[t('doc.project'), order.projectName],
		[t('doc.status'), t(`doc.statusText.${order.status}`)],
	];
	const terms = [
		...(order.paymentTerms ? [`${t('doc.payment')}: ${order.paymentTerms}`] : []),
		...(order.terms ?? '').split('\n').map((line) => line.trim()).filter(Boolean),
	];
	const words = terbilangRupiah(order.grandTotal).toLowerCase().replace(/^\S/, (letter) => letter.toUpperCase());

	return (
		<article className='bg-white [-webkit-print-color-adjust:exact] [print-color-adjust:exact] font-serif text-[9.5pt] leading-snug text-[#2b2b2b]'>
			<style>
				{`@page { size: A4; margin: 16mm 18mm 20mm; @bottom-center { content: "${footer.replace(/"/g, '')}"; font: 8pt Georgia, serif; color: #555; } }`}
			</style>

			<header className='flex items-start justify-between gap-6'>
				<div>
					<div className='flex items-baseline gap-2'>
						<span className={`text-[26pt] font-bold ${teal}`}>{profile?.documentCode ?? ''}</span>
						<span className='text-[14pt] font-bold'>|</span>
						<span className='text-[14pt] font-bold text-[#13243f]'>{company}</span>
					</div>
					{profile?.tradingName && <div className='mt-1 text-[9pt] text-[#555]'>{profile.tradingName}</div>}
				</div>
				<div className='text-right'>
					<div className='text-[20pt] font-bold text-[#13243f]'>{t('doc.title')}</div>
					<div className={`text-[8pt] uppercase ${teal}`}>{t('doc.subtitle')}</div>
				</div>
			</header>
			<div className='mt-5 h-5 bg-[#118a8c] print:bg-[#118a8c]' />

			<table className='mt-5 w-full table-fixed border-collapse'>
				<colgroup>
					<col className='w-[17%]' />
					<col className='w-[33%]' />
					<col className='w-[16%]' />
					<col className='w-[34%]' />
				</colgroup>
				<tbody>
					{[0, 2, 4, 6].map((index, row) => (
						<tr key={index} className={row % 2 === 0 ? 'bg-[#f1f5f8] print:bg-[#f1f5f8]' : ''}>
							<td className='whitespace-nowrap px-2 py-1.5 font-bold'>{facts[index]![0]}</td>
							<td className='px-2 py-1.5'>{facts[index]![1] ?? '-'}</td>
							<td className='whitespace-nowrap px-2 py-1.5 font-bold'>{facts[index + 1]![0]}</td>
							<td className='px-2 py-1.5'>{facts[index + 1]![1] ?? '-'}</td>
						</tr>
					))}
				</tbody>
			</table>

			<div className='mt-6 grid grid-cols-2 border-y border-[#d5e0e8] bg-[#eef4f8] print:bg-[#eef4f8]'>
				<div className='px-3 py-3'>
					<div className={`text-[8pt] font-bold uppercase ${teal}`}>{t('doc.buyer')}</div>
					<div className='font-bold text-[#13243f]'>{company}</div>
					{profile?.addressLine && <div className='whitespace-pre-line'>{profile.addressLine}</div>}
					{profile?.email && (
						<div>
							{t('doc.email')}: {profile.email}
						</div>
					)}
					{order.buyerPicName && (
						<div>
							{t('doc.pic')}: {order.buyerPicName}
						</div>
					)}
				</div>
				<div className='px-3 py-3'>
					<div className={`text-[8pt] font-bold uppercase ${teal}`}>{t('doc.seller')}</div>
					<div className='font-bold text-[#13243f]'>{supplier.name}</div>
					{supplier.address && <div className='whitespace-pre-line'>{supplier.address}</div>}
					{supplier.picName && (
						<div>
							{t('doc.pic')}: {supplier.picName}
							{supplier.picTitle ? ` (${supplier.picTitle})` : ''}
						</div>
					)}
				</div>
			</div>

			<h2 className='mt-6 mb-2 px-2 text-[11pt] font-bold text-[#13243f]'>{t('doc.lines')}</h2>
			<table className='w-full table-fixed border-collapse'>
				<colgroup>
					<col className='w-[6%]' />
					<col className='w-[50%]' />
					<col className='w-[9%]' />
					<col className='w-[17%]' />
					<col className='w-[18%]' />
				</colgroup>
				<thead className='[display:table-row-group]'>
					<tr className={`${navy} text-[8pt] font-bold uppercase`}>
						<th className='px-2 py-2 text-left'>{t('doc.no')}</th>
						<th className='px-2 py-2 text-left'>{t('doc.product')}</th>
						<th className='px-2 py-2 text-center'>{t('doc.qty')}</th>
						<th className='px-2 py-2 text-center'>{t('doc.unitPrice')}</th>
						<th className='px-2 py-2 text-right'>{t('doc.amount')}</th>
					</tr>
				</thead>
				<tbody>
					{order.items.map((item, index) => (
						<tr key={item.id} className={`border-b border-[#d5e0e8] [break-inside:avoid] ${index % 2 === 0 ? 'bg-[#f3f6f9] print:bg-[#f3f6f9]' : ''}`}>
							<td className='px-2 py-3 align-middle'>{String(index + 1).padStart(2, '0')}</td>
							<td className='px-2 py-3'>
								<div className='text-[10.5pt] font-bold text-[#13243f]'>{item.name}</div>
								{item.specification && <div className='whitespace-pre-line text-[8pt] text-[#555]'>{item.specification}</div>}
							</td>
							<td className='px-2 py-3 text-center align-middle'>{Number(item.quantity).toLocaleString('id-ID')}</td>
							<td className='px-2 py-3 text-center align-middle'>{rp(item.unitPrice)}</td>
							<td className='px-2 py-3 text-right align-middle font-bold text-[#13243f]'>{rp(item.lineTotal)}</td>
						</tr>
					))}
				</tbody>
			</table>

			<div className='[break-inside:avoid]'>
				<div className='mt-6 ml-auto flex w-[45%] flex-col gap-1.5 px-2'>
					<div className='flex justify-between'>
						<span className='text-[#555]'>{t('doc.subtotal')}</span>
						<span className='font-bold text-[#13243f]'>{rp(order.subtotal)}</span>
					</div>
					<div className='flex justify-between'>
						<span className='text-[#555]'>{t('doc.vat')}</span>
						<span className='font-bold text-[#13243f]'>
							{order.vatMode === 'included'
								? t('doc.vatIncluded')
								: order.vatMode === 'added'
									? `${t('doc.vatAdded', { percent: order.vatRateBps / 100 })} ${rp(order.taxTotal)}`
									: t('doc.vatNone')}
						</span>
					</div>
				</div>
				<div className={`mt-2 flex items-center justify-end gap-24 px-2 py-1.5 ${navy}`}>
					<span className='font-bold'>{t('doc.total')}</span>
					<span className='text-[12pt] font-bold'>{rp(order.grandTotal)}</span>
				</div>
				<p className='mt-2 px-2'>
					{t('doc.inWords')}: {words}.
				</p>
			</div>

			{terms.length > 0 && (
				<section className='mt-5 px-2 [break-inside:avoid]'>
					<h2 className='mb-2 text-[11pt] font-bold text-[#13243f]'>{t('doc.terms')}</h2>
					<ol className='flex flex-col gap-1'>
						{terms.map((term, index) => {
							const colon = term.indexOf(':');
							const title = colon > 0 && colon < 40 ? term.slice(0, colon) : null;
							return (
								<li key={term}>
									<span className={`mr-2 font-bold ${teal}`}>{String(index + 1).padStart(2, '0')}</span>
									{title ? (
										<>
											<span className='font-bold'>{title}:</span>
											{term.slice(colon + 1)}
										</>
									) : (
										term
									)}
								</li>
							);
						})}
					</ol>
				</section>
			)}
			{order.notes && <p className='mt-3 whitespace-pre-wrap px-2 text-[9pt]'>{order.notes}</p>}

			<section className='mt-5 grid grid-cols-2 gap-6 px-2 [break-inside:avoid]'>
				<div>
					<div>{t('doc.issuedBy')}</div>
					<div className='flex h-[20mm] items-center'>
						{profile?.signatureUrl && <img src={profile.signatureUrl} alt='' className='max-h-full max-w-[60%] object-contain' />}
					</div>
					<div className='font-bold text-[#13243f]'>{order.buyerPicName ?? profile?.signatoryName ?? ''}</div>
					<div className='text-[8pt] uppercase text-[#555]'>{company}</div>
				</div>
				<div>
					<div>{t('doc.acknowledgedBy')}</div>
					<div className='h-[20mm]' />
					<div className='font-bold'>(...................................)</div>
					<div className='text-[8pt] uppercase text-[#555]'>{supplier.name}</div>
				</div>
			</section>
		</article>
	);
}
