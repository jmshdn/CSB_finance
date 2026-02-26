const crypto = require("crypto");
const express = require("express");
const cors = require("cors");
const { types } = require("pg");
const {
  ALLOWED_TABLES,
  buildInsertQuery,
  buildUpsertQuery,
  buildUpdateQuery,
  buildDeleteQuery,
  buildSelectQuery,
} = require("./db-query");
const { createUserService } = require("./user-service");

const SERVER_TIMEZONE_OFFSET_MS = 9 * 60 * 60 * 1000;
const SERVER_MANAGED_FIELDS = new Set(["created_at", "updated_at"]);

function pad2(value) {
  return String(value).padStart(2, "0");
}

function formatAsServerDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  const shifted = new Date(date.getTime() + SERVER_TIMEZONE_OFFSET_MS);
  return `${shifted.getUTCFullYear()}-${pad2(shifted.getUTCMonth() + 1)}-${pad2(shifted.getUTCDate())}/${pad2(
    shifted.getUTCHours(),
  )}:${pad2(shifted.getUTCMinutes())}:${pad2(shifted.getUTCSeconds())}`;
}

function formatTimestampWithoutTimezone(value) {
  const match = String(value).match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})/);
  if (!match) return String(value);
  return `${match[1]}/${match[2]}`;
}

function stripServerManagedFields(values) {
  if (Array.isArray(values)) {
    return values.map((item) => stripServerManagedFields(item));
  }
  if (!values || typeof values !== "object") return values;

  const next = { ...values };
  for (const field of SERVER_MANAGED_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(next, field)) {
      delete next[field];
    }
  }
  return next;
}

// Match Supabase/PostgREST behavior for numeric columns by returning JS numbers.
types.setTypeParser(1700, (value) => (value === null ? null : Number(value)));
types.setTypeParser(1082, (value) => value); // date -> YYYY-MM-DD
types.setTypeParser(1114, (value) => (value === null ? null : formatTimestampWithoutTimezone(value)));
types.setTypeParser(1184, (value) => (value === null ? null : formatAsServerDateTime(value))); // timestamptz -> GMT+9

function dbError(res, status, message) {
  return res.status(status).json({ data: null, error: { message } });
}

