import type en from '../en/crm';

/**
 * Indonesian CRM copy — mirrors the `en` key set exactly.
 */
const crm: Record<keyof typeof en, string> = {
	'customers.title': 'Pelanggan',
	'customers.description':
		'Pelanggan dipakai bersama seluruh perusahaan. Pelanggan nonaktif tidak bisa dipakai di dokumen baru.',
	'customers.new': 'Pelanggan baru',
	'customers.edit': 'Ubah pelanggan',
	'customers.search': 'Cari nama atau kode…',
	'customers.empty': 'Belum ada pelanggan.',
	'customers.noResults': 'Tidak ada pelanggan yang cocok.',
	'customers.notFound': 'Pelanggan tidak ditemukan.',
	'customers.back': 'Kembali ke daftar pelanggan',
	'customers.filterAll': 'Semua status',
	'customers.saved': 'Pelanggan disimpan',
	'customers.deactivate': 'Nonaktifkan',
	'customers.activate': 'Aktifkan',
	'customers.deactivated': 'Pelanggan dinonaktifkan',
	'customers.activated': 'Pelanggan diaktifkan',
	'customers.details': 'Rincian',

	'customer.code': 'Kode',
	'customer.codeHint': 'Huruf, angka, dan . _ - /; disimpan dalam huruf besar.',
	'customer.name': 'Nama',
	'customer.legalName': 'Nama badan usaha',
	'customer.customerType': 'Jenis',
	'customer.taxId': 'NPWP',
	'customer.taxIdHint': '15 atau 16 digit; titik dan tanda hubung diabaikan.',
	'customer.email': 'Email',
	'customer.phone': 'Telepon',
	'customer.whatsapp': 'WhatsApp',
	'customer.address': 'Alamat',
	'customer.postalCode': 'Kode pos',
	'customer.notes': 'Catatan',
	'customer.status': 'Status',

	'customerType.individual': 'Perorangan',
	'customerType.company': 'Perusahaan',
	'customerType.government': 'Instansi pemerintah',
	'customerType.partner': 'Mitra',

	'customerStatus.active': 'Aktif',
	'customerStatus.inactive': 'Nonaktif',

	'contacts.title': 'Kontak',
	'contacts.add': 'Tambah kontak',
	'contacts.edit': 'Ubah kontak',
	'contacts.empty': 'Belum ada kontak.',
	'contacts.name': 'Nama',
	'contacts.position': 'Jabatan',
	'contacts.isPrimary': 'Kontak utama',
	'contacts.primary': 'Utama',
	'contacts.saved': 'Kontak disimpan',
	'contacts.remove': 'Hapus',
	'contacts.removeConfirm': 'Hapus kontak {{name}}?',
	'contacts.removed': 'Kontak dihapus',
};

export default crm;
