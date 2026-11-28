import type common from '../en/common';

/**
 * Indonesian — mirrors `en/common` keys exactly. Typed as
 * `Record<keyof typeof common, string>` (not `typeof common`) so values may be
 * translated while the key set stays compiler-enforced.
 */
const common_: Record<keyof typeof common, string> = {
	// Suffix of an optional form field label: "Phone (Optional)" (ERP-0114).
	'form.optional': 'Opsional',
	// Shared form parts (P7-6, RF-6, RF-16, RF-19, RF-27).
	'form.requiredLegend': 'wajib diisi',
	'form.requiredMark': 'wajib',
	'form.errorSummary': 'Ada {{count}} isian yang perlu diperbaiki',
	'form.serverError':
		'Terjadi kesalahan di server (ref: {{ref}}). Coba lagi atau laporkan nomor ini ke admin.',
	'form.networkError': 'Gagal menyimpan. Periksa koneksi lalu coba lagi.',
	// Field messages with the field label (pattern 4.5).
	'formError.required': '{{label}} wajib diisi.',
	'formError.invalidFormat': '{{label}} tidak valid.',
	'formError.invalidFormatExample': '{{label}} tidak valid. Contoh: {{example}}.',
	'formError.min': '{{label}} minimal {{min}}.',
	'formError.max': '{{label}} maksimal {{max}}.',
	'formError.minLength': '{{label}} minimal {{min}} karakter.',
	'formError.maxLength': '{{label}} maksimal {{max}} karakter.',
	'formError.notNegative': '{{label}} tidak boleh negatif.',
	'formError.notPast': '{{label}} tidak boleh di waktu yang sudah lewat.',
	'formError.dateOrder': '{{label}} tidak boleh sebelum {{other}}.',
	'formError.taken': '{{label}} {{value}} sudah dipakai. Gunakan yang lain.',
	'formError.exceedsRemaining': '{{label}} melebihi sisa ({{remaining}}).',
	'formError.emptyTable': 'Tambahkan minimal satu {{label}}.',
	'formError.contactRequired': 'Isi minimal satu kontak: telepon, WhatsApp, atau email.',
	'formError.unknownField': '{{label}} tidak dikenal.',
	'action.cancel': 'Batal',
	'cardMenu.label': 'Aksi',
	'cardMenu.stockAdjustment': 'Penyesuaian stok',
	'cardMenu.archive': 'Arsipkan',
	'cardMenu.activate': 'Aktifkan',
	'cardMenu.delete': 'Hapus',
	'cardMenu.archiveTitle': 'Arsipkan "{{name}}"?',
	'cardMenu.archiveBody':
		'Ditandai nonaktif: tetap muncul di daftar dengan lencana nonaktif dan tidak ditawarkan lagi untuk dokumen baru. Anda bisa mengaktifkannya kembali kapan saja.',
	'cardMenu.deleteTitle': 'Hapus "{{name}}"?',
	'cardMenu.deleteBody':
		'Dihapus dari daftar. Catatan yang sudah memakainya tetap menyimpan riwayatnya. Tindakan ini tidak bisa dibatalkan dari layar ini.',
	'cardMenu.reasonPlaceholder': 'Alasan (wajib)',
	'action.confirm': 'Konfirmasi',
	'action.save': 'Simpan',
	'action.saving': 'Menyimpan…',
	'action.delete': 'Hapus',
	'action.edit': 'Ubah',
	'action.search': 'Cari',
	'action.restore': 'Pulihkan',
	'action.previous': 'Sebelumnya',
	'action.next': 'Berikutnya',
	'action.actions': 'Tindakan',
	'action.download': 'Unduh',

	'state.loading': 'Memuat…',
	'state.noResults': 'Tidak ada hasil',

	'status.active': 'Aktif',
	'status.inactive': 'Tidak aktif',
	'status.pending': 'Tertunda',
	'status.deactivated': 'Dinonaktifkan',
	'status.deleted': 'Dihapus',
	'status.enabled': 'Diaktifkan',
	'status.disabled': 'Dimatikan',

	'pagination.summary': 'Halaman {{page}} dari {{totalPages}}',
	'pagination.goto': 'Ke halaman {{page}}',

	'error.generic': 'Terjadi kesalahan',
	'error.failed': 'Gagal',
	'error.network':
		'Tidak dapat menghubungi server. Periksa koneksi Anda dan coba lagi.',

	'notFound.title': '404 — Halaman tidak ditemukan',
	'notFound.description':
		'Halaman yang Anda cari tidak ada atau telah dipindahkan.',
	'notFound.backToDashboard': 'Kembali ke dasbor',

	'breadcrumb.home': 'Beranda',

	'language.label': 'Bahasa',
	'language.switchToEnglish': 'English',
	'language.switchToIndonesian': 'Bahasa Indonesia',
	'image.none': 'Belum ada gambar',
	'image.remove': 'Hapus gambar',
	'image.drop': 'Lepas gambar di sini, atau klik untuk memilih',
	'image.choose': 'Pilih gambar',
	'image.replace': 'Ganti gambar',
	'image.converting': 'Mengonversi.',
	'image.wrongType': 'Berkas itu bukan gambar.',
	'image.sourceTooLarge': 'Gambar lebih dari 20 MB.',
	'image.hint': 'PNG, JPG, atau WebP, maksimal 2 MB. Dikonversi ke WebP sebelum diunggah.',
	'image.tooLarge': 'Gambar lebih dari 2 MB.',
	'gallery.cover': 'Sampul',
	'gallery.pending': 'Belum disimpan',
	'gallery.add': 'Tambah gambar',
	'gallery.caption': 'Keterangan',
	'gallery.moveEarlier': 'Geser maju',
	'gallery.moveLater': 'Geser mundur',
	'gallery.limit': 'Maksimal {{max}} gambar.',
	'gallery.hint': 'Maksimal {{max}} gambar, PNG, JPG, atau WebP. Gambar pertama menjadi sampul. Gambar baru diunggah saat disimpan.',
};

export default common_;
