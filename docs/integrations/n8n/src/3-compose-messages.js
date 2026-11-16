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

/**
 * Indonesian numbers to a WAHA chat id: 0812… / +62 812… -> 62812…@c.us.
 * The Meta sender strips the `@c.us` part.
 */
function chatId(phone) {
	let digits = String(phone || '').replace(/\D/g, '');
	if (!digits) return null;
	if (digits.startsWith('0')) digits = '62' + digits.slice(1);
	if (digits.startsWith('8')) digits = '62' + digits;
	return digits.length >= 10 ? digits + '@c.us' : null;
}

// Every message carries both forms: `text` (WAHA sends it as is) and
// `template` + `params` (the Meta Cloud API needs an approved template for a
// message the business starts; see meta-templates.json). Meta template
// variables may not contain new lines, so params are flattened.
const flat = (value) => String(value == null || value === '' ? '-' : value).replace(/\s*\n\s*/g, ' / ').replace(/ {4,}/g, ' ');
const meta = (template, params) => ({ template, params: params.map(flat) });

const out = [];
// `file` (optional, ERP-0067): a document sent with the message. WAHA sends
// it with the text as caption; Meta puts it in the template's DOCUMENT header.
const push = (audience, to, text, spec, file) => {
	if (to) out.push({ channel: 'whatsapp', audience, to, text, template: spec ? spec.template : null, params: spec ? spec.params : [], file: file || null });
};
const toRole = (role, text, spec) => {
	for (const phone of CONFIG.team[role] || []) push(role, chatId(phone), text, spec);
};
/**
 * A message to one person (the owner of a lead or quotation, ERP-0066) by
 * their own phone from the ERP user profile. Without an owner or a phone it
 * goes to `fallbackRole` instead, so a reminder is never lost.
 */
const toPerson = (person, fallbackRole, text, spec) => {
	const to = person && chatId(person.phone);
	if (to) push('owner', to, text, spec);
	else toRole(fallbackRole, text, spec);
};
const emailRole = (role, subject, text) => {
	for (const address of CONFIG.teamEmail[role] || []) {
		if (address) out.push({ channel: 'email', audience: role, to: address, subject, text });
	}
};
const toCustomer = (customer, text, spec, file) => {
	if (!CONFIG.notifyCustomers || !customer) return;
	push('customer', chatId(customer.whatsapp || customer.phone), text, spec, file);
};
const toSupplier = (supplier, text, spec) => {
	if (!CONFIG.notifySuppliers || !supplier) return;
	push('supplier', chatId(supplier.picPhone || supplier.phone), text, spec);
};
const itemsText = (list) =>
	(list || [])
		.map((line) => line.name + ' ' + Number(line.quantity) + ' ' + line.unit + (line.serialNumbers && line.serialNumbers.length ? ' (SN ' + line.serialNumbers.join(', ') + ')' : ''))
		.join('; ');

