import { Reserva, SedeHabitacion, SedeTipologia } from '../../../shared/domain/hostal.model';
import { Tarifa, TarifaPeriodo } from '../../locations/domain/tarifas.repository';

/** Huésped mínimo necesario para identificar al cliente de una transacción. */
export interface ClienteTransaccion {
  id: number;
  nombres: string;
  apellidos: string;
  rutPasaporte?: string;
  email?: string;
}

/** IVA Chile: los precios de tarifa se informan con IVA incluido. */
export const IVA = 0.19;
const MAX_NOCHES = 366;

export type TipoTarifaAplicada = 'ALTA' | 'BAJA' | 'BASE';
export type TipoTarifaFiltro = 'TODAS' | 'ALTA' | 'BAJA' | 'PROMOCIONAL' | 'BASE';
export type MetodoPagoFiltro = 'TODOS' | 'transferencia' | 'efectivo' | 'sin-registro';
export type EstadoPagoTransaccion = 'PAGADO' | 'ABONADO' | 'PENDIENTE' | 'ANULADO';
export type DatePreset = 'mes-actual' | 'mes-anterior' | 'trimestre' | 'ultimos-30' | 'anio' | 'personalizado';

export interface NocheTarifada {
  fecha: string;
  precio: number;
  tarifa: string;
  tipo: TipoTarifaAplicada;
}

/** Cobro de una reserva valorizado con las tarifas configuradas de la sede. */
export interface TransaccionTarifa {
  id: string;
  reservaId: number;
  reservaCodigo: string;
  /** Nombre de la sede; se completa al combinar varias sedes. */
  sede?: string;
  huesped: string;
  huespedDocumento: string;
  habitacion: string;
  tipologiaId: number | null;
  tipologia: string;
  tipologiaColor: string;
  llegada: string;
  salida: string;
  noches: number;
  personas: number;
  tarifaNombre: string;
  tipoTarifa: TipoTarifaAplicada;
  esPromocional: boolean;
  tarifaNocheBase: number;
  subtotalTarifa: number;
  ajuste: number;
  total: number;
  totalEstimado: boolean;
  netoSinIva: number;
  ivaIncluido: number;
  porcentajeAbono: number;
  abonoInicial: number;
  pagado: number;
  saldo: number;
  metodoPago: 'transferencia' | 'efectivo' | null;
  estadoPago: EstadoPagoTransaccion;
  estadoReserva: Reserva['estado_reserva'];
  nochesDetalle: NocheTarifada[];
  busquedaIndex: string;
}

export interface KpisPeriodo {
  reservas: number;
  reservasValidas: number;
  canceladas: number;
  ingresos: number;
  cobrado: number;
  pendiente: number;
  nochesVendidas: number;
  nochesOcupadas: number;
  capacidad: number;
  ocupacion: number;
  tasaCancelacion: number;
  tarifaPromedio: number;
}

export interface RankingItem {
  clave: string;
  nombre: string;
  color: string;
  reservas: number;
  noches: number;
  ingresos: number;
  participacion: number;
  etiqueta?: string;
}

export const EMPTY_KPIS: KpisPeriodo = {
  reservas: 0, reservasValidas: 0, canceladas: 0, ingresos: 0, cobrado: 0, pendiente: 0,
  nochesVendidas: 0, nochesOcupadas: 0, capacidad: 0, ocupacion: 0, tasaCancelacion: 0, tarifaPromedio: 0,
};

export const DATE_PRESETS: { value: Exclude<DatePreset, 'personalizado'>; label: string }[] = [
  { value: 'mes-actual', label: 'Mes actual' },
  { value: 'mes-anterior', label: 'Mes anterior' },
  { value: 'trimestre', label: 'Trimestre' },
  { value: 'ultimos-30', label: 'Últimos 30 días' },
  { value: 'anio', label: 'Año' },
];

export const TIPO_TARIFA_LABELS: Record<TipoTarifaAplicada, string> = {
  ALTA: 'Temporada alta',
  BAJA: 'Temporada baja',
  BASE: 'Precio base',
};

export const ESTADO_PAGO_LABELS: Record<EstadoPagoTransaccion, string> = {
  PAGADO: 'Pagado',
  ABONADO: 'Abonado',
  PENDIENTE: 'Pendiente',
  ANULADO: 'Anulado',
};

