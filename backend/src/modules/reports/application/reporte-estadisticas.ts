/**
 * Cálculo puro (sin Prisma) de las estadísticas del reporte de gestión.
 * Las cifras de dinero cobrado salen de la tabla `pago`; la ocupación y las
 * noches salen de `reserva`.
 */

const MS_DAY = 86_400_000;

export type TipoOperacionPago =
  'ABONO' | 'PAGO_FINAL' | 'PAGO_SERVICIO_ADICIONAL' | 'REEMBOLSO';

export type EstadoReservaReporte =
  'CONFIRMADA' | 'EN_CURSO' | 'FINALIZADA' | 'CANCELADA';

export interface PagoReporte {
  monto: number;
  tipoOperacion: TipoOperacionPago;
  fechaPago: Date;
}

export interface ReservaReporte {
  habitacionId: number;
  fechaCheckIn: Date;
  fechaCheckOut: Date;
  precioTotal: number | null;
  estado: EstadoReservaReporte;
}

export interface Periodo {
  /** Inicio inclusivo (medianoche local). */
  desde: Date;
  /** Fin exclusivo (medianoche local del día siguiente al último día). */
  hasta: Date;
}

export interface PuntoSerie {
  /** Fecha de inicio del tramo (medianoche local). */
  fecha: Date;
  valor: number;
}

export interface EstadisticasPeriodo {
  dias: number;
  ingresosBrutos: number;
  reembolsos: number;
  ingresosNetos: number;
  cantidadPagos: number;
  habitaciones: number;
  nochesDisponibles: number;
  nochesVendidas: number;
  /** 0–100 */
  ocupacion: number;
  /** Ingreso por alojamiento devengado (precio de reservas prorrateado por noche). */
  ingresoAlojamiento: number;
  adr: number;
  revpar: number;
  /** Reservas con llegada dentro del periodo (incluye canceladas). */
  reservas: number;
  cancelaciones: number;
  /** 0–100 */
  tasaCancelacion: number;
  estadiaPromedio: number;
  ingresosDiarios: PuntoSerie[];
  ocupacionDiaria: PuntoSerie[];
}

export function inicioDelDia(fecha: Date): Date {
  return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
}

export function sumarDias(fecha: Date, dias: number): Date {
  return new Date(
    fecha.getFullYear(),
    fecha.getMonth(),
    fecha.getDate() + dias,
  );
}

/** Diferencia en días calendario entre dos fechas (robusto ante cambios de horario). */
export function diferenciaDias(desde: Date, hasta: Date): number {
  return Math.round(
    (inicioDelDia(hasta).getTime() - inicioDelDia(desde).getTime()) / MS_DAY,
  );
}

