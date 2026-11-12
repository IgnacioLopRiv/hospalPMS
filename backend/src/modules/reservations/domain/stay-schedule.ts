/**
 * Reglas de calendario de una estadía – Domain layer (sin dependencias de framework).
 *
 * Una estadía ocupa la habitación desde (fecha de llegada + hora de llegada) hasta
 * (fecha de salida + hora de salida). Las horas son de reloj local del hostal; para
 * compararlas se convierten a minutos en una línea de tiempo común.
 */

/**
 * Días después de la salida de una reserva activa en los que nadie más puede
 * reservar la habitación, para que esa misma reserva pueda extender su estadía.
 * El margen se libera cuando la reserva finaliza o se cancela.
 */
export const CHECKOUT_MARGIN_DAYS = 2;

/** Horas por defecto si ni la reserva ni la sede las definen (mismos defaults que sede en la BD). */
export const DEFAULT_ARRIVAL_TIME = '15:00';
export const DEFAULT_DEPARTURE_TIME = '12:00';

/** Horas a usar cuando una reserva no trae hora de llegada/salida (normalmente las de la sede). */
export interface StayTimeDefaults {
  arrivalTime: string;
  departureTime: string;
}

const MINUTES_PER_DAY = 24 * 60;

/**
 * Intervalo [start, end) en minutos de la línea de tiempo local.
 * blockedUntil: fin del margen de extensión (00:00 del día de salida + CHECKOUT_MARGIN_DAYS),
 * igual que la regla por días que ya existía: si sale el día 8, se puede llegar desde el día 10.
 */
export interface StayInterval {
  start: number;
  end: number;
  blockedUntil: number;
}

/** Convierte fecha 'YYYY-MM-DD' + hora 'HH:MM' en minutos (reloj local, sin zona horaria). */
export function toTimelineMinutes(dateKey: string, time: string): number {
  const [year, month, day] = dateKey.split('-').map(Number);
  const [hours, minutes] = time.split(':').map(Number);
  return Date.UTC(year, month - 1, day, hours, minutes) / 60_000;
}

export function stayInterval(
  arrivalDate: string,
  arrivalTime: string | null | undefined,
  departureDate: string,
  departureTime: string | null | undefined,
  defaults: StayTimeDefaults = {
    arrivalTime: DEFAULT_ARRIVAL_TIME,
    departureTime: DEFAULT_DEPARTURE_TIME,
  },
): StayInterval {
  const end = toTimelineMinutes(departureDate, departureTime || defaults.departureTime);
  const marginEnd =
    toTimelineMinutes(departureDate, '00:00') + CHECKOUT_MARGIN_DAYS * MINUTES_PER_DAY;
  return {
    start: toTimelineMinutes(arrivalDate, arrivalTime || defaults.arrivalTime),
    end,
    blockedUntil: Math.max(end, marginEnd),
  };
}

/** Dos estadías se cruzan si comparten algún minuto (una puede empezar justo cuando termina la otra). */
export function staysOverlap(a: StayInterval, b: StayInterval): boolean {
  return a.start < b.end && b.start < a.end;
}

/**
 * Para la misma habitación: además del cruce directo, ninguna estadía puede empezar
 * dentro del margen de extensión posterior a la salida de la otra.
 */
export function staysConflictWithMargin(a: StayInterval, b: StayInterval): boolean {
  return a.start < b.blockedUntil && b.start < a.blockedUntil;
}
