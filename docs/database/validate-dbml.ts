// Reusable validation for docs/database/docs.dbml.
// Run: bun docs/database/validate-dbml.ts
// Verifies:
//   1. the DBML parses (@dbml/core, dbmlv2)
//   2. no Ref crosses a module boundary (one schema = one module, ADR-0026)
//   3. every business table has created_at/updated_at/deleted_at
//      (documented exceptions: append-only ledgers, projections, Better Auth
//      core tables, transitional sales scaffold)
//   4. unique table names across schemas ("payments" is whitelisted:
//      payment.payments is the target; sales.payments is the transitional
//      scaffold dropped in phase step S7)
// Exits non-zero on any violation. No SQL export: docs.dbml is a design
// reference for the hand-written Drizzle schemas, not a DDL source.
import { Parser } from "@dbml/core";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const SRC = join(import.meta.dir, "docs.dbml");

const db = new Parser().parse(readFileSync(SRC, "utf8"), "dbmlv2");

const tables = [];
for (const schema of db.schemas) {
  for (const t of schema.tables ?? []) {
    tables.push({ schema: schema.name, name: t.name, fields: (t.fields ?? []).map(f => f.name) });
  }
}
const allRefs = db.schemas.flatMap((s) => s.refs ?? []);
console.log(`parsed: ${tables.length} tables, ${allRefs.length} refs`);

// module mapping: one schema per module (ADR-0024). `auth` is shared by the
// `user` and `organization` modules, which is why it is one entry here too.
const moduleOf = (s) => s;

// unique bare table names (so refs resolve unambiguously)
const nameMap = new Map();
let dups = 0;
// Bare-name duplicates that are tolerated because refs always use the
// schema-qualified name (ADR-0024): several schemas own a table with one of
// these names by design.
const DUP_ALLOWED = new Set([
  "settings",
  "code_numberings",
  "addresses",
  "company_addresses",
  "companies",
  "documents",
]);
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
// auth.* extension tables (user_invitations, organization_settings) are checked
// like every other business table.
const AUTH_CORE = new Set(["users", "sessions", "accounts", "verifications",
  "organizations", "members", "invitations", "passkeys", "apikeys"]);
