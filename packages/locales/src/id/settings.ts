import type en from '../en/settings';

/**
 * Indonesian company settings copy — mirrors the `en` key set exactly.
 */
const settings: Record<keyof typeof en, string> = {
	'companyProfile.title': 'Profil Perusahaan',
	'companyProfile.description':
		'Identitas hukum dan kontak kop surat perusahaan. Satu profil untuk seluruh perusahaan.',
	'companyProfile.saved': 'Profil perusahaan disimpan',
	'companyProfile.empty':
		'Profil perusahaan belum diisi. Nomor dokumen membutuhkan kode perusahaannya.',
	'companyProfile.readOnly':
		'Anda dapat melihat profil; mengubahnya membutuhkan akses pengaturan perusahaan.',
	'companyProfile.section.identity': 'Perusahaan',
	'companyProfile.section.contact': 'Alamat dan kontak',
	'companyProfile.legalName': 'Nama badan usaha',
	'companyProfile.tradingName': 'Nama dagang',
	'companyProfile.documentCode': 'Kode perusahaan',
	'companyProfile.documentCodeHint':
		'Dipakai nomor dokumen ({COMPANY}), mis. IMS. Hanya huruf dan angka.',
	'companyProfile.tagline': 'Slogan',
	'companyProfile.taxId': 'NPWP',
	'companyProfile.addressLine': 'Alamat',
	'companyProfile.postalCode': 'Kode pos',
	'companyProfile.phone': 'Telepon',
	'companyProfile.email': 'Email',
	'companyProfile.website': 'Situs web',

	'companyProfile.section.images': 'Gambar',
	'companyProfile.imagesHint': 'Logo kop surat dicetak di setiap dokumen; gambar halaman login adalah foto yang tampil di /login.',
	'companyProfile.image.logo': 'Logo kop surat',
	'companyProfile.image.onboarding': 'Gambar halaman login',
	'companyProfile.imageSaved': 'Gambar disimpan',

	'document.title': 'Pengaturan Dokumen',
	'document.description': 'Nilai yang dipakai saat dokumen dicetak dan ditandatangani.',
	'document.settingsTitle': 'Pengaturan dokumen',
	'document.settingsDescription': 'Nilai yang dipakai modul dokumen (grup `document`).',
	'document.settingsEmpty':
		'Belum ada pengaturan dokumen. `document.signature_request_expiry_days` ditulis oleh alur permintaan tanda tangan (ERP-0048).',

	'paymentGateways.title': 'Gateway pembayaran',
	'paymentGateways.description':
		'Penyedia pembayaran online untuk membuat checkout invoice. Rahasia bersifat hanya-tulis: setelah disimpan tidak akan ditampilkan lagi.',
	'paymentGateways.noAccess': 'Anda tidak memiliki akses ke pengaturan gateway pembayaran.',
	'paymentGateways.empty': 'Belum ada gateway pembayaran yang dikonfigurasi.',
	'paymentGateways.add': 'Tambah gateway',
	'paymentGateways.createTitle': 'Tambah gateway pembayaran',
	'paymentGateways.editTitle': 'Ubah {{name}}',
	'paymentGateways.dialogDescription': 'Penyedia dan kode tidak dapat diubah setelah gateway dibuat.',
	'paymentGateways.name': 'Nama',
	'paymentGateways.code': 'Kode',
	'paymentGateways.codeHint': 'Hanya huruf, angka, tanda hubung, dan garis bawah.',
	'paymentGateways.provider': 'Penyedia',
	'paymentGateways.mode': 'Mode',
	'paymentGateways.modeSandbox': 'Sandbox (uji coba)',
	'paymentGateways.modeLive': 'Live',
	'paymentGateways.status': 'Status',
	'paymentGateways.defaultBadge': 'Utama',
	'paymentGateways.makeDefault': 'Jadikan utama',
	'paymentGateways.defaultSet': 'Gateway utama diubah',
	'paymentGateways.secret': 'Rahasia API',
	'paymentGateways.webhookToken': 'Token webhook',
	'paymentGateways.secretHintNew': 'Disimpan terenkripsi dan tidak akan ditampilkan lagi.',
	'paymentGateways.secretHintRotate': 'Kosongkan untuk mempertahankan nilai saat ini; mengetik nilai baru akan menggantinya.',
	'paymentGateways.configured': 'Terkonfigurasi',
	'paymentGateways.configuredLast4': 'Terkonfigurasi (berakhiran {{last4}})',
	'paymentGateways.notConfigured': 'Belum dikonfigurasi',
	'paymentGateways.rotatedAt': 'Rahasia diganti',
	'paymentGateways.neverRotated': 'Belum pernah',
	'paymentGateways.saved': 'Gateway disimpan',

	'settings.title': 'Pengaturan',
	'settings.description': 'Pengaturan kunci/nilai di level perusahaan yang dipakai modul lain.',
	'settings.empty': 'Belum ada pengaturan.',
	'settings.group': 'Grup',
	'settings.key': 'Kunci',
	'settings.valueType': 'Tipe',
	'settings.value': 'Nilai',
	'settings.edit': 'Ubah',
	'settings.editTitle': 'Pengaturan {{key}}',
	'settings.editDescription': 'Nilai kosong menghapus isi pengaturan. Nilai harus sesuai tipenya.',
	'settings.saved': 'Pengaturan disimpan',
	'settings.type.string': 'Teks',
	'settings.type.number': 'Angka',
	'settings.type.boolean': 'Ya / tidak (true atau false)',
	'settings.type.json': 'JSON',
	'settings.type.date': 'Tanggal (YYYY-MM-DD)',
};

export default settings;
