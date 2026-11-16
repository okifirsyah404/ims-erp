// n8n Code node "3. Compose messages".
//
// Turns one ERP event into the messages to send. Edit CONFIG below: who
// receives what is decided here, not in the ERP (the ERP stores no
// templates, ADR-0020). Event fields: docs/architecture/modules/automation.md,
// "The event contract". Amounts arrive as integer IDR minor units (cents).

// ============================== CONFIG ==================================
const CONFIG = {
	companyName: 'Entragate',
	// Internal WhatsApp numbers per role: '0812…', '62812…' or '+62 812…'.
	// An empty list means nobody in that role is told.
	team: {
		owner: [],
		salesManager: [],
		sales: [],
		operationsManager: [],
		purchasing: [],
		warehouse: [],
		finance: [],
		support: [],
		adminOnDuty: [],
	},
	// Optional internal email per role, used only when the "Send email" node
	// is enabled (it is disabled after import).
	teamEmail: {
		finance: [],
		purchasing: [],
	},
	// Messages to customers and supplier contacts. Keep false until the owner
	// approved the texts below (ADR-0020); internal messages always go out.
	notifyCustomers: false,
	notifySuppliers: false,
	// ERP web address used in links, without a trailing slash; '' = no links.
	erpUrl: '',
};
// ========================================================================

const item = $input.first().json;
if (item.httpStatus) return [{ json: item }];

const rupiah = (minor) =>
	'Rp ' + (Math.round(Number(minor || 0)) / 100).toLocaleString('id-ID', { maximumFractionDigits: 2 });
const date = (value) => {
	if (!value) return '-';
	const parsed = new Date(String(value).length === 10 ? value + 'T12:00:00+07:00' : value);
	return Number.isNaN(parsed.getTime())
		? String(value)
		: parsed.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' });
};
const link = (path) => (CONFIG.erpUrl ? '\n' + CONFIG.erpUrl + path : '');
const lines = (list) =>
	(list || [])
		.map((line) => '- ' + line.name + ' ' + Number(line.quantity) + ' ' + line.unit + (line.serialNumbers && line.serialNumbers.length ? ' (SN ' + line.serialNumbers.join(', ') + ')' : ''))
		.join('\n');

/** Indonesian numbers to a WAHA chat id: 0812… / +62 812… -> 62812…@c.us. */
function chatId(phone) {
	let digits = String(phone || '').replace(/\D/g, '');
	if (!digits) return null;
	if (digits.startsWith('0')) digits = '62' + digits.slice(1);
	if (digits.startsWith('8')) digits = '62' + digits;
	return digits.length >= 10 ? digits + '@c.us' : null;
}

const out = [];
const toRole = (role, text) => {
	for (const phone of CONFIG.team[role] || []) {
		const to = chatId(phone);
		if (to) out.push({ channel: 'whatsapp', audience: role, to, text });
	}
};
const emailRole = (role, subject, text) => {
	for (const address of CONFIG.teamEmail[role] || []) {
		if (address) out.push({ channel: 'email', audience: role, to: address, subject, text });
	}
};
const toCustomer = (customer, text) => {
	if (!CONFIG.notifyCustomers || !customer) return;
	const to = chatId(customer.whatsapp || customer.phone);
	if (to) out.push({ channel: 'whatsapp', audience: 'customer', to, text });
};
const toSupplier = (supplier, text) => {
	if (!CONFIG.notifySuppliers || !supplier) return;
	const to = chatId(supplier.picPhone || supplier.phone);
	if (to) out.push({ channel: 'whatsapp', audience: 'supplier', to, text });
};