export const METODO_PAGO_LABELS: Record<'transferencia' | 'efectivo' | 'sin-registro', string> = {
  transferencia: 'Transferencia',
  efectivo: 'Efectivo',
  'sin-registro': 'Sin registrar',
};

const SEASON_COLORS: Record<TipoTarifaAplicada, string> = { ALTA: '#ea580c', BAJA: '#0891b2', BASE: '#64748b' };
const METODO_PAGO_COLORS: Record<'transferencia' | 'efectivo' | 'sin-registro', string> = {
  transferencia: '#2563eb',
  efectivo: '#16a34a',
  'sin-registro': '#94a3b8',
};

// ----- Fechas ---------------------------------------------------------------

export function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function parseDateKey(value: string): Date {
  return new Date(`${value}T00:00:00`);
}

export function shiftDateKey(value: string, days: number): string {
  const date = parseDateKey(value);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
}

export function daysInclusive(inicio: string, fin: string): number {
  return Math.max(0, Math.round((parseDateKey(fin).getTime() - parseDateKey(inicio).getTime()) / 86_400_000) + 1);
}

export function presetRange(preset: Exclude<DatePreset, 'personalizado'>, ref = new Date()): { inicio: string; fin: string } {
  const year = ref.getFullYear();
  const month = ref.getMonth();
  switch (preset) {
    case 'mes-actual': return { inicio: toDateKey(new Date(year, month, 1)), fin: toDateKey(new Date(year, month + 1, 0)) };
    case 'mes-anterior': return { inicio: toDateKey(new Date(year, month - 1, 1)), fin: toDateKey(new Date(year, month, 0)) };
    case 'trimestre': {
      const start = Math.floor(month / 3) * 3;
      return { inicio: toDateKey(new Date(year, start, 1)), fin: toDateKey(new Date(year, start + 3, 0)) };
    }
    case 'ultimos-30': return { inicio: toDateKey(new Date(year, month, ref.getDate() - 29)), fin: toDateKey(ref) };
    case 'anio': return { inicio: `${year}-01-01`, fin: `${year}-12-31` };
  }
}

