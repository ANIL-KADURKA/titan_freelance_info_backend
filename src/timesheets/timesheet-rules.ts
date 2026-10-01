import type { PayCurrency, PayUnit } from '@prisma/client';

/** Candidates work in India; "today" is the date in IST. */
const TIME_ZONE = 'Asia/Kolkata';

type QuantityRule = { step: number; max: number; label: string };

/**
 * How much can be logged per day for each pay unit. Weekly, monthly and
 * fixed-project jobs are claimed as a single unit on the day it's done.
 */
export const quantityRules: Record<PayUnit, QuantityRule> = {
  HOUR: { step: 0.25, max: 24, label: 'hours' },
  DAY: { step: 0.5, max: 1, label: 'days' },
  WEEK: { step: 1, max: 1, label: 'weeks' },
  MONTH: { step: 1, max: 1, label: 'months' },
  TASK: { step: 1, max: 1000, label: 'tasks' },
  PROJECT: { step: 1, max: 1, label: 'project' },
};

/** Returns an error message, or null when the quantity is valid. */
export function checkQuantity(unit: PayUnit, quantity: number): string | null {
  const rule = quantityRules[unit];
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return 'Enter how much you worked.';
  }
  if (quantity > rule.max) {
    return `You can log at most ${rule.max} ${rule.label} per day.`;
  }
  // Compare in hundredths to avoid floating-point remainders.
  if (Math.round(quantity * 100) % Math.round(rule.step * 100) !== 0) {
    return `Use steps of ${rule.step} ${rule.label}.`;
  }
  return null;
}

/** YYYY-MM-DD of an instant, in IST. */
export function dateKey(value: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(value);
}

/** Parses YYYY-MM-DD into a UTC-midnight Date (for @db.Date columns). */
export function parseDateKey(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
    ? null
    : date;
}

/** A @db.Date value back to YYYY-MM-DD. */
export function formatDateKey(value: Date): string {
  return value.toISOString().slice(0, 10);
}

/**
 * First loggable day: the selection date. Outside production one extra day
 * earlier is allowed, so a candidate selected today can be tested with
 * yesterday's date.
 */
export function earliestLogDate(
  selectedDate: string,
  isProduction: boolean = process.env.NODE_ENV === 'production',
) {
  if (isProduction) return selectedDate;
  const date = parseDateKey(selectedDate);
  if (!date) return selectedDate;
  date.setUTCDate(date.getUTCDate() - 1);
  return formatDateKey(date);
}

/**
 * Work can be logged from the day the candidate was selected up to today
 * (IST). Returns an error message, or null when the date is allowed.
 */
export function checkWorkDate(
  workDate: string,
  startDate: string,
  today: string = dateKey(),
): string | null {
  if (!parseDateKey(workDate)) return 'Choose a valid date.';
  if (workDate > today) return "You can't log work for a future date.";
  if (workDate < startDate) {
    return `You can log work from ${startDate}, the day you were selected.`;
  }
  return null;
}

/** quantity × rate, rounded to paise/cents. */
export function computeAmount(quantity: number, rate: number) {
  return Math.round(quantity * rate * 100) / 100;
}

export function formatMoney(amount: number, currency: PayCurrency) {
  return new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

export type MoneyTotals = Partial<Record<PayCurrency, number>>;

/** Adds an amount into per-currency totals (never mixes currencies). */
export function addTo(
  totals: MoneyTotals,
  currency: PayCurrency,
  amount: number,
) {
  totals[currency] = Math.round(((totals[currency] ?? 0) + amount) * 100) / 100;
}
