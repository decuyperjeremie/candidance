import Database from "better-sqlite3";
import { readFileSync, readdirSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * SQLite storage for the prototype.
 *
 * - Single local file under ./data (git-ignored).
 * - A tiny ordered-`.sql` migration runner (no ORM, per design.md).
 *   Migrations live in ./migrations and run in filename order, each once.
 */

const MODULE_DIR = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(MODULE_DIR, "migrations");
const DEFAULT_DB_PATH = join(process.cwd(), "data", "tatiana.db");

let db: Database.Database | null = null;

function ensureMigrationsTable(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name       TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

/**
 * Applies any not-yet-applied `.sql` files from the migrations directory,
 * in lexical order, each inside its own transaction. Idempotent.
 */
export function runMigrations(database: Database.Database): string[] {
  ensureMigrationsTable(database);

  const applied = new Set<string>(
    database
      .prepare("SELECT name FROM schema_migrations")
      .all()
      .map((r) => (r as { name: string }).name),
  );

  const files = existsSync(MIGRATIONS_DIR)
    ? readdirSync(MIGRATIONS_DIR)
        .filter((f) => f.endsWith(".sql"))
        .sort()
    : [];

  const newlyApplied: string[] = [];
  const record = database.prepare(
    "INSERT INTO schema_migrations (name) VALUES (?)",
  );

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
    const tx = database.transaction(() => {
      database.exec(sql);
      record.run(file);
    });
    tx();
    newlyApplied.push(file);
  }

  return newlyApplied;
}

/**
 * Opens (creating if needed) the SQLite database and runs migrations.
 * No manual setup required on first run — the data dir and file are created.
 */
export function getDb(dbPath: string = DEFAULT_DB_PATH): Database.Database {
  if (db) return db;

  mkdirSync(dirname(dbPath), { recursive: true });
  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  runMigrations(db);
  return db;
}
