/** Utilidades de fechas `YYYY-MM-DD` en hora local, usadas por Recepción. */

const DAY_MS = 24 * 60 * 60 * 1000;

export function localDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function todayKey(): string {
  return localDateString(new Date());
}

export function addDays(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T00:00:00`);
  date.setDate(date.getDate() + days);
  return localDateString(date);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
}

/** Noches cobradas; una estadía del mismo día (pocas horas) se cobra como 1 noche mínima. */
export function chargedNights(arrivalDate: string, departureDate: string): number {
  return Math.max(1, daysBetween(arrivalDate, departureDate));
}

/** `YYYY-MM-DD` → `DD/MM`. */
export function formatDayMonth(dateKey: string): string {
  const [, month, day] = dateKey.split('-');
  return `${day}/${month}`;
}

/** Fecha `YYYY-MM-DD` que existe en el calendario. */
export function isValidDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00`);
  return !Number.isNaN(date.getTime()) && localDateString(date) === value;
}
