/* eslint-disable @typescript-eslint/no-explicit-any */

type ApiError = { message: string };
type ApiEnvelope<T> = { data: T; error: ApiError | null };

export type AuthUser = {
  id: string;
  email: string | null;
};

type AuthSession = {
  access_token: string;
  user: AuthUser;
};

type AuthChangeEvent = "SIGNED_IN" | "SIGNED_OUT" | "USER_UPDATED";
type AuthListener = (event: AuthChangeEvent, session: AuthSession | null) => void;

type QueryResult<T = any> = {
  data: T;
  error: ApiError | null;
};

type DbFilter = {
  op: "eq" | "neq" | "not";
  column: string;
  value: unknown;
  operator?: string;
};

const NUMERIC_COLUMNS_BY_TABLE: Record<string, string[]> = {
  months: ["crypto_start", "crypto_end"],
  monthly_summaries: ["total_income", "total_expense", "base_fee", "crypto_start", "crypto_end"],
  person_monthly_summaries: ["income", "expense", "revenue"],
  person_salary_balances: ["carry_forward_deficit"],
  salary_settings: ["base_fee_per_person", "team_target", "base_rate", "below_target_rate", "top_performer_rate"],
  transactions: ["amount", "settled_amount"],
  wallet_starting_balances: ["starting_amount", "carry_forward_amount", "real_balance"],
};

function coerceNumeric(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "number") return value;
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (trimmed.length === 0) return value;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : value;
}

function coerceTableRows(table: string, rows: any[]): any[] {
  const numericColumns = NUMERIC_COLUMNS_BY_TABLE[table];
  if (!numericColumns || rows.length === 0) return rows;

  return rows.map((row) => {
    if (!row || typeof row !== "object") return row;
    const next = { ...row };
    for (const column of numericColumns) {
      if (Object.prototype.hasOwnProperty.call(next, column)) {
        next[column] = coerceNumeric(next[column]);
      }
    }
    return next;
  });
}

const API_BASE = String(import.meta.env.VITE_API_URL || "/api").replace(/\/$/, "");
const SESSION_STORAGE_KEY = "financecsb.local.session";

function toError(err: unknown): ApiError {
  if (err instanceof Error && err.message) return { message: err.message };
  return { message: "Unexpected error" };
}

async function apiRequest<T>(path: string, init: RequestInit): Promise<ApiEnvelope<T>> {
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init.headers || {}),
      },
    });

    const json = (await response.json()) as ApiEnvelope<T> | null;
    if (!response.ok) {
      return {
        data: (json?.data ?? null) as T,
        error: json?.error ?? { message: `Request failed with status ${response.status}` },
      };
    }

    return {
      data: (json?.data ?? null) as T,
      error: json?.error ?? null,
    };
  } catch (err) {
    return { data: null as T, error: toError(err) };
  }
}

function postJson<T>(path: string, body: unknown): Promise<ApiEnvelope<T>> {
  return apiRequest<T>(path, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

function readSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthSession;
  } catch {
    return null;
  }
}

function writeSession(session: AuthSession | null) {
  if (!session) {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    return;
  }
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}

class LocalQueryBuilder<T = any> implements PromiseLike<QueryResult<T>> {
  private operation: "select" | "insert" | "update" | "delete" | "upsert" = "select";
  private filters: DbFilter[] = [];
  private selectColumns: string = "*";
  private orderBy: { column: string; ascending: boolean } | null = null;
  private limitCount: number | null = null;
  private values: unknown = null;
  private options: Record<string, unknown> = {};
  private expect: "many" | "single" | "maybeSingle" = "many";

  constructor(private readonly table: string) {}

  select(columns = "*") {
    this.selectColumns = columns;
    return this;
  }

  insert(values: unknown) {
    this.operation = "insert";
    this.values = values;
    return this;
  }

  update(values: unknown) {
    this.operation = "update";
    this.values = values;
    return this;
  }

