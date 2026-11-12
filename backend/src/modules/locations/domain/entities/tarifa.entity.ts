export type TipoPeriodo =
  | 'months'
  | 'weekdays'
  | 'month-days'
  | 'specific-month-days'
  | 'date-range'
  | 'specific-dates';

export const TIPOS_PERIODO: TipoPeriodo[] = [
  'months',
  'weekdays',
  'month-days',
  'specific-month-days',
  'date-range',
  'specific-dates',
];

/** Periodos con fechas concretas; el resto se repite cada año/semana/mes. */
const TIPOS_PERIODO_ACOTADOS: TipoPeriodo[] = [
  'date-range',
  'specific-dates',
  'specific-month-days',
];

/**
 * Regla de aplicación de una tarifa (meses, días de semana, rango de fechas, etc.).
 * Las fechas se expresan como 'YYYY-MM-DD'; meses 0-11 y días de semana 0-6 (lunes = 0).
 */
export interface TarifaPeriodo {
  id: string;
  tipo: TipoPeriodo;
  meses: number[];
  diasSemana: number[];
  diasMes: number[];
  fechaInicio: string;
  fechaFin: string;
  fechas: string[];
  anio?: number;
  mes?: number;
}

/**
 * Entidad de dominio: Tarifa
 *
 * Temporada de precios de una sede. Define cuándo aplica (periodos) y el precio
 * por noche de cada tipología (precios: tipologiaId → precio). Se cobra con el
 * porcentaje de abono de la TarifaAbono a la que pertenece.
 */
export class Tarifa {
  constructor(
    public readonly id: number,
    public readonly sedeId: number,
    public tarifaAbonoId: number,
    public nombre: string,
    public precioBase: number | null,
    public fechaInicio: Date | null,
    public fechaFin: Date | null,
    public activa: boolean,
    public periodos: TarifaPeriodo[],
    public precios: Record<number, number>,
  ) {}

  /**
   * Vigencia de la tarifa: menor y mayor fecha de sus periodos acotados.
   * Si algún periodo es recurrente (meses, días de semana, días del mes),
   * la tarifa no tiene límite y ambas fechas quedan en null.
   */
  static calcularVigencia(periodos: TarifaPeriodo[]): {
    fechaInicio: Date | null;
    fechaFin: Date | null;
  } {
    const sinLimite = { fechaInicio: null, fechaFin: null };
    if (
      periodos.length === 0 ||
      periodos.some((periodo) => !TIPOS_PERIODO_ACOTADOS.includes(periodo.tipo))
    ) {
      return sinLimite;
    }

    const fechas = periodos
      .flatMap((periodo): string[] => {
        switch (periodo.tipo) {
          case 'date-range':
            return [periodo.fechaInicio, periodo.fechaFin];
          case 'specific-dates':
            return periodo.fechas;
          case 'specific-month-days': {
            const inicio = new Date(Date.UTC(periodo.anio!, periodo.mes, 1));
            const fin = new Date(Date.UTC(periodo.anio!, periodo.mes! + 1, 0));
            return [
              inicio.toISOString().slice(0, 10),
              fin.toISOString().slice(0, 10),
            ];
          }
          default:
            return [];
        }
      })
      .filter(Boolean)
      .sort();

    if (fechas.length === 0) return sinLimite;
    return {
      fechaInicio: new Date(`${fechas[0]}T00:00:00Z`),
      fechaFin: new Date(`${fechas[fechas.length - 1]}T00:00:00Z`),
    };
  }
}
