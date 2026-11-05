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
	'common.imageInvalid': 'Unggah gambar PNG, JPG, atau WebP maksimal {{max}} MB',
	'common.payloadTooLarge': 'Data yang dikirim terlalu besar',
	'common.authenticationRequired': 'Autentikasi diperlukan',

	'location.provinceNotFound': 'Provinsi tidak ditemukan',
	'location.regencyNotFound': 'Kabupaten/kota tidak ditemukan',
	'location.districtNotFound': 'Kecamatan tidak ditemukan',
	'location.villageNotFound': 'Kelurahan/desa tidak ditemukan',

	'sales.quotationNotFound': 'Penawaran tidak ditemukan',
	'sales.paymentNotFound': 'Pembayaran tidak ditemukan',
	'procurement.supplierNotFound': 'Pemasok tidak ditemukan',
	'procurement.supplierCodeTaken': 'Kode pemasok {{code}} sudah dipakai',
	'procurement.supplierAlreadyActive': 'Pemasok sudah aktif',
	'procurement.supplierAlreadyInactive': 'Pemasok sudah nonaktif',
	'procurement.villageNotFound': 'Kelurahan/desa tidak ditemukan',
	'procurement.purchaseOrderNotFound': 'Purchase order tidak ditemukan',
	'procurement.supplierUnavailable': 'Pemasok tidak ditemukan atau nonaktif',
	'procurement.itemUnavailable': 'Baris {{line}}: barang tidak ditemukan atau nonaktif',
	'procurement.poState.notDraft': 'Hanya purchase order draf yang bisa diubah atau diajukan',
	'procurement.poState.notSubmitted': 'Purchase order tidak sedang menunggu persetujuan',
	'procurement.poState.notApproved': 'Hanya purchase order yang disetujui yang bisa ditandai terkirim',
	'procurement.poState.notCancellable': 'Purchase order ini tidak bisa dibatalkan lagi',
	'procurement.poState.received': 'Barang sudah diterima; purchase order tidak bisa dibatalkan',
	'procurement.selfApproval': 'Anda tidak bisa menyetujui atau menolak purchase order buatan sendiri',
	'procurement.poCodeTaken': 'Nomor PO {{code}} sudah dipakai',
	'procurement.receiptBin': 'Lokasi penyimpanan bukan milik gudang yang dipilih',
	'procurement.goodsReceiptNotFound': 'Penerimaan barang tidak ditemukan',
	'procurement.orderNotReceivable': 'Hanya purchase order yang terkirim atau diterima sebagian yang bisa diterima',
	'procurement.receiptLine.unknown': 'Baris {{line}}: bukan baris purchase order ini',
	'procurement.receiptLine.over': 'Baris {{line}}: melebihi sisa yang belum diterima',
	'procurement.receiptLine.serials': 'Baris {{line}}: isi satu nomor seri unik per unit',
	'sales.orderBilled': 'Sales order ini sudah ditagih; batalkan (void) invoicenya dulu',
	'finance.invoiceNotFound': 'Invoice tidak ditemukan',
	'finance.receiptNotFound': 'Kwitansi tidak ditemukan',
	'finance.orderUnavailable': 'Sales order tidak ditemukan atau sudah dibatalkan',
	'finance.term.fullyInvoiced': 'Sales order sudah ditagih penuh',
	'finance.term.empty': 'Nilai termin harus lebih dari nol',
	'finance.term.exceeds': 'Termin melebihi sisa yang belum ditagih',
	'finance.term.noPlannedTerm': 'Tidak ada termin rencana yang tersisa',
	'finance.invoiceState.notDraft': 'Hanya invoice draf yang bisa diterbitkan',
	'finance.invoiceState.notVoidable': 'Hanya invoice draf atau terbit yang belum dibayar yang bisa di-void (batalkan kwitansinya dulu)',
	'finance.invoiceState.notPayable': 'Pembayaran hanya bisa dicatat pada invoice terbit yang belum lunas',
	'finance.receiptExceeds': 'Pembayaran melebihi sisa tagihan',
	'finance.receiptReversed': 'Kwitansi sudah dibatalkan',
	'finance.dueBeforeIssue': 'Jatuh tempo tidak boleh sebelum tanggal terbit',
	'sales.orderNotFound': 'Sales order tidak ditemukan',
	'sales.orderQuotationNotReady': 'Hanya penawaran yang sudah disetujui atau terkirim yang bisa dijadikan sales order',
	'sales.orderExists': 'Penawaran ini sudah memiliki sales order',
	'sales.orderNotCancellable': 'Hanya sales order yang aktif yang bisa dibatalkan',
	'sales.customerUnavailable': 'Pelanggan tidak ditemukan atau nonaktif',
	'sales.contactInvalid': 'Kontak tersebut bukan milik pelanggan ini',
	'sales.leadNotFound': 'Lead tidak ditemukan',
	'sales.itemUnavailable': 'Baris {{line}}: barang tidak ditemukan atau nonaktif',
	'sales.discountTooLarge': 'Baris {{line}}: diskon melebihi nilai baris',
	'sales.quotationState.notDraft': 'Hanya penawaran berstatus draf yang bisa diubah atau diajukan',
	'sales.quotationState.notSubmitted': 'Penawaran tidak sedang menunggu persetujuan',
	'sales.quotationState.notApproved': 'Hanya penawaran yang sudah disetujui yang bisa ditandai terkirim',
	'sales.quotationState.notOpen': 'Hanya penawaran yang masih berjalan yang bisa ditandai batal',
	'sales.quotationState.revisionOfDraft': 'Draf bisa langsung diubah; tidak perlu revisi',
	'sales.quotationState.notLatest': 'Hanya revisi terakhir yang bisa direvisi',
	'sales.quotationState.won': 'Penawaran ini sudah memiliki sales order',
	'sales.selfApproval': 'Tidak boleh menyetujui sendiri: penawaran ini harus disetujui atau ditolak orang lain',

	'crm.customerNotFound': 'Pelanggan tidak ditemukan',
	'crm.customerCodeTaken': 'Kode pelanggan {{code}} sudah dipakai',
	'crm.customerAlreadyActive': 'Pelanggan sudah aktif',
	'crm.customerAlreadyInactive': 'Pelanggan sudah nonaktif',
	'crm.villageNotFound': 'Kelurahan/desa tidak ditemukan',
	'crm.contactNotFound': 'Kontak tidak ditemukan',
	'crm.leadNotFound': 'Lead tidak ditemukan',
	'crm.leadClosed': 'Lead yang sudah menjadi pelanggan tidak bisa diubah lagi',
	'crm.leadAlreadyConverted': 'Lead sudah menjadi pelanggan',
	'crm.leadLostReopenFirst': 'Buka kembali lead yang kalah sebelum menjadikannya pelanggan',
	'crm.leadAssignForbidden': 'Hanya manajer yang dapat membagikan lead',
	'crm.leadAssigneeInvalid': 'Penanggung jawab harus anggota organisasi ini yang punya akses lead',
	'crm.leadCustomerUnavailable': 'Pelanggan tidak ditemukan atau nonaktif',
	'crm.attachmentNotFound': 'Lampiran tidak ditemukan',
	'publicApi.keyRequired': 'API key wajib dikirim',
	'publicApi.keyInvalid': 'API key tidak valid',
	'publicApi.rateLimited': 'Terlalu banyak permintaan',
	'publicApi.tooManyFiles': 'Lampirkan paling banyak {{max}} berkas',
	'publicApi.fileTooLarge': 'Setiap berkas maksimal 25 MB',
	'publicApi.fileType': 'Gunakan berkas PDF, DWG, JPG, atau PNG',
	'publicApi.badPayload': 'Payload harus JSON yang valid',

	'inventory.itemNotFound': 'Barang tidak ditemukan',
	'inventory.unitNotFound': 'Unit barang tidak ditemukan',
	'inventory.skuTaken': 'Barang dengan SKU ini sudah ada',
	'inventory.categoryNotFound': 'Kategori barang tidak ditemukan',
	'inventory.categorySlugTaken': 'Kategori barang dengan slug ini sudah ada',
	'inventory.categoryHasItems':
		'Kategori yang masih dipakai {{count}} barang tidak bisa diarsipkan; nonaktifkan saja',
	'inventory.categoryUnavailable': 'Kategori yang dipilih tidak tersedia',
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
	'organization.singleCompany': 'Sistem ini hanya memiliki satu organisasi (perusahaan); organisasi lain tidak bisa ditambahkan',
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
