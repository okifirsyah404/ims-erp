import type en from '../en/documents';

/**
 * Indonesian copy for the document registry.
 *
 * @remarks
 * Typed as `Record<keyof typeof en, string>` so the key set must match the
 * English bundle exactly (never `typeof en`: that makes values literal types).
 */
const documents: Record<keyof typeof en, string> = {
	'title': 'Dokumen',
	'description':
		'Setiap dokumen yang diterbitkan beserta nomor, jenis, dan statusnya. Data bisnis tetap di modulnya masing-masing; registri ini menyimpan salinan terbit.',
	'entries': 'Dokumen terbit',
	'count': '{{count}} dokumen',
	'empty': 'Belum ada dokumen.',
	'noPermission': 'Anda tidak memiliki izin untuk melihat dokumen.',
	'search': 'Cari',
	'searchPlaceholder': 'Nomor atau judul',
	'code': 'Nomor',
	'type': 'Jenis',
	'documentTitle': 'Judul',
	'issuedOn': 'Tanggal terbit',
	'status': 'Status',
	'allStatuses': 'Semua status',
	'void': 'Batalkan',
	'voided': 'Dokumen dibatalkan',
	'status.draft': 'Draf',
	'status.issued': 'Terbit',
	'status.void': 'Dibatalkan',
	'status.archived': 'Diarsipkan',
	'back': 'Kembali ke dokumen',
	'details': 'Rincian',
	'detailAction': 'Lihat detail',
	'print': 'Cetak',
	'previewUnavailable': 'Pratinjau tidak dapat dimuat.',
	'voidConfirmTitle': 'Batalkan dokumen ini?',
	'voidConfirmDescription':
		'Dokumen tetap tercatat di registri sebagai dibatalkan dan tidak berlaku lagi. Tindakan ini tidak dapat diurungkan.',
	'overview': 'Rincian',
	'source': 'Sumber',
	'files': 'Berkas',
	'filesHint': 'Pindaian PDF atau gambar yang dilampirkan pada dokumen ini.',
	'uploadFile': 'Unggah berkas',
	'fileName': 'Berkas',
	'fileSize': 'Ukuran',
	'uploadedAt': 'Diunggah',
	'fileUploaded': 'Berkas diunggah',
	'fileDeleted': 'Berkas dihapus',
	'noFiles': 'Belum ada berkas terlampir.',
	'shares': 'Tautan berbagi',
	'sharesHint': 'Tautan yang dapat dibuka siapa saja tanpa masuk, sampai kedaluwarsa atau dicabut.',
	'createShare': 'Buat tautan',
	'expiresInDays': '{{count}} hari',
	'shareCreated': 'Tautan berbagi dibuat',
	'shareRevoked': 'Tautan berbagi dicabut',
	'noShares': 'Belum ada tautan berbagi.',
	'link': 'Tautan',
	'expiresAt': 'Kedaluwarsa',
	'copyLink': 'Salin',
	'linkCopied': 'Tautan disalin',
	'revoke': 'Cabut',
	'accessTrail': 'Jejak akses',
	'accessTrailHint': 'Siapa yang melihat, mengunduh, atau membagikan dokumen ini, terbaru lebih dulu.',
	'noAccess': 'Belum ada akses tercatat.',
	'action.view': 'Dilihat',
	'action.download': 'Diunduh',
	'action.print': 'Dicetak',
	'action.share': 'Dibagikan',
	'action.delete': 'Berkas dihapus',
};

export default documents;
