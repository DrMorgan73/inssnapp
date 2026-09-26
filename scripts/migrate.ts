/**
 * Database migration runner (TASK-002).
 *
 * Usage:
 *   DATABASE_URL=postgres://user:pass@host:5432/inssnapp npx tsx scripts/migrate.ts
 *
 * Applies packages/db/src/schema.sql. Idempotent — safe to run repeatedly.
 */

import { migrate, usingPostgres } from "../packages/db/src/index";

async function main() {
  if (!usingPostgres) {
    console.error("DATABASE_URL is not set. PostgreSQL is required for migrations.");
    process.exit(1);
  }

  console.log("Applying migrations...");
  await migrate();
  console.log("Migrations complete.");
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