function createApp({ pool, defaultLocalPassword }) {
  const app = express();
  const userService = createUserService({ pool, defaultLocalPassword });

  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json({ limit: "1mb" }));

  app.get("/", (_req, res) => {
    res.json({
      ok: true,
      service: "financecsb-local-api",
      health: "/api/health",
    });
  });

  app.get("/api/health", async (_req, res) => {
    try {
      await pool.query("SELECT 1");
      res.json({ ok: true });
    } catch (err) {
      dbError(res, 500, err.message || "Database unavailable");
    }
  });

  app.post("/api/auth/sign-in", async (req, res) => {
    try {
      await userService.ensureUsersBootstrapped();

      const email = userService.normalizeEmail(req.body?.email);
      const password = String(req.body?.password || "");
      if (!email || !password) return dbError(res, 400, "Email and password are required");

      const userRes = await pool.query("SELECT id, email, password_hash FROM users WHERE email = $1 LIMIT 1", [email]);
      if (userRes.rowCount === 0) return dbError(res, 401, "Invalid email or password");

      const user = userRes.rows[0];
      if (!userService.verifyPassword(password, user.password_hash)) {
        return dbError(res, 401, "Invalid email or password");
      }

      const profileRes = await pool.query("SELECT is_active FROM profiles WHERE user_id = $1 LIMIT 1", [user.id]);
      if (profileRes.rowCount > 0 && profileRes.rows[0].is_active === false) {
        return dbError(res, 403, "Account is disabled");
      }

      const session = {
        access_token: crypto.randomUUID(),
        user: {
          id: user.id,
          email: user.email,
        },
      };

      res.json({ data: { user: session.user, session }, error: null });
    } catch (err) {
      dbError(res, 500, err.message || "Sign-in failed");
    }
  });

  app.post("/api/auth/sign-out", async (_req, res) => {
    res.json({ data: null, error: null });
  });

  app.post("/api/auth/update-password", async (req, res) => {
    try {
      const userId = String(req.body?.userId || "");
      const password = String(req.body?.password || "");
      if (!userId || !password) return dbError(res, 400, "userId and password are required");

      const result = await pool.query("UPDATE users SET password_hash = $1 WHERE id = $2", [
        userService.hashPassword(password),
        userId,
      ]);

      if (result.rowCount === 0) return dbError(res, 404, "User not found");
      res.json({ data: null, error: null });
    } catch (err) {
      dbError(res, 500, err.message || "Password update failed");
    }
  });

  app.post("/api/db/query", async (req, res) => {
    try {
      const table = String(req.body?.table || "");
      const operation = String(req.body?.operation || "select");
      const select = req.body?.select || "*";
      const filters = Array.isArray(req.body?.filters) ? req.body.filters : [];
      const order = req.body?.order || null;
      const limit = req.body?.limit ?? null;
      const values = req.body?.values ?? null;
      const options = req.body?.options ?? {};
      const sanitizedValues =
        operation === "insert" || operation === "upsert" || operation === "update"
          ? stripServerManagedFields(values)
          : values;

      if (!ALLOWED_TABLES.has(table)) {
        return dbError(res, 400, `Table not allowed: ${table}`);
      }

      let query;
      if (operation === "select") {
        query = buildSelectQuery(table, select, filters, order, limit);
      } else if (operation === "insert") {
        query = buildInsertQuery(table, sanitizedValues);
      } else if (operation === "upsert") {
        query = buildUpsertQuery(table, sanitizedValues, options.onConflict);
      } else if (operation === "update") {
        query = buildUpdateQuery(table, sanitizedValues, filters);
      } else if (operation === "delete") {
        query = buildDeleteQuery(table, filters);
      } else {
        return dbError(res, 400, `Unsupported operation: ${operation}`);
      }

      const result = await pool.query(query.sql, query.values);
      res.json({ data: result.rows, error: null });
    } catch (err) {
      dbError(res, 500, err.message || "Database query failed");
    }
  });

  app.post("/api/rpc/:name", async (req, res) => {
    try {
      const name = String(req.params.name || "");
      if (name === "carry_forward_wallet_balances") {
        const args = req.body || {};
        await pool.query("SELECT carry_forward_wallet_balances($1, $2)", [
          args._new_month_id || null,
          args._crypto_start || 0,
        ]);
        return res.json({ data: null, error: null });
      }

      if (name === "close_month") {
        const args = req.body || {};
        await pool.query("SELECT close_month($1)", [args._month_id || null]);
        return res.json({ data: null, error: null });
      }

      return dbError(res, 400, `Unsupported RPC: ${name}`);
    } catch (err) {
      dbError(res, 500, err.message || "RPC failed");
    }
  });

  app.post("/api/functions/:name", async (req, res) => {
    try {
      const name = String(req.params.name || "");
      if (name !== "admin-users") {
        return dbError(res, 400, `Unsupported function: ${name}`);
      }

      const action = String(req.body?.action || "");
      if (action === "seed") {
        const results = await userService.seedUsersFromTeamPersons();
        return res.json({ data: { success: true, results }, error: null });
      }

      if (action === "reset-password") {
        const userId = String(req.body?.user_id || "");
        if (!userId) return dbError(res, 400, "user_id required");

        const updated = await pool.query("UPDATE users SET password_hash = $1 WHERE id = $2", [
          userService.hashPassword(defaultLocalPassword),
          userId,
        ]);
        if (updated.rowCount === 0) return dbError(res, 404, "User not found");

        await pool.query("UPDATE profiles SET must_change_password = true WHERE user_id = $1", [userId]);
        return res.json({ data: { success: true }, error: null });
      }

      if (action === "create-user") {
        const nameInput = String(req.body?.name || "").trim();
        if (!nameInput) return dbError(res, 400, "name required");

        const email = `${nameInput.toLowerCase()}@csb.com`;
        const wallet = req.body?.wallet ?? null;
        const role = req.body?.role ?? "normal_user";
        const userId = crypto.randomUUID();

        await pool.query("INSERT INTO users (id, email, password_hash) VALUES ($1, $2, $3)", [
          userId,
          email,
          userService.hashPassword(defaultLocalPassword),
        ]);

        await pool.query(
          `INSERT INTO profiles (user_id, display_name, assigned_wallet, is_active, must_change_password)
           VALUES ($1, $2, $3, true, true)
           ON CONFLICT (user_id) DO NOTHING`,
          [userId, nameInput, wallet],
        );

        if (role === "admin" || role === "team_user") {
          await pool.query("INSERT INTO user_roles (user_id, role) VALUES ($1, $2) ON CONFLICT DO NOTHING", [
            userId,
            role,
          ]);
        }

        return res.json({ data: { success: true, email, role }, error: null });
      }

      return dbError(res, 400, "Unknown action");
    } catch (err) {
      dbError(res, 500, err.message || "Function call failed");
    }
  });

  return {
    app,
    ensureUsersBootstrapped: userService.ensureUsersBootstrapped,
  };
}

module.exports = {
  createApp,
};
