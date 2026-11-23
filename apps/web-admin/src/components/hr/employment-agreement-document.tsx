import type { TAgreementRender } from '@/lib/hr-records-api';
import { formatBusinessDate } from '@/lib/format';

/** Indonesian labels: the agreement is printed in Indonesian (business copy default). */
const EMPLOYMENT_TYPE: Record<string, string> = {
	permanent: 'Karyawan tetap (PKWTT)',
	contract: 'Karyawan kontrak (PKWT)',
	probation: 'Masa percobaan',
	internship: 'Magang',
	outsourced: 'Alih daya',
};
const WORK_TYPE: Record<string, string> = { onsite: 'Di kantor', remote: 'Jarak jauh', hybrid: 'Hybrid' };
const GENDER: Record<string, string> = { male: 'Laki-laki', female: 'Perempuan' };
const MARITAL: Record<string, string> = { single: 'Belum menikah', married: 'Menikah', divorced: 'Cerai hidup', widowed: 'Cerai mati' };

function Row({ label, value }: { label: string; value: string | null | undefined }) {
	return (
		<tr>
			<td className='w-[52mm] py-[1mm] align-top'>{label}</td>
			<td className='w-[4mm] py-[1mm] align-top'>:</td>
			<td className='py-[1mm] align-top'>{value || '—'}</td>
		</tr>
	);
}

/**
 * The employment agreement (Perjanjian Kerja) as printed to PDF (ERP-0121,
 * grill-me Q21): company and employee identity, employment type, work type,
 * start date and both signature blocks. No salary. The clauses are generic
 * placeholders awaiting the owner's legal review.
 *
 * @remarks
 * Document text is Indonesian on purpose: it is a legal document of an
 * Indonesian company, not app chrome, so it is not routed through i18n.
 */
export function EmploymentAgreementDocument({ data }: { data: TAgreementRender }) {
	const { document, employee, address, profile } = data;
	const date = (value: string | null) => (value ? formatBusinessDate(value, 'id') : null);
	const place = address
		? [address.addressLine, address.villageName, address.districtName, address.regencyName, address.provinceName, address.postalCode]
				.filter(Boolean)
				.join(', ')
		: null;

	return (
		<article className='mx-auto w-[210mm] bg-white px-[20mm] py-[18mm] text-[10.5pt] leading-relaxed text-black'>
			<header className='mb-[8mm] flex items-start gap-[6mm] border-b-2 border-black pb-[4mm]'>
				{profile?.logoUrl && <img src={profile.logoUrl} alt='' className='h-[18mm] w-auto object-contain' />}
				<div>
					<div className='text-[16pt] font-bold'>{profile?.legalName ?? ''}</div>
					{profile?.addressLine && <div>{profile.addressLine}</div>}
					<div>{[profile?.phone, profile?.email].filter(Boolean).join(' · ')}</div>
				</div>
			</header>

			<h1 className='text-center text-[14pt] font-bold uppercase'>Perjanjian Kerja</h1>
			<p className='mb-[6mm] text-center'>Nomor: {document.code}</p>

			<p>Perjanjian ini dibuat oleh dan antara:</p>
			<table className='my-[3mm] w-full'>
				<tbody>
					<Row label='Nama perusahaan' value={profile?.legalName} />
					<Row label='NPWP' value={profile?.taxId} />
					<Row label='Diwakili oleh' value={[profile?.signatoryName, profile?.signatoryTitle].filter(Boolean).join(', ')} />
				</tbody>
			</table>
			<p>selanjutnya disebut <strong>Pihak Pertama</strong>, dan</p>
			<table className='my-[3mm] w-full'>
				<tbody>
					<Row label='Nama' value={employee.fullName} />
					<Row label='NIK' value={employee.nationalId} />
					<Row label='Tempat, tanggal lahir' value={[employee.birthPlace, date(employee.birthDate)].filter(Boolean).join(', ')} />
					<Row label='Jenis kelamin' value={employee.gender ? GENDER[employee.gender] : null} />
					<Row label='Status pernikahan' value={employee.maritalStatus ? MARITAL[employee.maritalStatus] : null} />
					<Row label='Alamat domisili' value={place} />
					<Row label='Nomor induk karyawan' value={employee.employeeCode} />
				</tbody>
			</table>
			<p className='mb-[4mm]'>selanjutnya disebut <strong>Pihak Kedua</strong>.</p>

			<p>Para pihak sepakat mengikatkan diri dalam hubungan kerja dengan ketentuan sebagai berikut:</p>
			<table className='my-[3mm] w-full'>
				<tbody>
					<Row label='Jenis hubungan kerja' value={EMPLOYMENT_TYPE[employee.employmentType] ?? employee.employmentType} />
					<Row label='Lokasi kerja' value={WORK_TYPE[employee.workType] ?? employee.workType} />
					<Row label='Tanggal mulai bekerja' value={date(employee.hireDate)} />
				</tbody>
			</table>

			{/* Placeholder clauses (grill-me Q21): to be replaced after the owner's legal review. */}
			<ol className='my-[4mm] list-decimal space-y-[2mm] pl-[6mm]'>
				<li>Pihak Kedua melaksanakan tugas dan tanggung jawab yang diberikan oleh Pihak Pertama sesuai jabatan dan peraturan perusahaan.</li>
				<li>Hak dan kewajiban para pihak, termasuk upah dan tunjangan, diatur dalam peraturan perusahaan dan ketentuan perundang-undangan yang berlaku.</li>
				<li>Pihak Kedua wajib menjaga kerahasiaan informasi perusahaan selama dan setelah hubungan kerja berakhir.</li>
				<li>Hubungan kerja dapat berakhir sesuai ketentuan peraturan perusahaan dan peraturan perundang-undangan yang berlaku.</li>
				<li>Hal-hal yang belum diatur dalam perjanjian ini akan diatur kemudian berdasarkan kesepakatan para pihak.</li>
			</ol>

			<p>Perjanjian ini dibuat dalam rangkap dua dan ditandatangani oleh para pihak dalam keadaan sadar tanpa paksaan.</p>

			<section className='mt-[14mm] grid grid-cols-2 gap-[20mm] text-center'>
				<div>
					<div>Pihak Pertama</div>
					<div className='flex h-[26mm] items-center justify-center'>
						{profile?.signatureUrl && <img src={profile.signatureUrl} alt='' className='max-h-full max-w-full object-contain' />}
					</div>
					<div className='border-t border-black pt-[1mm] font-semibold'>{profile?.signatoryName ?? ''}</div>
					{profile?.signatoryTitle && <div>{profile.signatoryTitle}</div>}
				</div>
				<div>
					<div>Pihak Kedua</div>
					<div className='h-[26mm]' />
					<div className='border-t border-black pt-[1mm] font-semibold'>{employee.fullName}</div>
				</div>
			</section>
		</article>
	);
}
