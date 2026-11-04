/**
 * Indonesian dashboard copy — mirrors `en/dashboard` key-for-key; the parity
 * test fails if the two drift.
 */
import type en from '../en/dashboard';

const dashboard: Record<keyof typeof en, string> = {
	'banner.sampleData':
		'Data contoh — semua angka di bawah adalah placeholder, bukan data ERP sungguhan.',

	'widget.sales.title': 'Penjualan',
	'widget.sales.invoicedThisMonth': 'Difakturkan bulan ini',
	'widget.sales.invoicedLastMonth': 'Bulan sebelumnya',
	'widget.sales.openQuotes': 'SPH terbuka',

	'widget.cash.title': 'Kas & Bank',
	'widget.cash.perAccount': 'Saldo per akun',
	'widget.cash.total': 'Total',

	'widget.profit.title': 'Laba',
	'widget.profit.monthToDate': 'Sejak awal bulan',
	'widget.profit.provisional': 'Provisional — periode belum ditutup',

	'widget.inventory.title': 'Inventaris',
	'widget.inventory.itemCount': 'Barang',
	'widget.inventory.stockValue': 'Nilai stok (ringkasan keuangan terakhir)',

	'widget.projects.title': 'Proyek',
	'widget.projects.byStatus': 'Proyek aktif per status',
	'widget.projects.overdue': 'Lewat tanggal target',
	'projects.status.planning': 'Perencanaan',
	'projects.status.inProgress': 'Berjalan',
	'projects.status.done': 'Selesai',

	'widget.subscriptions.title': 'Langganan',
	'widget.subscriptions.endingSoon': 'Berakhir dalam 30 hari',
	'widget.subscriptions.expired': 'Sudah berakhir',

	'chart.title': 'Penjualan difakturkan — 6 bulan terakhir',
	'chart.monthly': 'Difakturkan',

	'activity.title': 'Aktivitas terbaru',
	'activity.quoted': 'SPH {{code}} dibuat',
	'activity.invoicePaid': 'Faktur {{code}} dibayar',
	'activity.stockAdjusted': 'Stok disesuaikan untuk {{code}}',
	'activity.projectHandover': 'Proyek {{code}} diserahterimakan (BAST)',

	'quickLinks.title': 'Tautan cepat',

	'action.viewAll': 'Lihat semua',
} as const;

export default dashboard;
