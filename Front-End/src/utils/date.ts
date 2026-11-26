import type { Locale } from "@/i18n/LocaleContext";

/** "YYYY-MM-DD" for a Date, using the phone's local calendar day (not UTC —
 * toISOString() rolls back a day before 07:00 in Vietnam, UTC+7). */
export function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Parses "YYYY-MM-DD" as a local date (new Date("YYYY-MM-DD") is UTC). */
export function fromIsoDate(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

/** Display format shared by every screen: 22/10/2026 (vi) · Oct 22, 2026 (en).
 * Accepts a bare "YYYY-MM-DD" date or a full ISO timestamp. */
export function formatDate(value: string | null | undefined, locale: Locale): string {
  if (!value) return "—";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? fromIsoDate(value) : new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return locale === "vi"
    ? date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" })
    : date.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
}

export function formatDateRange(start: string, end: string, locale: Locale): string {
  return `${formatDate(start, locale)} – ${formatDate(end, locale)}`;
}
