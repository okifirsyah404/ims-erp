/** Lonceng notifikasi dalam aplikasi dan teks templatnya (ERP-0047). */
const notifications = {
	'title': 'Notifikasi',
	'unreadLabel': 'Notifikasi, {{count}} belum dibaca',
	'markAllRead': 'Tandai semua dibaca',
	'empty': 'Belum ada notifikasi',
	'loadFailed': 'Tidak dapat memuat notifikasi',
	'offline': 'Pembaruan langsung tidak tersedia',

	// Dirender dari `templateCode` + `variables`; teks Inggris yang tersimpan di
	// server hanya cadangan untuk kode yang tidak dikenal bundel ini. Nama kunci
	// camelCase, bukan snake_case milik kode: kunci bertipe i18next memperlakukan
	// `_` sebagai sufiks plural dan akan menolak `template.org.member_added.title`.
	'template.org.memberAdded.title': 'Anda bergabung dengan {{organizationName}}',
	'template.org.memberAdded.body':
		'Anda ditambahkan ke {{organizationName}} sebagai {{role}}.',
	'template.org.orgCreated.title': '{{organizationName}} siap',
	'template.org.orgCreated.body':
		'Anda membuat {{organizationName}}. Undang tim Anda untuk memulai.',
	'template.sales.invoiceIssued.title': 'Invoice {{invoiceNumber}} diterbitkan',
	'template.sales.invoiceIssued.body':
		'Invoice {{invoiceNumber}} untuk {{customerName}} diterbitkan sebesar {{amount}}.',
	'template.document.signatureRequested.title':
		'Tanda tangan diminta: {{documentName}}',
	'template.document.signatureRequested.body':
		'{{requesterName}} meminta tanda tangan Anda pada {{documentName}}.',
	'template.document.signatureSigned.title':
		'Dokumen ditandatangani: {{documentName}}',
	'template.document.signatureSigned.body':
		'{{signerName}} menandatangani {{documentName}}.',
	'template.document.signatureDeclined.title':
		'Tanda tangan ditolak: {{documentName}}',
	'template.document.signatureDeclined.body':
		'{{signerName}} menolak menandatangani {{documentName}}.',
	'template.hr.taskAssigned.title': 'Tugas baru: {{title}}',
	'template.hr.taskAssigned.body':
		'Anda diberi tugas {{title}} dengan tenggat {{dueDate}}.',
	'template.hr.leaveDecided.title':
		'Pengajuan {{requestType}} Anda {{decision}}',
	'template.hr.leaveDecided.body':
		'Pengajuan {{requestType}} Anda untuk {{period}} {{decision}}.',
	'template.project.attendanceRecorded.title':
		'Absensi tercatat di {{projectName}}',
	'template.project.attendanceRecorded.body':
		'{{employeeName}} check-in di {{projectName}} pada {{checkedAt}}.',
	'template.hr.payrollDraftReady.title': 'Penggajian {{period}} siap disetujui',
	'template.hr.payrollDraftReady.body': 'Proses hari gajian membuat {{records}} draf gaji untuk {{period}}.',
	'template.hr.payslipReady.title': 'Slip gaji {{period}} tersedia',
	'template.hr.payslipReady.body': 'Slip gaji {{period}} dapat diunduh dari halaman akun Anda.',
} as const;

export default notifications;
