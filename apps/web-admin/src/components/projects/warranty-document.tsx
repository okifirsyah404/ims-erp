import { useTranslation } from 'react-i18next';

import { Letterhead } from '@/components/sales/quotation-document';
import type { TCompanyProfile } from '@/lib/company-api';
import { formatBusinessDate } from '@/lib/format';
import type { TWarranty } from '@/lib/handover-api';
import { numberToWords } from '@/lib/terbilang';
import { RichText, TermList } from './document-text';

const cell = 'border border-black px-1.5 py-0.5 align-top';

function Facts({ rows }: { rows: [string, React.ReactNode][] }) {
	return (
		<div className='grid grid-cols-[42mm_auto]'>
			{rows.map(([label, value]) => (
				<div key={label} className='contents'>
					<span>{label}</span>
					<span>: {value}</span>
				</div>
			))}
		</div>
	);
}

/**
 * Warranty certificate print laid out like pages 3–4 of the company's sample
 * (`.agents/samples-private/`, not committed; US Letter, Times): letterhead,
 * "SURAT KETERANGAN GARANSI PERANGKAT", number and date, the company, the
 * project, then A. covered devices, B. period, C. terms (✅ covered / ❌ not
 * covered, with "o" sub-items), D. service terms, and the signature.
 *
 * @remarks
 * Texts are the certificate's snapshot (from the company profile at the
 * time): one item per line, `o ` sub-items, `**…**` bold. Labels come from
 * the `id` bundle.
 */
export function WarrantyDocument({ warranty, profile }: { warranty: TWarranty; profile: TCompanyProfile | null | undefined }) {
	const { i18n } = useTranslation();
	const t = i18n.getFixedT('id', 'projects');
	const section = 'mt-6 text-[13pt] font-bold';
	const rule = 'my-4 border-t-2 border-gray-400';
	const signer = (profile?.tradingName ?? profile?.legalName ?? '').replace(/^(CV|PT)\.?\s+/i, '').toUpperCase();

	return (
		<article className="bg-white [-webkit-print-color-adjust:exact] [print-color-adjust:exact] font-['Times_New_Roman',_Times,_serif] text-[12pt] leading-[1.2] text-black">
			<style>{'@page { size: letter; margin: 15mm 20mm 15mm 22mm; }'}</style>
			<Letterhead profile={profile} />
			<h1 className='mt-3 text-center font-bold'>{t('warrantyDoc.heading')}</h1>

			<div className='mt-6'>
				<div>
					{t('warrantyDoc.number')} :{warranty.code}
				</div>
				<div>
					{t('warrantyDoc.date')} : {formatBusinessDate(warranty.issueDate, 'id')}
				</div>
			</div>

			<p className='mt-5'>{t('warrantyDoc.undersigned')}</p>
			<div className='mt-4'>
				<Facts
					rows={[
						[t('warrantyDoc.company'), <strong key='name'>{profile?.legalName ?? ''}</strong>],
						[t('warrantyDoc.address'), [profile?.addressLine, profile?.postalCode].filter(Boolean).join(' ')],
						[t('warrantyDoc.phone'), profile?.phone ?? ''],
						[t('warrantyDoc.email'), profile?.email ?? ''],
					]}
				/>
			</div>

			<p className='mt-6'>
				{t('warrantyDoc.statementBefore')} <strong>{t('warrantyDoc.provider', { product: warranty.productSummary })}</strong>,{' '}
				{t('warrantyDoc.statementGive')} <strong>{t('warrantyDoc.official')}</strong> {t('warrantyDoc.statementAfter')}
			</p>
			<div className='mt-4'>
				<Facts
					rows={[
						[t('warrantyDoc.projectName'), warranty.projectName.toUpperCase()],
						[t('warrantyDoc.projectLocation'), (warranty.projectLocation ?? '').toUpperCase()],
						[t('warrantyDoc.projectOwner'), warranty.projectOwner.toUpperCase()],
					]}
				/>
			</div>

			<h2 className={section}>{t('warrantyDoc.sectionA')}</h2>
			<p>{t('warrantyDoc.scopeIntro')}</p>
			<table className='mt-4 ml-[12mm] w-[85%] table-fixed border-collapse text-[11.5pt]'>
				<colgroup>
					<col className='w-[7%]' />
					<col className='w-[45%]' />
					<col className='w-[10%]' />
					<col className='w-[38%]' />
				</colgroup>
				<thead>
					<tr>
						<th className={`${cell} font-normal`}>{t('bastDoc.no')}</th>
						<th className={`${cell} text-left font-normal`}>{t('bastDoc.description')}</th>
						<th className={`${cell} text-left font-normal`}>{t('bastDoc.volume')}</th>
						<th className={`${cell} text-left font-normal`}>{t('bastDoc.remarks')}</th>
					</tr>
				</thead>
				<tbody>
					{warranty.items.map((item, index) => (
						<tr key={index} className='[break-inside:avoid]'>
							<td className={`${cell} text-center`}>{index + 1}</td>
							<td className={cell}>{item.description}</td>
							<td className={cell}>{item.volume}</td>
							<td className={cell}>{item.remarks}</td>
						</tr>
					))}
				</tbody>
			</table>

			<h2 className={section}>{t('warrantyDoc.sectionB')}</h2>
			<p className='mt-4'>{t('warrantyDoc.periodIntro')}</p>
			<div className='mt-4 pl-[12mm]'>
				<div className='font-bold'>
					{t('warrantyDoc.period', { months: warranty.months, words: numberToWords(warranty.months) })}
				</div>
				<div>
					<RichText text={t('warrantyDoc.periodFrom')} />
				</div>
			</div>

			<div className={`${rule} [break-before:page]`} />
			<h2 className='text-[13pt] font-bold'>{t('warrantyDoc.sectionC')}</h2>
			<p>{t('warrantyDoc.termsIntro')}</p>
			<p className='mt-4 font-bold'>✅{t('warrantyDoc.covered')}</p>
			<TermList text={warranty.coverage} className='mt-2' />
			<p className='mt-4 font-bold'>❌{t('warrantyDoc.notCovered')}</p>
			<TermList text={warranty.exclusions} className='mt-2' />

			<div className={rule} />
			<h2 className='text-[13pt] font-bold'>{t('warrantyDoc.sectionD')}</h2>
			<TermList text={warranty.serviceTerms} className='mt-2' />

			<div className={rule} />
			<section className='[break-inside:avoid]'>
				<p>{t('warrantyDoc.closing')}</p>
				<p>{t('warrantyDoc.thanks')}</p>
				<p>{t('warrantyDoc.regards')}</p>
				<p className='font-bold'>{signer}</p>
				{profile?.signatureUrl ? (
					<img src={profile.signatureUrl} alt='' className='my-1 h-[22mm] w-auto object-contain' />
				) : (
					<div className='h-[22mm]' />
				)}
				<p>({profile?.signatoryName ?? ''})</p>
				<p>{profile?.signatoryTitle ?? ''}</p>
			</section>
		</article>
	);
}
