// Reusable validation for docs/database/docs.dbml.
// Run: bun docs/database/validate-dbml.ts
// Verifies:
//   1. the DBML parses (@dbml/core, dbmlv2)
//   2. no Ref crosses a module boundary (warehouse+inventory = one module)
//   3. every business table has created_at/updated_at/deleted_at
//      (documented exceptions: append-only ledgers, projections, Better Auth
//      core tables, transitional sales scaffold)
//   4. unique table names across schemas ("payments" is whitelisted:
//      finance.payments is the target; sales.payments is the transitional
//      scaffold dropped in phase step S7)
// Exits non-zero on any violation. No SQL export: docs.dbml is a design
// reference for the hand-written Drizzle schemas, not a DDL source.
import { Parser } from "@dbml/core";
import { readFileSync } from "node:fs";

const SRC = "B:/ims/erp/docs/database/docs.dbml";

const db = new Parser().parse(readFileSync(SRC, "utf8"), "dbmlv2");

const tables = [];
for (const schema of db.schemas) {
  for (const t of schema.tables ?? []) {
    tables.push({ schema: schema.name, name: t.name, fields: (t.fields ?? []).map(f => f.name) });
  }
}
const allRefs = db.schemas.flatMap((s) => s.refs ?? []);
console.log(`parsed: ${tables.length} tables, ${allRefs.length} refs`);

// module mapping: schemas belonging to one module
const moduleOf = (s) =>
  s === "warehouse" || s === "inventory" ? "Inventory" : s;

// unique bare table names (so refs resolve unambiguously)
const nameMap = new Map();
let dups = 0;
// Bare-name duplicates that are tolerated because the surviving name is
// unambiguous in practice. `items` was superseded by inventory.items
// (ADR-0008): catalog.items is retained only until the catalogue satellites
// are adopted, and no new ref may target it.
const DUP_ALLOWED = new Set(["payments", "items"]);
for (const t of tables) {
  if (nameMap.has(t.name) && nameMap.get(t.name) !== t.schema && !DUP_ALLOWED.has(t.name)) {
    console.error(`DUPLICATE table name: ${t.schema}.${t.name} also in ${nameMap.get(t.name)}`); dups++;
  }
  nameMap.set(t.name, t.schema);
}

let cross = 0;
for (const r of allRefs) {
  const [e1, e2] = r.endpoints;
  const bare = (name) => (name.includes(".") ? name.split(".")[1] : name);
  // `endpoint.schemaName` is authoritative; the bare-name map is only a
  // fallback because `items` exists in both catalog and inventory.
  const s1 = e1.schemaName || nameMap.get(bare(e1.tableName));
  const s2 = e2.schemaName || nameMap.get(bare(e2.tableName));
  if (s1 === undefined || s2 === undefined) {
    console.error(`UNRESOLVED ref endpoint: ${e1.tableName} / ${e2.tableName}`); cross++; continue;
  }
  if (moduleOf(s1) !== moduleOf(s2)) {
    console.error(`CROSS-MODULE FK: ${s1}.${bare(e1.tableName)} -> ${s2}.${bare(e2.tableName)}`); cross++;
  }
}
console.log(`cross-module refs: ${cross}`);

// timestamp coverage
// Better Auth core tables only (the 9 adapter-managed tables); the ERP-owned
// auth.* extension tables (user_profiles, portal_identities, ...) are checked
// like every other business table.
const AUTH_CORE = new Set(["users", "sessions", "accounts", "verifications",
  "organizations", "members", "invitations", "passkeys", "apikeys"]);
const TIMESTAMP_EXEMPT = new Set([
  // Better Auth managed core tables (own conventions, adapter contract)
  ...tables.filter(t => t.schema === "auth" && AUTH_CORE.has(t.name)).map(t => `auth.${t.name}`),
  // transitional live scaffold, replaced in step S3/S7
  "sales.quotations", "sales.payments",
  // append-only ledger / history (deleted_at meaningless, documented in notes)
  "inventory.stock_movements", "ticket.ticket_status_history", "audit.audit_logs",
  // append-only business timeline (never edited, never soft-deleted)
  "assets.borrowing_events",
  // projection
  "inventory.stock_balances",
  // serial/lot rows are stock facts closed by disposition, not business entities
  "inventory.serial_tracked_items", "inventory.lot_batches",
]);

const gaps = [];
// An append-only event row may timestamp itself with `occurred_at` instead of
// `created_at`: they are the same instant for an immutable record.
const CREATION_TIMESTAMPS = ["created_at", "occurred_at"];
for (const t of tables) {
  const full = `${t.schema}.${t.name}`;
  const has = (c) => t.fields.includes(c);
  if (!CREATION_TIMESTAMPS.some(has)) gaps.push(`${full}: missing created_at`);
  if (TIMESTAMP_EXEMPT.has(full)) continue;
  if (!has("updated_at")) gaps.push(`${full}: missing updated_at`);
  if (!has("deleted_at")) gaps.push(`${full}: missing deleted_at`);
}
console.log(`timestamp gaps: ${gaps.length}`);
gaps.forEach(g => console.error("  " + g));

if (dups || cross || gaps.length) process.exit(1);
console.log("OK");
// @dbml/core leaves an open handle on Windows; force-exit or bun never returns
process.exit(0);
