import fs from "node:fs";
import path from "node:path";
import { Client } from "pg";
import { supabaseDbUrl } from "@/lib/supabase/env";

/**
 * Runs the numbered .sql files in supabase/migrations against the database
 * directly, for the admin Migrations page. Everywhere else in the app talks
 * to Postgres through PostgREST (the anon/service-role keys), which can't
 * run DDL — this is the one place that needs an actual Postgres connection,
 * kept as narrow as it can be: only files already committed to this repo
 * can run, never arbitrary SQL.
 */

const MIGRATIONS_DIR = path.join(process.cwd(), "supabase", "migrations");

export function listMigrationFiles(): string[] {
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => /^\d{3}_[\w-]+\.sql$/.test(f))
    .sort();
}

export function readMigrationFile(filename: string): string {
  return fs.readFileSync(path.join(MIGRATIONS_DIR, filename), "utf8");
}

async function connect(): Promise<Client> {
  // rejectUnauthorized: false because Supabase's pooler certificate chain
  // isn't always in Node's default trust store from a serverless function —
  // the connection itself is still encrypted, this only skips verifying who
  // signed the cert.
  const client = new Client({
    connectionString: supabaseDbUrl,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  return client;
}

async function ensureTrackingTable(client: Client): Promise<void> {
  await client.query(`
    create table if not exists public.schema_migrations (
      filename text primary key,
      applied_at timestamptz not null default now()
    );
    alter table public.schema_migrations enable row level security;
  `);
}

export async function getMigrationStatus(): Promise<
  { filename: string; applied: boolean; appliedAt: string | null }[]
> {
  const files = listMigrationFiles();
  const client = await connect();
  try {
    await ensureTrackingTable(client);
    const { rows } = await client.query<{
      filename: string;
      applied_at: string;
    }>("select filename, applied_at from public.schema_migrations");
    const applied = new Map(rows.map((r) => [r.filename, r.applied_at]));
    return files.map((filename) => ({
      filename,
      applied: applied.has(filename),
      appliedAt: applied.get(filename) ?? null,
    }));
  } finally {
    await client.end();
  }
}

export async function runMigrationFile(
  filename: string
): Promise<{ ranStatements: true } | { alreadyApplied: true }> {
  // Never trust the caller's filename beyond "it's one of ours" — this is
  // the only thing standing between the admin session and arbitrary DDL.
  if (!listMigrationFiles().includes(filename)) {
    throw new Error(`Unknown migration file: ${filename}`);
  }

  const sql = readMigrationFile(filename);
  const client = await connect();
  try {
    await ensureTrackingTable(client);

    const { rows: already } = await client.query(
      "select 1 from public.schema_migrations where filename = $1",
      [filename]
    );
    if (already.length > 0) {
      return { alreadyApplied: true };
    }

    await client.query("BEGIN");
    try {
      // A bare string with no params runs on the simple query protocol,
      // which — unlike a parameterized query — allows a semicolon-separated
      // file to execute as more than one statement.
      await client.query(sql);
      await client.query(
        "insert into public.schema_migrations (filename) values ($1)",
        [filename]
      );
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    }

    return { ranStatements: true };
  } finally {
    await client.end();
  }
}
