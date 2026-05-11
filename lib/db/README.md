# `lib/db/` — Local SQLite Backend

The local backend for donothing. One SQLite database (`nothing.db`)
opened via expo-sqlite, with a sequential migration runner and a Zod
validation layer at every write.

## Architecture

```
lib/db/
├── index.ts                 ← getDb() singleton + wipeUserData()
├── migrations.ts            ← migration runner + version registry
├── migrations/
│   ├── 001_initial.ts
│   ├── 003_reflection_checkin_milestones.ts
│   ├── 004_block_groups.ts
│   ├── 005_unlock_goal.ts
│   ├── 006_drop_block_groups.ts
│   ├── 007_schema_hygiene.ts        ← Supabase-ready columns + CHECKs
│   ├── 008_drop_reminders.ts
│   └── 009_hygiene_pass.ts          ← updated_at triggers + indexes
├── schemas.ts               ← Zod schemas (write-side validation)
├── types.ts                 ← entity types (UI/store boundary)
├── sessions.ts              ← session reads/writes
├── scheduled-blocks.ts      ← scheduled-block reads/writes
├── milestones-db.ts         ← milestone reads/writes
└── settings.ts              ← key/value settings + device_state
```

`getDb()` is a lazy singleton. First call opens the file, enables WAL +
foreign keys, runs all pending DDL migrations inside a transaction,
then caches the handle.

## Core invariants

**Normalize at write, trust at read.** Every `INSERT` / `UPDATE`
funnels through a Zod parse (`schemas.ts`). By the time a row is
persisted it is canonical, so the read path is a plain row→entity
mapper — no defensive re-validation, no second source of truth.

**One entity = one file.** `lib/db/{entity}.ts` owns all queries for
that entity. UI/store never issues raw SQL.

**Migrations are append-only and idempotent.** Each migration version
is applied exactly once (tracked in `_migrations`). Never edit a
previously-shipped migration — write a new one.

**Row-count parity on destructive copies.** SQLite can't alter CHECK
constraints in place, so the `CREATE _new → INSERT … SELECT → DROP →
RENAME` rebuild dance is sometimes necessary. When that's needed, the
copy step compares `COUNT(*)` before/after and throws on mismatch —
otherwise an out-of-range row would vanish silently on app update.
See `copyAndVerify()` in `007_schema_hygiene.ts`.

**`updated_at` lives in SQLite, not in code.** Triggers in
migration009 refresh `updated_at` on every UPDATE. Don't set it
manually from JS — the trigger always wins, and forgetting it in a
new query would silently break sync semantics.

## How to add a new entity

1. **Migration.** Create `migrations/00X_{entity}.ts` with
   `CREATE TABLE …`. Include from day one:
   - `id TEXT PRIMARY KEY` (UUID via `expo-crypto`'s `randomUUID()`)
   - `user_id TEXT NOT NULL DEFAULT 'local'` (RLS-ready)
   - `created_at TEXT NOT NULL DEFAULT (datetime('now'))`
   - `updated_at TEXT NOT NULL DEFAULT (datetime('now'))`
   - `CHECK` constraints on every bounded column (durations, enums…)
   - Indexes on every column you'll filter by (`user_id`, foreign-ish
     keys, anything dated).
   - If sync will care: `deleted_at TEXT` and
     `version INTEGER NOT NULL DEFAULT 1`.
2. **Register** the migration in `migrations.ts` (`syncMigrations` array
   + bump `CURRENT_SCHEMA_VERSION`).
3. **`updated_at` trigger.** Add an `AFTER UPDATE OF <cols>` trigger in
   the same migration so the column stays fresh without JS help.
4. **Zod schema** in `schemas.ts`. Define `XInputSchema` for writes.
   If the canonical type lives elsewhere (e.g. enums imported from
   `lib/mood.ts`), reference it — don't duplicate the list.
5. **`{entity}.ts`** with `addX / getX / updateX / deleteX` helpers.
   Every write `.parse()`s through the schema first. Every read returns
   the canonical entity type from `types.ts`.
6. **Wipe.** Add the table name to `USER_DATA_TABLES` in `index.ts` so
   "Delete Account" actually clears it.

## How to add a column to an existing table

SQLite supports `ALTER TABLE … ADD COLUMN` for **nullable** columns or
columns with a `DEFAULT`. That's the easy path — one migration, one
line, done.

For anything else (NOT NULL without default, new CHECK, changed
constraint), use the rebuild dance from `007_schema_hygiene.ts`:

1. `CREATE TABLE {entity}_new (…)` with the new shape.
2. `INSERT INTO {entity}_new (…) SELECT … FROM {entity} WHERE <valid>`.
3. **`copyAndVerify()`** — assert row counts match; throw otherwise.
4. `DROP TABLE {entity}` → `ALTER TABLE {entity}_new RENAME TO {entity}`.
5. Recreate all indexes (they don't survive the rebuild).
6. Update the Zod schema in `schemas.ts` to match.
7. Update `types.ts` and the read mapper in `{entity}.ts` so the new
   field appears in the canonical entity.

The migration runs inside the outer `BEGIN TRANSACTION` from
`runSyncMigrations`, so any thrown error rolls everything back.

## Supabase debt (intentional)

This backend is built to be Supabase-portable later but isn't there
yet. The list below is the work that will be required when sync is
turned on — none of it is critical for the current offline-only build.

Ordered by pain at migration time:

1. **Hard DELETE → soft delete.** `deleted_at` columns already exist
   on `sessions`, `scheduled_blocks`, `milestones`. All `DELETE`
   statements need to become `UPDATE … SET deleted_at = datetime('now')`
   and every `SELECT` needs `WHERE deleted_at IS NULL`. ~3-4 days.
2. **TEXT timestamps → `timestamptz`.** Postgres can ingest the ISO
   strings; just declare the columns as `timestamptz` in the Supabase
   schema and let the driver coerce. ~1-2 days.
3. **`user_id = 'local'` backfill.** On first login, run a single
   transactional UPDATE to set every row's `user_id` to the real
   account id, then enable RLS. ~1 day.
4. **`enabled INTEGER` → `BOOLEAN`.** Postgres is strict-typed; either
   keep INTEGER or migrate with `CAST`. ~4 hours.
5. **`strftime('%Y-%m-%d', timestamp / 1000, 'unixepoch', 'localtime')`
   → `to_char(to_timestamp(timestamp / 1000), 'YYYY-MM-DD')` or
   equivalent.** Used in `sessions.ts` for date bucketing. Better:
   extract into a `dateKeyExpr(col)` helper so the swap is one place.
   ~4 hours.
6. **TEXT primary keys → native `uuid`.** Pure schema change in
   Postgres; app already generates real UUIDs. ~4 hours.
7. **Schema source-of-truth split.** Migrations define SQL, `schemas.ts`
   defines Zod. They drift unless reviewed together. No fix beyond
   discipline — keep them adjacent in PRs.

If/when account-based sync is on the roadmap, work the list top-down.
