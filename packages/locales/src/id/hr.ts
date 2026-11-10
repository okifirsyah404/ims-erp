/** HR employee feature (ERP-0034) — admin UI strings, Indonesian (flat). */
const hr_ = {
	'list.title': 'Karyawan',
	'list.description':
		'Karyawan organisasi Anda ditambah karyawan company-level. Membuat karyawan mengirim email invitasi.',
	'list.new': 'Karyawan baru',
	'list.searchPlaceholder': 'Cari nama, kode, atau email…',
	'list.filterAllStatuses': 'Semua status',
	'list.emptyTitle': 'Belum ada karyawan',
	'list.empty': 'Invitasi karyawan pertama untuk memulai.',
	'list.companyLevel': 'Company-level',
	'list.archived': 'Karyawan diarsipkan',
	'list.archive': 'Arsipkan',

	'status.active': 'Aktif',
	'status.inactive': 'Nonaktif',
	'status.terminated': 'Berhenti',

	'employmentType.permanent': 'Tetap',
	'employmentType.contract': 'Kontrak',
	'employmentType.probation': 'Percobaan',
	'employmentType.internship': 'Magang',
	'employmentType.outsourced': 'Alih daya',

	'workType.onsite': 'Onsite',
	'workType.remote': 'Remote',
	'workType.hybrid': 'Hybrid',

	'form.newEmployee': 'Karyawan baru',
	'form.newEmployeeDescription':
		'Satu langkah membuat record karyawan dan mengirim email invitasi untuk mengklaim login.',
	'form.identity': 'Identitas',
	'form.fullName': 'Nama lengkap',
	'form.email': 'Email login',
	'form.emailHint':
		'Tautan invitasi dikirim ke alamat ini; alamat menjadi login karyawan.',
	'form.phone': 'Telepon',
	'form.nationalId': 'NIK',
	'form.employmentType': 'Tipe kepegawaian',
	'form.workType': 'Tipe kerja',
	'form.hireDate': 'Tanggal masuk',
	'form.employeeCode': 'Kode karyawan',
	'form.inviteAndCreate': 'Invitasi & buat',
	'form.cancel': 'Batal',
	'form.created': 'Karyawan {{code}} dibuat; email invitasi sedang dikirim',

	'detail.details': 'Detail',
	'detail.notFound': 'Karyawan tidak ditemukan',
} as const;

export default hr_;
