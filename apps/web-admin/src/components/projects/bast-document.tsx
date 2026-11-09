import { useTranslation } from 'react-i18next';

import type { TBast } from '@/lib/handover-api';
import { dateInWords } from '@/lib/terbilang';
import { RichText } from './document-text';

const cell = 'border border-black px-1.5 py-0.5 align-top';

function Party({ index, company, name, title, label, boldName }: { index: number; company: string; name: string; title: string; label: string; boldName?: boolean }) {
	const { i18n } = useTranslation();
	const t = i18n.getFixedT('id', 'projects');
	return (
		<li className='mt-2' value={index}>
			<div>
				{company}, {t('bastDoc.representedBy')}
			</div>
			<div className='grid grid-cols-[28mm_auto] pl-[10mm]'>
				<span>{t('bastDoc.name')}</span>
				<span className={boldName ? 'font-bold' : undefined}>: {name}</span>
				<span>{t('bastDoc.title')}</span>
				<span>: {title}</span>
			</div>
			<div className='pl-[3mm]'>
				{t('bastDoc.hereinafter')} {label}
			</div>
		</li>
	);
}

/**
 * BAST print laid out like the company's sample (`.agents/samples-private/`,
 * not committed; US Letter, no letterhead, Times): title, the day and date
 * in words, the two parties, "Dan berdasarkan kepada" with the contract,
 * the NO / Uraian / Vol / Keterangan table, the handed-over scope, the
 * closing sentence and the two signature blocks.
 *
 * @remarks
 * The sample has no number line; the BAST number is printed under the
 * title so the paper can be traced (as on the surat jalan). Labels come
 * from the `id` bundle: the company's documents are Indonesian.
 */
export function BastDocument({ bast }: { bast: TBast }) {
	const { i18n } = useTranslation();
	const t = i18n.getFixedT('id', 'projects');
	const subject = [bast.workTitle.toUpperCase(), bast.projectName].filter(Boolean).join(', ');

	return (
		<article className="bg-white [-webkit-print-color-adjust:exact] [print-color-adjust:exact] font-['Times_New_Roman',_Times,_serif] text-[12pt] leading-snug text-black">
			<style>{'@page { size: letter; margin: 18mm 20mm 15mm 22mm; }'}</style>
			<h1 className='text-center text-[13pt] font-bold'>{t('bastDoc.heading')}</h1>
			<div className='text-center text-[11pt]'>
				{t('bastDoc.number')} : {bast.code}
			</div>

			<p className='mt-5'>
				{t('bastDoc.onThisDay')} {dateInWords(bast.bastDate)} {t('bastDoc.basedOn')}
			</p>
			<ol className='list-decimal pl-[7mm]'>
				<Party index={1} company={bast.firstPartyCompany} name={bast.firstPartyName} title={bast.firstPartyTitle} label={t('bastDoc.firstParty')} boldName />
				<Party index={2} company={bast.secondPartyCompany} name={bast.secondPartyName} title={bast.secondPartyTitle} label={t('bastDoc.secondParty')} />
			</ol>

			<p className='mt-3'>{t('bastDoc.andBasedOn')}</p>
			<p>
				{bast.contractNumber ? (
					<>
						{t('bastDoc.contractNumber')} <strong>{bast.contractNumber}</strong> {t('bastDoc.between')}{' '}
					</>
				) : (
					<>{t('bastDoc.workBetween')} </>
				)}
				<strong>{bast.firstPartyCompany}</strong> {t('bastDoc.with')} <strong>{bast.secondPartyCompany}</strong> {t('bastDoc.about')}{' '}
				<strong>{subject}</strong>
			</p>

			<table className='mt-3 ml-[6mm] w-[88%] table-fixed border-collapse text-[11.5pt]'>
				<colgroup>
					<col className='w-[7%]' />
					<col className='w-[46%]' />
					<col className='w-[11%]' />
					<col className='w-[36%]' />
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
					{bast.items.map((item, index) => (
						<tr key={index} className='[break-inside:avoid]'>
							<td className={`${cell} text-center`}>{index + 1}</td>
							<td className={cell}>{item.description}</td>
							<td className={cell}>{item.volume}</td>
							<td className={cell}>{item.remarks}</td>
						</tr>
					))}
				</tbody>
			</table>

			{bast.scope.length > 0 && (
				<>
					<p className='mt-3'>{t('bastDoc.scopeIntro')}</p>
					<ol className='mt-2 list-decimal pl-[16mm]'>
						{bast.scope.map((line, index) => (
							<li key={index}>
								<RichText text={line} />
							</li>
						))}
					</ol>
				</>
			)}

			<p className='mt-3'>{t('bastDoc.closing')}</p>

			<section className='mt-4 grid grid-cols-2 text-center [break-inside:avoid]'>
				{[
					[t('bastDoc.firstParty'), bast.firstPartyCompany, bast.firstPartyName, bast.firstPartyTitle, true],
					[t('bastDoc.secondParty'), bast.secondPartyCompany, bast.secondPartyName, bast.secondPartyTitle, false],
				].map(([label, company, name, title, bold]) => (
					<div key={label as string}>
						<div>{label}</div>
						<div>{company}</div>
						<div className={`mt-[22mm] ${bold ? 'font-bold' : ''}`}>{name}</div>
						<div>{title}</div>
					</div>
				))}
			</section>
		</article>
	);
}
