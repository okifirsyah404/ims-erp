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
	'kind.tool': 'Peralatan',
	'kind.service': 'Jasa',

	'products.title': 'Produk',
	'components.title': 'Komponen',
	'materials.title': 'Bahan',
	'tools.title': 'Peralatan',

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
	'form.serviceHint': 'Jasa tidak pernah bernomor seri dan tidak disimpan sebagai stok.',
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
	'warehouses.code': 'Kode',
	'warehouses.name': 'Nama',
	'warehouses.scope': 'Cakupan',
	'warehouses.global': 'Global',
	'warehouses.organization': 'Organisasi',
	'warehouses.status': 'Status data',
	'warehouses.default': 'Utama',
	'warehouses.inactive': 'Tidak aktif',
	'warehouses.notFound': 'Gudang tidak ditemukan.',
	'warehouses.noAddress': 'Belum ada alamat.',
	'warehouses.storages': 'Penyimpanan',
	'warehouses.noStorages': 'Belum ada penyimpanan.',
	'warehouses.binType': 'Jenis',

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
} as const;

export default inventory;
