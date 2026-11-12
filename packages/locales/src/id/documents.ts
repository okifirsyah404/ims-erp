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
};

export default documents;
