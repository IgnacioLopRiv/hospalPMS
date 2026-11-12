import {
  stayInterval,
  staysConflictWithMargin,
  staysOverlap,
} from './stay-schedule';

describe('stay-schedule (reglas de calendario de estadías)', () => {
  it('permite estadías del mismo día comparando por hora', () => {
    const stay = stayInterval('2026-12-10', '10:00', '2026-12-10', '18:00');
    expect(stay.end - stay.start).toBe(8 * 60);
  });

  it('dos estadías se cruzan solo si comparten algún minuto', () => {
    const morning = stayInterval('2026-12-10', '08:00', '2026-12-10', '12:00');
    const afternoon = stayInterval('2026-12-10', '12:00', '2026-12-10', '18:00');
    const lunch = stayInterval('2026-12-10', '11:00', '2026-12-10', '13:00');

    expect(staysOverlap(morning, afternoon)).toBe(false);
    expect(staysOverlap(morning, lunch)).toBe(true);
  });

  it('mantiene el margen de 2 días por fecha: si sale el día 8, la siguiente puede llegar desde el día 10', () => {
    const existing = stayInterval('2026-12-05', '14:00', '2026-12-08', '12:00');

    expect(
      staysConflictWithMargin(existing, stayInterval('2026-12-09', '23:00', '2026-12-11', '12:00')),
    ).toBe(true);
    expect(
      staysConflictWithMargin(existing, stayInterval('2026-12-10', '00:00', '2026-12-11', '12:00')),
    ).toBe(false);
  });

  it('el margen también bloquea reservas anteriores que terminan cerca de la llegada de otra', () => {
    const existing = stayInterval('2026-12-10', '14:00', '2026-12-12', '12:00');
    const before = stayInterval('2026-12-06', '14:00', '2026-12-09', '12:00');

    expect(staysConflictWithMargin(existing, before)).toBe(true);
  });

  it('sin horas en la reserva usa las de la sede (o 15:00 / 12:00 por defecto)', () => {
    expect(stayInterval('2026-12-10', null, '2026-12-11', null)).toEqual(
      stayInterval('2026-12-10', '15:00', '2026-12-11', '12:00'),
    );
    expect(
      stayInterval('2026-12-10', null, '2026-12-11', null, { arrivalTime: '14:00', departureTime: '11:00' }),
    ).toEqual(stayInterval('2026-12-10', '14:00', '2026-12-11', '11:00'));
  });
});
