import { EscapeCloseDirective } from '../../../../../shared/presentation/modal-portal/escape-close.directive';
import { Component, computed, DestroyRef, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { firstValueFrom } from 'rxjs';
import {
  addOutline,
  calendarOutline,
  cashOutline,
  checkmarkOutline,
  closeOutline,
  pricetagOutline,
  trashOutline,
} from 'ionicons/icons';
import { SedeService } from '../../../application/sede.service';
import { PeriodType, Tarifa, TarifaInput, TarifaPeriodo, TarifasRepository } from '../../../domain/tarifas.repository';
import { ModalPortalDirective } from '../../../../../shared/presentation/modal-portal/modal-portal.directive';

export type { PeriodType, Tarifa, TarifaPeriodo } from '../../../domain/tarifas.repository';

const DEFAULT_ABONO_PORCENTAJE = 20;
const WEEKDAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const RECURRING_CYCLE_DAYS = 146_097;
const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

function emptyPeriod(): TarifaPeriodo {
  return {
    id: crypto.randomUUID(),
    tipo: 'months',
    meses: [],
    diasSemana: [],
    diasMes: [],
    fechaInicio: '',
    fechaFin: '',
    fechas: [],
    anio: new Date().getFullYear(),
    mes: new Date().getMonth(),
  };
}

function isValidPeriod(period: TarifaPeriodo): boolean {
  switch (period.tipo) {
    case 'months': return period.meses.length > 0;
    case 'weekdays': return period.diasSemana.length > 0;
    case 'month-days': return period.diasMes.length > 0;
    case 'specific-month-days': {
      const year = period.anio;
      const month = period.mes;
      if (!Number.isInteger(year) || !Number.isInteger(month) || (year ?? 0) < 1900 || (year ?? 10000) > 9999 || (month ?? -1) < 0 || (month ?? 12) > 11) {
        return false;
      }
      const daysInMonth = new Date(year!, month! + 1, 0).getDate();
      return period.diasMes.length > 0 && period.diasMes.every((day) => day <= daysInMonth);
    }
    case 'date-range': return !!period.fechaInicio && !!period.fechaFin && period.fechaInicio <= period.fechaFin;
    case 'specific-dates': return period.fechas.length > 0;
  }
}

@Component({
  selector: 'app-tarifas',
  templateUrl: './tarifas.page.html',
  styleUrls: ['./tarifas.page.scss'],
  standalone: true,
  imports: [EscapeCloseDirective, CommonModule, FormsModule, IonIcon, ModalPortalDirective],
})
export class TarifasPage {
  private readonly sedeService = inject(SedeService);
  private readonly tarifasRepository = inject(TarifasRepository);
  private readonly destroyRef = inject(DestroyRef);
  private loadedSedeId: number | null = null;

  readonly sede = this.sedeService.selectedSede;
  readonly tipologias = this.sedeService.tipologias;
  readonly tarifas = signal<Tarifa[]>([]);
  readonly configOpen = signal(false);
  readonly editingTarifaId = signal<number | null>(null);
  readonly rateStep = signal<1 | 2>(1);
  readonly abonoPorcentaje = signal(DEFAULT_ABONO_PORCENTAJE);
  readonly periodSelectionError = signal('');
  readonly now = signal(new Date());
  readonly monthNames = MONTHS;
  readonly weekdayNames = WEEKDAYS;
  readonly calendarPlaceholders = Array.from({ length: 6 }, (_, index) => index);

  editTarifa: Tarifa = this.newTarifa();
  abonoDraft = DEFAULT_ABONO_PORCENTAJE;
  basePriceDraft: Record<number, number | null> = {};

  readonly activeTarifas = computed(() => {
    const today = this.now();
    return this.tarifas().filter((tarifa) =>
      tarifa.activa && tarifa.periodos.some((periodo) => this.periodMatches(periodo, today)));
  });

  constructor() {
    addIcons({
      addOutline,
      calendarOutline,
      cashOutline,
      checkmarkOutline,
      closeOutline,
      pricetagOutline,
      trashOutline,
    });
    const interval = setInterval(() => this.now.set(new Date()), 60_000);
    this.destroyRef.onDestroy(() => clearInterval(interval));
    effect(() => {
      const sedeId = this.sede()?.id;
      const currentTipologias = this.tipologias();
      this.basePriceDraft = Object.fromEntries(
        currentTipologias.map((typology) => [typology.id, typology.precioBase ?? 0])
      );
      if (sedeId === undefined) {
        this.loadedSedeId = null;
        this.tarifas.set([]);
        this.abonoPorcentaje.set(DEFAULT_ABONO_PORCENTAJE);
        this.abonoDraft = DEFAULT_ABONO_PORCENTAJE;
      } else if (this.loadedSedeId !== sedeId) {
        void this.loadConfig(sedeId);
      }
    });
  }

  openConfig(): void {
    this.startNewTarifa();
    this.configOpen.set(true);
  }

  editTarifaConfig(tarifa: Tarifa): void {
    this.editingTarifaId.set(tarifa.id);
    this.editTarifa = this.cloneTarifa(tarifa);
    this.rateStep.set(1);
    this.configOpen.set(true);
  }

  closeConfig(): void {
    this.configOpen.set(false);
  }

  startNewTarifa(): void {
    this.editingTarifaId.set(null);
    this.editTarifa = this.newTarifa();
    this.rateStep.set(1);
  }

  continueToPrices(): void {
    if (!this.hasValidNameAndPeriods()) return;
    this.rateStep.set(2);
  }

  backToPeriods(): void {
    this.rateStep.set(1);
  }

  async saveTarifa(): Promise<void> {
    if (this.rateStep() !== 2 || !this.canSaveTarifa()) return;

    const sedeId = this.sede()?.id;
    if (sedeId === undefined) return;
    const { id: _id, ...draft } = this.cloneTarifa(this.editTarifa);
    const data: TarifaInput = { ...draft, nombre: draft.nombre.trim() };
    const editingId = this.editingTarifaId();
    const saved = await firstValueFrom(editingId !== null
      ? this.tarifasRepository.updateTarifa(editingId, data)
      : this.tarifasRepository.createTarifa(sedeId, data));
    this.tarifas.update((current) => editingId !== null
      ? current.map((tarifa) => tarifa.id === editingId ? saved : tarifa)
      : [...current, saved]);
    this.configOpen.set(false);
  }

  async deleteTarifa(tarifaId: number): Promise<void> {
    const tarifa = this.tarifas().find((item) => item.id === tarifaId);
    if (!tarifa || !globalThis.confirm(`¿Eliminar la tarifa "${tarifa.nombre}"?`)) return;
    await firstValueFrom(this.tarifasRepository.deleteTarifa(tarifaId));
    this.tarifas.update((current) => current.filter((item) => item.id !== tarifaId));
  }

  async saveAbonoPorcentaje(): Promise<void> {
    const porcentaje = Number(this.abonoDraft);
    if (!this.isValidAbonoDraft()) return;

    const sedeId = this.sede()?.id;
    if (sedeId === undefined) return;
    const saved = await firstValueFrom(this.tarifasRepository.saveAbono(sedeId, porcentaje));
    this.abonoPorcentaje.set(saved.porcentajeAbono);
  }

  isValidAbonoDraft(): boolean {
    const percentage = Number(this.abonoDraft);
    return Number.isFinite(percentage) && percentage >= 1 && percentage <= 100;
  }

  async saveBasePrices(): Promise<void> {
    if (!this.isValidBasePriceDraft()) return;

    const prices = this.basePriceDraft;
    await Promise.all(this.tipologias().map((typology) => {
      const price = prices[typology.id];
      return typeof price === 'number'
        ? this.sedeService.updateTipologia(typology.id, { precioBase: price })
        : Promise.resolve();
    }));
    this.basePriceDraft = Object.fromEntries(
      this.tipologias().map((typology) => [typology.id, prices[typology.id]])
    );
  }

  isValidBasePriceDraft(): boolean {
    return this.tipologias().length > 0 && this.tipologias().every((typology) => {
      const price = this.basePriceDraft[typology.id];
      return typeof price === 'number' && Number.isFinite(price) && price >= 0;
    });
  }

  addPeriod(): void {
    this.editTarifa.periodos = [...this.editTarifa.periodos, emptyPeriod()];
  }

  removePeriod(periodId: string): void {
    this.editTarifa.periodos = this.editTarifa.periodos.filter((period) => period.id !== periodId);
  }

  changePeriodType(period: TarifaPeriodo, type: PeriodType): void {
    Object.assign(period, {
      tipo: type,
      meses: [],
      diasSemana: [],
      diasMes: [],
      fechaInicio: '',
      fechaFin: '',
      fechas: [],
      anio: new Date().getFullYear(),
      mes: new Date().getMonth(),
    });
  }

  toggleSelection(values: number[], value: number): number[] {
    return values.includes(value)
      ? values.filter((item) => item !== value)
      : [...values, value].sort((a, b) => a - b);
  }

  toggleMonth(period: TarifaPeriodo, month: number): void {
    if (!period.meses.includes(month) && this.isMonthUnavailable(period, month)) return;
    period.meses = this.toggleSelection(period.meses, month);
  }

  toggleWeekday(period: TarifaPeriodo, day: number): void {
    if (!period.diasSemana.includes(day) && this.isWeekdayUnavailable(period, day)) return;
    period.diasSemana = this.toggleSelection(period.diasSemana, day);
  }

  toggleMonthDay(period: TarifaPeriodo, day: number): void {
    if (period.tipo === 'specific-month-days' && this.isCalendarDayUnavailable(period, day)) return;
    period.diasMes = this.toggleSelection(period.diasMes, day);
  }

  daysInSelectedMonth(period: TarifaPeriodo): number[] {
    if (!Number.isInteger(period.anio) || !Number.isInteger(period.mes)) return [];
    return Array.from({ length: new Date(period.anio!, period.mes! + 1, 0).getDate() }, (_, index) => index + 1);
  }

  calendarOffset(period: TarifaPeriodo): number {
    if (!Number.isInteger(period.anio) || !Number.isInteger(period.mes)) return 0;
    return (new Date(period.anio!, period.mes!, 1).getDay() + 6) % 7;
  }

  updateSpecificMonth(period: TarifaPeriodo, month: number): void {
    if (this.isSpecificCalendarMonthUnavailable(period, month)) return;
    if (period.mes === month) return;
    period.mes = month;
    period.diasMes = [];
  }

  updateSpecificYear(period: TarifaPeriodo, year: number): void {
    if (period.anio === year) return;
    period.anio = year;
    period.diasMes = period.diasMes.filter((day) => day <= this.daysInSelectedMonth(period).length);
  }

  updateDateRange(period: TarifaPeriodo, field: 'fechaInicio' | 'fechaFin', value: string): void {
    const candidate = { ...period, [field]: value };
    if (candidate.fechaInicio && candidate.fechaFin
      && (this.otherPeriods(period).some((other) => this.periodsOverlap(candidate, other))
        || this.periodOverlapsAnotherSeason(candidate))) {
      this.periodSelectionError.set('Ese rango incluye fechas que ya pertenecen a otro periodo.');
      return;
    }
    period[field] = value;
    this.periodSelectionError.set('');
  }

  isMonthUnavailable(period: TarifaPeriodo, month: number): boolean {
    const candidate: TarifaPeriodo = {
      ...emptyPeriod(),
      tipo: 'months',
      meses: [month],
    };
    return this.otherPeriods(period).some((other) => this.periodsOverlap(candidate, other))
      || this.periodOverlapsAnotherSeason(candidate);
  }

  isSpecificCalendarMonthUnavailable(period: TarifaPeriodo, month: number): boolean {
    return this.otherPeriods(period).some((other) =>
      other.tipo === 'months' && other.meses.includes(month)
    ) || this.tarifas()
      .filter((tarifa) => tarifa.id !== this.editingTarifaId())
      .some((tarifa) => tarifa.periodos.some((other) =>
        other.tipo === 'months' && other.meses.includes(month)
      ));
  }

  isWeekdayUnavailable(_period: TarifaPeriodo, _weekday: number): boolean {
    const candidate: TarifaPeriodo = {
      ...emptyPeriod(),
      tipo: 'weekdays',
      diasSemana: [_weekday],
    };
    return this.periodOverlapsAnotherSeason(candidate);
  }

  isCalendarDayUnavailable(period: TarifaPeriodo, day: number): boolean {
    const candidate: TarifaPeriodo = {
      ...period,
      tipo: 'specific-month-days',
      diasMes: [day],
    };
    return this.otherPeriods(period).some((other) => this.periodsOverlap(candidate, other))
      || this.periodOverlapsAnotherSeason(candidate);
  }

  periodHasConflict(period: TarifaPeriodo): boolean {
    return this.otherPeriods(period).some((other) => this.periodsOverlap(period, other))
      || this.periodOverlapsAnotherSeason(period);
  }

  addSpecificDate(period: TarifaPeriodo, value: string): void {
    if (!value || period.fechas.includes(value)) return;
    const candidate: TarifaPeriodo = {
      ...period,
      tipo: 'specific-dates',
      fechas: [value],
    };
    if (this.otherPeriods(period).some((other) => this.periodsOverlap(candidate, other))
      || this.periodOverlapsAnotherSeason(candidate)) {
      this.periodSelectionError.set('Esa fecha ya está incluida en otro periodo de esta tarifa.');
      return;
    }
    period.fechas = [...period.fechas, value].sort();
    this.periodSelectionError.set('');
  }

  removeSpecificDate(period: TarifaPeriodo, value: string): void {
    period.fechas = period.fechas.filter((date) => date !== value);
    this.periodSelectionError.set('');
  }

  periodIsValid(period: TarifaPeriodo): boolean {
    return isValidPeriod(period);
  }

  periodSummary(period: TarifaPeriodo): string {
    switch (period.tipo) {
      case 'months': return period.meses.map((month) => MONTHS[month].slice(0, 3)).join(', ');
      case 'weekdays': return period.diasSemana.map((day) => WEEKDAYS[day]).join(', ');
      case 'month-days': return `Días ${period.diasMes.join(', ')} de cada mes`;
      case 'specific-month-days': return `${period.diasMes.join(', ')} de ${MONTHS[period.mes ?? 0]} de ${period.anio}`;
      case 'date-range': return `${period.fechaInicio} al ${period.fechaFin}`;
      case 'specific-dates': return period.fechas.join(', ');
    }
  }

  getRatePrice(tarifa: Tarifa, typologyId: number): number {
    if (Object.prototype.hasOwnProperty.call(tarifa.precios, typologyId)) {
      return tarifa.precios[typologyId];
    }
    return this.tipologias().find((typology) => typology.id === typologyId)?.precioBase ?? 0;
  }

  getAppliedTarifa(typologyId: number, date: Date = this.now()): Tarifa | undefined {
    return this.tarifas()
      .filter((tarifa) => tarifa.activa && tarifa.periodos.some((period) => this.periodMatches(period, date)))
      .reduce<Tarifa | undefined>((highest, tarifa) =>
        !highest || this.getRatePrice(tarifa, typologyId) > this.getRatePrice(highest, typologyId)
          ? tarifa
          : highest,
      undefined);
  }

  hasPricesForAllTypologies(): boolean {
    return this.tipologias().every((typology) =>
      Number.isFinite(this.editTarifa.precios[typology.id]) && this.editTarifa.precios[typology.id] >= 0
    );
  }

  canSaveTarifa(): boolean {
    return this.hasValidNameAndPeriods()
      && this.hasPricesForAllTypologies();
  }

  hasValidNameAndPeriods(): boolean {
    return !!this.editTarifa.nombre.trim()
      && this.editTarifa.periodos.length > 0
      && this.editTarifa.periodos.every((period) => isValidPeriod(period) && !this.periodHasConflict(period));
  }

  private otherPeriods(period: TarifaPeriodo): TarifaPeriodo[] {
    return this.editTarifa.periodos.filter((item) => item.id !== period.id);
  }

  private periodOverlapsAnotherSeason(period: TarifaPeriodo): boolean {
    return this.tarifas()
      .filter((tarifa) => tarifa.id !== this.editingTarifaId())
      .some((tarifa) => tarifa.periodos.some((other) =>
        !this.isAllowedMonthWeekdayOverlap(period, other)
        && this.periodsOverlap(period, other, false)
      ));
  }

  private isAllowedMonthWeekdayOverlap(first: TarifaPeriodo, second: TarifaPeriodo): boolean {
    return (first.tipo === 'months' && second.tipo === 'weekdays')
      || (first.tipo === 'weekdays' && second.tipo === 'months');
  }

  private periodsOverlap(first: TarifaPeriodo, second: TarifaPeriodo, allowWeekdayOverlap = true): boolean {
    if (allowWeekdayOverlap && (first.tipo === 'weekdays' || second.tipo === 'weekdays')) return false;

    const firstDates = this.explicitDates(first);
    if (firstDates) return firstDates.some((date) => this.periodMatches(second, date));
    const secondDates = this.explicitDates(second);
    if (secondDates) return secondDates.some((date) => this.periodMatches(first, date));

    if (first.tipo === 'date-range' && second.tipo === 'date-range') {
      return first.fechaInicio <= second.fechaFin && second.fechaInicio <= first.fechaFin;
    }

    if (first.tipo === 'months' && second.tipo === 'months') {
      return first.meses.some((month) => second.meses.includes(month));
    }
    if (first.tipo === 'weekdays' && second.tipo === 'weekdays') {
      return first.diasSemana.some((day) => second.diasSemana.includes(day));
    }
    if (first.tipo === 'months' && second.tipo === 'weekdays'
      || second.tipo === 'months' && first.tipo === 'weekdays') {
      return first.tipo === 'months'
        ? first.meses.length > 0 && second.diasSemana.length > 0
        : second.meses.length > 0 && first.diasSemana.length > 0;
    }
    if (first.tipo === 'months' && second.tipo === 'month-days'
      || second.tipo === 'months' && first.tipo === 'month-days') {
      return (first.tipo === 'months' ? first.meses.length : second.meses.length) > 0
        && (first.tipo === 'month-days' ? first.diasMes.length : second.diasMes.length) > 0;
    }
    if (first.tipo === 'weekdays' && second.tipo === 'month-days'
      || second.tipo === 'weekdays' && first.tipo === 'month-days') {
      return (first.tipo === 'weekdays' ? first.diasSemana.length : second.diasSemana.length) > 0
        && (first.tipo === 'month-days' ? first.diasMes.length : second.diasMes.length) > 0;
    }

    const range = first.tipo === 'date-range' ? first : second.tipo === 'date-range' ? second : null;
    if (range) {
      const start = new Date(`${range.fechaInicio}T00:00:00`);
      const end = new Date(`${range.fechaFin}T00:00:00`);
      const days = Math.floor((end.getTime() - start.getTime()) / 86_400_000);
      const daysToCheck = Math.min(days, RECURRING_CYCLE_DAYS - 1);
      for (let offset = 0; offset <= daysToCheck; offset++) {
        const date = new Date(start);
        date.setDate(start.getDate() + offset);
        if (this.periodMatches(first === range ? second : first, date)) return true;
      }
      return false;
    }

    const cycleStart = new Date(2000, 0, 1);
    for (let offset = 0; offset < RECURRING_CYCLE_DAYS; offset++) {
      const date = new Date(cycleStart);
      date.setDate(cycleStart.getDate() + offset);
      if (this.periodMatches(first, date) && this.periodMatches(second, date)) return true;
    }
    return false;
  }

  private explicitDates(period: TarifaPeriodo): Date[] | null {
    if (period.tipo === 'specific-dates') {
      return period.fechas.map((date) => new Date(`${date}T00:00:00`));
    }
    if (period.tipo === 'specific-month-days') {
      return period.diasMes.map((day) => new Date(period.anio!, period.mes!, day));
    }
    return null;
  }

  private periodMatches(period: TarifaPeriodo, date: Date): boolean {
    const dateString = this.toDateString(date);
    switch (period.tipo) {
      case 'months': return period.meses.includes(date.getMonth());
      case 'weekdays': return period.diasSemana.includes((date.getDay() + 6) % 7);
      case 'month-days': return period.diasMes.includes(date.getDate());
      case 'specific-month-days': return period.anio === date.getFullYear()
        && period.mes === date.getMonth()
        && period.diasMes.includes(date.getDate());
      case 'date-range': return dateString >= period.fechaInicio && dateString <= period.fechaFin;
      case 'specific-dates': return period.fechas.includes(dateString);
    }
  }

  private toDateString(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private newTarifa(): Tarifa {
    return {
      id: 0,
      nombre: '',
      activa: true,
      periodos: [emptyPeriod()],
      precios: Object.fromEntries(this.tipologias().map((typology) => [typology.id, typology.precioBase ?? 0])),
    };
  }

  private cloneTarifa(tarifa: Tarifa): Tarifa {
    return {
      id: tarifa.id,
      nombre: tarifa.nombre,
      activa: tarifa.activa,
      periodos: tarifa.periodos.map((period) => ({
        ...period,
        meses: [...period.meses],
        diasSemana: [...period.diasSemana],
        diasMes: [...period.diasMes],
        fechas: [...period.fechas],
      })),
      precios: { ...tarifa.precios },
    };
  }

  private async loadConfig(sedeId: number): Promise<void> {
    try {
      const [abono, rates] = await Promise.all([
        firstValueFrom(this.tarifasRepository.getAbono(sedeId)),
        firstValueFrom(this.tarifasRepository.listTarifas(sedeId)),
      ]);
      if (this.sede()?.id !== sedeId) return;
      this.tarifas.set(rates.map((tarifa) => this.cloneTarifa(tarifa)));
      this.abonoPorcentaje.set(abono.porcentajeAbono);
      this.abonoDraft = abono.porcentajeAbono;
      this.loadedSedeId = sedeId;
    } catch (error) {
      console.error('No se pudieron cargar las tarifas de la sede.', error);
      this.tarifas.set([]);
      this.abonoPorcentaje.set(DEFAULT_ABONO_PORCENTAJE);
    }
  }

}
