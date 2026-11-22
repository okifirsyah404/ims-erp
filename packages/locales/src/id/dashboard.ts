/**
 * Indonesian dashboard copy — mirrors `en/dashboard` key-for-key; the parity
 * test fails if the two drift.
 */
import type en from '../en/dashboard';

const dashboard: Record<keyof typeof en, string> = {
	'title': 'Dasbor',


	'section.finance.title': 'Ringkasan keuangan',
	'section.finance.description': 'Basis kas: mutasi kas dan bank yang sudah diposting, tanpa saldo awal.',
	'section.operations.title': 'Operasional',
	'section.operations.description': 'Penjualan, stok, proyek, dan langganan.',
	'section.activity.title': 'Aktivitas',

	'kpi.income': 'Pemasukan',
	'kpi.outcome': 'Pengeluaran',
	'kpi.net': 'Arus kas bersih',
	'kpi.period': 'Bulan berjalan: {{from}} s.d. {{to}}',
	'kpi.delta': '{{percent}}% dibanding hari yang sama bulan lalu',
	'kpi.noBase': 'Belum ada angka untuk hari yang sama bulan lalu',
	'kpi.previous': 'Bulan lalu: {{amount}}',

	'cashFlowChart.title': 'Pemasukan vs pengeluaran',
	'cashFlowChart.rangeLabel': '{{from}} s.d. {{to}} · bersih {{net}}',

	'empty.noWidgets.title': 'Tidak ada yang bisa ditampilkan untuk peran Anda',
	'empty.noWidgets.description': 'Peran Anda di organisasi ini tidak mencakup angka dasbor apa pun. Gunakan menu untuk membuka halaman yang bisa Anda akses.',

	'gate.title': 'Tidak ada akses dasbor',
	'gate.noRole': 'Dasbor membutuhkan peran internal di sebuah organisasi. Minta pemilik atau admin organisasi untuk mengundang Anda.',
	'gate.appAdmin': 'Anda admin platform tetapi belum menjadi anggota organisasi mana pun. Buat organisasi (Anda otomatis menjadi pemiliknya) atau minta ditambahkan ke salah satunya.',

	'action.retry': 'Coba lagi',
	'action.viewAll': 'Lihat semua',

	'error.unavailable': 'Angka ini belum bisa ditampilkan.',
	'empty.noAccounts': 'Belum ada akun kas atau bank.',
	'empty.noOrganization': 'Pilih organisasi di pemilih organisasi (sidebar) untuk melihat angkanya.',

	'widget.sales.title': 'Penjualan',
	'widget.sales.invoicedThisMonth': 'Difakturkan bulan ini',
	'widget.sales.invoicedLastMonth': 'Bulan sebelumnya',
	'widget.sales.invoiceCount': 'Faktur bulan ini',
	'widget.sales.delta': '{{percent}}% dibanding bulan lalu',

	'widget.cash.title': 'Kas & Bank',
	'widget.cash.perAccount': 'Saldo per akun',
	'widget.cash.total': 'Total',

	'widget.profit.title': 'Laba',
	'widget.profit.monthToDate': 'Sejak awal bulan',
	'widget.profit.revenue': 'Pendapatan',
	'widget.profit.expenses': 'Beban',
	'widget.profit.provisional': 'Provisional — periode belum ditutup',

	'widget.inventory.title': 'Inventaris',
	'widget.inventory.itemCount': 'Barang',
	'widget.inventory.stockValue': 'Nilai stok',

	'widget.projects.title': 'Proyek',
	'widget.projects.byStatus': 'Proyek aktif per tahap',
	'widget.projects.active': 'Aktif',
	'widget.projects.closed': 'Selesai',
	'widget.projects.overdue': 'Lewat tanggal target',
	'widget.projects.attention': 'Terlambat',

	'widget.subscriptions.title': 'Langganan',
	'widget.subscriptions.endingSoon': 'Berakhir dalam 30 hari',
	'widget.subscriptions.expired': 'Sudah berakhir',

	'chart.title': 'Penjualan difakturkan',
	'chart.invoiced': 'Difakturkan',
	'chart.rangeLabel': '{{from}} sampai {{to}} · total {{total}}',
	'chart.customPlaceholder': 'Pilih rentang tanggal',
	'chart.range.14d': '14 hari',
	'chart.range.1m': '1 bulan',
	'chart.range.3m': '3 bulan',
	'chart.range.6m': '6 bulan',
	'chart.range.1y': '1 tahun',
	'chart.range.5y': '5 tahun',
	'chart.range.custom': 'Kustom',

	'activity.title': 'Aktivitas terbaru',
	'activity.invoiceIssued': 'Faktur {{code}} diterbitkan',
	'activity.receiptRecorded': 'Kuitansi {{code}} dicatat',
	'activity.empty': 'Belum ada faktur atau kuitansi.',

	'quickLinks.title': 'Tautan cepat',
} as const;

export default dashboard;
