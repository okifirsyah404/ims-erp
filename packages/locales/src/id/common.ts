import type common from '../en/common';

/**
 * Indonesian — mirrors `en/common` keys exactly. Typed as
 * `Record<keyof typeof common, string>` (not `typeof common`) so values may be
 * translated while the key set stays compiler-enforced.
 */
const common_: Record<keyof typeof common, string> = {
	'action.cancel': 'Batal',
	'action.save': 'Simpan',
	'action.saving': 'Menyimpan…',
	'action.delete': 'Hapus',
	'action.edit': 'Ubah',
	'action.search': 'Cari',
	'action.restore': 'Pulihkan',
	'action.previous': 'Sebelumnya',
	'action.next': 'Berikutnya',

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
	'image.hint': 'PNG, JPG, atau WebP, maksimal 2 MB.',
	'image.tooLarge': 'Gambar lebih dari 2 MB.',
};

export default common_;