const TIMESTAMP_EXEMPT = new Set([
  // Better Auth managed core tables (own conventions, adapter contract)
  ...tables.filter(t => t.schema === "auth" && AUTH_CORE.has(t.name)).map(t => `auth.${t.name}`),
  // append-only ledgers (deleted_at meaningless, documented in notes)
  "inventory.movements", "audit.audit_logs", "inventory.borrowing_events", "inventory.borrowing_request_events",
  // projections: running balances cleared by status, not soft-deleted
  "inventory.stocks", "finance.ar_open_items", "finance.ap_open_items",
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

// ---------------------------------------------------------------------------
// 5. Drizzle schema parity: every table and column that exists in
//    apps/backend/drizzle/schemas must exist in docs.dbml.
//
// docs.dbml is canonical and describes the target, so it legitimately carries
// tables and columns that are not built yet (the 150 unbuilt target tables,
// planned columns such as hr.employees.department_id). The reverse is a bug:
// a shipped table or column that the contract does not mention means the
// contract lies about the database. That is what this check catches.
// ---------------------------------------------------------------------------
const SCHEMA_DIR = join(import.meta.dir, "../../apps/backend/drizzle/schemas");
const dbmlFields = new Map(tables.map(t => [`${t.schema}.${t.name}`, new Set(t.fields)]));

const drift = [];
for (const file of readdirSync(SCHEMA_DIR).filter(f => f.endsWith(".schema.ts"))) {
  const src = readFileSync(join(SCHEMA_DIR, file), "utf8");
  // A file either declares its own pgSchema() or reuses one imported from a
  // sibling schema file (role.schema.ts reuses authSchema).
  let schemaName = /export const \w+ = pgSchema\(\s*["']([a-z_]+)["']\s*\)/.exec(src)?.[1];
  if (!schemaName) {
    const alias = /(\w+Schema)\.table\(/.exec(src)?.[1];
    const from = alias && new RegExp(`import\\s*\\{[^}]*\\b${alias}\\b[^}]*\\}\\s*from\\s*["']\\./([a-z0-9-]+)\\.schema["']`).exec(src)?.[1];
    if (from) {
      const dep = readFileSync(join(SCHEMA_DIR, `${from}.schema.ts`), "utf8");
      schemaName = new RegExp(`export const ${alias} = pgSchema\\(\\s*["']([a-z_]+)["']`).exec(dep)?.[1];
    }
  }
  if (!schemaName) {
    drift.push(`${file}: no pgSchema() declaration and no imported schema found`);
    continue;
  }
  // Table blocks: `.table('name', {` ... up to the next table marker.
  const marks = [...src.matchAll(/\.table\(\s*["']([a-z_0-9]+)["']\s*,/g)];
  marks.forEach((mark, i) => {
    const from = mark.index + mark[0].length;
    const to = i + 1 < marks.length ? marks[i + 1].index : src.length;
    const block = src.slice(from, to);
    const full = `${schemaName}.${mark[1]}`;
    const declared = dbmlFields.get(full);
    if (!declared) {
      drift.push(`${full} (${file}): table missing from docs.dbml`);
      return;
    }
    // Column definitions look like `camelCase: sqlType('snake_case', ...)`.
    for (const col of block.matchAll(/^\s{1,4}[a-zA-Z0-9_]+:\s*[a-zA-Z0-9_]+\(\s*["']([a-z_0-9]+)["']/gm)) {
      if (!declared.has(col[1])) drift.push(`${full}.${col[1]} (${file}): column missing from docs.dbml`);
    }
  });
}
console.log(`drizzle parity drift: ${drift.length}`);
drift.forEach(d => console.error("  " + d));

// ---------------------------------------------------------------------------
// 6. Column parity, both directions, against the real Drizzle tables: for every
//    table that exists in both, a column must have the same nullability and
//    the same SQL type in docs.dbml and in the Drizzle schema. Check 5 only
//    proves that names exist; it never noticed a NOT NULL on a cross-module id
//    column (ADR-0014 says those are always nullable) or a type that differs.
//    docs.dbml wins: a mismatch means the Drizzle file is the bug.
//
// Defaults and indexes are not compared: DBML cannot express partial or
// expression indexes, and Drizzle `$onUpdate` / `$default` are not DB defaults.
// ---------------------------------------------------------------------------
const { getTableConfig, PgTable } = await import("drizzle-orm/pg-core");
const { is } = await import("drizzle-orm");
const dbmlColumns = new Map();
for (const schema of db.schemas) {
  for (const t of schema.tables ?? []) {
    dbmlColumns.set(`${schema.name}.${t.name}`, new Map((t.fields ?? []).map(f => [f.name, f])));
  }
}
const normType = (s) =>
  String(s).toLowerCase().replace(/\(.*/, "").trim()
    .replace("character varying", "varchar")
    .replace("timestamp without time zone", "timestamp")
    .replace("integer", "int");
const columnDrift = [];
for (const file of readdirSync(SCHEMA_DIR).filter(f => f.endsWith(".schema.ts"))) {
  const mod = await import(join(SCHEMA_DIR, file));
  for (const value of Object.values(mod)) {
    if (!is(value, PgTable)) continue;
    const config = getTableConfig(value);
    const full = `${config.schema ?? "public"}.${config.name}`;
    const declared = dbmlColumns.get(full);
    if (!declared) continue; // reported by check 5
    for (const col of config.columns) {
      const field = declared.get(col.name);
      if (!field) continue; // reported by check 5
      const dbmlNotNull = Boolean(field.not_null) || Boolean(field.pk);
      if (dbmlNotNull !== Boolean(col.notNull)) {
        columnDrift.push(`${full}.${col.name}: docs.dbml ${dbmlNotNull ? "NOT NULL" : "nullable"}, Drizzle ${col.notNull ? "NOT NULL" : "nullable"}`);
      }
      const a = normType(field.type?.type_name ?? "");
      const b = normType(col.getSQLType());
      if (a !== b) columnDrift.push(`${full}.${col.name}: docs.dbml type ${a}, Drizzle type ${b}`);
    }
  }
}
console.log(`column parity drift (nullability, type): ${columnDrift.length}`);
columnDrift.forEach(d => console.error("  " + d));

if (dups || cross || gaps.length || drift.length || columnDrift.length) process.exit(1);
console.log("OK");
// @dbml/core leaves an open handle on Windows; force-exit or bun never returns
process.exit(0);
