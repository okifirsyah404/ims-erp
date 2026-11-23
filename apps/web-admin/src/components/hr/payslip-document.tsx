import type { TPayslipRender } from '@/lib/hr-records-api';
import { formatIdr } from '@/lib/format';

const EMPLOYMENT_TYPE: Record<string, string> = {
	permanent: 'Karyawan tetap',
	contract: 'Karyawan kontrak',
	probation: 'Masa percobaan',
	internship: 'Magang',
	outsourced: 'Alih daya',
};

function periodLabel(period: string) {
	return new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${period}-01T00:00:00Z`));
}

function Line({ label, amount, strong, negative }: { label: string; amount: number; strong?: boolean; negative?: boolean }) {
	return (
		<tr className={strong ? 'border-t-2 border-black font-bold' : 'border-b border-gray-300'}>
			<td className='py-[1.5mm]'>{label}</td>
			<td className='py-[1.5mm] text-right tabular-nums'>{negative && amount > 0 ? `(${formatIdr(amount)})` : formatIdr(amount)}</td>
		</tr>
	);
}

/**
 * The payslip (Slip Gaji) as printed to PDF (ERP-0122, grill-me Q34):
 * letterhead, period, employee, the pay lines and net pay in rupiah, the
 * masked payee account, who approved it and when, and an "electronically
 * generated" note — no wet signature. Indonesian on purpose: a business
 * document of an Indonesian company, not app chrome.
 */
export function PayslipDocument({ data }: { data: TPayslipRender }) {
	const { document, record, employee, payee, profile } = data;
	const approvedOn = record.approvedAt
		? new Intl.DateTimeFormat('id-ID', { dateStyle: 'long', timeZone: 'Asia/Jakarta' }).format(new Date(record.approvedAt))
		: null;

	return (
		<article className='mx-auto w-[210mm] bg-white px-[18mm] py-[16mm] text-[10.5pt] leading-relaxed text-black'>
			<header className='mb-[6mm] flex items-start gap-[6mm] border-b-2 border-black pb-[4mm]'>
				{profile?.logoUrl && <img src={profile.logoUrl} alt='' className='h-[16mm] w-auto object-contain' />}
				<div>
					<div className='text-[15pt] font-bold'>{profile?.legalName ?? ''}</div>
					{profile?.addressLine && <div>{profile.addressLine}</div>}
				</div>
			</header>

			<h1 className='text-center text-[14pt] font-bold uppercase'>Slip Gaji</h1>
			<p className='mb-[5mm] text-center'>
				Periode {periodLabel(record.period)} · {document.code}
			</p>

			<table className='mb-[5mm] w-full'>
				<tbody>
					<tr>
						<td className='w-[45mm] py-[0.5mm]'>Nama</td>
						<td>: {employee.fullName}</td>
					</tr>
					<tr>
						<td className='py-[0.5mm]'>Nomor induk karyawan</td>
						<td>: {employee.employeeCode}</td>
					</tr>
					<tr>
						<td className='py-[0.5mm]'>Status kepegawaian</td>
						<td>: {EMPLOYMENT_TYPE[employee.employmentType] ?? employee.employmentType}</td>
					</tr>
				</tbody>
			</table>

			<table className='w-full'>
				<tbody>
					<Line label='Gaji pokok' amount={record.baseSalary} />
					<Line label='Tunjangan' amount={record.allowances} />
					<Line label='Uang lembur' amount={record.overtimePay} />
					<Line label='Bonus' amount={record.bonus} />
					<Line label='Potongan' amount={record.deductions} negative />
					<Line label='Gaji bersih' amount={record.netPay} strong />
				</tbody>
			</table>
			{record.notes && <p className='mt-[3mm] text-[9.5pt]'>Catatan: {record.notes}</p>}

			<section className='mt-[6mm]'>
				<div className='font-semibold'>Dibayarkan ke</div>
				{payee ? (
					<div>
						{payee.bankName} · {payee.accountNumber} · a.n. {payee.accountHolder}
					</div>
				) : (
					<div>—</div>
				)}
			</section>

			<footer className='mt-[10mm] border-t border-gray-400 pt-[3mm] text-[9pt] text-gray-700'>
				{approvedOn && (
					<div>
						Disetujui {record.approvedByName ? `oleh ${record.approvedByName} ` : ''}pada {approvedOn}.
					</div>
				)}
				<div>Dokumen ini dibuat secara elektronik dan sah tanpa tanda tangan basah.</div>
			</footer>
		</article>
	);
}