export function normalizeText(value: string): string {
  return value.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// ----- Tarifas --------------------------------------------------------------

/** Misma regla que la página de Tarifas: ¿el periodo cubre esta fecha? */
export function periodoCubreFecha(periodo: TarifaPeriodo, date: Date): boolean {
  const key = toDateKey(date);
  switch (periodo.tipo) {
    case 'months': return periodo.meses.includes(date.getMonth());
    case 'weekdays': return periodo.diasSemana.includes((date.getDay() + 6) % 7);
    case 'month-days': return periodo.diasMes.includes(date.getDate());
    case 'specific-month-days': return periodo.anio === date.getFullYear()
      && periodo.mes === date.getMonth()
      && periodo.diasMes.includes(date.getDate());
    case 'date-range': return key >= periodo.fechaInicio && key <= periodo.fechaFin;
    case 'specific-dates': return periodo.fechas.includes(key);
  }
}

export function precioTarifa(tarifa: Tarifa, tipologia: SedeTipologia): number {
  return Object.prototype.hasOwnProperty.call(tarifa.precios, tipologia.id)
    ? tarifa.precios[tipologia.id]
    : tipologia.precioBase ?? 0;
}

/** Igual que en Tarifas: si varias tarifas activas coinciden, se aplica la de mayor precio para la tipología. */
export function tarifaAplicada(tarifas: Tarifa[], tipologia: SedeTipologia, date: Date): Tarifa | undefined {
  return tarifas
    .filter((tarifa) => tarifa.activa && tarifa.periodos.some((periodo) => periodoCubreFecha(periodo, date)))
    .reduce<Tarifa | undefined>((best, tarifa) =>
      !best || precioTarifa(tarifa, tipologia) > precioTarifa(best, tipologia) ? tarifa : best, undefined);
}

// ----- Transacciones ----------------------------------------------------------

export interface ContextoTransacciones {
  tarifas: Tarifa[];
  tipologias: SedeTipologia[];
  habitaciones: SedeHabitacion[];
  clientes: ClienteTransaccion[];
  abonoPorDefecto: number;
}

export function buildTransacciones(reservas: Reserva[], ctx: ContextoTransacciones): TransaccionTarifa[] {
  const rooms = new Map(ctx.habitaciones.map((room) => [room.id, room]));
  const clients = new Map(ctx.clientes.map((client) => [client.id, client]));
  return reservas.map((reserva) => buildTransaccion(reserva, ctx, rooms, clients));
}

function buildTransaccion(
  reserva: Reserva,
  ctx: ContextoTransacciones,
  rooms: Map<number, SedeHabitacion>,
  clients: Map<number, ClienteTransaccion>,
): TransaccionTarifa {
  const room = rooms.get(reserva.id_habitacion);
  const tipologia = ctx.tipologias.find((item) => item.id === room?.tipologiaId)
    ?? ctx.tipologias.find((item) => item.nombre === room?.tipo);
  const client = clients.get(reserva.id_huesped);

  const nochesDetalle: NocheTarifada[] = [];
  const porTarifa = new Map<string, { tipo: TipoTarifaAplicada; noches: number }>();
  if (reserva.fecha_llegada && reserva.fecha_salida && reserva.fecha_salida > reserva.fecha_llegada) {
    const date = parseDateKey(reserva.fecha_llegada);
    const end = parseDateKey(reserva.fecha_salida);
    for (let guard = 0; date < end && guard < MAX_NOCHES; guard++) {
      const aplicada = tipologia ? tarifaAplicada(ctx.tarifas, tipologia, date) : undefined;
      const precio = aplicada && tipologia ? precioTarifa(aplicada, tipologia) : tipologia?.precioBase ?? 0;
      const nombre = aplicada?.nombre ?? 'Precio base';
      const tipo: TipoTarifaAplicada = aplicada?.tipoTemporada ?? 'BASE';
      nochesDetalle.push({ fecha: toDateKey(date), precio, tarifa: nombre, tipo });
      porTarifa.set(nombre, { tipo, noches: (porTarifa.get(nombre)?.noches ?? 0) + 1 });
      date.setDate(date.getDate() + 1);
    }
  }

  const noches = nochesDetalle.length;
  const subtotalTarifa = nochesDetalle.reduce((sum, night) => sum + night.precio, 0);
  const totalEstimado = typeof reserva.precio_total !== 'number';
  const total = totalEstimado ? subtotalTarifa : reserva.precio_total!;
  const [tarifaNombre, predominante] = [...porTarifa.entries()]
    .sort((a, b) => b[1].noches - a[1].noches)[0] ?? ['Precio base', { tipo: 'BASE' as const, noches: 0 }];
  const porcentajeAbono = reserva.porcentaje_abono ?? ctx.abonoPorDefecto;
  const pagado = reserva.pago_completo ? Math.max(total, reserva.monto_pagado ?? 0) : reserva.monto_pagado ?? 0;
  const anulada = reserva.estado_reserva === 'CANCELADA';
  const saldo = anulada ? 0 : Math.max(total - pagado, 0);
  const ajuste = total - subtotalTarifa;
  const estadoPago: EstadoPagoTransaccion = anulada
    ? 'ANULADO'
    : reserva.pago_completo || (total > 0 && saldo === 0) ? 'PAGADO' : pagado > 0 ? 'ABONADO' : 'PENDIENTE';
  const huesped = client ? `${client.nombres} ${client.apellidos}`.trim() : `Huésped #${reserva.id_huesped}`;
  const id = `TRX-${String(reserva.id_reserva).padStart(5, '0')}`;
  const reservaCodigo = `R-${String(reserva.id_reserva).padStart(4, '0')}`;
  const neto = Math.round(total / (1 + IVA));

  return {
    id,
    reservaId: reserva.id_reserva,
    reservaCodigo,
    huesped,
    huespedDocumento: client?.rutPasaporte ?? '',
    habitacion: room?.numero ?? `#${reserva.id_habitacion}`,
    tipologiaId: tipologia?.id ?? null,
    tipologia: tipologia?.nombre ?? room?.tipo ?? 'Sin tipología',
    tipologiaColor: tipologia?.color ?? '#64748b',
    llegada: reserva.fecha_llegada,
    salida: reserva.fecha_salida,
    noches,
    personas: reserva.cantidad_personas ?? 1,
    tarifaNombre,
    tipoTarifa: predominante.tipo,
    esPromocional: !totalEstimado && subtotalTarifa > 0 && ajuste < 0,
    tarifaNocheBase: noches ? subtotalTarifa / noches : 0,
    subtotalTarifa,
    ajuste,
    total,
    totalEstimado,
    netoSinIva: neto,
    ivaIncluido: total - neto,
    porcentajeAbono,
    abonoInicial: Math.round(total * porcentajeAbono / 100),
    pagado,
    saldo,
    metodoPago: reserva.metodo_pago ?? null,
    estadoPago,
    estadoReserva: reserva.estado_reserva,
    nochesDetalle,
    busquedaIndex: normalizeText([
      id, reservaCodigo, String(reserva.id_reserva), huesped, client?.rutPasaporte ?? '', client?.email ?? '',
    ].join(' ')),
  };
}

// ----- RF-12: KPIs del período ----------------------------------------------------

/**
 * Reservas, ingresos y cancelaciones se cuentan por fecha de llegada dentro del período.
 * La ocupación considera cada noche ocupada dentro del período (aunque la llegada sea anterior).
 */
export function calcularKpis(transacciones: TransaccionTarifa[], inicio: string, fin: string, totalHabitaciones: number): KpisPeriodo {
  const enPeriodo = transacciones.filter((trx) => trx.llegada >= inicio && trx.llegada <= fin);
  const validas = enPeriodo.filter((trx) => trx.estadoReserva !== 'CANCELADA');
  const ingresos = validas.reduce((sum, trx) => sum + trx.total, 0);
  const nochesVendidas = validas.reduce((sum, trx) => sum + trx.noches, 0);
  const nochesOcupadas = transacciones
    .filter((trx) => trx.estadoReserva !== 'CANCELADA' && trx.llegada <= fin && trx.salida > inicio)
    .reduce((sum, trx) => sum + trx.nochesDetalle.filter((night) => night.fecha >= inicio && night.fecha <= fin).length, 0);
  const capacidad = totalHabitaciones * daysInclusive(inicio, fin);
  const canceladas = enPeriodo.length - validas.length;
  return {
    reservas: enPeriodo.length,
    reservasValidas: validas.length,
    canceladas,
    ingresos,
    cobrado: validas.reduce((sum, trx) => sum + trx.pagado, 0),
    pendiente: validas.reduce((sum, trx) => sum + trx.saldo, 0),
    nochesVendidas,
    nochesOcupadas,
    capacidad,
    ocupacion: capacidad ? Math.min(100, (nochesOcupadas / capacidad) * 100) : 0,
    tasaCancelacion: enPeriodo.length ? (canceladas / enPeriodo.length) * 100 : 0,
    tarifaPromedio: nochesVendidas ? ingresos / nochesVendidas : 0,
  };
}

// ----- RF-13: rankings ------------------------------------------------------------

/**
 * Ranking de tipologías. Con `agruparPorNombre` (vista global) las tipologías
 * de distintas sedes que se llaman igual se suman en una sola fila.
 */
export function rankingTipologias(
  transacciones: TransaccionTarifa[],
  tipologias: SedeTipologia[],
  opciones: { agruparPorNombre?: boolean } = {},
): RankingItem[] {
  const keyOf = (id: number | null, nombre: string) => opciones.agruparPorNombre
    ? `nombre-${normalizeText(nombre)}`
    : id !== null ? String(id) : `sin-${nombre}`;
  const ranking = new Map<string, RankingItem>();
  for (const tipologia of tipologias) {
    const key = keyOf(tipologia.id, tipologia.nombre);
    if (!ranking.has(key)) {
      ranking.set(key, {
        clave: key, nombre: tipologia.nombre, color: tipologia.color ?? '#64748b',
        reservas: 0, noches: 0, ingresos: 0, participacion: 0,
      });
    }
  }
  const validas = transacciones.filter((trx) => trx.estadoReserva !== 'CANCELADA');
  for (const trx of validas) {
    const key = keyOf(trx.tipologiaId, trx.tipologia);
    const item = ranking.get(key) ?? {
      clave: key, nombre: trx.tipologia, color: trx.tipologiaColor, reservas: 0, noches: 0, ingresos: 0, participacion: 0,
    };
    item.reservas += 1;
    item.noches += trx.noches;
    item.ingresos += trx.total;
    ranking.set(key, item);
  }
  return conParticipacion([...ranking.values()], validas.length);
}

export function rankingTarifas(transacciones: TransaccionTarifa[]): RankingItem[] {
  const ranking = new Map<string, RankingItem>();
  const validas = transacciones.filter((trx) => trx.estadoReserva !== 'CANCELADA');
  for (const trx of validas) {
    const item = ranking.get(trx.tarifaNombre) ?? {
      clave: trx.tarifaNombre, nombre: trx.tarifaNombre, color: SEASON_COLORS[trx.tipoTarifa],
      reservas: 0, noches: 0, ingresos: 0, participacion: 0, etiqueta: TIPO_TARIFA_LABELS[trx.tipoTarifa],
    };
    item.reservas += 1;
    item.noches += trx.noches;
    item.ingresos += trx.total;
    ranking.set(trx.tarifaNombre, item);
  }
  return conParticipacion([...ranking.values()], validas.length);
}

export function rankingMetodosPago(transacciones: TransaccionTarifa[]): RankingItem[] {
  const ranking = new Map<string, RankingItem>();
  const validas = transacciones.filter((trx) => trx.estadoReserva !== 'CANCELADA');
  for (const trx of validas) {
    const key = trx.metodoPago ?? 'sin-registro';
    const item = ranking.get(key) ?? {
      clave: key, nombre: METODO_PAGO_LABELS[key], color: METODO_PAGO_COLORS[key],
      reservas: 0, noches: 0, ingresos: 0, participacion: 0,
    };
    item.reservas += 1;
    item.noches += trx.noches;
    item.ingresos += trx.pagado;
    ranking.set(key, item);
  }
  return conParticipacion([...ranking.values()], validas.length);
}

function conParticipacion(items: RankingItem[], total: number): RankingItem[] {
  return items
    .map((item) => ({ ...item, participacion: total ? (item.reservas / total) * 100 : 0 }))
    .sort((a, b) => b.reservas - a.reservas || b.ingresos - a.ingresos || a.nombre.localeCompare(b.nombre));
}

// ----- Filtros y exportación ------------------------------------------------------

export function filtrarTransacciones(
  transacciones: TransaccionTarifa[],
  filtros: { tipo: TipoTarifaFiltro; metodo: MetodoPagoFiltro; busqueda: string },
): TransaccionTarifa[] {
  const query = normalizeText(filtros.busqueda.trim());
  return transacciones
    .filter((trx) => filtros.tipo === 'TODAS' || (filtros.tipo === 'PROMOCIONAL' ? trx.esPromocional : trx.tipoTarifa === filtros.tipo))
    .filter((trx) => filtros.metodo === 'TODOS'
      || (filtros.metodo === 'sin-registro' ? trx.metodoPago === null : trx.metodoPago === filtros.metodo))
    .filter((trx) => !query || trx.busquedaIndex.includes(query))
    .sort((a, b) => b.llegada.localeCompare(a.llegada) || b.reservaId - a.reservaId);
}

export function transaccionesToCsv(transacciones: TransaccionTarifa[]): string {
  const header = [
    'ID Transacción', 'Sede', 'Reserva', 'Huésped', 'Documento', 'Habitación', 'Tipología', 'Llegada', 'Salida', 'Noches',
    'Tarifa', 'Tipo tarifa', 'Tarifa promedio noche', 'Subtotal tarifa', 'Ajuste', 'Total', 'IVA incluido',
    'Abono inicial', 'Pagado', 'Saldo', 'Método de pago', 'Estado pago', 'Estado reserva',
  ];
  const rows = transacciones.map((trx) => [
    trx.id, trx.sede ?? '', trx.reservaCodigo, trx.huesped, trx.huespedDocumento, trx.habitacion, trx.tipologia, trx.llegada, trx.salida,
    trx.noches, trx.tarifaNombre, TIPO_TARIFA_LABELS[trx.tipoTarifa], Math.round(trx.tarifaNocheBase), trx.subtotalTarifa,
    trx.ajuste, trx.total, trx.ivaIncluido, trx.abonoInicial, trx.pagado, trx.saldo,
    METODO_PAGO_LABELS[trx.metodoPago ?? 'sin-registro'], ESTADO_PAGO_LABELS[trx.estadoPago], trx.estadoReserva,
  ]);
  const escape = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  return [header, ...rows].map((row) => row.map(escape).join(';')).join('\r\n');
}
