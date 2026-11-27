# User guide

End-user documentation of the web admin (M02 sales, M05 procurement and
warehouse, M07 projects and after-sales), as implemented on
`merge/main-sync` (ADR-0011 port, 2026-11-06).

| File | Content |
|---|---|
| [en.md](en.md) | User guide in English |
| [id.md](id.md) | Panduan pengguna dalam Bahasa Indonesia |
| [finance-accounting-guide.md](finance-accounting-guide.md) | Panduan keuangan & pajak untuk akuntan (non-teknis): buku besar, kas/bank, rekonsiliasi, penutupan bulan, laporan, Pajak |
| [whatsapp-n8n-setup.en.md](whatsapp-n8n-setup.en.md) / [.id.md](whatsapp-n8n-setup.id.md) | M04 setup: WAHA webhook, n8n flows per event, AI provider, go-live checklist (T32) |
| [diagrams.md](diagrams.md) | UML (Mermaid): end-to-end activity, sequences, document state machines, module contracts, cost flow |

Keep both languages in step: a change to one guide updates the other in the
same change, and both follow the code (labels, statuses, permissions). The
diagrams are checked by rendering them with Mermaid 11; state names are the
values stored in the database.