const d = item.data || {};
const handlers = {
	'lead.created': () => {
		toRole(
			'salesManager',
			'Lead baru ' + (d.reference || '') + '\n' +
				(d.name || '-') + (d.companyName ? ' (' + d.companyName + ')' : '') + '\n' +
				'Kontak: ' + (d.whatsapp || d.phone || d.email || '-') + '\n' +
				'Sumber: ' + (d.source || '-') + ' / ' + (d.channel || '-') + '\n' +
				'Kebutuhan: ' + (d.needs || '-') + link('/crm/leads/' + d.leadId),
		);
	},
	'invoice.issued': () => {
		const customer = d.customer || {};
		toCustomer(
			customer,
			'Yth. ' + (customer.name || 'Pelanggan') + ',\n' +
				'Invoice ' + d.code + ' dari ' + CONFIG.companyName + ' sebesar ' + rupiah(d.grandTotal) +
				' jatuh tempo ' + date(d.dueDate) + '. Terima kasih.',
		);
		toRole('finance', 'Invoice ' + d.code + ' terbit untuk ' + (customer.name || '-') + ': ' + rupiah(d.grandTotal) + ', jatuh tempo ' + date(d.dueDate) + '.');
	},
	'receipt.recorded': () => {
		const customer = d.customer || {};
		const invoice = d.invoice || {};
		toCustomer(
			customer,
			'Terima kasih, pembayaran ' + rupiah(d.amount) + ' untuk invoice ' + (invoice.code || '-') + ' sudah kami terima.' +
				(Number(invoice.outstandingTotal) > 0 ? ' Sisa tagihan: ' + rupiah(invoice.outstandingTotal) + '.' : ' Invoice sudah lunas.'),
		);
	},
	'service_ticket.updated': () => {
		const customer = d.customer || {};
		const texts = {
			created: 'Tiket servis ' + d.code + ' sudah kami terima: ' + (d.complaint || '') + '. Teknisi kami akan menghubungi Anda.',
			assigned: 'Tiket ' + d.code + ' ditangani oleh ' + ((d.assignee && d.assignee.name) || 'teknisi kami') + '.',
			started: 'Teknisi mulai menangani tiket ' + d.code + '.',
			resolved: 'Tiket ' + d.code + ' selesai: ' + (d.resolution || '-') + '.',
			reopened: 'Tiket ' + d.code + ' dibuka kembali.',
			closed: 'Tiket ' + d.code + ' ditutup. Terima kasih.',
		};
		if (texts[d.change]) toCustomer({ ...customer, whatsapp: customer.whatsapp || d.reporterContact }, texts[d.change]);
		if (d.change === 'created') toRole('support', 'Tiket baru ' + d.code + ' dari ' + (customer.name || d.reporterName || '-') + ': ' + (d.complaint || '-') + link('/projects/tickets/' + d.ticketId));
	},
	'whatsapp.handoff': () => {
		toRole(
			'adminOnDuty',
			'Chat WhatsApp perlu admin (' + d.reason + ')\n' + (d.contactName || '') + ' ' + (d.phone || '') + '\n"' + (d.question || '') + '"' + link('/integrations/whatsapp-ai/' + d.conversationId),
		);
	},
	'license.due': () => {
		const customer = d.customer || {};
		const app = (d.application && d.application.name) || 'aplikasi';
		const text =
			d.stage === 'ended'
				? 'Lisensi ' + app + ' (' + d.code + ') sudah berakhir ' + date(d.endDate) + '. Masa tenggang sampai ' + date(d.graceEndsOn) + '.'
				: 'Lisensi ' + app + ' (' + d.code + ') berakhir ' + date(d.endDate) + ' (' + d.daysLeft + ' hari lagi).';
		toCustomer(customer, 'Yth. ' + (customer.name || 'Pelanggan') + ', ' + text + ' Hubungi kami untuk perpanjangan.');
		toRole('salesManager', text + ' Pelanggan: ' + (customer.name || '-') + '.');
	},
	'purchase_return.updated': () => {
		const supplier = d.supplier || {};
		const head = 'Retur pembelian ' + (d.code || '(belum bernomor)') + ' ke ' + (supplier.name || '-');
		const detail = '\nBPB ' + (d.goodsReceiptCode || '-') + ' / PO ' + (d.purchaseOrderCode || '-') + '\nAlasan: ' + (d.reason || '-') + '\n' + lines(d.lines);
		const url = link('/procurement/purchase-returns/' + d.returnId);
		if (d.change === 'submitted') toRole('operationsManager', head + ' menunggu persetujuan Anda.' + detail + url);
		if (d.change === 'approved') {
			toRole('warehouse', head + ' disetujui. Siapkan barang untuk dikirim ke pemasok.' + detail + url);
			toRole('purchasing', head + ' disetujui. Hubungi pemasok untuk penggantian.' + url);
		}
		if (d.change === 'rejected') toRole('purchasing', head + ' ditolak: ' + (d.rejectionReason || '-') + url);
		if (d.change === 'shipped') {
			toRole('purchasing', head + ' sudah dikirim. PO dibuka lagi untuk barang pengganti.' + url);
			toSupplier(
				supplier,
				'Yth. ' + (supplier.picName || supplier.name || 'Bapak/Ibu') + ', ' + CONFIG.companyName + ' mengirim kembali barang berikut untuk diganti (' + (d.code || '') + ', PO ' + (d.purchaseOrderCode || '-') + '):\n' + lines(d.lines) + '\nAlasan: ' + (d.reason || '-'),
			);
		}
		if (d.change === 'cancelled') {
			toRole('purchasing', head + ' dibatalkan: ' + (d.cancelledReason || '-'));
			toRole('warehouse', head + ' dibatalkan, barang tidak jadi dikirim.');
		}
	},
	'sales_return.updated': () => {
		const customer = d.customer || {};
		const head = 'Retur penjualan ' + (d.code || '(belum bernomor)') + ' dari ' + (customer.name || '-');
		const detail = '\nSurat jalan ' + (d.deliveryNoteCode || '-') + ' / SO ' + (d.salesOrderCode || '-') + '\nAlasan: ' + (d.reason || '-') + '\n' + lines(d.lines);
		const url = link('/sales/returns/' + d.returnId);
		if (d.change === 'submitted') toRole('salesManager', head + ' menunggu persetujuan Anda.' + detail + url);
		if (d.change === 'approved') {
			toRole('warehouse', head + ' disetujui. Barang akan datang, siapkan pemeriksaan kondisi.' + detail + url);
			toCustomer(customer, 'Yth. ' + (customer.name || 'Pelanggan') + ', pengajuan retur ' + (d.code || '') + ' disetujui. Tim kami akan mengatur pengambilan/pengiriman barang.');
		}
		if (d.change === 'rejected') toRole('sales', head + ' ditolak: ' + (d.rejectionReason || '-') + url);
		if (d.change === 'received') {
			const damaged = (d.lines || []).filter((line) => line.condition === 'damaged').length;
			toRole('sales', head + ' sudah diterima gudang' + (damaged ? ' (' + damaged + ' baris rusak)' : '') + '. Siapkan surat jalan pengganti.' + url);
			toCustomer(customer, 'Yth. ' + (customer.name || 'Pelanggan') + ', barang retur ' + (d.code || '') + ' sudah kami terima. Barang pengganti akan segera kami kirim.');
		}
		if (d.change === 'cancelled') toRole('sales', head + ' dibatalkan: ' + (d.cancelledReason || '-'));
	},
	'supplier_bill.recorded': () => {
		const supplier = d.supplier || {};
		const text = 'Tagihan pemasok ' + d.code + ' (' + (d.supplierInvoiceNumber || '-') + ') dari ' + (supplier.name || '-') + ' dicatat: ' + rupiah(d.grandTotal) + ', jatuh tempo ' + date(d.dueDate) + '.';
		toRole('finance', text + link('/finance/payables'));
		emailRole('finance', 'Tagihan pemasok ' + d.code, text);
	},
	'supplier_bill.due': () => {
		const supplier = d.supplier || {};
		const when = d.stage === 'upcoming' ? 'jatuh tempo ' + date(d.dueDate) + ' (' + d.daysLeft + ' hari lagi)' : d.stage === 'due' ? 'jatuh tempo HARI INI' : 'LEWAT jatuh tempo sejak ' + date(d.dueDate);
		const text = 'Tagihan pemasok ' + d.code + ' (' + (d.supplierInvoiceNumber || '-') + ') ke ' + (supplier.name || '-') + ' ' + when + '. Sisa: ' + rupiah(d.outstandingTotal) + '.';
		toRole('finance', text + link('/finance/payables'));
		emailRole('finance', 'Pengingat tagihan ' + d.code, text);
		if (d.stage === 'overdue') toRole('owner', text);
	},
};

if (handlers[item.topic]) handlers[item.topic]();
return [{ json: { ...item, messages: out } }];
