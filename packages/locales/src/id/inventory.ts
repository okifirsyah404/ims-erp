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

	// Warehouse list.

	// Warehouse create / edit form.

	// Address fields and the location cascade.

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
	'movements.type.borrow_out': 'Dipinjam keluar',
	'movements.type.borrow_return': 'Kembali dari peminjaman',
	'movements.type.project_site': 'Dikirim ke lokasi proyek',
	'movements.type.disposal': 'Pelepasan',
	'movements.type.lost': 'Hilang',
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
	'adjustmentForm.details': 'Detail penyesuaian',
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
	'adjustmentForm.creating': 'Membuat…',
	'adjustmentForm.emptyLines': 'Tambahkan minimal satu baris.',

	'adjustmentForm.unitCost': 'Harga pokok per unit (Rp)',
	'adjustmentForm.unitCostPlaceholder': 'Kosong = harga rata-rata',
	'adjustmentForm.reasonOpeningStock': 'Stok awal',
	'value.title': 'Nilai persediaan',
	'value.description': 'Stok yang ada dinilai dengan HPP rata-rata bergerak, per barang dan gudang. Penerimaan masuk dengan harga pokoknya; pengiriman dan pengurangan keluar dengan harga rata-rata.',
	'value.total': 'Total nilai persediaan',
	'value.allWarehouses': 'Semua gudang',
	'value.balances': '{{count}} saldo',
	'value.search': 'Cari SKU atau nama barang…',
	'value.empty': 'Tidak ada stok.',
	'value.item': 'Barang',
	'value.warehouse': 'Gudang',
	'value.quantity': 'Stok',
	'value.averageCost': 'HPP rata-rata',
	'value.totalValue': 'Nilai',
	'value.link': 'Nilai persediaan',
} as const;

export default inventory;
