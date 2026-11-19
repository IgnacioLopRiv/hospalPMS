import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { SedeService } from '../../../../locations/application/sede.service';
import { Tarifa, TarifasRepository } from '../../../../locations/domain/tarifas.repository';
import { SedeTipologia } from '../../../../../shared/domain/hostal.model';
import { addDays, localDateString } from './check-dates';

type TarifaPeriodType = 'months' | 'weekdays' | 'month-days' | 'specific-month-days' | 'date-range' | 'specific-dates';

interface StoredTarifaPeriod {
  tipo: TarifaPeriodType;
  meses: number[];
  diasSemana: number[];
  diasMes: number[];
  fechaInicio: string;
  fechaFin: string;
  fechas: string[];
  anio?: number;
  mes?: number;
}

export interface StoredTarifa {
  periodos: StoredTarifaPeriod[];
  precios: Record<number, number>;
}

const PERIOD_TYPES: TarifaPeriodType[] = [
  'months', 'weekdays', 'month-days', 'specific-month-days', 'date-range', 'specific-dates',
];

/** Porcentaje de abono si la sede aún no tiene uno configurado. */
const DEFAULT_DEPOSIT_PERCENTAGE = 20;

/**
 * Precios por noche de Recepción según las tarifas de la sede (/tarifas).
 * Se provee en CheckPagePage: sus modales hijos comparten la misma configuración cargada.
 */
@Injectable()
export class TarifaPricingService {
  private readonly sedeService = inject(SedeService);
  private readonly tarifasRepository = inject(TarifasRepository);
  private config: { sedeId: number; porcentajeAbono: number; tarifas: Tarifa[] } | null = null;

  /** Carga (o recarga) abono y tarifas activas de la sede seleccionada. */
  async load(): Promise<void> {
    const sedeId = this.requireSedeId('Selecciona una sede para consultar sus tarifas.');
    const [abono, tarifas] = await Promise.all([
      firstValueFrom(this.tarifasRepository.getAbono(sedeId)),
      firstValueFrom(this.tarifasRepository.listTarifas(sedeId)),
    ]);
    this.config = {
      sedeId,
      porcentajeAbono: abono.porcentajeAbono,
      tarifas: tarifas.filter((tarifa) => tarifa.activa),
    };
  }

  /** Tarifas cargadas de la sede actual. Lanza si no hay sede o el formato es inválido. */
  rates(): StoredTarifa[] {
    const sedeId = this.requireSedeId('Selecciona una sede para consultar sus tarifas.');
    if (this.config?.sedeId !== sedeId) return [];
    const parsed: unknown = this.config.tarifas;
    if (!Array.isArray(parsed) || !parsed.every((rate) => isStoredTarifa(rate))) {
      throw new Error('Las tarifas guardadas tienen un formato inválido. Revísalas en /tarifas.');
    }
    return parsed as StoredTarifa[];
  }

  /** Porcentaje de abono de la sede actual. */
  depositPercentage(): number {
    const sedeId = this.requireSedeId('Selecciona una sede para consultar el porcentaje de abono.');
    if (this.config?.sedeId !== sedeId) return DEFAULT_DEPOSIT_PERCENTAGE;
    const percentage = this.config.porcentajeAbono;
    if (!Number.isFinite(percentage) || percentage < 1 || percentage > 100) {
      throw new Error('El porcentaje de abono configurado en /tarifas no es válido.');
    }
    return percentage;
  }

  /** Precio de una noche: el mayor entre el precio base y las tarifas que aplican ese día. */
  nightlyPrice(typology: SedeTipologia, date: Date, rates: StoredTarifa[]): number | undefined {
    const matchingRates = rates.filter((rate) => rate.periodos.some((period) => periodMatches(period, date)));
    let nightlyPrice = typeof typology.precioBase === 'number' &&
      Number.isFinite(typology.precioBase) && typology.precioBase >= 0
      ? typology.precioBase
      : undefined;
    for (const rate of matchingRates) {
      const ratePrice = rate.precios[typology.id] ?? typology.precioBase;
      if (typeof ratePrice === 'number' && Number.isFinite(ratePrice) && ratePrice >= 0 &&
        (nightlyPrice === undefined || ratePrice > nightlyPrice)) {
        nightlyPrice = ratePrice;
      }
    }
    return nightlyPrice;
  }

