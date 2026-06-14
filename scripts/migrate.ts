import { getDb, runMigrations } from "@/lib/db";

const db = getDb();
const applied = runMigrations(db); // idempotent; getDb already ran them once
const rows = db
  .prepare("SELECT name, applied_at FROM schema_migrations ORDER BY name")
  .all() as { name: string; applied_at: string }[];

console.log(
  applied.length
    ? `Applied ${applied.length} migration(s): ${applied.join(", ")}`
    : "No new migrations to apply.",
);
console.log("Migration history:");
for (const r of rows) console.log(`  - ${r.name} (${r.applied_at})`);
