import { Observable } from 'rxjs';

export type PeriodType = 'months' | 'weekdays' | 'month-days' | 'specific-month-days' | 'date-range' | 'specific-dates';
export type TipoTemporada = 'ALTA' | 'BAJA';

export interface TarifaPeriodo {
  id: string;
  tipo: PeriodType;
  meses: number[];
  diasSemana: number[];
  diasMes: number[];
  fechaInicio: string;
  fechaFin: string;
  fechas: string[];
  anio?: number;
  mes?: number;
}

/** Temporada de precios de una sede: cuándo aplica y cuánto cuesta cada tipología por noche. */
export interface Tarifa {
  id: number;
  nombre: string;
  tipoTemporada: TipoTemporada;
  activa: boolean;
  periodos: TarifaPeriodo[];
  precios: Record<number, number>;
}

export type TarifaInput = Omit<Tarifa, 'id'>;

/** Abono de reserva de la sede; aplica a todas sus tarifas. */
export interface TarifaAbono {
  sedeId: number;
  porcentajeAbono: number;
}

export abstract class TarifasRepository {
  abstract getAbono(sedeId: number): Observable<TarifaAbono>;
  abstract saveAbono(sedeId: number, porcentajeAbono: number): Observable<TarifaAbono>;
  abstract listTarifas(sedeId: number): Observable<Tarifa[]>;
  abstract createTarifa(sedeId: number, data: TarifaInput): Observable<Tarifa>;
  abstract updateTarifa(id: number, data: Partial<TarifaInput>): Observable<Tarifa>;
  abstract deleteTarifa(id: number): Observable<void>;
}
