import { Reserva, SedeTipologia } from '../../../shared/domain/hostal.model';
import { Tarifa } from '../../locations/domain/tarifas.repository';
import {
  buildTransacciones,
  calcularKpis,
  filtrarTransacciones,
  presetRange,
  rankingMetodosPago,
  rankingTarifas,
  rankingTipologias,
} from './reporte-transacciones';

describe('reporte-transacciones', () => {
  const tipologias: SedeTipologia[] = [{ id: 1, nombre: 'Doble', capacidad: 2, precioBase: 40000 }];
  const verano: Tarifa = {
    id: 90,
    nombre: 'Verano',
    tipoTemporada: 'ALTA',
    activa: true,
    periodos: [{ id: 'p', tipo: 'months', meses: [0], diasSemana: [], diasMes: [], fechaInicio: '', fechaFin: '', fechas: [] }],
    precios: { 1: 60000 },
  };
  const reservas: Reserva[] = [
    {
      id_reserva: 1, id_huesped: 4, id_habitacion: 10, fecha_llegada: '2026-01-10', fecha_salida: '2026-01-13',
      estado_reserva: 'CONFIRMADA', precio_total: 171000, porcentaje_abono: 20, monto_pagado: 34200, metodo_pago: 'transferencia',
    },
    {
      id_reserva: 2, id_huesped: 5, id_habitacion: 11, fecha_llegada: '2026-01-20', fecha_salida: '2026-01-22',
      estado_reserva: 'FINALIZADA', precio_total: 120000, monto_pagado: 120000, pago_completo: true, metodo_pago: 'efectivo',
    },
    {
      id_reserva: 3, id_huesped: 4, id_habitacion: 10, fecha_llegada: '2026-01-25', fecha_salida: '2026-01-26',
      estado_reserva: 'CANCELADA', precio_total: 60000,
    },
    {
      id_reserva: 4, id_huesped: 4, id_habitacion: 10, fecha_llegada: '2025-12-30', fecha_salida: '2026-01-02',
      estado_reserva: 'FINALIZADA',
    },
  ];
  const transacciones = buildTransacciones(reservas, {
    tarifas: [verano],
    tipologias,
    habitaciones: [
      { id: 10, numero: '101', tipo: 'Doble', tipologiaId: 1, tamanoM2: null, disposicionMuebles: '' },
      { id: 11, numero: '102', tipo: 'Doble', tipologiaId: 1, tamanoM2: null, disposicionMuebles: '' },
    ],
    clientes: [
      { id: 4, nombres: 'Luis', apellidos: 'Soto', rutPasaporte: '22.222.222-2' },
      { id: 5, nombres: 'Ana', apellidos: 'Pérez', rutPasaporte: '11.111.111-1' },
    ],
    abonoPorDefecto: 20,
  });
  const enero = transacciones.filter((trx) => trx.llegada >= '2026-01-01' && trx.llegada <= '2026-01-31');

  it('prices every night with the applicable tariff and derives the payment breakdown', () => {
    const trx = transacciones.find((item) => item.reservaId === 1)!;
    expect(trx.id).toBe('TRX-00001');
    expect(trx.huesped).toBe('Luis Soto');
    expect(trx.noches).toBe(3);
    expect(trx.tarifaNombre).toBe('Verano');
    expect(trx.tipoTarifa).toBe('ALTA');
    expect(trx.tarifaNocheBase).toBe(60000);
    expect(trx.subtotalTarifa).toBe(180000);
    expect(trx.ajuste).toBe(-9000);
    expect(trx.esPromocional).toBeTrue();
    expect(trx.abonoInicial).toBe(34200);
    expect(trx.saldo).toBe(136800);
    expect(trx.estadoPago).toBe('ABONADO');
    expect(trx.netoSinIva + trx.ivaIncluido).toBe(trx.total);

    const mixed = transacciones.find((item) => item.reservaId === 4)!;
    expect(mixed.totalEstimado).toBeTrue();
    expect(mixed.total).toBe(40000 + 40000 + 60000);
    expect(mixed.tipoTarifa).toBe('BASE');

    expect(transacciones.find((item) => item.reservaId === 2)!.estadoPago).toBe('PAGADO');
    expect(transacciones.find((item) => item.reservaId === 3)!.estadoPago).toBe('ANULADO');
  });

  it('computes occupancy, revenue and cancellation rate for a period', () => {
    const kpis = calcularKpis(transacciones, '2026-01-01', '2026-01-31', 2);
    expect(kpis.reservas).toBe(3);
    expect(kpis.canceladas).toBe(1);
    expect(kpis.tasaCancelacion).toBeCloseTo(33.33, 1);
    expect(kpis.ingresos).toBe(291000);
    expect(kpis.nochesVendidas).toBe(5);
    expect(kpis.tarifaPromedio).toBe(58200);
    expect(kpis.nochesOcupadas).toBe(6);
    expect(kpis.capacidad).toBe(62);
    expect(calcularKpis(transacciones, '2025-12-01', '2025-12-31', 2).ingresos).toBe(140000);
  });

  it('ranks the most requested typologies, tariffs and payment methods', () => {
    expect(rankingTipologias(enero, tipologias)[0]).toEqual(jasmine.objectContaining({ nombre: 'Doble', reservas: 2, noches: 5 }));
    expect(rankingTarifas(enero)[0]).toEqual(jasmine.objectContaining({ nombre: 'Verano', reservas: 2 }));
    expect(rankingMetodosPago(enero).map((item) => item.clave).sort()).toEqual(['efectivo', 'transferencia']);
  });

  it('groups typologies with the same name across locations in the global view', () => {
    const otraSede: SedeTipologia[] = [{ id: 7, nombre: 'doble', capacidad: 2, precioBase: 45000 }];
    const deOtraSede = enero.map((trx) => ({ ...trx, id: `${trx.id}-b`, tipologiaId: 7, tipologia: 'doble' }));
    const global = rankingTipologias([...enero, ...deOtraSede], [...tipologias, ...otraSede], { agruparPorNombre: true });
    expect(global.length).toBe(1);
    expect(global[0]).toEqual(jasmine.objectContaining({ nombre: 'Doble', reservas: 4, noches: 10 }));
    expect(rankingTipologias([...enero, ...deOtraSede], [...tipologias, ...otraSede]).length).toBe(2);
  });

  it('filters by tariff type, payment method and accent-insensitive search', () => {
    const base = { tipo: 'TODAS' as const, metodo: 'TODOS' as const, busqueda: '' };
    expect(filtrarTransacciones(enero, { ...base, tipo: 'PROMOCIONAL' }).map((trx) => trx.reservaId)).toEqual([1]);
    expect(filtrarTransacciones(enero, { ...base, metodo: 'efectivo' }).map((trx) => trx.reservaId)).toEqual([2]);
    expect(filtrarTransacciones(enero, { ...base, busqueda: 'perez' }).map((trx) => trx.reservaId)).toEqual([2]);
    expect(filtrarTransacciones(enero, { ...base, busqueda: 'R-0003' }).map((trx) => trx.reservaId)).toEqual([3]);
  });

  it('resolves date presets relative to a reference date', () => {
    const ref = new Date(2026, 10, 9);
    expect(presetRange('mes-anterior', ref)).toEqual({ inicio: '2026-10-01', fin: '2026-10-31' });
    expect(presetRange('trimestre', ref)).toEqual({ inicio: '2026-10-01', fin: '2026-12-31' });
    expect(presetRange('ultimos-30', ref)).toEqual({ inicio: '2026-10-11', fin: '2026-11-09' });
  });
});
