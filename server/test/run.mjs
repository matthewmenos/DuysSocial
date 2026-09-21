// Integration smoke tests for the DUYS API.
// Boots the Express server against a throwaway SQLite DB, then runs
// authenticated HTTP assertions for auth/feed/posts/admin/money.
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const port = 5999;
const base = `http://localhost:${port}`;

const dbFile = path.join(root, "test.db");
const sqliteUrl = "file:" + dbFile.replace(/\\/g, "/");
try { fs.unlinkSync(dbFile); } catch {}

let server;
let pass = 0;
let fail = 0;
const results = [];

function check(name, ok, extra = "") {
  if (ok) pass++; else fail++;
  results.push(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? `  (${extra})` : ""}`);
}

// Minimal cookie-tracking fetch.
async function j(u, o = {}, cookie = "") {
  const headers = { "Content-Type": "application/json", ...(o.headers || {}) };
  if (cookie) headers.Cookie = cookie;
  const r = await fetch(base + u, { ...o, headers });
  const sc = r.headers.get("set-cookie");
  const c = sc && !cookie ? sc.split(";")[0] : cookie;
  let body = {};
  try { body = await r.json(); } catch {}
  return { status: r.status, body, cookie: c };
}

function run(cmd, args, env = {}) {
  return new Promise((resolve) => {
    const p = spawn(cmd, args, { env: { ...process.env, ...env }, cwd: root });
    let out = "";
    p.stdout.on("data", (d) => { out += d; });
    p.stderr.on("data", (d) => { out += d; });
    p.on("exit", (code) => resolve({ code, out }));
  });
}

async function waitHealthy(timeoutMs = 120000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try { const r = await fetch(`${base}/health`); if (r.ok) return true; } catch {}
    await new Promise((r) => setTimeout(r, 300));
  }
  return false;
}

const Env = {
  ...process.env,
  DATABASE_URL: sqliteUrl,
  API_PORT: String(port),
  SECRET_KEY: "test-secret",
  NODE_ENV: "test",
  APP_URL: `http://localhost:${port}`,
  CLIENT_ORIGIN: `http://localhost:${port}`,
  ADMIN_USERNAME: "admin",
  ADMIN_EMAIL: "admin@test.dev",
  ADMIN_PASSWORD: "secretpass123",
};

const nodeBin = process.execPath;
const prismaBin = path.join(root, "..", "node_modules", "prisma", "build", "index.js");
const tsxBin = path.join(root, "..", "node_modules", "tsx", "dist", "cli.mjs");

async function main() {
  const push = await run(nodeBin, [prismaBin, "db", "push", "--skip-generate", "--accept-data-loss"], { DATABASE_URL: Env.DATABASE_URL });
  if (push.code !== 0) {
    console.log("prisma db push failed:\n" + push.out.slice(0, 2000));
    process.exit(1);
  }

  server = spawn(nodeBin, [tsxBin, "src/index.ts"], { env: Env, cwd: root });
  server.stdout.on("data", (d) => process.stdout.write(d));
  server.stderr.on("data", (d) => process.stderr.write(d));
  if (!(await waitHealthy())) {
    console.error("Server did not become healthy.");
    process.exit(1);
  }

  // Unauthenticated bootstrap.
  const boot = await j("/api/bootstrap");
  check("bootstrap returns app name", boot.status === 200 && boot.body.appName, String(boot.body.appName));

  // Register a fresh user.
  const reg = await j("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ displayName: "Alice", username: "alice", email: "alice@test.dev", password: "password123", confirmPassword: "password123" }),
  });
  const aliceCookie = reg.cookie;
  check("register creates user", reg.status === 200 && reg.body.user?.username === "alice");

  const dup = await j("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ displayName: "Bob", username: "alice", email: "bob@test.dev", password: "password123", confirmPassword: "password123" }),
  });
  check("duplicate username rejected", dup.status === 409);

  const post = await j("/api/posts", { method: "POST", body: JSON.stringify({ kind: "text", body: "Hello world #launch" }) }, aliceCookie);
  const pid = post.body.post?.id;
  check("create post", post.status === 201 && !!pid, "id=" + pid);

  const feed = await j("/api/feed?scope=for_you", {}, aliceCookie);
  const inFeed = (feed.body.posts || []).some((p) => p.id === pid);
  check("feed returns post", feed.status === 200 && inFeed);

  const like = await j(`/api/posts/${pid}/like`, { method: "POST", body: "{}" }, aliceCookie);
  check("like a post", like.status === 200 && like.body.liked === true);

  const adminLogin = await j("/api/auth/login", { method: "POST", body: JSON.stringify({ email: "admin@test.dev", password: "secretpass123" }) });
  const adminCookie = adminLogin.cookie;
  check("admin login + role", adminLogin.status === 200 && adminLogin.body.user?.isAdmin === true);

  const adminOverview = await j("/api/admin/overview", {}, adminCookie);
  check("admin overview", adminOverview.status === 200 && adminOverview.body.users >= 2);
  const forbidden = await j("/api/admin/overview", {}, aliceCookie);
  check("non-admin rejected from admin", forbidden.status === 403);

  const quote = await j("/api/swap/quote", { method: "POST", body: JSON.stringify({ side: "buy", fromAmount: 10 }) }, aliceCookie);
  check("swap quote uses live/fallback mid", quote.status === 200 && quote.body.toAmount > 0 && quote.body.mid > 0);

  const nonce = await j("/api/wallet/connect/nonce", { method: "POST" }, aliceCookie);
  check("wallet nonce issued", nonce.status === 200 && !!nonce.body.nonce);
  const badVerify = await j(
    "/api/wallet/connect/verify",
    { method: "POST", body: JSON.stringify({ address: "0x000000000000000000000000000000000000000000", signature: "0x00" }) },
    aliceCookie,
  );
  check("wallet verify rejects bad signature", badVerify.status === 400);

  const w = await j("/api/earn/webhooks/hypelab", { method: "POST", body: JSON.stringify({ eventId: "evt-1", userId: 2 }) });
  check("hypelab webhook credits", w.status === 200 && w.body.ok === true);
  const w2 = await j("/api/earn/webhooks/hypelab", { method: "POST", body: JSON.stringify({ eventId: "evt-1", userId: 2 }) });
  check("hypelab webhook idempotent", w2.status === 200 && w2.body.duplicate === true);

  console.log("\n" + results.join("\n"));
  console.log(`\n${pass} passed, ${fail} failed`);
  try { server.kill(); } catch {}
  process.exit(fail ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  try { server?.kill(); } catch {}
  process.exit(1);
});