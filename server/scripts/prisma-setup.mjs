// Provider-aware Prisma setup, run before every build.
//
// Why this exists: prisma/schema.prisma declares `provider = "sqlite"` so local
// dev and the test suite need zero setup, but Prisma validates that the
// datasource provider matches the DATABASE_URL scheme. Production (Render/Neon)
// supplies a `postgres://` URL, so a build that blindly runs the SQLite schema
// dies before TypeScript starts with:
//
//   Error code: P1012
//   error: Error validating datasource `db`: the URL must start with the
//   protocol `file:`.
//
// This script reads DATABASE_URL, selects (and for postgres, derives) the
// matching schema, then runs `generate` + `db push` against it. That makes
// `npm run build` correct in both environments, including when a hosting
// dashboard has a build command that disagrees with render.yaml.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { derivePostgresSchema } from "./make-postgres-schema.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.resolve(here, "..");
const sqliteSchema = path.resolve(serverRoot, "prisma", "schema.prisma");

const url = (process.env.DATABASE_URL || "").trim();

if (!url) {
  console.error(
    [
      "DATABASE_URL is not set, so the Prisma schema cannot be selected.",
      "",
      '  local dev / tests : DATABASE_URL="file:./prisma/dev.db"',
      '  production        : DATABASE_URL="postgresql://user:pass@host/db"',
      "",
      "Set it (root .env, or the host's environment settings) and retry.",
    ].join("\n"),
  );
  process.exit(1);
}

let schema;
if (/^file:/i.test(url)) {
  schema = sqliteSchema;
} else if (/^postgres(ql)?:\/\//i.test(url)) {
  schema = derivePostgresSchema();
} else {
  console.error(
    'DATABASE_URL must start with "file:" (SQLite) or "postgres://" / "postgresql://" (PostgreSQL).\n' +
      `Got: ${url.slice(0, 24)}…`,
  );
  process.exit(1);
}

// `prisma` shim lookup: used only if the shim is missing from PATH (the script
// is normally invoked from an npm script, where npm puts node_modules/.bin
// on PATH — the same way the previous build script called `prisma` directly).
const cliJs =
  [
    path.resolve(serverRoot, "..", "node_modules", "prisma", "build", "index.js"),
    path.resolve(serverRoot, "node_modules", "prisma", "build", "index.js"),
  ].find((p) => fs.existsSync(p)) || null;

console.log(
  `prisma-setup: ${path.relative(serverRoot, schema)} ` +
    `(${url.replace(/\/\/[^@/]*@/, "//***@").slice(0, 60)})`,
);

function runPrisma(args) {
  // Same invocation the old build used: the `prisma` shim that npm puts on
  // PATH (falling back to the CLI JS if it is missing from PATH).
  const quote = (s) => (/\s/.test(s) ? `"${s}"` : s);
  const line = cliJs
    ? [process.execPath, cliJs, ...args].map(quote).join(" ")
    : ["prisma", ...args].map(quote).join(" ");
  console.log(`prisma-setup: ${line}`);
  const res = spawnSync(line, { cwd: serverRoot, stdio: "inherit", shell: true });
  if (res.status !== 0) {
    if (res.error) console.error(`prisma-setup: failed to start (${res.error.message}).`);
    console.error(`\nprisma-setup: \`prisma ${args[0]}\` failed (exit ${res.status}).`);
    process.exit(typeof res.status === "number" ? res.status : 1);
  }
}

runPrisma(["generate", "--schema", schema]);
runPrisma(["db", "push", "--schema", schema, "--skip-generate"]);

console.log("prisma-setup: client generated and schema in sync");
