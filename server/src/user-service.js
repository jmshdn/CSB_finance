const crypto = require("crypto");

function hashPassword(password) {
  const digest = crypto.createHash("sha256").update(password).digest("hex");
  return `sha256:${digest}`;
}

function verifyPassword(rawPassword, storedHash) {
  if (typeof storedHash !== "string" || storedHash.length === 0) return false;
  if (storedHash.startsWith("sha256:")) {
    return hashPassword(rawPassword) === storedHash;
  }
  // Fallback for legacy/dev seeds.
  return rawPassword === storedHash;
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function createUserService({ pool, defaultLocalPassword }) {
  let bootstrapTried = false;

  async function seedUsersFromProfiles() {
    const profilesRes = await pool.query(
      "SELECT user_id, display_name, assigned_wallet FROM profiles WHERE display_name IS NOT NULL AND display_name <> ''",
    );

    const results = [];
    for (const row of profilesRes.rows) {
      const name = row.display_name;
      const email = `${name.toLowerCase()}@csb.com`;
      const userId = row.user_id || crypto.randomUUID();

      const existingUser = await pool.query("SELECT id FROM users WHERE email = $1 LIMIT 1", [email]);
      if (existingUser.rowCount > 0) {
        results.push({ name, email, status: "already_exists" });
        continue;
      }

      await pool.query("INSERT INTO users (id, email, password_hash) VALUES ($1, $2, $3)", [
        userId,
        email,
        hashPassword(defaultLocalPassword),
      ]);

      await pool.query(
        `INSERT INTO profiles (user_id, display_name, assigned_wallet, is_active, must_change_password)
         VALUES ($1, $2, $3, true, true)
         ON CONFLICT (user_id) DO UPDATE SET
           display_name = EXCLUDED.display_name,
           assigned_wallet = COALESCE(EXCLUDED.assigned_wallet, profiles.assigned_wallet),
           is_active = true`,
        [userId, name, row.assigned_wallet || null],
      );

      if (name === "JJS") {
        await pool.query("INSERT INTO user_roles (user_id, role) VALUES ($1, 'admin') ON CONFLICT DO NOTHING", [userId]);
      }

      results.push({ name, email, status: "created", role: name === "JJS" ? "admin" : "normal_user" });
    }

    return results;
  }

  async function seedUsersFromTeamPersons() {
    const personsRes = await pool.query("SELECT person_name, team FROM team_persons");
    const personTeamMap = new Map();

    for (const row of personsRes.rows) {
      const name = row.person_name;
      if (["Team", "Internal", "All"].includes(name)) continue;
      if (row.team === "CSB") continue;
      if (!personTeamMap.has(name)) {
        personTeamMap.set(name, row.team);
      }
    }

    const results = [];
    for (const [name, team] of personTeamMap.entries()) {
      const email = `${name.toLowerCase()}@csb.com`;
      const profileRes = await pool.query("SELECT user_id FROM profiles WHERE display_name = $1 LIMIT 1", [name]);
      const userId = profileRes.rowCount > 0 ? profileRes.rows[0].user_id : crypto.randomUUID();

      const existing = await pool.query("SELECT id FROM users WHERE email = $1 LIMIT 1", [email]);
      if (existing.rowCount === 0) {
        await pool.query("INSERT INTO users (id, email, password_hash) VALUES ($1, $2, $3)", [
          userId,
          email,
          hashPassword(defaultLocalPassword),
        ]);
        results.push({ name, email, team, status: "created", role: name === "JJS" ? "admin" : "normal_user" });
      } else {
        results.push({ name, email, status: "already_exists" });
      }

      await pool.query(
        `INSERT INTO profiles (user_id, display_name, assigned_wallet, is_active, must_change_password)
         VALUES ($1, $2, $3, true, true)
         ON CONFLICT (user_id) DO UPDATE SET
           assigned_wallet = EXCLUDED.assigned_wallet,
           is_active = true,
           must_change_password = true`,
        [userId, name, team],
      );

      if (name === "JJS") {
        await pool.query("INSERT INTO user_roles (user_id, role) VALUES ($1, 'admin') ON CONFLICT DO NOTHING", [userId]);
      }
    }

    return results;
  }

  async function ensureUsersBootstrapped() {
    if (bootstrapTried) return;
    bootstrapTried = true;

    try {
      const countRes = await pool.query("SELECT COUNT(*)::int AS count FROM users");
      const count = countRes.rows[0]?.count ?? 0;
      if (count === 0) {
        await seedUsersFromProfiles();
      }
    } catch (_err) {
      // Keep server running; surface DB/schema errors on actual requests.
    }
  }

  return {
    hashPassword,
    verifyPassword,
    normalizeEmail,
    seedUsersFromTeamPersons,
    ensureUsersBootstrapped,
  };
}

module.exports = {
  createUserService,
  hashPassword,
  verifyPassword,
  normalizeEmail,
};

