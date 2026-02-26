const path = require("path");
const assert = require("node:assert/strict");
const test = require("node:test");
const dotenv = require("dotenv");
const { Pool } = require("pg");
const { createApp } = require("../src/create-app");

dotenv.config({ path: path.join(__dirname, "..", ".env") });

let pool;
let server;
let baseUrl;
let defaultPassword;
let signedInUserId;

async function requestJson(pathname, options = {}) {
  const res = await fetch(`${baseUrl}${pathname}`, options);
  const body = await res.json();
  return { status: res.status, body };
}

test.before(async () => {
  const databaseUrl = process.env.DATABASE_URL;
  defaultPassword = process.env.DEFAULT_LOCAL_PASSWORD || "123123";
  assert.ok(databaseUrl, "DATABASE_URL is required for integration tests");

  pool = new Pool({ connectionString: databaseUrl });
  const { app, ensureUsersBootstrapped } = createApp({
    pool,
    defaultLocalPassword: defaultPassword,
  });

  await ensureUsersBootstrapped();

  await new Promise((resolve) => {
    server = app.listen(0, resolve);
  });
  const addr = server.address();
  baseUrl = `http://127.0.0.1:${addr.port}`;
});

test.after(async () => {
  if (server) {
    await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }
  if (pool) await pool.end();
});

test("GET / returns API metadata", async () => {
  const { status, body } = await requestJson("/");
  assert.equal(status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.service, "financecsb-local-api");
  assert.equal(body.health, "/api/health");
});

test("GET /api/health returns database health", async () => {
  const { status, body } = await requestJson("/api/health");
  assert.equal(status, 200);
  assert.equal(body.ok, true);
});

test("POST /api/auth/sign-in authenticates seeded user", async () => {
  const { status, body } = await requestJson("/api/auth/sign-in", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "jjs@csb.com", password: defaultPassword }),
  });
  assert.equal(status, 200);
  assert.equal(body.error, null);
  assert.equal(body.data.user.email, "jjs@csb.com");
  assert.ok(body.data.user.id);
  signedInUserId = body.data.user.id;
});

test("POST /api/auth/sign-out returns success envelope", async () => {
  const { status, body } = await requestJson("/api/auth/sign-out", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  assert.equal(status, 200);
  assert.equal(body.data, null);
  assert.equal(body.error, null);
});

test("POST /api/auth/update-password updates hash for existing user", async () => {
  assert.ok(signedInUserId, "sign-in test must run first");
  const { status, body } = await requestJson("/api/auth/update-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId: signedInUserId, password: defaultPassword }),
  });
  assert.equal(status, 200);
  assert.equal(body.data, null);
  assert.equal(body.error, null);
});

test("POST /api/db/query selects allowed table data", async () => {
  const { status, body } = await requestJson("/api/db/query", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      table: "teams",
      operation: "select",
      select: "name",
      order: { column: "name", ascending: true },
    }),
  });
  assert.equal(status, 200);
  assert.equal(body.error, null);
  assert.ok(Array.isArray(body.data));
  assert.ok(body.data.length > 0);
});

test("POST /api/db/query rejects disallowed table", async () => {
  const { status, body } = await requestJson("/api/db/query", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      table: "non_existing_table",
      operation: "select",
      select: "*",
    }),
  });
  assert.equal(status, 400);
  assert.equal(body.data, null);
  assert.match(body.error.message, /Table not allowed/);
});

test("POST /api/rpc/:name rejects unsupported rpc", async () => {
  const { status, body } = await requestJson("/api/rpc/unknown_rpc", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  assert.equal(status, 400);
  assert.equal(body.data, null);
  assert.match(body.error.message, /Unsupported RPC/);
});

test("POST /api/functions/:name rejects unsupported function", async () => {
  const { status, body } = await requestJson("/api/functions/not-supported", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  assert.equal(status, 400);
  assert.equal(body.data, null);
  assert.match(body.error.message, /Unsupported function/);
});

test("POST /api/functions/admin-users rejects unknown action", async () => {
  const { status, body } = await requestJson("/api/functions/admin-users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "not-an-action" }),
  });
  assert.equal(status, 400);
  assert.equal(body.data, null);
  assert.equal(body.error.message, "Unknown action");
});

