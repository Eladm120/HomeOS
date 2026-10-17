// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SQL_TESTS_DIR, createMigratedDb, migrationFiles } from "./harness";

// Each SQL test script asserts inside a transaction it rolls back, and raises on
// the first failed assertion. Running them here means every migration and every
// RLS rule is exercised by `npm test`, not only by hand in the Supabase editor.
const scripts = readdirSync(SQL_TESTS_DIR)
  .filter((f) => f.endsWith(".sql"))
  .sort();

describe("database", () => {
  it("applies every migration on a clean database", async () => {
    const db = await createMigratedDb();
    const { rows } = await db.query<{ n: number }>(
      "select count(*)::int as n from pg_tables where schemaname = 'public'",
    );
    expect(rows[0].n).toBeGreaterThan(10);
    expect(migrationFiles().length).toBeGreaterThan(0);
    await db.close();
  }, 60_000);

  for (const file of scripts) {
    it(`passes ${file}`, async () => {
      const db = await createMigratedDb();
      const sql = readFileSync(join(SQL_TESTS_DIR, file), "utf8");
      await expect(db.exec(sql)).resolves.toBeDefined();
      await db.close();
    }, 60_000);
  }
});
