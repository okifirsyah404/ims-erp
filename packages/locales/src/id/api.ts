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
	'inventory.warehouseLinkConflict':
		'Tautan tidak dapat diputus selama organisasi masih memiliki {{count}} peminjaman aktif yang berasal dari gudang ini',
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

	'assets.assetNotFound': 'Aset tidak ditemukan',
	'assets.categoryNotFound': 'Kategori aset tidak ditemukan',
	'assets.categoryCodeTaken': 'Kategori aset dengan kode ini sudah ada',
	'assets.ruleViolation': 'Aturan aset tidak mengizinkan: {{rule}}',
	'assets.illegalTransition':
		'Aset tidak dapat berpindah dari "{{from}}" ke "{{to}}"',
	'assets.assetHasHistory':
		'Tidak dapat mengarsipkan aset dengan riwayat peminjaman atau pemeliharaan',
	'assets.placeBlocked':
		'Aset tidak dapat ditempatkan pada status saat ini',
	'assets.transferBlocked':
		'Aset tidak dapat dipindahkan pada status saat ini',
	'assets.periodAlreadyDepreciated':
		'Aset ini sudah memiliki entri penyusutan untuk {{period}}',
	'assets.depreciationExceedsBookValue':
		'Penyusutan tidak boleh melebihi nilai buku tersisa',
	'assets.toolSetNotEmpty':
		'Tidak dapat mengarsipkan set perkakas yang masih berisi item',

	'user.notFound': 'Pengguna tidak ditemukan',
	'user.emailInUse': 'Email sudah digunakan',
	'user.globalAdminRequired': 'Peran administrator global diperlukan',
	'user.fileFieldExpected': 'Diperlukan kolom berkas multipart',
	'user.avatarTooLarge': 'Avatar maksimal 2 MiB',
	'user.avatarUnsupportedType': 'Avatar harus berupa gambar PNG, JPEG, atau WebP',

	'organization.lastOrganization':
		'Ini organisasi terakhir Anda dan tidak dapat dihapus',
	'organization.notFound': 'Organisasi tidak ditemukan',
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

	'userAdmin.accountAlreadyActive': 'Akun sudah aktif',
	'userAdmin.cannotDeactivate':
		'Tidak dapat menonaktifkan akun yang tidak berstatus aktif',

	'auth.ownerGrantRequired':
		'Hanya pemilik organisasi yang dapat memberikan peran pemilik',
	'auth.roleNotGrantable': 'Peran tidak dapat diberikan: {{roles}}',

	// Borrowing (S4)
	'assets.borrowingNotFound': 'Peminjaman tidak ditemukan',
	'assets.borrowingLineNotFound': 'Baris peminjaman tidak ditemukan',
	'assets.unitNotOnBorrowing':
		'Aset tersebut tidak dipinjamkan pada peminjaman ini',
	'assets.borrowingTransition':
		'Perubahan status tersebut tidak diizinkan untuk peminjaman ini',
	'assets.borrowingCodeTaken':
		'Tidak dapat membuat kode peminjaman yang unik',
	'assets.borrowingHasNoLines':
		'Peminjaman harus memiliki minimal satu baris',
	'assets.unitNotAvailable': 'Aset tersebut tidak dapat dipinjamkan',
	'assets.borrowerIdentity':
		'Identitas peminjam tidak sesuai dengan tipe peminjam',
	'assets.guestIdentityIncomplete':
		'Peminjam tamu belum melengkapi data identitas wajib',
	'assets.borrowingSelfApprovalForbidden':
		'Anda tidak dapat menyetujui peminjaman Anda sendiri',

	// Pajak (ERP-0016)
	'accounting.taxTypeNotFound': 'Jenis pajak tidak ditemukan',
	'accounting.taxTypeOverlap':
		'Periode berlaku bertabrakan dengan tarif yang ada untuk kode pajak ini',
	'accounting.taxTypeInUse': 'Jenis pajak masih digunakan',
	'accounting.taxRateNotFound': 'Tidak ada tarif pajak aktif untuk tanggal ini',
	'accounting.taxRecordNotFound': 'Catatan pajak tidak ditemukan',
	'accounting.taxRecordPeriodTaken':
		'Catatan pajak untuk jenis dan periode ini sudah ada',
	'accounting.taxRecordLocked': 'Catatan pajak tidak lagi dapat diubah',
	'accounting.taxTransition':
		'Perubahan status tersebut tidak diizinkan untuk catatan ini',
	'accounting.withholdingNotFound': 'Catatan pemotongan pajak tidak ditemukan',
	'accounting.withholdingLocked': 'Catatan pemotongan pajak tidak lagi dapat diubah',
	'accounting.withholdingTransition':
		'Perubahan status tersebut tidak diizinkan untuk catatan pemotongan ini',

	// Buku besar (M09 F2)
	'accounting.accountNotFound': 'Akun bagan akun tidak ditemukan',
	'accounting.accountCodeTaken': 'Kode akun sudah digunakan',
	'accounting.accountInUse':
		'Akun masih direferensikan dan tidak dapat dinonaktifkan',
	'accounting.accountNotPostable':
		'Baris jurnal memerlukan akun yang dapat diposting',
	'accounting.accountInactive': 'Akun tidak aktif',
	'accounting.periodNotFound': 'Periode akuntansi tidak ditemukan',
	'accounting.periodTaken': 'Periode akuntansi untuk bulan ini sudah ada',
	'accounting.periodLocked':
		'Periode akuntansi untuk tanggal ini sudah ditutup',
	'accounting.periodTransition':
		'Perubahan status tersebut tidak diizinkan untuk periode ini',
	'accounting.journalEntryNotFound': 'Entri jurnal tidak ditemukan',
	'accounting.journalUnbalanced':
		'Entri jurnal tidak seimbang: debit harus sama dengan kredit',
	'accounting.journalLineSide':
		'Setiap baris jurnal harus memuat salah satu dari debit atau kredit',
	'accounting.journalDuplicate':
		'Entri jurnal terposting dengan kunci idempotensi ini sudah ada',
	'accounting.journalTransition':
		'Perubahan status tersebut tidak diizinkan untuk entri jurnal ini',
	'accounting.journalAlreadyReversed': 'Entri jurnal sudah pernah dibalik',
	'accounting.reversalPeriodLocked':
		'Pembalikan akan jatuh pada periode yang sudah ditutup; buka kembali terlebih dahulu',

	// Buku besar F3
	'accounting.openingBalanceAlreadyPosted':
		'Saldo awal sudah pernah diposting dan tidak dapat diubah; lakukan koreksi melalui pembalikan jurnal',
	'accounting.openingBalanceLocked':
		'Baris saldo awal tidak ditemukan atau tidak dapat diubah',
	'accounting.cashBankAccountNotFound': 'Akun kas/bank tidak ditemukan',
	'accounting.cashBankAccountCodeTaken':
		'Kode akun kas/bank sudah digunakan',
	'accounting.cashBankAccountInactive': 'Akun kas/bank tidak aktif',
	'accounting.cashBankLinkRequired':
		'Akun kas/bank belum ditautkan ke akun buku besar; tambahkan tautan sebelum mencatat pergerakan',
	'accounting.cashBankTransactionNotFound':
		'Transaksi kas/bank tidak ditemukan',
	'accounting.cashBankInsufficientFunds':
		'Saldo akun kas/bank tidak mencukupi',

	// Faktur & Piutang (F4)
	'accounting.arAccountNotConfigured':
		'Belum ada akun buku besar aktif untuk peran posting ini; lengkapi bagan akun terlebih dahulu',
	'accounting.paymentNotFound': 'Pembayaran tidak ditemukan',
	'accounting.paymentInvalidTransition':
		'Perubahan status tersebut tidak diizinkan untuk pembayaran ini',
	'accounting.paymentVoidNotAllowed':
		'Pembayaran yang sudah dieksekusi tidak dapat dibatalkan di sini; lakukan koreksi melalui penyesuaian akhir periode',
	'accounting.paymentAllocationMismatch':
		'Jumlah alokasi harus sama persis dengan nilai pembayaran',
	'accounting.paymentOverAllocation':
		'Alokasi melebihi sisa tagihan faktur',
	'accounting.paymentTargetNotIssued':
		'Alokasi hanya boleh menarget faktur berstatus terbit atau sebagian dibayar',
	'accounting.paymentCashAccountRequired':
		'Akun kas/bank diperlukan untuk mengeksekusi pembayaran ini',
	'accounting.billNotFound': 'Tagihan pemasok tidak ditemukan',
	'accounting.billNotDraft':
		'Hanya tagihan pemasok berstatus draf yang dapat diubah atau dicatat',
	'accounting.bankReconciliationNotFound':
		'Rekonsiliasi bank tidak ditemukan',
	'accounting.bankReconciliationState':
		'Tindakan rekonsiliasi tersebut tidak diizinkan untuk dokumen ini',
	'accounting.reportPeriodInvalid':
		'Rentang tanggal laporan tidak valid',

	// Faktur (F4) — kunci sales
	'sales.invoiceNotFound': 'Faktur tidak ditemukan',
	'sales.invoiceNotDraft':
		'Hanya faktur berstatus draf yang dapat diubah atau diterbitkan',
	'sales.invoiceNoItems':
		'Faktur memerlukan minimal satu baris item untuk diterbitkan',
	'sales.invoiceDueBeforeIssue':
		'Tanggal jatuh tempo tidak boleh sebelum tanggal terbit',
};

export default api;
