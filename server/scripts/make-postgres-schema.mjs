// Emits a PostgreSQL-flavoured copy of prisma/schema.prisma for production.
//
// Why: Prisma validates that the datasource `provider` matches the DATABASE_URL
// scheme, so a schema cannot be both SQLite (local dev/tests, zero deps) and
// PostgreSQL (Render/Neon) at once. prisma/schema.prisma stays the single source
// of truth (provider = "sqlite"); this script derives the postgres variant.
//
// Usage (production build):
//   npm run db:generate:pg && npm run db:push:pg
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const src = path.resolve(here, "..", "prisma", "schema.prisma");
const out = path.resolve(here, "..", "prisma", "schema.postgres.prisma");

const sqlite = fs.readFileSync(src, "utf8");

if (!/provider\s*=\s*"sqlite"/.test(sqlite)) {
  throw new Error(
    `Expected \`provider = "sqlite"\` in ${src}.\n` +
      "Refusing to derive a postgres schema from an unexpected source.",
  );
}

const postgres = sqlite.replace(/provider\s*=\s*"sqlite"/, 'provider = "postgresql"');
fs.writeFileSync(out, postgres);
console.log(`wrote ${path.relative(process.cwd(), out)} (provider = postgresql)`);
