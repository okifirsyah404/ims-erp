/**
 * Indonesian inventory copy — mirrors the `en` key set exactly.
 *
 * @remarks
 * `in_stock` is labelled "Siap", which is the wording the domain uses for
 * "ready to hand out". The stored value stays `in_stock` (ADR-0008).
 */
const inventory = {
	'adminOnly':
		'Pengelolaan inventaris hanya tersedia untuk administrator aplikasi.',

	'items.description':
		'Master barang — katalog SKU untuk organisasi ini.',
	'items.empty': 'Belum ada barang untuk organisasi ini.',
	'items.emptyTitle': 'Belum ada apa pun di sini',
	'items.sku': 'Kode SKU',
	'items.name': 'Nama',
	'items.kind': 'Jenis',
	'items.tracking': 'Pelacakan',
	'items.serialized': 'Bernomor seri',
	'items.quantityTracked': 'Kuantitas',
	'items.category': 'Kategori',
	'items.unitLabel': 'Satuan',
	'items.minStockQty': 'Stok minimum',
	'items.sellingPrice': 'Harga jual',
	'items.purchasePrice': 'Harga beli',
	'items.description_label': 'Deskripsi',
	'items.barcode': 'Kode batang',

	'kind.product': 'Produk',
	'kind.component': 'Komponen',
	'kind.material': 'Bahan',

	'products.title': 'Produk',
	'components.title': 'Komponen',
	'materials.title': 'Bahan',

	'form.newItem': 'Barang baru',
	'form.newItemDescription':
		'SKU dan jenis ditetapkan saat pembuatan — keduanya menentukan keunikan dan aturan status.',
	'form.editItem': 'Ubah barang',
	'form.editItemDescription':
		'SKU dan jenis tidak dapat diubah setelah dibuat.',
	'form.create': 'Buat barang',
	'form.creating': 'Membuat…',
	'form.save': 'Simpan perubahan',
	'form.saving': 'Menyimpan…',
	'form.serializedHint':
		'Barang bernomor seri dilacak per unit; kuantitas tidak dihitung.',
	'form.created': 'Barang dibuat',
	'form.updated': 'Barang diperbarui',
	'form.archived': 'Barang diarsipkan',

	'detail.notFound': 'Barang ini tidak ada atau sudah diarsipkan.',
	'detail.archive': 'Arsipkan',
	'detail.archiveConfirm': 'Arsipkan barang ini?',
	'detail.archiveConfirmBody':
		'Mengarsipkan menyembunyikan barang dari daftar. Barang yang masih memiliki unit tidak dapat diarsipkan.',
	'detail.units': 'Unit',
	'detail.unitsEmpty': 'Belum ada unit terdaftar.',
	'detail.serialNumber': 'Nomor seri',
	'detail.assetTag': 'Tag aset',
	'detail.status': 'Keadaan',
	'detail.provisional': 'Sementara',

	'status.pre_order': 'Pra-pesan',
	'status.in_stock': 'Siap',
	'status.borrowed': 'Dipinjam',
	'status.lost': 'Hilang',
	'status.sold': 'Terjual',
	'status.applied_warranty': 'Dipakai garansi',

	'unit.new': 'Daftarkan unit',
	'unit.newDescription':
		'Unit adalah wujud fisik dari barang bernomor seri.',
	'unit.serialNumber': 'Nomor seri',
	'unit.serialNumberHint':
		'Kosongkan untuk pra-pesan: nomor seri sementara dibuat dan diganti sekali saat barang diterima.',
	'unit.register': 'Daftarkan unit',
	'unit.registering': 'Mendaftarkan…',
	'unit.registered': 'Unit terdaftar',

	'unit.replaceSerial': 'Tetapkan nomor seri asli',
	'unit.replaceSerialBody':
		'Nomor seri sementara hanya dapat diganti satu kali.',
	'unit.replaced': 'Nomor seri diganti',

	// Warehouse list.
	'warehouses.title': 'Gudang',
	'warehouses.description':
		'Data induk gudang - lokasi penyimpanan global dan per organisasi.',
	'warehouses.new': 'Gudang baru',
	'warehouses.empty': 'Belum ada gudang.',
	'warehouses.emptyTitle': 'Belum ada gudang',
	'warehouses.noAddressTitle': 'Belum ada alamat',
	'warehouses.code': 'Kode',
	'warehouses.name': 'Nama',
	'warehouses.global': 'Global',
	'warehouses.organization': 'Organisasi',
	'warehouses.default': 'Utama',
	'warehouses.inactive': 'Tidak aktif',
	'warehouses.notFound': 'Gudang tidak ditemukan.',
	'warehouses.noAddress': 'Belum ada alamat.',
	'warehouses.storages': 'Penyimpanan',
	'warehouses.noStorages': 'Belum ada penyimpanan.',
	'warehouses.noStoragesTitle': 'Belum ada penyimpanan',
	'warehouses.binType': 'Jenis',
	'warehouses.search': 'Cari',
	'warehouses.searchPlaceholder': 'Cari berdasarkan kode atau nama…',
	'warehouses.includeArchived': 'Sertakan yang diarsipkan',
	'warehouses.active': 'Aktif',
	'warehouses.products': 'Produk',
	'warehouses.materials': 'Bahan',
	'warehouses.equipments': 'Peralatan',
	'warehouses.storageTab': 'Penyimpanan',
	'warehouses.capacity': 'Kapasitas',
	'warehouses.state': 'Keadaan',
	'warehouses.quantity': 'Kuantitas',
	'warehouses.activate': 'Setel aktif',
	'warehouses.deactivate': 'Setel tidak aktif',
	'warehouses.activated': 'Gudang diaktifkan',
	'warehouses.deactivated': 'Gudang dinonaktifkan',
	'warehouses.archiveConfirmTitle': 'Arsipkan gudang ini?',
	'warehouses.archiveConfirmBody':
		'Mengarsipkan menyembunyikan gudang dari daftar. Gudang yang masih menyimpan unit tidak dapat diarsipkan.',
	'warehouses.archived': 'Gudang diarsipkan',
	'warehouses.addStorage': 'Tambah penyimpanan',
	'warehouses.editStorage': 'Ubah penyimpanan',
	'warehouses.storageCode': 'Kode',
	'warehouses.storageName': 'Nama',
	'warehouses.storageCodeHint':
		'Unik di dalam gudang ini, tetap setelah dibuat.',
	'warehouses.storageCreated': 'Penyimpanan dibuat',
	'warehouses.storageUpdated': 'Penyimpanan diperbarui',
	'warehouses.storageArchived': 'Penyimpanan diarsipkan',
	'warehouses.organizationsTab': 'Organisasi',
	'warehouses.linkedOrganizations': 'Organisasi tertaut',
	'warehouses.linkedOrganizationsHint':
		'Organisasi yang boleh menyimpan stok dan aset di gudang ini.',
	'warehouses.selectOrganization': 'Pilih organisasi',
	'warehouses.linkAction': 'Tautkan',
	'warehouses.unlinkAction': 'Putuskan',
	'warehouses.unlinkConfirm':
		'Putuskan akses organisasi ini ke gudang?',
	'warehouses.linkCreated': 'Organisasi ditautkan',
	'warehouses.linkAlreadyExists': 'Organisasi sudah tertaut',
	'warehouses.linkRemoved': 'Tautan organisasi diputus',
	'warehouses.noLinkedOrganizations': 'Belum ada organisasi yang tertaut.',
	'warehouses.linkedSince': 'Tertaut sejak',

	// Warehouse create / edit form.
	'warehouseForm.new': 'Gudang baru',
	'warehouseForm.newDescription':
		'Kode dan cakupan ditetapkan saat dibuat. Gudang tanpa organisasi bersifat global.',
	'warehouseForm.edit': 'Ubah gudang',
	'warehouseForm.editDescription':
		'Kode dan cakupan tidak dapat diubah setelah dibuat.',
	'warehouseForm.details': 'Detail',
	'warehouseForm.detailsDescription':
		'Hanya satu gudang yang dapat menjadi utama dalam satu cakupan.',
	'warehouseForm.code': 'Kode',
	'warehouseForm.name': 'Nama',
	'warehouseForm.isDefault': 'Gudang utama',
	'warehouseForm.isDefaultHint':
		'Menjadikan gudang ini utama akan menghapus status utama gudang lain pada cakupan yang sama.',
	'warehouseForm.isActive': 'Aktif',
	'warehouseForm.address': 'Alamat',
	'warehouseForm.addressDescription':
		'Tersusun per wilayah. Hanya desa/kelurahan yang disimpan pada alamat.',
	'warehouseForm.create': 'Buat gudang',
	'warehouseForm.saving': 'Menyimpan.',
	'warehouseForm.created': 'Gudang dibuat',
	'warehouseForm.updated': 'Gudang diperbarui',

	// Address fields and the location cascade.
	'address.label': 'Label',
	'address.street': 'Jalan',
	'address.rt': 'RT',
	'address.rw': 'RW',
	'address.postalCode': 'Kode pos',
	'address.province': 'Provinsi',
	'address.regency': 'Kabupaten / kota',
	'address.district': 'Kecamatan',
	'address.village': 'Desa / kelurahan',
	'address.searchProvince': 'Cari provinsi',
	'address.searchRegency': 'Cari kabupaten / kota',
	'address.searchDistrict': 'Cari kecamatan',
	'address.searchVillage': 'Cari desa / kelurahan',
	'address.noResults': 'Tidak ada hasil',

	// Stock balances.
	'stock.title': 'Saldo stok',
	'stock.description':
		'Jumlah yang tersedia per gudang. Gudang global menyimpan satu saldo bersama.',
	'stock.empty': 'Belum ada stok tercatat.',
	'stock.item': 'Barang',
	'stock.warehouse': 'Gudang',
	'stock.bin': 'Penyimpanan',
	'stock.onHand': 'Tersedia fisik',
	'stock.reserved': 'Direservasi',
	'stock.available': 'Bisa dipakai',
	'stock.lastMovement': 'Pergerakan terakhir',
	'stock.scope': 'Cakupan',
	'stock.shared': 'Bersama',
	'stock.inStockOnly': 'Hanya yang ada stok',
	'stock.noBin': 'Belum ditentukan',
	'stock.recompute': 'Hitung ulang dari buku besar',
	'stock.recomputeConfirm': 'Hitung ulang saldo dari buku besar?',
	'stock.recomputeConfirmBody':
		'Tindakan ini menghitung ulang saldo satu cakupan dari buku besar pergerakan. Ini alat perbaikan; saldo berjalan biasanya sudah benar.',
	'stock.recomputed':
		'Saldo dihitung ulang ({{written}} ditulis, {{removed}} dihapus)',
	'stock.movements': 'Pergerakan',
	'stock.adjust': 'Sesuaikan stok',

	// Movement ledger.
	'movements.title': 'Pergerakan stok',
	'movements.description':
		'Buku besar. Setiap pergerakan hanya bisa ditambah; koreksi berupa baris baru, bukan perubahan.',
	'movements.empty': 'Belum ada pergerakan tercatat.',
	'movements.code': 'Kode',
	'movements.type': 'Jenis',
	'movements.item': 'Barang',
	'movements.quantity': 'Jumlah',
	'movements.statusLabel': 'Keterangan status',
	'movements.occurredAt': 'Waktu',
	'movements.reference': 'Rujukan',
	'movements.notes': 'Catatan',
	'movements.reverse': 'Balik',
	'movements.reverseConfirm': 'Balik pergerakan ini?',
	'movements.reverseConfirmBody':
		'Pembalikan menambahkan pergerakan berlawanan. Hanya bisa dilakukan sekali dan tidak dapat dibatalkan; akan ditolak jika membuat stok menjadi negatif.',
	'movements.reversed': 'Pergerakan dibalik',
	'movements.type.receipt': 'Penerimaan',
	'movements.type.issue': 'Pengeluaran',
	'movements.type.transfer_in': 'Transfer masuk',
	'movements.type.transfer_out': 'Transfer keluar',
	'movements.type.adjustment_in': 'Penyesuaian masuk',
	'movements.type.adjustment_out': 'Penyesuaian keluar',
	'movements.type.return_in': 'Pengembalian masuk',
	'movements.type.return_out': 'Pengembalian keluar',
	'movements.type.consumption': 'Pemakaian',
	'movements.type.borrowing_out': 'Dipinjam keluar',
	'movements.type.borrowing_in': 'Kembali dari peminjaman',
	'movements.status.draft': 'Draf',
	'movements.status.posted': 'Tercatat',
	'movements.status.reversed': 'Dibalik',

	// Adjustments list.
	'adjustments.title': 'Penyesuaian stok',
	'adjustments.description':
		'Hasil hitung fisik baru menjadi pergerakan setelah disetujui dan dicatat.',
	'adjustments.new': 'Penyesuaian baru',
	'adjustments.empty': 'Belum ada penyesuaian.',
	'adjustments.code': 'Kode',
	'adjustments.type': 'Jenis',
	'adjustments.statusLabel': 'Keterangan status',
	'adjustments.requestedBy': 'Diajukan oleh',
	'adjustments.requestedAt': 'Diajukan',
	'adjustments.approvedBy': 'Disetujui oleh',
	'adjustments.postedAt': 'Dicatat',
	'adjustments.notes': 'Catatan',
	'adjustments.notFound': 'Penyesuaian tidak ditemukan.',
	'adjustments.lines': 'Baris',
	'adjustments.noLines': 'Penyesuaian ini tidak memiliki baris.',
	'adjustments.qtyBefore': 'Sistem',
	'adjustments.qtyAfter': 'Hasil hitung',
	'adjustments.delta': 'Selisih',
	'adjustments.type.increase': 'Penambahan',
	'adjustments.type.decrease': 'Pengurangan',
	'adjustments.type.recount': 'Hitung ulang fisik',
	'adjustments.status.draft': 'Draf',
	'adjustments.status.submitted': 'Diajukan',
	'adjustments.status.approved': 'Disetujui',
	'adjustments.status.rejected': 'Ditolak',
	'adjustments.status.posted': 'Tercatat',
	'adjustments.status.cancelled': 'Dibatalkan',

	// Adjustment workflow actions.
	'adjustmentActions.submit': 'Ajukan persetujuan',
	'adjustmentActions.approve': 'Setujui',
	'adjustmentActions.reject': 'Tolak',
	'adjustmentActions.cancel': 'Batalkan',
	'adjustmentActions.post': 'Catat ke stok',
	'adjustmentActions.submitted': 'Penyesuaian diajukan',
	'adjustmentActions.approved': 'Penyesuaian disetujui',
	'adjustmentActions.rejected': 'Penyesuaian ditolak',
	'adjustmentActions.cancelled': 'Penyesuaian dibatalkan',
	'adjustmentActions.posted': 'Penyesuaian dicatat ke stok',
	'adjustmentActions.selfApprovalBlocked':
		'Anda yang mengajukan penyesuaian ini, jadi orang lain harus menyetujuinya.',

	// Adjustment form.
	'adjustmentForm.new': 'Penyesuaian baru',
	'adjustmentForm.newDescription':
		'Masukkan jumlah hasil hitung fisik per baris. Selisih terhadap jumlah sistem menjadi pergerakannya.',
	'adjustmentForm.warehouse': 'Gudang',
	'adjustmentForm.type': 'Alasan',
	'adjustmentForm.reasonCode': 'Kode alasan',
	'adjustmentForm.notes': 'Catatan',
	'adjustmentForm.lines': 'Baris',
	'adjustmentForm.linesDescription':
		'Jumlah hasil hitung, bukan selisih. Baris yang sama dengan sistem tidak menghasilkan pergerakan.',
	'adjustmentForm.item': 'Barang',
	'adjustmentForm.bin': 'Penyimpanan',
	'adjustmentForm.systemQuantity': 'Sistem',
	'adjustmentForm.countedQuantity': 'Hasil hitung',
	'adjustmentForm.difference': 'Selisih',
	'adjustmentForm.lineNote': 'Catatan',
	'adjustmentForm.addLine': 'Tambah baris',
	'adjustmentForm.removeLine': 'Hapus',
	'adjustmentForm.create': 'Buat penyesuaian',
	'adjustmentForm.creating': 'Membuat.',
	'adjustmentForm.created': 'Penyesuaian dibuat',
	'adjustmentForm.emptyLines': 'Tambahkan minimal satu baris.',

	} as const;

export default inventory;
