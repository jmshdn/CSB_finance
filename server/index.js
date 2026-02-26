const dotenv = require("dotenv");
const { Pool } = require("pg");
const { createApp } = require("./src/create-app");

dotenv.config();

const PORT = Number(process.env.PORT || 4000);
const DATABASE_URL = process.env.DATABASE_URL;
const DEFAULT_LOCAL_PASSWORD = process.env.DEFAULT_LOCAL_PASSWORD || "123123";
const SERVER_TIME_ZONE = process.env.SERVER_TIME_ZONE || "Asia/Tokyo";

if (!DATABASE_URL) {
  console.error("Missing DATABASE_URL in server/.env");
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  options: `-c TimeZone=${SERVER_TIME_ZONE}`,
});
const { app, ensureUsersBootstrapped } = createApp({
  pool,
  defaultLocalPassword: DEFAULT_LOCAL_PASSWORD,
});

app.listen(PORT, async () => {
  await ensureUsersBootstrapped();
  console.log(`Local API listening on http://localhost:${PORT}`);
});
