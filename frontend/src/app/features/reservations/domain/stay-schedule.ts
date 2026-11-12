/**
 * Reglas de calendario de una estadía (espejo de backend/src/modules/reservations/domain/stay-schedule.ts).
 *
 * Una estadía ocupa la habitación desde (fecha + hora de llegada) hasta (fecha + hora de salida).
 * Las horas son de reloj local del hostal; para compararlas se llevan a minutos en una línea común.
 */

/**
 * Días después de la salida de una reserva activa en los que nadie más puede reservar
 * la habitación (para permitir extender la estadía). Si sale el día 8, se puede llegar desde el día 10.
 */
export const CHECKOUT_MARGIN_DAYS = 2;

/** Horas por defecto si ni la reserva ni la sede las definen (mismos defaults que la BD). */
export const DEFAULT_ARRIVAL_TIME = '15:00';
export const DEFAULT_DEPARTURE_TIME = '12:00';

const MINUTES_PER_DAY = 24 * 60;

export interface StayTimeDefaults {
  arrivalTime: string;
  departureTime: string;
}

/** Intervalo [start, end) en minutos; blockedUntil es el fin del margen de extensión. */
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
  defaults: StayTimeDefaults = { arrivalTime: DEFAULT_ARRIVAL_TIME, departureTime: DEFAULT_DEPARTURE_TIME },
): StayInterval {
  const end = toTimelineMinutes(departureDate, departureTime || defaults.departureTime);
  const marginEnd = toTimelineMinutes(departureDate, '00:00') + CHECKOUT_MARGIN_DAYS * MINUTES_PER_DAY;
  return {
    start: toTimelineMinutes(arrivalDate, arrivalTime || defaults.arrivalTime),
    end,
    blockedUntil: Math.max(end, marginEnd),
  };
}

/** La salida debe ser posterior a la llegada por fecha y hora (permite estadías del mismo día). */
export function isValidStayRange(stay: StayInterval): boolean {
  return stay.end > stay.start;
}

/** Dos estadías se cruzan si comparten algún minuto (una puede empezar justo cuando termina la otra). */
export function staysOverlap(a: StayInterval, b: StayInterval): boolean {
  return a.start < b.end && b.start < a.end;
}

/** Para la misma habitación: tampoco se puede empezar dentro del margen de extensión de la otra. */
export function staysConflictWithMargin(a: StayInterval, b: StayInterval): boolean {
  return a.start < b.blockedUntil && b.start < a.blockedUntil;
}

/** Estados de habitación que impiden recibir un huésped hoy hasta liberarla. */
export const ROOM_STATES_NOT_READY = ['en aseo', 'ocupada', 'mantenimiento'] as const;

export function isRoomReadyForGuest(estado: string | undefined): boolean {
  return !(ROOM_STATES_NOT_READY as readonly string[]).includes(estado ?? 'libre');
}