const d = item.data || {};
const handlers = {
	'lead.created': () => {
		const who = (d.name || '-') + (d.companyName ? ' (' + d.companyName + ')' : '');
		const contact = d.whatsapp || d.phone || d.email || '-';
		toRole(
			'salesManager',
			'Lead baru ' + (d.reference || '') + '\n' + who + '\n' +
				'Kontak: ' + contact + '\n' +
				'Sumber: ' + (d.source || '-') + ' / ' + (d.channel || '-') + '\n' +
				'Kebutuhan: ' + (d.needs || '-') + link('/crm/leads/' + d.leadId),
			meta('erp_lead_baru', [d.reference, who, contact, d.needs]),
		);
	},
	'invoice.issued': () => {
		const customer = d.customer || {};
		toCustomer(
			customer,
			'Yth. ' + (customer.name || 'Pelanggan') + ',\n' +
				'Invoice ' + d.code + ' dari ' + CONFIG.companyName + ' sebesar ' + rupiah(d.grandTotal) +
				' jatuh tempo ' + date(d.dueDate) + '. Terima kasih.',
			meta('erp_invoice_terbit', [customer.name || 'Pelanggan', d.code, rupiah(d.grandTotal), date(d.dueDate)]),
		);
		toRole(
			'finance',
			'Invoice ' + d.code + ' terbit untuk ' + (customer.name || '-') + ': ' + rupiah(d.grandTotal) + ', jatuh tempo ' + date(d.dueDate) + '.',
			meta('erp_invoice_terbit_internal', [d.code, customer.name, rupiah(d.grandTotal), date(d.dueDate)]),
		);
	},
	'receipt.recorded': () => {
		const customer = d.customer || {};
		const invoice = d.invoice || {};
		const rest = Number(invoice.outstandingTotal) > 0 ? rupiah(invoice.outstandingTotal) : 'lunas';
		toCustomer(
			customer,
			'Terima kasih, pembayaran ' + rupiah(d.amount) + ' untuk invoice ' + (invoice.code || '-') + ' sudah kami terima.' +
				(Number(invoice.outstandingTotal) > 0 ? ' Sisa tagihan: ' + rupiah(invoice.outstandingTotal) + '.' : ' Invoice sudah lunas.'),
			meta('erp_pembayaran_diterima', [rupiah(d.amount), invoice.code, rest]),
		);
	},
	'service_ticket.updated': () => {
		const customer = d.customer || {};
		const updates = {
			created: 'sudah kami terima, teknisi kami akan menghubungi Anda',
			assigned: 'ditangani oleh ' + ((d.assignee && d.assignee.name) || 'teknisi kami'),
			started: 'teknisi mulai menangani',
			resolved: 'selesai: ' + (d.resolution || '-'),
			reopened: 'dibuka kembali',
			closed: 'ditutup, terima kasih',
		};
		const texts = {
			created: 'Tiket servis ' + d.code + ' sudah kami terima: ' + (d.complaint || '') + '. Teknisi kami akan menghubungi Anda.',
			assigned: 'Tiket ' + d.code + ' ditangani oleh ' + ((d.assignee && d.assignee.name) || 'teknisi kami') + '.',
			started: 'Teknisi mulai menangani tiket ' + d.code + '.',
			resolved: 'Tiket ' + d.code + ' selesai: ' + (d.resolution || '-') + '.',
			reopened: 'Tiket ' + d.code + ' dibuka kembali.',
			closed: 'Tiket ' + d.code + ' ditutup. Terima kasih.',
		};
		if (texts[d.change]) {
			toCustomer({ ...customer, whatsapp: customer.whatsapp || d.reporterContact }, texts[d.change], meta('erp_tiket_servis_update', [d.code, updates[d.change]]));
		}
		if (d.change === 'created') {
			toRole(
				'support',
				'Tiket baru ' + d.code + ' dari ' + (customer.name || d.reporterName || '-') + ': ' + (d.complaint || '-') + link('/projects/tickets/' + d.ticketId),
				meta('erp_tiket_servis_baru_internal', [d.code, customer.name || d.reporterName, d.complaint]),
			);
		}
	},
	'whatsapp.handoff': () => {
		const who = ((d.contactName || '') + ' ' + (d.phone || '')).trim();
		toRole(
			'adminOnDuty',
			'Chat WhatsApp perlu admin (' + d.reason + ')\n' + who + '\n"' + (d.question || '') + '"' + link('/integrations/whatsapp-ai/' + d.conversationId),
			meta('erp_chat_perlu_admin', [who, d.reason, d.question]),
		);
	},
	'license.due': () => {
		const customer = d.customer || {};
		const app = (d.application && d.application.name) || 'aplikasi';
		const text =
			d.stage === 'ended'
				? 'Lisensi ' + app + ' (' + d.code + ') sudah berakhir ' + date(d.endDate) + '. Masa tenggang sampai ' + date(d.graceEndsOn) + '.'
				: 'Lisensi ' + app + ' (' + d.code + ') berakhir ' + date(d.endDate) + ' (' + d.daysLeft + ' hari lagi).';
		toCustomer(
			customer,
			'Yth. ' + (customer.name || 'Pelanggan') + ', ' + text + ' Hubungi kami untuk perpanjangan.',
			meta('erp_lisensi_berakhir', [customer.name || 'Pelanggan', app, d.code, date(d.endDate)]),
		);
		toRole('salesManager', text + ' Pelanggan: ' + (customer.name || '-') + '.', meta('erp_lisensi_berakhir_internal', [app, d.code, customer.name, date(d.endDate)]));
	},
	'purchase_return.updated': () => {
		const supplier = d.supplier || {};
		const code = d.code || '(belum bernomor)';
		const head = 'Retur pembelian ' + code + ' ke ' + (supplier.name || '-');
		const detail = '\nBPB ' + (d.goodsReceiptCode || '-') + ' / PO ' + (d.purchaseOrderCode || '-') + '\nAlasan: ' + (d.reason || '-') + '\n' + lines(d.lines);
		const url = link('/procurement/purchase-returns/' + d.returnId);
		const team = (role, state, text) => toRole(role, text, meta('erp_retur_pembelian_internal', [code, supplier.name, state, itemsText(d.lines)]));
		if (d.change === 'submitted') team('operationsManager', 'menunggu persetujuan Anda', head + ' menunggu persetujuan Anda.' + detail + url);
		if (d.change === 'approved') {
			team('warehouse', 'disetujui, siapkan barang untuk dikirim ke pemasok', head + ' disetujui. Siapkan barang untuk dikirim ke pemasok.' + detail + url);
			team('purchasing', 'disetujui, hubungi pemasok untuk penggantian', head + ' disetujui. Hubungi pemasok untuk penggantian.' + url);
		}
		if (d.change === 'rejected') team('purchasing', 'ditolak: ' + (d.rejectionReason || '-'), head + ' ditolak: ' + (d.rejectionReason || '-') + url);
		if (d.change === 'shipped') {
			team('purchasing', 'sudah dikirim, PO dibuka lagi untuk barang pengganti', head + ' sudah dikirim. PO dibuka lagi untuk barang pengganti.' + url);
			toSupplier(
				supplier,
				'Yth. ' + (supplier.picName || supplier.name || 'Bapak/Ibu') + ', ' + CONFIG.companyName + ' mengirim kembali barang berikut untuk diganti (' + (d.code || '') + ', PO ' + (d.purchaseOrderCode || '-') + '):\n' + lines(d.lines) + '\nAlasan: ' + (d.reason || '-'),
				meta('erp_retur_pembelian_pemasok', [supplier.picName || supplier.name || 'Bapak/Ibu', CONFIG.companyName, d.code, d.purchaseOrderCode, itemsText(d.lines), d.reason]),
			);
		}
		if (d.change === 'cancelled') {
			team('purchasing', 'dibatalkan: ' + (d.cancelledReason || '-'), head + ' dibatalkan: ' + (d.cancelledReason || '-'));
			team('warehouse', 'dibatalkan, barang tidak jadi dikirim', head + ' dibatalkan, barang tidak jadi dikirim.');
		}
	},
	'sales_return.updated': () => {
		const customer = d.customer || {};
		const code = d.code || '(belum bernomor)';
		const head = 'Retur penjualan ' + code + ' dari ' + (customer.name || '-');
		const detail = '\nSurat jalan ' + (d.deliveryNoteCode || '-') + ' / SO ' + (d.salesOrderCode || '-') + '\nAlasan: ' + (d.reason || '-') + '\n' + lines(d.lines);
		const url = link('/sales/returns/' + d.returnId);
		const team = (role, state, text) => toRole(role, text, meta('erp_retur_penjualan_internal', [code, customer.name, state, itemsText(d.lines)]));
		if (d.change === 'submitted') team('salesManager', 'menunggu persetujuan Anda', head + ' menunggu persetujuan Anda.' + detail + url);
		if (d.change === 'approved') {
			team('warehouse', 'disetujui, barang akan datang, siapkan pemeriksaan kondisi', head + ' disetujui. Barang akan datang, siapkan pemeriksaan kondisi.' + detail + url);
			toCustomer(
				customer,
				'Yth. ' + (customer.name || 'Pelanggan') + ', pengajuan retur ' + (d.code || '') + ' disetujui. Tim kami akan mengatur pengambilan/pengiriman barang.',
				meta('erp_retur_disetujui', [customer.name || 'Pelanggan', d.code]),
			);
		}
		if (d.change === 'rejected') team('sales', 'ditolak: ' + (d.rejectionReason || '-'), head + ' ditolak: ' + (d.rejectionReason || '-') + url);
		if (d.change === 'received') {
			const damaged = (d.lines || []).filter((line) => line.condition === 'damaged').length;
			const state = 'sudah diterima gudang' + (damaged ? ' (' + damaged + ' baris rusak)' : '') + ', siapkan surat jalan pengganti';
			team('sales', state, head + ' sudah diterima gudang' + (damaged ? ' (' + damaged + ' baris rusak)' : '') + '. Siapkan surat jalan pengganti.' + url);
			toCustomer(
				customer,
				'Yth. ' + (customer.name || 'Pelanggan') + ', barang retur ' + (d.code || '') + ' sudah kami terima. Barang pengganti akan segera kami kirim.',
				meta('erp_retur_diterima', [customer.name || 'Pelanggan', d.code]),
			);
		}
		if (d.change === 'cancelled') team('sales', 'dibatalkan: ' + (d.cancelledReason || '-'), head + ' dibatalkan: ' + (d.cancelledReason || '-'));
	},
	'lead.follow_up_due': () => {
		const who = (d.name || '-') + (d.companyName ? ' (' + d.companyName + ')' : '');
		const contact = d.whatsapp || d.phone || d.email || '-';
		const when = d.daysOverdue > 0 ? 'terlambat ' + d.daysOverdue + ' hari (jadwal ' + date(d.dueDate) + ')' : 'jadwalnya hari ini';
		const ownerName = (d.owner && d.owner.name) || 'belum ada pemilik';
		const text = 'Follow-up lead ' + who + ' ' + when + '. Kontak: ' + contact + '. Kebutuhan: ' + (d.needs || '-') + link('/crm/leads/' + d.leadId);
		toPerson(d.owner, 'salesManager', text, meta('erp_followup_lead', [who, when, contact, d.needs]));
		if (d.stage === 'overdue' && d.owner && d.owner.phone) {
			toRole(
				'salesManager',
				'Lead ' + who + ' milik ' + ownerName + ' belum di-follow-up, ' + when + '.' + link('/crm/leads/' + d.leadId),
				meta('erp_followup_lead_terlambat', [who, ownerName, when]),
			);
		}
	},
	'quotation.follow_up_due': () => {
		const customer = (d.customer && d.customer.name) || '-';
		const state =
			d.stage === 'expiring'
				? 'berlaku sampai ' + date(d.validUntil) + ' (' + d.daysLeft + ' hari lagi)'
				: 'terkirim ' + d.daysSinceSent + ' hari lalu dan belum ada jawaban';
		toPerson(
			d.owner,
			'salesManager',
			'Penawaran ' + d.code + ' (' + d.title + ') untuk ' + customer + ' sebesar ' + rupiah(d.grandTotal) + ' ' + state + '. Saatnya follow-up.' + link('/sales/quotes/' + d.quotationId),
			meta('erp_followup_penawaran', [d.code, customer, rupiah(d.grandTotal), state]),
		);
	},
	'quotation.sent': () => {
		const customer = d.customer || {};
		const pdf = d.pdf;
		if (pdf && pdf.url) {
			// The PDF link is public for 30 days (revocable in the ERP's document
			// screen); customers get it only when notifyCustomers is on.
			toCustomer(
				customer,
				'Yth. ' + (customer.name || 'Pelanggan') + ',\n' +
					'Berikut penawaran ' + d.code + ' (' + d.title + ') dari ' + CONFIG.companyName + ' sebesar ' + rupiah(d.grandTotal) +
					', berlaku sampai ' + date(d.validUntil) + '. Terima kasih.',
				meta('erp_penawaran_terkirim', [customer.name || 'Pelanggan', d.code, d.title, rupiah(d.grandTotal), date(d.validUntil)]),
				{ url: pdf.url, filename: pdf.fileName || 'penawaran.pdf', mimetype: 'application/pdf' },
			);
		} else {
			// No PDF (rendering failed, or PDFs are off in the ERP): the
			// salesperson sends it by hand from the print page.
			toPerson(
				d.owner,
				'salesManager',
				'Penawaran ' + d.code + ' untuk ' + (customer.name || '-') + ' sudah terkirim, tetapi PDF-nya tidak dibuat otomatis. Kirim PDF dari halaman cetak.' + link('/sales/quotes/' + d.quotationId + '/print'),
				meta('erp_penawaran_tanpa_pdf', [d.code, customer.name]),
			);
		}
	},
	'supplier_bill.recorded': () => {
		const supplier = d.supplier || {};
		const text = 'Tagihan pemasok ' + d.code + ' (' + (d.supplierInvoiceNumber || '-') + ') dari ' + (supplier.name || '-') + ' dicatat: ' + rupiah(d.grandTotal) + ', jatuh tempo ' + date(d.dueDate) + '.';
		toRole('finance', text + link('/finance/payables'), meta('erp_tagihan_pemasok_internal', [d.code, d.supplierInvoiceNumber, supplier.name, rupiah(d.grandTotal), 'dicatat, jatuh tempo ' + date(d.dueDate)]));
		emailRole('finance', 'Tagihan pemasok ' + d.code, text);
	},
	'supplier_bill.due': () => {
		const supplier = d.supplier || {};
		const when = d.stage === 'upcoming' ? 'jatuh tempo ' + date(d.dueDate) + ' (' + d.daysLeft + ' hari lagi)' : d.stage === 'due' ? 'jatuh tempo HARI INI' : 'LEWAT jatuh tempo sejak ' + date(d.dueDate);
		const text = 'Tagihan pemasok ' + d.code + ' (' + (d.supplierInvoiceNumber || '-') + ') ke ' + (supplier.name || '-') + ' ' + when + '. Sisa: ' + rupiah(d.outstandingTotal) + '.';
		const spec = meta('erp_tagihan_pemasok_internal', [d.code, d.supplierInvoiceNumber, supplier.name, rupiah(d.outstandingTotal), when]);
		toRole('finance', text + link('/finance/payables'), spec);
		emailRole('finance', 'Pengingat tagihan ' + d.code, text);
		if (d.stage === 'overdue') toRole('owner', text, spec);
	},
};

if (handlers[item.topic]) handlers[item.topic]();
return [{ json: { ...item, messages: out } }];
