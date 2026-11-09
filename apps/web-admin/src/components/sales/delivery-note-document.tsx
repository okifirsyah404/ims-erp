import { useTranslation } from 'react-i18next';

import type { TCompanyProfile } from '@/lib/company-settings-api';
import type { TDeliveryNoteDetail } from '@/lib/delivery-note-api';
import { formatBusinessDate } from '@/lib/format';

/** Prices as on the company's documents: "Rp1.900.000". */
function rp(minor: number): string {
	return `Rp${new Intl.NumberFormat('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(minor / 100)}`;
}

/** The sample's item table always shows at least seven rows. */
const MIN_ROWS = 7;

function Field({ label, value }: { label: string; value: string | null | undefined }) {
	return (
		<div className='flex gap-1'>
			<span className='shrink-0'>{label}:</span>
			<span className='whitespace-pre-line'>{value ?? ''}</span>
		</div>
	);
}

/** "(______________)", with the name written on the line when known. */
function SignatureLine({ name }: { name: string | null | undefined }) {
	return (
		<div className='flex items-end justify-center text-[14pt] font-bold'>
			<span>(</span>
			<span className='inline-block min-w-[48mm] border-b-2 border-black px-1 text-center text-[11pt]'>{name ?? ''}</span>
			<span>)</span>
		</div>
	);
}

/**
 * Delivery note (surat jalan) print, laid out exactly like the company's
 * sample (`.agents/samples-private/`, not committed; US Letter): logo and
 * company block over a rule, "SURAT JALAN BARANG / PROYEK / KONSTRUKSI"
 * between rules, the date and project fields, Data Pengirim and Data
 * Penerima, the item table (No. / Nama Barang / QTY / Satuan / Harga /
 * Keterangan, padded to seven rows), the Catatan box and the three
 * signatures (Supir, Pengirim, Penerima).
 *
 * @remarks
 * The sample has no number line; "No. Surat Jalan" is added as the first
 * field so the paper can be traced. Labels come from the `id` bundle
 * (`getFixedT`): the company's documents are Indonesian whatever the UI
 * language. Serial numbers go in Keterangan.
 */
export function DeliveryNoteDocument({ note, profile }: { note: TDeliveryNoteDetail; profile: TCompanyProfile | null | undefined }) {
	const { i18n } = useTranslation();
	const t = i18n.getFixedT('id', 'sales');
	const companyAddress = [profile?.addressLine, profile?.postalCode].filter(Boolean).join(' ');
	const companyContact = [profile?.phone, profile?.email].filter(Boolean).join(' / ');
	const fillers = Math.max(0, MIN_ROWS - note.items.length);
	const cell = 'border-[1.5px] border-black px-1.5 py-1';

	return (
		<article className="bg-white [-webkit-print-color-adjust:exact] [print-color-adjust:exact] font-['Arial',_'Helvetica',_sans-serif] text-[11pt] leading-snug text-black">
			<style>{'@page { size: letter; margin: 15mm 18mm 15mm; }'}</style>

			<header className='flex items-start gap-8'>
				<div className='w-[52mm] shrink-0'>
					{profile?.logoUrl && <img src={profile.logoUrl} alt='' className='h-[26mm] w-auto object-contain' />}
				</div>
				<div className='leading-tight'>
					<div className='text-[15pt] font-bold'>{profile?.legalName ?? ''}</div>
					{companyAddress && <div className='whitespace-pre-line text-[10.5pt]'>{companyAddress}</div>}
					{profile?.email && (
						<div className='text-[10.5pt]'>
							{t('sj.email')}: {profile.email}
						</div>
					)}
					{profile?.phone && (
						<div className='text-[10.5pt]'>
							{t('sj.phone')}: {profile.phone}
						</div>
					)}
				</div>
			</header>
			<div className='mt-1 border-b-2 border-black' />
			<div className='py-1 text-center leading-tight'>
				<div className='text-[14pt] font-bold'>{t('sj.title')}</div>
				<div className='text-[10.5pt]'>{t('sj.subtitle')}</div>
			</div>
			<div className='border-b-2 border-black' />

			<section className='mt-4 flex flex-col gap-0.5 px-1'>
				<Field label={t('sj.number')} value={note.code} />
				<Field label={t('sj.date')} value={formatBusinessDate(note.deliveryDate, 'id')} />
				<Field label={t('sj.project')} value={note.projectName} />
				<Field label={t('sj.location')} value={note.projectLocation} />

				<div className='mt-3 font-bold'>{t('sj.sender')}</div>
				<Field label={t('sj.company')} value={profile?.legalName} />
				<Field label={t('sj.address')} value={companyAddress} />
				<Field label={t('sj.contact')} value={companyContact} />

				<div className='mt-3 font-bold'>{t('sj.recipient')}</div>
				<Field label={t('sj.recipientName')} value={note.recipientName} />
				<Field label={t('sj.projectAddress')} value={note.recipientAddress} />
				<Field label={t('sj.pic')} value={note.recipientPic} />
				<Field label={t('sj.contact')} value={note.recipientContact} />
			</section>

			<table className='mt-4 w-full table-fixed border-collapse'>
				<colgroup>
					<col className='w-[6.3%]' />
					<col className='w-[29.8%]' />
					<col className='w-[11.4%]' />
					<col className='w-[12.6%]' />
					<col className='w-[16.8%]' />
					<col className='w-[23.1%]' />
				</colgroup>
				<thead>
					<tr className='text-center font-bold'>
						<th className={cell}>{t('sj.no')}</th>
						<th className={cell}>{t('sj.item')}</th>
						<th className={cell}>{t('sj.qty')}</th>
						<th className={cell}>{t('sj.unit')}</th>
						<th className={cell}>{t('sj.price')}</th>
						<th className={cell}>{t('sj.remarks')}</th>
					</tr>
				</thead>
				<tbody>
					{note.items.map((item, index) => (
						<tr key={item.id} className='align-top [break-inside:avoid]'>
							<td className={`${cell} text-center`}>{index + 1}</td>
							<td className={cell}>{item.name}</td>
							<td className={`${cell} text-center`}>{Number(item.quantity).toLocaleString('id-ID')}</td>
							<td className={`${cell} text-center`}>{item.unit}</td>
							<td className={`${cell} text-right`}>{rp(item.unitPrice)}</td>
							<td className={`${cell} whitespace-pre-line text-[9.5pt]`}>
								{[item.remarks, item.serialNumbers?.length ? `${t('sj.serials')}: ${item.serialNumbers.join(', ')}` : null]
									.filter(Boolean)
									.join('\n')}
							</td>
						</tr>
					))}
					{Array.from({ length: fillers }, (_, index) => (
						<tr key={`filler-${index}`}>
							{Array.from({ length: 6 }, (_, column) => (
								<td key={column} className={`${cell} h-[7mm]`} />
							))}
						</tr>
					))}
				</tbody>
			</table>

			<section className='mt-4 border-2 border-black px-1.5 py-1 [break-inside:avoid]'>
				<div className='font-bold'>{t('sj.notes')}</div>
				<div className='min-h-[12mm] whitespace-pre-line'>{note.notes ?? ''}</div>
			</section>

			<section className='mt-4 grid grid-cols-3 [break-inside:avoid]'>
				{[
					[t('sj.driver'), note.driverName],
					[t('sj.shipper'), null],
					[t('sj.receiver'), note.receiverName],
				].map(([label, name]) => (
					<div key={label} className='flex flex-col items-center gap-[16mm]'>
						<div>{label}</div>
						<SignatureLine name={name} />
					</div>
				))}
			</section>
		</article>
	);
}
