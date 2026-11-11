import {
  agruparSerie,
  calcularEstadisticas,
  periodoAnterior,
  ReservaReporte,
  variacion,
} from './reporte-estadisticas';

const d = (y: number, m: number, day: number, h = 0) =>
  new Date(y, m - 1, day, h);

describe('reporte-estadisticas', () => {
  const periodo = { desde: d(2026, 11, 1), hasta: d(2026, 11, 11) }; // 10 días

  it('calcula ingresos netos desde los pagos y descuenta reembolsos', () => {
    const stats = calcularEstadisticas(periodo, {
      habitaciones: 2,
      reservas: [],
      pagos: [
        {
          monto: 50_000,
          tipoOperacion: 'ABONO',
          fechaPago: d(2026, 11, 2, 10),
        },
        {
          monto: 100_000,
          tipoOperacion: 'PAGO_FINAL',
          fechaPago: d(2026, 11, 5, 18),
        },
        {
          monto: 20_000,
          tipoOperacion: 'REEMBOLSO',
          fechaPago: d(2026, 11, 5, 19),
        },
        {
          monto: 999_999,
          tipoOperacion: 'PAGO_FINAL',
          fechaPago: d(2026, 11, 11, 0),
        }, // fuera
      ],
    });
    expect(stats.ingresosBrutos).toBe(150_000);
    expect(stats.reembolsos).toBe(20_000);
    expect(stats.ingresosNetos).toBe(130_000);
    expect(stats.cantidadPagos).toBe(3);
    expect(stats.ingresosDiarios[1].valor).toBe(50_000);
    expect(stats.ingresosDiarios[4].valor).toBe(80_000);
  });

  it('cuenta noches ocupadas recortadas al periodo y prorratea el ADR', () => {
    const reservas: ReservaReporte[] = [
      // 4 noches, 2 dentro del periodo (1 y 2 nov)
      {
        habitacionId: 1,
        fechaCheckIn: d(2026, 10, 30, 15),
        fechaCheckOut: d(2026, 11, 3, 12),
        precioTotal: 400_000,
        estado: 'FINALIZADA',
      },
      // 3 noches dentro (5, 6, 7 nov)
      {
        habitacionId: 2,
        fechaCheckIn: d(2026, 11, 5, 15),
        fechaCheckOut: d(2026, 11, 8, 12),
        precioTotal: 300_000,
        estado: 'EN_CURSO',
      },
      // cancelada: no ocupa
      {
        habitacionId: 1,
        fechaCheckIn: d(2026, 11, 6),
        fechaCheckOut: d(2026, 11, 9),
        precioTotal: 300_000,
        estado: 'CANCELADA',
      },
    ];
    const stats = calcularEstadisticas(periodo, {
      habitaciones: 2,
      reservas,
      pagos: [],
    });
    expect(stats.nochesDisponibles).toBe(20);
    expect(stats.nochesVendidas).toBe(5);
    expect(stats.ocupacion).toBeCloseTo(25);
    expect(stats.ingresoAlojamiento).toBeCloseTo(200_000 + 300_000);
    expect(stats.adr).toBeCloseTo(100_000);
    expect(stats.revpar).toBeCloseTo(25_000);
    expect(stats.ocupacionDiaria[0].valor).toBe(50);
    expect(stats.ocupacionDiaria[3].valor).toBe(0);
    // Llegadas en el periodo: la de habitación 2 y la cancelada
    expect(stats.reservas).toBe(2);
    expect(stats.cancelaciones).toBe(1);
    expect(stats.tasaCancelacion).toBe(50);
    expect(stats.estadiaPromedio).toBe(3);
  });

  it('no cuenta dos veces la misma habitación en una noche', () => {
    const reservas: ReservaReporte[] = [
      {
        habitacionId: 1,
        fechaCheckIn: d(2026, 11, 1),
        fechaCheckOut: d(2026, 11, 2),
        precioTotal: 1,
        estado: 'FINALIZADA',
      },
      {
        habitacionId: 1,
        fechaCheckIn: d(2026, 11, 1),
        fechaCheckOut: d(2026, 11, 2),
        precioTotal: 1,
        estado: 'FINALIZADA',
      },
    ];
    const stats = calcularEstadisticas(periodo, {
      habitaciones: 1,
      reservas,
      pagos: [],
    });
    expect(stats.nochesVendidas).toBe(1);
  });

  it('el periodo anterior tiene la misma duración', () => {
    const anterior = periodoAnterior(periodo);
    expect(anterior.desde).toEqual(d(2026, 10, 22));
    expect(anterior.hasta).toEqual(periodo.desde);
  });

  it('agrupa series por semana y por mes', () => {
    const serie = Array.from({ length: 10 }, (_, i) => ({
      fecha: d(2026, 11, 1 + i),
      valor: 10,
    }));
    expect(agruparSerie(serie, 'semana', 'suma').map((p) => p.valor)).toEqual([
      70, 30,
    ]);
    expect(
      agruparSerie(serie, 'semana', 'promedio').map((p) => p.valor),
    ).toEqual([10, 10]);
    const cruzaMes = Array.from({ length: 5 }, (_, i) => ({
      fecha: d(2026, 10, 30 + i),
      valor: 1,
    }));
    expect(agruparSerie(cruzaMes, 'mes', 'suma').map((p) => p.valor)).toEqual([
      2, 3,
    ]);
  });

  it('variación sin base devuelve null', () => {
    expect(variacion(10, 0)).toBeNull();
    expect(variacion(0, 0)).toBe(0);
    expect(variacion(150, 100)).toBe(50);
  });
});
