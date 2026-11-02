import type nav from '../en/nav';

/** Indonesian — mirrors `en/nav` keys exactly (values are free-form). */
const nav_: Record<keyof typeof nav, string> = {
	'section.inventory': 'Inventaris',
	'section.administration': 'Administrasi',
	'section.platform': 'Platform',

	'item.warehouses': 'Gudang',
	'item.items': 'Barang',
	'item.products': 'Produk',
	'item.components': 'Komponen',
	'item.materials': 'Material',
	'item.tools': 'Peralatan',
	'item.newItem': 'Barang baru',
	'item.itemMovements': 'Mutasi Barang',
	'item.organizations': 'Organisasi',
	'item.users': 'Pengguna',
	'item.auditLog': 'Log Audit',
	'item.settings': 'Pengaturan',

	'theme.label': 'Tema',
	'theme.light': 'Tema terang',
	'theme.dark': 'Tema gelap',
	'theme.system': 'Tema sistem',

	'organization.manage': 'Kelola',
	'organization.new': 'Organisasi baru',
	'organization.none': 'Tidak ada organisasi',
	'organization.setUp': 'Siapkan organisasi Anda',
	'organization.required': 'Pilih organisasi untuk melanjutkan.',
	'organization.switchFailed': 'Tidak dapat mengganti organisasi',
	'organization.switched': 'Organisasi diganti',

	'user.loadingAccount': 'Memuat akun…',
	'user.account': 'Akun',
	'user.notifications': 'Notifikasi',
	'user.logOut': 'Keluar',

	'project.projects': 'Proyek',
	'project.view': 'Lihat Proyek',
	'project.share': 'Bagikan Proyek',
	'project.delete': 'Hapus Proyek',
	'project.more': 'Lainnya',

	'breadcrumb.home': 'Beranda',
	'breadcrumb.organizations': 'Organisasi',
	'breadcrumb.organizationNew': 'Organisasi baru',
	'breadcrumb.organizationEdit': 'Ubah',
	'breadcrumb.memberNew': 'Tambah anggota',
	'breadcrumb.memberEdit': 'Ubah anggota',
};

export default nav_;