export function claveDia(fecha: Date): string {
  const y = fecha.getFullYear();
  const m = String(fecha.getMonth() + 1).padStart(2, '0');
  const d = String(fecha.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Periodo inmediatamente anterior, con la misma cantidad de días. */
export function periodoAnterior(periodo: Periodo): Periodo {
  const dias = diferenciaDias(periodo.desde, periodo.hasta);
  return { desde: sumarDias(periodo.desde, -dias), hasta: periodo.desde };
}

export function montoNeto(
  pago: Pick<PagoReporte, 'monto' | 'tipoOperacion'>,
): number {
  return pago.tipoOperacion === 'REEMBOLSO' ? -pago.monto : pago.monto;
}

export function calcularEstadisticas(
  periodo: Periodo,
  datos: {
    habitaciones: number;
    reservas: ReservaReporte[];
    pagos: PagoReporte[];
  },
): EstadisticasPeriodo {
  const { desde, hasta } = periodo;
  const dias = Math.max(0, diferenciaDias(desde, hasta));
  const dentro = (fecha: Date) => fecha >= desde && fecha < hasta;

  // ----- Dinero cobrado (tabla pago) -----
  const ingresosDiarios = Array.from({ length: dias }, (_, i) => ({
    fecha: sumarDias(desde, i),
    valor: 0,
  }));
  let ingresosBrutos = 0;
  let reembolsos = 0;
  let cantidadPagos = 0;
  for (const pago of datos.pagos) {
    if (!dentro(pago.fechaPago)) continue;
    cantidadPagos++;
    if (pago.tipoOperacion === 'REEMBOLSO') reembolsos += pago.monto;
    else ingresosBrutos += pago.monto;
    const indice = diferenciaDias(desde, pago.fechaPago);
    if (indice >= 0 && indice < dias)
      ingresosDiarios[indice].valor += montoNeto(pago);
  }

  // ----- Ocupación (tabla reserva) -----
  const habitacionesPorNoche = Array.from(
    { length: dias },
    () => new Set<number>(),
  );
  let ingresoAlojamiento = 0;
  for (const reserva of datos.reservas) {
    if (reserva.estado === 'CANCELADA') continue;
    const llegada = inicioDelDia(reserva.fechaCheckIn);
    const salida = inicioDelDia(reserva.fechaCheckOut);
    const nochesTotales = diferenciaDias(llegada, salida);
    if (nochesTotales <= 0) continue;
    const primera = Math.max(0, diferenciaDias(desde, llegada));
    const ultima = Math.min(dias, diferenciaDias(desde, salida));
    if (ultima <= primera) continue;
    for (let i = primera; i < ultima; i++)
      habitacionesPorNoche[i].add(reserva.habitacionId);
    ingresoAlojamiento +=
      ((reserva.precioTotal ?? 0) * (ultima - primera)) / nochesTotales;
  }
  const nochesVendidas = habitacionesPorNoche.reduce(
    (total, set) => total + set.size,
    0,
  );
  const nochesDisponibles = datos.habitaciones * dias;
  const ocupacionDiaria = habitacionesPorNoche.map((set, i) => ({
    fecha: sumarDias(desde, i),
    valor: datos.habitaciones
      ? (Math.min(set.size, datos.habitaciones) / datos.habitaciones) * 100
      : 0,
  }));

  // ----- Reservas con llegada en el periodo -----
  const llegadas = datos.reservas.filter((reserva) =>
    dentro(reserva.fechaCheckIn),
  );
  const cancelaciones = llegadas.filter(
    (reserva) => reserva.estado === 'CANCELADA',
  ).length;
  const efectivas = llegadas.filter(
    (reserva) => reserva.estado !== 'CANCELADA',
  );
  const nochesEfectivas = efectivas.reduce(
    (total, reserva) =>
      total +
      Math.max(0, diferenciaDias(reserva.fechaCheckIn, reserva.fechaCheckOut)),
    0,
  );

  return {
    dias,
    ingresosBrutos,
    reembolsos,
    ingresosNetos: ingresosBrutos - reembolsos,
    cantidadPagos,
    habitaciones: datos.habitaciones,
    nochesDisponibles,
    nochesVendidas,
    ocupacion: nochesDisponibles
      ? Math.min(100, (nochesVendidas / nochesDisponibles) * 100)
      : 0,
    ingresoAlojamiento,
    adr: nochesVendidas ? ingresoAlojamiento / nochesVendidas : 0,
    revpar: nochesDisponibles ? ingresoAlojamiento / nochesDisponibles : 0,
    reservas: llegadas.length,
    cancelaciones,
    tasaCancelacion: llegadas.length
      ? (cancelaciones / llegadas.length) * 100
      : 0,
    estadiaPromedio: efectivas.length ? nochesEfectivas / efectivas.length : 0,
    ingresosDiarios,
    ocupacionDiaria,
  };
}

export type Agrupacion = 'dia' | 'semana' | 'mes';

export function agrupacionPara(dias: number): Agrupacion {
  if (dias <= 31) return 'dia';
  if (dias <= 120) return 'semana';
  return 'mes';
}

/**
 * Agrupa una serie diaria en tramos. `modo` define cómo combinar los valores:
 * `suma` para dinero, `promedio` para porcentajes.
 */
export function agruparSerie(
  serie: PuntoSerie[],
  agrupacion: Agrupacion,
  modo: 'suma' | 'promedio',
): PuntoSerie[] {
  if (agrupacion === 'dia') return serie.map((punto) => ({ ...punto }));
  const grupos: { fecha: Date; total: number; n: number }[] = [];
  let actual: { fecha: Date; total: number; n: number } | null = null;
  serie.forEach((punto, i) => {
    const nuevo =
      actual === null ||
      (agrupacion === 'semana'
        ? i % 7 === 0
        : punto.fecha.getMonth() !== actual.fecha.getMonth() ||
          punto.fecha.getFullYear() !== actual.fecha.getFullYear());
    if (nuevo) {
      actual = { fecha: punto.fecha, total: 0, n: 0 };
      grupos.push(actual);
    }
    actual!.total += punto.valor;
    actual!.n++;
  });
  return grupos.map((grupo) => ({
    fecha: grupo.fecha,
    valor: modo === 'suma' ? grupo.total : grupo.total / grupo.n,
  }));
}

/** Variación porcentual; `null` cuando no hay base de comparación. */
export function variacion(actual: number, anterior: number): number | null {
  if (!anterior) return actual ? null : 0;
  return ((actual - anterior) / Math.abs(anterior)) * 100;
}
