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
	'template.crm.companyChangeRequested.title': '{{customerName}} meminta perubahan data perusahaan',
	'template.crm.companyChangeRequested.body':
		'{{requestedBy}} meminta perubahan {{fields}} untuk {{customerName}} di portal pelanggan. Tinjau di halaman pelanggan.',
	'template.sales.invoiceIssued.title': 'Invoice {{invoiceNumber}} diterbitkan',
	'template.sales.invoiceIssued.body':
		'Invoice {{invoiceNumber}} untuk {{customerName}} diterbitkan sebesar {{amount}}.',
	'template.sales.onlineOrderReceived.title': 'Pesanan online {{quotationNumber}} dari {{customerName}}',
	'template.sales.onlineOrderReceived.body':
		'{{customerName}} memesan secara online ({{amount}}). Periksa dan ajukan draf SPH {{quotationNumber}}.',
	'template.sales.quotationAccepted.title': '{{customerName}} menyetujui {{quotationNumber}}',
	'template.sales.quotationAccepted.body':
		'{{customerName}} menyetujui {{quotationNumber}} di portal pelanggan. Sales order {{orderNumber}} telah dibuat.',
	'template.sales.quotationRevisionRequested.title': '{{customerName}} meminta revisi {{quotationNumber}}',
	'template.sales.quotationRevisionRequested.body': '{{customerName}} meminta revisi {{quotationNumber}}: {{message}}',
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
} as const;

export default notifications;
