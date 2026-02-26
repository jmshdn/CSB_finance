/** Currency and number formatting utilities */

const SERVER_OFFSET_MS = 9 * 60 * 60 * 1000;
const pad2 = (n: number) => String(n).padStart(2, "0");

export function formatCurrency(amount: number): string {
  const abs = Math.abs(amount);
  const formatted = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(abs);
  return amount < 0 ? `(${formatted})` : formatted;
}

export function formatCurrencyShort(amount: number): string {
  const abs = Math.abs(amount);
  if (abs >= 1000) {
    return (amount < 0 ? "-" : "") + "$" + (abs / 1000).toFixed(1) + "k";
  }
  return formatCurrency(amount);
}

export function fmt(n: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function fmtRound(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

export function pct(n: number): string {
  return `${(n * 100).toFixed(0)}%`;
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "-";

  if (typeof value === "string") {
    if (/^\d{4}-\d{2}-\d{2}\/\d{2}:\d{2}:\d{2}$/.test(value)) return value;
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return `${value}/00:00:00`;
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  // Keep one global time system for UI display: GMT+9 (server time).
  const serverTime = new Date(date.getTime() + SERVER_OFFSET_MS);
  return `${serverTime.getUTCFullYear()}-${pad2(serverTime.getUTCMonth() + 1)}-${pad2(serverTime.getUTCDate())}/${pad2(
    serverTime.getUTCHours(),
  )}:${pad2(serverTime.getUTCMinutes())}:${pad2(serverTime.getUTCSeconds())}`;
}

export function formatDateOnly(value: string | Date | null | undefined): string {
  if (!value) return "-";
  if (typeof value === "string") {
    if (/^\d{4}-\d{2}-\d{2}(\/\d{2}:\d{2}:\d{2})?$/.test(value)) return value.slice(0, 10);
  }
  return formatDateTime(value).slice(0, 10);
}

export function toSortTimestamp(value: string | Date | null | undefined): number {
  if (!value) return 0;

  if (value instanceof Date) {
    const ts = value.getTime();
    return Number.isNaN(ts) ? 0 : ts;
  }

  if (typeof value === "string") {
    if (/^\d{4}-\d{2}-\d{2}\/\d{2}:\d{2}:\d{2}$/.test(value)) {
      const ts = new Date(value.replace("/", "T") + "+09:00").getTime();
      return Number.isNaN(ts) ? 0 : ts;
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const ts = new Date(value + "T00:00:00+09:00").getTime();
      return Number.isNaN(ts) ? 0 : ts;
    }
  }

  const ts = new Date(value).getTime();
  return Number.isNaN(ts) ? 0 : ts;
}

export function getServerDateOnlyNow(): string {
  const now = new Date();
  const serverTime = new Date(now.getTime() + SERVER_OFFSET_MS);
  return `${serverTime.getUTCFullYear()}-${pad2(serverTime.getUTCMonth() + 1)}-${pad2(serverTime.getUTCDate())}`;
}