  delete() {
    this.operation = "delete";
    return this;
  }

  upsert(values: unknown, options: Record<string, unknown> = {}) {
    this.operation = "upsert";
    this.values = values;
    this.options = options;
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push({ op: "eq", column, value });
    return this;
  }

  neq(column: string, value: unknown) {
    this.filters.push({ op: "neq", column, value });
    return this;
  }

  not(column: string, operator: string, value: unknown) {
    this.filters.push({ op: "not", column, operator, value });
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.orderBy = { column, ascending: options?.ascending !== false };
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  single() {
    this.expect = "single";
    return this;
  }

  maybeSingle() {
    this.expect = "maybeSingle";
    return this;
  }

  private async execute(): Promise<QueryResult<any>> {
    const result = await postJson<any[]>("/db/query", {
      table: this.table,
      operation: this.operation,
      select: this.selectColumns,
      filters: this.filters,
      order: this.orderBy,
      limit: this.limitCount,
      values: this.values,
      options: this.options,
    });

    if (result.error) return { data: null, error: result.error };

    const rows = Array.isArray(result.data) ? coerceTableRows(this.table, result.data) : [];
    if (this.expect === "many") {
      return { data: rows, error: null };
    }

    if (this.expect === "maybeSingle") {
      return { data: rows[0] ?? null, error: null };
    }

    if (rows.length === 0) {
      return { data: null, error: { message: "No rows found" } };
    }

    return { data: rows[0], error: null };
  }

  then<TResult1 = QueryResult<T>, TResult2 = never>(
    onfulfilled?:
      | ((value: QueryResult<T>) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?:
      | ((reason: any) => TResult2 | PromiseLike<TResult2>)
      | null,
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled ?? undefined, onrejected ?? undefined);
  }
}

class LocalAuth {
  private listeners = new Set<AuthListener>();

  private notify(event: AuthChangeEvent, session: AuthSession | null) {
    for (const listener of this.listeners) listener(event, session);
  }

  onAuthStateChange(listener: AuthListener) {
    this.listeners.add(listener);
    return {
      data: {
        subscription: {
          unsubscribe: () => {
            this.listeners.delete(listener);
          },
        },
      },
    };
  }

  async getSession() {
    return { data: { session: readSession() }, error: null };
  }

  async signInWithPassword(input: { email: string; password: string }) {
    const response = await postJson<{ user: AuthUser; session: AuthSession }>("/auth/sign-in", input);
    if (response.error) {
      return { data: { user: null, session: null }, error: response.error };
    }

    const session = response.data?.session ?? null;
    writeSession(session);
    this.notify("SIGNED_IN", session);

    return {
      data: {
        user: response.data?.user ?? null,
        session,
      },
      error: null,
    };
  }

  async signOut() {
    await postJson<null>("/auth/sign-out", {});
    writeSession(null);
    this.notify("SIGNED_OUT", null);
    return { error: null };
  }

  async updateUser(input: { password: string }) {
    const session = readSession();
    if (!session?.user?.id) {
      return { data: null, error: { message: "Not authenticated" } };
    }

    const response = await postJson<null>("/auth/update-password", {
      userId: session.user.id,
      password: input.password,
    });
    if (response.error) return { data: null, error: response.error };

    this.notify("USER_UPDATED", session);
    return { data: { user: session.user }, error: null };
  }
}

const auth = new LocalAuth();

export const supabase = {
  from<T = any>(table: string) {
    return new LocalQueryBuilder<T>(table);
  },

  auth,

  async rpc(name: string, args?: Record<string, unknown>) {
    const response = await postJson<null>(`/rpc/${name}`, args || {});
    return { data: response.data, error: response.error };
  },

  functions: {
    async invoke(name: string, input?: { body?: Record<string, unknown> }) {
      const response = await postJson<any>(`/functions/${name}`, input?.body || {});
      return { data: response.data, error: response.error };
    },
  },
};
