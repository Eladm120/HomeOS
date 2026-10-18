import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";

/**
 * Minimal stand-ins for the Supabase-managed schemas (auth, storage, roles,
 * realtime publication) so the real migrations and the real SQL test scripts
 * can run in an in-process Postgres. Behaviour mirrors Supabase where the
 * migrations depend on it: auth.uid()/auth.jwt() read the forged JWT claims,
 * storage.foldername() splits object paths.
 */
const SUPABASE_STUBS = `
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;

create schema extensions;
-- pgcrypto is not bundled with PGlite; these two match its signatures.
create function extensions.gen_random_bytes(n int) returns bytea language sql volatile as $$
  select substring(decode(string_agg(md5(random()::text), ''), 'hex') from 1 for n) from generate_series(1, (n / 16) + 1)
$$;
create function extensions.digest(data text, alg text) returns bytea language sql immutable as $$
  select sha256(convert_to(data, 'utf8'))
$$;
create schema auth;
create table auth.users (
  id uuid primary key,
  instance_id uuid,
  email text,
  aud text,
  role text,
  raw_user_meta_data jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);
create function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
$$;
create function auth.uid() returns uuid language sql stable as $$
  select nullif(auth.jwt() ->> 'sub', '')::uuid
$$;
grant usage on schema auth to anon, authenticated, service_role;
grant select on auth.users to service_role;

create schema storage;
create table storage.buckets (
  id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]
);
create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets (id),
  name text,
  owner uuid,
  created_at timestamptz default now()
);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql immutable as $$
  select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]
$$;
grant usage on schema storage to anon, authenticated, service_role;
grant all on storage.objects to authenticated;
grant select on storage.buckets to authenticated;

create publication supabase_realtime;
`;

export const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations");
export const SQL_TESTS_DIR = join(process.cwd(), "supabase", "tests");

export function migrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
}

/** A fresh database with every migration applied, as on Supabase. */
export async function createMigratedDb(): Promise<PGlite> {
  const db = new PGlite({ extensions: { pg_trgm } });
  await db.exec(SUPABASE_STUBS);
  for (const file of migrationFiles()) {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8").replace(/create extension if not exists pgcrypto[^;]*;/gi, "");
    try {
      await db.exec(sql);
    } catch (e) {
      throw new Error(`Migration ${file} failed: ${(e as Error).message}`);
    }
  }
  return db;
}
