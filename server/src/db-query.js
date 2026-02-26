const IDENTIFIER_RE = /^[a-z_][a-z0-9_]*$/;

const ALLOWED_TABLES = new Set([
  "activity_logs",
  "custom_categories",
  "monthly_summaries",
  "months",
  "notifications",
  "person_monthly_summaries",
  "person_salary_balances",
  "profiles",
  "salary_settings",
  "team_persons",
  "teams",
  "transactions",
  "user_preferences",
  "user_roles",
  "users",
  "wallet_starting_balances",
]);

function quoteIdent(identifier) {
  if (!IDENTIFIER_RE.test(identifier)) {
    throw new Error(`Invalid identifier: ${identifier}`);
  }
  return `"${identifier}"`;
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function buildWhere(filters = [], paramStart = 1) {
  const clauses = [];
  const values = [];
  let idx = paramStart;

  for (const filter of filters) {
    if (!filter || typeof filter !== "object") continue;

    const column = quoteIdent(String(filter.column || ""));
    const op = String(filter.op || "eq");
    const value = Object.prototype.hasOwnProperty.call(filter, "value") ? filter.value : null;

    if (op === "eq") {
      if (value === null) {
        clauses.push(`${column} IS NULL`);
      } else {
        clauses.push(`${column} = $${idx++}`);
        values.push(value);
      }
      continue;
    }

    if (op === "neq") {
      if (value === null) {
        clauses.push(`${column} IS NOT NULL`);
      } else {
        clauses.push(`${column} <> $${idx++}`);
        values.push(value);
      }
      continue;
    }

    if (op === "not") {
      const operator = String(filter.operator || "").toLowerCase();
      if (operator === "is") {
        if (value === null) {
          clauses.push(`${column} IS NOT NULL`);
        } else {
          clauses.push(`${column} IS DISTINCT FROM $${idx++}`);
          values.push(value);
        }
        continue;
      }
      if (operator === "eq") {
        if (value === null) {
          clauses.push(`${column} IS NOT NULL`);
        } else {
          clauses.push(`${column} <> $${idx++}`);
          values.push(value);
        }
        continue;
      }
    }

    throw new Error(`Unsupported filter op: ${op}`);
  }

  return {
    sql: clauses.length > 0 ? ` WHERE ${clauses.join(" AND ")}` : "",
    values,
    nextParam: idx,
  };
}

function normalizeRows(input) {
  if (Array.isArray(input)) return input;
  if (isPlainObject(input)) return [input];
  throw new Error("Payload must be an object or array of objects");
}

function buildInsertQuery(table, payload) {
  const rows = normalizeRows(payload);
  if (rows.length === 0) throw new Error("No rows provided");

  const columns = Object.keys(rows[0]);
  if (columns.length === 0) throw new Error("No columns provided");

  const quotedColumns = columns.map(quoteIdent);
  const values = [];
  const tuples = rows.map((row, rowIdx) => {
    const placeholders = columns.map((column, colIdx) => {
      values.push(Object.prototype.hasOwnProperty.call(row, column) ? row[column] : null);
      const pos = rowIdx * columns.length + colIdx + 1;
      return `$${pos}`;
    });
    return `(${placeholders.join(", ")})`;
  });

  return {
    sql: `INSERT INTO ${quoteIdent(table)} (${quotedColumns.join(", ")}) VALUES ${tuples.join(", ")} RETURNING *`,
    values,
  };
}

function buildUpsertQuery(table, payload, onConflictRaw) {
  const rows = normalizeRows(payload);
  if (rows.length === 0) throw new Error("No rows provided");

  const columns = Object.keys(rows[0]);
  if (columns.length === 0) throw new Error("No columns provided");

  const onConflict = String(onConflictRaw || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (onConflict.length === 0) {
    throw new Error("Upsert requires options.onConflict");
  }

  const conflictSet = new Set(onConflict);
  const updateColumns = columns.filter((c) => !conflictSet.has(c));
  const updateClause =
    updateColumns.length > 0
      ? updateColumns.map((c) => `${quoteIdent(c)} = EXCLUDED.${quoteIdent(c)}`).join(", ")
      : `${quoteIdent(onConflict[0])} = EXCLUDED.${quoteIdent(onConflict[0])}`;

  const insert = buildInsertQuery(table, rows);
  const conflictSql = onConflict.map(quoteIdent).join(", ");
  return {
    sql: insert.sql.replace(
      " RETURNING *",
      ` ON CONFLICT (${conflictSql}) DO UPDATE SET ${updateClause} RETURNING *`,
    ),
    values: insert.values,
  };
}

function buildUpdateQuery(table, payload, filters) {
  if (!isPlainObject(payload)) throw new Error("Update payload must be an object");
  const columns = Object.keys(payload);
  if (columns.length === 0) throw new Error("No update values provided");

  const setValues = [];
  const setSql = columns
    .map((column, idx) => {
      setValues.push(payload[column]);
      return `${quoteIdent(column)} = $${idx + 1}`;
    })
    .join(", ");

  const where = buildWhere(filters, columns.length + 1);
  return {
    sql: `UPDATE ${quoteIdent(table)} SET ${setSql}${where.sql} RETURNING *`,
    values: [...setValues, ...where.values],
  };
}

function buildDeleteQuery(table, filters) {
  const where = buildWhere(filters, 1);
  return {
    sql: `DELETE FROM ${quoteIdent(table)}${where.sql} RETURNING *`,
    values: where.values,
  };
}

function buildSelectQuery(table, select, filters, order, limit) {
  let selectSql = "*";
  let joinSql = "";
  const tableSql = quoteIdent(table);

  // Keep existing PersonDetail month history query behavior.
  if (table === "person_monthly_summaries" && typeof select === "string" && select.includes("months!inner")) {
    selectSql =
      'person_monthly_summaries.*, json_build_object(\'name\', months.name, \'start_date\', months.start_date) AS months';
    joinSql = " INNER JOIN months ON months.id = person_monthly_summaries.month_id";
  }

  const where = buildWhere(filters, 1);

  let orderSql = "";
  if (order && typeof order === "object" && order.column) {
    const direction = order.ascending === false ? "DESC" : "ASC";
    orderSql = ` ORDER BY ${quoteIdent(String(order.column))} ${direction}`;
  }

  let limitSql = "";
  const parsedLimit = Number(limit);
  if (Number.isFinite(parsedLimit) && parsedLimit > 0) {
    limitSql = ` LIMIT ${Math.floor(parsedLimit)}`;
  }

  return {
    sql: `SELECT ${selectSql} FROM ${tableSql}${joinSql}${where.sql}${orderSql}${limitSql}`,
    values: where.values,
  };
}

module.exports = {
  ALLOWED_TABLES,
  buildInsertQuery,
  buildUpsertQuery,
  buildUpdateQuery,
  buildDeleteQuery,
  buildSelectQuery,
};

