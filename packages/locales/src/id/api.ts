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
	'common.imageInvalid': 'Unggah gambar PNG, JPG, WebP, atau HEIC maksimal {{max}} MB',
	'common.fileInvalid': 'Unggah file PDF, PNG, JPG, atau WebP maksimal {{max}} MB',
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
	'sales.deliveryNoteNotFound': 'Surat jalan tidak ditemukan',
	'sales.deliveryOrderNotDeliverable': 'Hanya sales order yang aktif atau sedang berjalan yang bisa dikirim',
	'sales.deliveryLine.unknown': 'Baris {{line}}: bukan baris sales order ini',
	'sales.deliveryLine.over': 'Baris {{line}}: melebihi sisa yang belum dikirim pada sales order',
	'sales.deliveryLine.serials': 'Baris {{line}}: isi satu nomor seri unik per unit',
	'sales.deliveryLine.notInStock': 'Baris {{line}}: ada nomor seri yang tidak tersedia di gudang ini',
	'sales.deliveryBin': 'Lokasi simpan bukan milik gudang yang dipilih',
	'sales.deliveryState.ship': 'Hanya surat jalan yang disiapkan yang bisa dikirim',
	'sales.deliveryState.deliver': 'Hanya surat jalan yang sudah dikirim yang bisa ditandai diterima',
	'sales.deliveryState.cancel': 'Hanya surat jalan yang disiapkan yang bisa dibatalkan',
	'sales.orderDelivered': 'Sales order ini sudah punya surat jalan; batalkan surat jalannya dulu',
	'sales.deliveryReadForbidden': 'Anda tidak berhak melihat surat jalan',
	'projects.notFound': 'Proyek tidak ditemukan',
	'projects.notActive': 'Proyek sudah ditutup atau dibatalkan',
	'projects.deal.notFound': 'Sales order aktif tidak ditemukan',
	'projects.deal.taken': 'Deal ini sudah memiliki proyek',
	'projects.staff.pic': 'PIC harus anggota yang berhak mengelola proyek',
	'projects.staff.assignee': 'Tugas hanya bisa diberikan ke anggota yang berhak mengerjakan tugas',
	'projects.dates': 'Target selesai lebih awal dari target mulai',
	'projects.evidenceMissing': 'Untuk menutup proyek perlu bukti: {{missing}}',
	'projects.childNotFound.task': 'Tugas tidak ditemukan di proyek ini',
	'projects.childNotFound.evidence': 'File bukti tidak ditemukan di proyek ini',
	'projects.childNotFound.cost': 'Biaya tidak ditemukan di proyek ini',
	'projects.forbidden.task': 'Hanya petugas atau manajer proyek yang bisa mengubah tugas ini',
	'projects.forbidden.evidence': 'Hanya pengunggah atau manajer proyek yang bisa menghapus file ini',
	'projects.file.type': 'Gunakan file JPG, PNG, WebP atau PDF',
	'projects.file.size': 'Setiap file maksimal 15 MB',
	'projects.file.empty': 'File kosong',
	'projects.costVoided': 'Biaya ini sudah dibatalkan',
	'sales.orderHasProject': 'Sales order ini sudah punya proyek; batalkan proyeknya dulu',
	'projects.bastNotFound': 'BAST tidak ditemukan di proyek ini',
	'aftersales.warrantyBastRequired': 'Pilih BAST proyek ini yang masih berlaku: garansi dimulai dari tanggalnya',
	'aftersales.warrantyProjectCancelled': 'Proyek sudah dibatalkan',
	'aftersales.warrantyExists': 'Proyek ini sudah memiliki surat garansi',
	'aftersales.ticketNotFound': 'Tiket servis tidak ditemukan',
	'aftersales.ticketRef.customer': 'Pelanggan tidak ada atau tidak aktif',
	'aftersales.ticketRef.project': 'Proyek ini bukan milik pelanggan tersebut',
	'aftersales.ticketRef.serial': 'Nomor seri ini dikirim ke pelanggan lain',
	'aftersales.ticketState.assign': 'Hanya tiket baru atau yang sedang dikerjakan yang bisa ditugaskan',
	'aftersales.ticketState.start': 'Hanya tiket baru yang bisa mulai dikerjakan',
	'aftersales.ticketState.resolve': 'Hanya tiket baru atau yang sedang dikerjakan yang bisa diselesaikan',
	'aftersales.ticketState.reopen': 'Hanya tiket yang sudah selesai yang bisa dibuka lagi',
	'aftersales.ticketState.close': 'Hanya tiket yang sudah selesai yang bisa ditutup',
	'aftersales.ticketForbidden': 'Hanya teknisi yang ditugaskan atau pengelola tiket yang bisa mengerjakan tiket ini',
	'aftersales.ticketAssignee': 'Tiket hanya bisa ditugaskan ke anggota yang berhak mengerjakan tiket',
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
	'inventory.warehouseLinkConflict':
		'Tautan tidak dapat diputus selama organisasi masih memiliki {{count}} peminjaman aktif yang berasal dari gudang ini',
	'inventory.storageNotFound': 'Penyimpanan tidak ditemukan',
	'inventory.storageCodeTaken':
		'Penyimpanan dengan kode ini sudah ada di gudang ini',
	'inventory.warehouseInactive':
		'Gudang "{{warehouseCode}}" tidak aktif; penyimpanannya tidak dapat diubah',
	'inventory.warehousePicInvalid':
		'Karyawan penanggung jawab tidak dikenal, tidak aktif, atau bukan dari organisasi yang terhubung',
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
	'user.avatarUnsupportedType': 'Avatar harus berupa gambar PNG, JPG, WebP, atau HEIC',

	'organization.lastOrganization':
		'Ini organisasi terakhir Anda dan tidak dapat dihapus',
	'organization.notFound': 'Organisasi tidak ditemukan',
	'company.profileRequired':
		'Lengkapi profil perusahaan (beserta kode dokumen) terlebih dahulu',
	'company.settingInvalid': 'Nilai tidak sesuai dengan tipenya',
	'numbering.unknownCodeType': 'Jenis kode tidak dikenal',
	'document.notFound': 'Dokumen tidak ditemukan',
	'document.notVoidable': 'Dokumen ini tidak dapat dibatalkan',
	'document.fileNotFound': 'File tidak ditemukan',
	'document.shareNotFound': 'Tautan ini tidak valid atau sudah kedaluwarsa',
	'document.fileNotAllowed': 'Dokumen yang dibatalkan tidak dapat menerima file',
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

	'aftersales.ticketState.comment': 'Tiket yang sudah ditutup tidak menerima pesan baru',
	'portal.stage.preparation': 'Persiapan',
	'portal.stage.delivery': 'Pengiriman',
	'portal.stage.installation': 'Instalasi',
	'portal.stage.testing': 'Uji fungsi',
	'portal.stage.training': 'Pelatihan',
	'portal.stage.handover': 'Serah terima (BAST)',
	'portal.stage.warranty': 'Garansi',
	'portal.label.allDone': 'Semua pekerjaan selesai',
	'portal.label.completed': 'Selesai {{date}}',
	'portal.label.target': 'Target {{date}}',
	'portal.label.noTarget': 'Belum ada tanggal target',
	'portal.label.bast': 'Berita acara serah terima (BAST) {{code}}',
	'portal.label.projectManager': 'Manajer proyek',
	'portal.label.you': 'Anda',
	'portal.label.support': 'Tim layanan',
	'portal.label.resolvedOn': 'Diselesaikan {{date}}',
	'portal.label.warrantyPlan': 'Garansi {{months}} bulan',
	'portal.label.warrantyCertificate': 'Surat garansi {{code}}',
	'portal.evidence.testing': 'Uji fungsi',
	'portal.evidence.training': 'Pelatihan',
	'portal.evidence.bast': 'BAST bertanda tangan',
	'portal.evidence.photo': 'Foto',
	'portal.ticket.created': 'Tiket dibuat',
	'portal.ticket.resolved': 'Diselesaikan',
	'portal.ticket.closed': 'Ditutup',
	'portal.businessByInvitation': 'Akun bisnis dibuat melalui undangan. Silakan hubungi kami.',
	'portal.invalidCode': 'Kode salah atau sudah kedaluwarsa',
	'portal.ownerOnly': 'Hanya pemilik akun yang bisa mengelola anggota',
	'portal.removeSelf': 'Anda tidak bisa mencabut akses Anda sendiri',
	'portal.contactUnavailable': 'Kontak tidak ada atau milik pelanggan lain',
	'portal.role.owner': 'Pemilik',
	'portal.role.approver': 'Penyetuju',
	'portal.role.finance': 'Keuangan',
	'portal.role.viewer': 'Pemantau',
	'portal.customerUnavailable': 'Pelanggan tidak ada atau tidak aktif',
	'portal.accountExists': 'Pelanggan ini sudah punya akun portal',
	'portal.emailTaken': 'Email ini sudah dipakai akun lain',
	'portal.accountNotFound': 'Akun portal tidak ditemukan',
	'portal.notConfigured': 'Alamat portal pelanggan (PORTAL_URL) belum diatur',
	'portal.invalidCredentials': 'Email atau kata sandi salah',
	'portal.locked': 'Terlalu banyak percobaan masuk yang gagal. Coba lagi nanti.',
	'portal.unauthenticated': 'Silakan masuk ke portal pelanggan',
	'portal.invalidToken': 'Tautan ini tidak valid atau sudah kedaluwarsa',
	'portal.wrongPassword': 'Kata sandi saat ini salah',
	'portal.projectNotFound': 'Proyek tidak ditemukan',
	'portal.productNotFound': 'Perangkat tidak ditemukan',
	'portal.attachmentsUnsupported': 'Lampiran belum didukung; jelaskan masalahnya di pesan',
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
	'invitation.unknownOrganizationSlug': 'Tidak ada organisasi dengan slug "{{slug}}"',
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
	'licensing.notFound.application': 'Aplikasi tidak ditemukan',
	'licensing.notFound.contract': 'Kontrak lisensi tidak ditemukan',
	'licensing.notFound.key': 'Kunci lisensi tidak ditemukan',
	'licensing.applicationCodeTaken': 'Kode ini sudah dipakai aplikasi lain',
	'licensing.contract.customer': 'Pelanggan tidak ada atau tidak aktif',
	'licensing.contract.application': 'Aplikasi tidak ada atau sudah dipensiunkan',
	'licensing.contract.order': 'Sales order tidak ada atau milik pelanggan lain',
	'licensing.contract.dates': 'Tanggal berakhir sebelum tanggal mulai',
	'licensing.contract.startRequired': 'Isi tanggal mulai sebelum mengaktifkan',
	'licensing.state.edit': 'Hanya kontrak draf yang bisa diubah',
	'licensing.state.activate': 'Hanya kontrak draf yang bisa diaktifkan',
	'licensing.state.suspend': 'Hanya kontrak aktif yang bisa ditangguhkan',
	'licensing.state.reactivate': 'Hanya kontrak yang ditangguhkan yang bisa diaktifkan kembali',
	'licensing.state.terminate': 'Kontrak ini sudah dihentikan atau diperpanjang',
	'licensing.state.renew': 'Hanya kontrak aktif yang bisa diperpanjang, satu kali',
	'licensing.state.keys': 'Kunci hanya bisa ditambahkan ke kontrak draf, aktif, atau ditangguhkan',
	'licensing.key.required': 'Ketik kunci dari vendor (aplikasi pihak ketiga)',
	'licensing.key.taken': 'Kunci lisensi ini sudah terdaftar',
	'licensing.api.missing': 'Kunci API lisensi wajib dikirim',
	'licensing.api.invalid': 'Kunci API lisensi tidak valid',
	'licensing.api.rateLimited': 'Terlalu banyak panggilan API lisensi; coba lagi semenit lagi',
	'licensing.refused.unknown': 'Kunci lisensi tidak dikenal',
	'licensing.refused.expired': 'Lisensi sudah kedaluwarsa',
	'licensing.refused.not_started': 'Lisensi belum aktif',
	'licensing.refused.suspended': 'Lisensi sedang ditangguhkan',
	'licensing.refused.terminated': 'Lisensi sudah dihentikan',
	'licensing.refused.revoked': 'Kunci lisensi sudah dicabut',
	'licensing.refused.seat_limit': 'Semua aktivasi kunci ini sudah terpakai',
	'licensing.refused.not_activated': 'Instalasi ini belum diaktivasi',
	'licensing.apiKey.ownOnly': 'Kunci API hanya untuk aplikasi milik perusahaan yang aktif',
	'licensing.apiKey.noOwner': 'Organisasi tidak punya owner untuk menerbitkan kunci',
	'licensing.apiKey.notFound': 'Kunci API tidak ditemukan',
	'licensing.activationNotFound': 'Aktivasi tidak ditemukan atau sudah dilepas',

	// HR (ERP-0034)
	'hr.employeeNotFound': 'Karyawan tidak ditemukan',
	'hr.companyEmployeeForbidden': 'Karyawan company-level hanya dikelola oleh admin aplikasi',
	'hr.employeeEmailTaken': 'Email atau kode login sudah dipakai karyawan lain',
	'hr.employeeInvite': 'Invitasi karyawan gagal',

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
	'sales.receiptNotFound': 'Kwitansi tidak ditemukan',
	'sales.receiptExceeds':
		'Pembayaran melebihi sisa tagihan',
	'sales.receiptReversed': 'Kwitansi sudah dibatalkan',
	'sales.invoiceNotPayable':
		'Hanya faktur berstatus terbit atau sebagian dibayar yang dapat menerima pembayaran',

	'notification.notFound': 'Notifikasi tidak ditemukan',
};

export default api;