  /** Precio de `nights` noches desde `from` con las tarifas vigentes; null si falta precio. */
  priceNights(typology: SedeTipologia, from: string, nights: number): number | null {
    let rates: StoredTarifa[];
    try {
      rates = this.rates();
    } catch {
      return null;
    }
    let total = 0;
    for (let offset = 0; offset < nights; offset++) {
      const price = this.nightlyPrice(typology, new Date(`${addDays(from, offset)}T00:00:00`), rates);
      if (price === undefined || !Number.isFinite(price) || price < 0) return null;
      total += price;
    }
    return Math.round(total);
  }

  /** Diferencia de precio de `nights` noches desde `from` entre la tipología nueva y la de la habitación actual. */
  roomSwapDelta(currentRoomId: number, newTypologyId: number, from: string, nights: number): number | null {
    if (nights <= 0) return 0;
    const currentRoom = this.sedeService.habitaciones().find((h) => h.id === currentRoomId);
    const typologies = this.sedeService.tipologias();
    const oldTypology = typologies.find((t) => t.id === currentRoom?.tipologiaId);
    const newTypology = typologies.find((t) => t.id === newTypologyId);
    if (!oldTypology || !newTypology) return null;
    const oldPrice = this.priceNights(oldTypology, from, nights);
    const newPrice = this.priceNights(newTypology, from, nights);
    return oldPrice === null || newPrice === null ? null : newPrice - oldPrice;
  }

  private requireSedeId(message: string): number {
    const sedeId = this.sedeService.selectedSede()?.id;
    if (sedeId === undefined) throw new Error(message);
    return sedeId;
  }
}

function isStoredTarifa(value: unknown): value is StoredTarifa {
  if (!value || typeof value !== 'object') return false;
  const rate = value as Record<string, unknown>;
  return Array.isArray(rate['periodos']) &&
    rate['periodos'].every((period: unknown) => {
      if (!period || typeof period !== 'object') return false;
      const item = period as Record<string, unknown>;
      return typeof item['tipo'] === 'string' && PERIOD_TYPES.includes(item['tipo'] as TarifaPeriodType) &&
        Array.isArray(item['meses']) && item['meses'].every(Number.isInteger) &&
        Array.isArray(item['diasSemana']) && item['diasSemana'].every(Number.isInteger) &&
        Array.isArray(item['diasMes']) && item['diasMes'].every(Number.isInteger) &&
        typeof item['fechaInicio'] === 'string' && typeof item['fechaFin'] === 'string' &&
        Array.isArray(item['fechas']) && item['fechas'].every((date) => typeof date === 'string');
    }) &&
    !!rate['precios'] && typeof rate['precios'] === 'object' && !Array.isArray(rate['precios']) &&
    Object.values(rate['precios']).every((price) =>
      typeof price === 'number' && Number.isFinite(price) && price >= 0
    );
}

function periodMatches(period: StoredTarifaPeriod, date: Date): boolean {
  const dateString = localDateString(date);
  switch (period.tipo) {
    case 'months': return period.meses.includes(date.getMonth());
    case 'weekdays': return period.diasSemana.includes((date.getDay() + 6) % 7);
    case 'month-days': return period.diasMes.includes(date.getDate());
    case 'specific-month-days': return period.anio === date.getFullYear() &&
      period.mes === date.getMonth() && period.diasMes.includes(date.getDate());
    case 'date-range': return dateString >= period.fechaInicio && dateString <= period.fechaFin;
    case 'specific-dates': return period.fechas.includes(dateString);
  }
}
