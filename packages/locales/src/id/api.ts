/**
 * Indonesian API messages. Mirrors `en/api.ts` key-for-key; the parity test
 * fails if the two drift.
 */
import type en from '../en/api';

const api: Record<keyof typeof en, string> = {
	'common.validationFailed': 'Validasi gagal',
	'common.notFound': 'Tidak ditemukan',
	'common.conflict': 'Konflik',
	'common.unsupportedMediaType': 'Tipe media tidak didukung',
	'common.payloadTooLarge': 'Data yang dikirim terlalu besar',
	'common.authenticationRequired': 'Autentikasi diperlukan',

	'location.provinceNotFound': 'Provinsi tidak ditemukan',
	'location.regencyNotFound': 'Kabupaten/kota tidak ditemukan',
	'location.districtNotFound': 'Kecamatan tidak ditemukan',
	'location.villageNotFound': 'Kelurahan/desa tidak ditemukan',

	'sales.quotationNotFound': 'Penawaran tidak ditemukan',
	'sales.paymentNotFound': 'Pembayaran tidak ditemukan',

	'inventory.itemNotFound': 'Barang tidak ditemukan',
	'inventory.unitNotFound': 'Unit barang tidak ditemukan',
	'inventory.skuTaken': 'Barang dengan SKU ini sudah ada',
	'inventory.serialTaken': 'Unit barang dengan nomor seri ini sudah ada',
	'inventory.ruleViolation': 'Aturan inventaris tidak mengizinkan: {{rule}}',
	'inventory.itemHasUnits':
		'Barang tidak dapat diarsipkan karena masih memiliki {{count}} unit aktif',
	'inventory.warehouseNotFound': 'Gudang tidak ditemukan',
	'inventory.warehouseCodeTaken':
		'Gudang dengan kode ini sudah ada pada cakupan ini',
	'inventory.warehouseHasUnits':
		'Gudang tidak dapat diarsipkan karena masih menyimpan {{count}} unit aktif',
	'inventory.storageNotFound': 'Penyimpanan tidak ditemukan',
	'inventory.storageCodeTaken':
		'Penyimpanan dengan kode ini sudah ada di gudang ini',
	'inventory.warehouseInactive':
		'Gudang "{{warehouseCode}}" tidak aktif; penyimpanannya tidak dapat diubah',
	'inventory.movementNotFound': 'Pergerakan stok tidak ditemukan',
	'inventory.movementAlreadyReversed':
		'Pergerakan stok ini sudah dibalik sebelumnya',
	'inventory.insufficientStock':
		'Tidak dapat memindahkan {{requested}}: hanya tersedia {{available}}',
	'inventory.adjustmentNotFound': 'Penyesuaian stok tidak ditemukan',
	'inventory.adjustmentCodeTaken':
		'Penyesuaian dengan kode ini sudah ada di organisasi ini',
	'inventory.adjustmentTransition':
		'Penyesuaian tidak dapat berpindah dari "{{from}}" ke "{{to}}"',
	'inventory.selfApprovalForbidden':
		'Anda tidak dapat menyetujui penyesuaian stok Anda sendiri',
	'inventory.adjustmentHasNoLines':
		'Penyesuaian stok harus memiliki minimal satu baris',

	'user.notFound': 'Pengguna tidak ditemukan',
	'user.emailInUse': 'Email sudah digunakan',
	'user.globalAdminRequired': 'Peran administrator global diperlukan',
	'user.fileFieldExpected': 'Diperlukan kolom berkas multipart',
	'user.avatarTooLarge': 'Avatar maksimal 2 MiB',
	'user.avatarUnsupportedType': 'Avatar harus berupa gambar PNG, JPEG, atau WebP',

	'organization.lastOrganization':
		'Ini organisasi terakhir Anda dan tidak dapat dihapus',
	'organization.notFound': 'Organisasi tidak ditemukan',
	'organization.companyProfileRequired':
		'Lengkapi profil perusahaan (beserta kode dokumen) terlebih dahulu',
	'numbering.unknownDocumentType': 'Jenis dokumen tidak dikenal',
	'numbering.pattern.length': 'Pola harus 1-100 karakter',
	'numbering.pattern.unknownToken': 'Token {{token}} tidak dikenal',
	'numbering.pattern.tokenNotForType':
		'Token {{token}} hanya tersedia untuk: {{types}}',
	'numbering.pattern.tokenTakesNoWidth': 'Token {{token}} tidak memakai lebar digit',
	'numbering.pattern.seqWidth': 'Lebar {SEQ:n} harus antara 1 dan 10',
	'numbering.pattern.seqOnce': 'Pola harus memuat {SEQ} tepat satu kali',
	'numbering.pattern.braces': 'Kurung kurawal token tidak seimbang atau salah',
	'numbering.pattern.literals':
		'Di luar token hanya boleh huruf, angka, spasi, / - . _',
	'organization.slugTaken': 'Slug organisasi sudah dipakai',
	'organization.alreadyDeleted': 'Organisasi sudah dihapus',
	'organization.notDeleted': 'Organisasi belum dihapus',
	'organization.memberNotFound': 'Anggota tidak ditemukan',
	'organization.lastOwner':
		'Tidak dapat menghapus atau menurunkan pemilik terakhir',

	'invitation.notFound': 'Undangan tidak ditemukan',
	'invitation.pendingExists': 'Sudah ada undangan tertunda untuk email ini',
	'invitation.notPending': 'Undangan tidak dalam status tertunda',
	'invitation.claimed':
		'Undangan yang sudah diklaim tidak dapat dihapus; nonaktifkan penggunanya',
	'invitation.invalidPayload':
		'Undangan organisasi memerlukan organizationId dan roleId',
	'invitation.requiresName': 'Undangan aplikasi memerlukan nama',
	'invitation.invalidLink': 'Tautan undangan tidak valid atau kedaluwarsa',
	'invitation.alreadyUsed': 'Undangan ini sudah digunakan',
	'invitation.inactive': 'Undangan ini sudah tidak aktif',
	'invitation.expired': 'Tautan undangan ini sudah kedaluwarsa',
	'invitation.bulkLimited': 'Maksimal {{max}} baris',
	'invitation.claimUserMissing': 'Pengguna yang diundang tidak lagi tersedia',
	'invitation.claimAlreadyActive': 'Akun ini sudah aktif',
	'invitation.claimInvalid': 'Data klaim tidak valid',

	'claim.usernameTaken': 'Nama pengguna sudah dipakai',
	'claim.phoneInUse': 'Nomor telepon sudah digunakan',
	'claim.alreadyInUse': 'Nama pengguna atau email sudah digunakan',

	'role.notFound': 'Peran tidak ditemukan',
	'role.nameTaken': 'Peran bernama "{{name}}" sudah ada di organisasi ini',
	'role.inUse': 'Peran ini tidak dapat dihapus: peran sistem atau masih dipakai',
	'role.systemRole': '"{{role}}" adalah peran sistem dan tidak dapat dihapus',
	'role.stillAssigned':
		'{{count}} anggota masih memakai "{{role}}"; pindahkan mereka terlebih dahulu',
	'role.invalidPermission': 'Pemberian izin di luar katalog',
	'role.unknownResource': '{{label}}: sumber daya "{{resource}}" tidak dikenal',
	'role.unknownAction':
		'{{label}}: "{{resource}}" tidak memiliki aksi "{{action}}"',
	'role.rankExceeded':
		'Anda tidak dapat memberikan peran setara atau di atas peringkat Anda',
	'role.targetRankExceeded':
		'Target memegang "{{role}}" (peringkat {{rank}}) di organisasi Anda',

	'userAdmin.accountAlreadyActive': 'Akun sudah aktif',
	'userAdmin.cannotDeactivate':
		'Tidak dapat menonaktifkan akun yang tidak berstatus aktif',

	'auth.ownerGrantRequired':
		'Hanya pemilik organisasi yang dapat memberikan peran pemilik',
	'auth.roleNotGrantable': 'Peran tidak dapat diberikan: {{roles}}',

	// Borrowing (S4)
	'inventory.borrowingNotFound': 'Peminjaman tidak ditemukan',
	'inventory.borrowingLineNotFound': 'Baris peminjaman tidak ditemukan',
	'inventory.unitNotOnBorrowing':
		'Unit tersebut tidak dipinjamkan pada peminjaman ini',
	'inventory.borrowingTransition':
		'Perubahan status tersebut tidak diizinkan untuk peminjaman ini',
	'inventory.borrowingCodeTaken':
		'Tidak dapat membuat kode peminjaman yang unik',
	'inventory.borrowingHasNoLines':
		'Peminjaman harus memiliki minimal satu baris',
	'inventory.unitNotAvailable': 'Unit tersebut tidak dapat dipinjamkan',
	'inventory.borrowerIdentity':
		'Identitas peminjam tidak sesuai dengan tipe peminjam',
	'inventory.guestIdentityIncomplete':
		'Peminjam tamu belum melengkapi data identitas wajib',
	'inventory.borrowingSelfApprovalForbidden':
		'Anda tidak dapat menyetujui peminjaman Anda sendiri',
};

export default api;
