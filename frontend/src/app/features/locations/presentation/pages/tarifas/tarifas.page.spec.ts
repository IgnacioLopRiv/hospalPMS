import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { SedeService } from '../../../application/sede.service';
import { TarifaPeriodo, TarifasPage } from './tarifas.page';
import { Tarifa, TarifaInput, TarifasRepository } from '../../../domain/tarifas.repository';
import { SedeTipologia } from '../../../../../shared/domain/hostal.model';

describe('TarifasPage', () => {
  let component: TarifasPage;
  let fixture: ComponentFixture<TarifasPage>;
  let storedTarifas: Tarifa[];
  let storedAbono: number;
  let tipologias: SedeTipologia[];
  let sedeServiceStub: {
    selectedSede: ReturnType<typeof signal<{ id: number; nombre: string; ciudad: string; habitaciones: never[] } | null>>;
    tipologias: ReturnType<typeof signal<SedeTipologia[]>>;
    updateTipologia: jasmine.Spy;
    addTipologia: jasmine.Spy;
    deleteTipologia: jasmine.Spy;
  };

  beforeEach(async () => {
    storedTarifas = [];
    storedAbono = 20;
    tipologias = [];
    sedeServiceStub = {
      selectedSede: signal({ id: 7, nombre: 'Sede test', ciudad: 'Santiago', habitaciones: [] }),
      tipologias: signal(tipologias),
      updateTipologia: jasmine.createSpy().and.callFake(async (id: number, patch: Partial<SedeTipologia>) => {
        tipologias = tipologias.map((typology) => typology.id === id ? { ...typology, ...patch } : typology);
        sedeServiceStub.tipologias.set(tipologias);
      }),
      addTipologia: jasmine.createSpy().and.callFake(async (data: Omit<SedeTipologia, 'id'>) => {
        const created = { ...data, id: tipologias.length + 1 };
        tipologias = [...tipologias, created];
        sedeServiceStub.tipologias.set(tipologias);
        return created;
      }),
      deleteTipologia: jasmine.createSpy().and.callFake(async (id: number) => {
        tipologias = tipologias.filter((typology) => typology.id !== id);
        sedeServiceStub.tipologias.set(tipologias);
        return { ok: true };
      }),
    };
    const tarifasRepository = {
      getAbono: jasmine.createSpy().and.callFake((sedeId: number) => of({ sedeId, porcentajeAbono: storedAbono })),
      saveAbono: jasmine.createSpy().and.callFake((sedeId: number, porcentajeAbono: number) => {
        storedAbono = porcentajeAbono;
        return of({ sedeId, porcentajeAbono });
      }),
      listTarifas: jasmine.createSpy().and.callFake(() => of(storedTarifas)),
      createTarifa: jasmine.createSpy().and.callFake((_sedeId: number, data: TarifaInput) => {
        const created = { ...data, id: storedTarifas.length + 1 };
        storedTarifas = [...storedTarifas, created];
        return of(created);
      }),
      updateTarifa: jasmine.createSpy().and.callFake((id: number, data: Partial<TarifaInput>) => {
        storedTarifas = storedTarifas.map((tarifa) => tarifa.id === id ? { ...tarifa, ...data } : tarifa);
        return of(storedTarifas.find((tarifa) => tarifa.id === id)!);
      }),
      deleteTarifa: jasmine.createSpy().and.callFake((id: number) => {
        storedTarifas = storedTarifas.filter((tarifa) => tarifa.id !== id);
        return of(undefined);
      }),
    };
    await TestBed.configureTestingModule({
      imports: [TarifasPage],
      providers: [
        { provide: SedeService, useValue: sedeServiceStub },
        { provide: TarifasRepository, useValue: tarifasRepository },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(TarifasPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await Promise.resolve();
    await Promise.resolve();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('creates a named rate and persists it for the current location', async () => {
    component.openConfig();
    component.editTarifa.nombre = 'Verano';
    component.toggleMonth(component.editTarifa.periodos[0], 11);

    expect(component.rateStep()).toBe(1);
    component.continueToPrices();
    expect(component.rateStep()).toBe(2);
    await component.saveTarifa();

    expect(component.tarifas().length).toBe(1);
    expect(component.tarifas()[0].nombre).toBe('Verano');
    expect('abonoPorcentaje' in component.tarifas()[0]).toBeFalse();
    expect(component.periodSummary(component.tarifas()[0].periodos[0])).toBe('Dic');
    expect(storedTarifas).toContain(jasmine.objectContaining({ id: 1, nombre: 'Verano', tipoTemporada: 'ALTA', activa: true }));
    expect(TestBed.inject(TarifasRepository).createTarifa).toHaveBeenCalledWith(7, jasmine.objectContaining({ nombre: 'Verano' }));
  });

  it('saves a shared location deposit percentage with its rate configuration', async () => {
    component.abonoDraft = 35;

    await component.saveAbonoPorcentaje();

    expect(component.abonoPorcentaje()).toBe(35);
    expect(storedAbono).toBe(35);
  });

  it('saves base prices by typology to the selected location', async () => {
    const sedeService = TestBed.inject(SedeService);
    const typology = await sedeService.addTipologia({
      nombre: 'Base test',
      capacidad: 2,
      precioBase: 50000,
    });
    fixture.detectChanges();

    component.basePriceDraft[typology.id] = 72500;
    expect(component.isValidBasePriceDraft()).toBeTrue();
    await component.saveBasePrices();

    expect(sedeService.tipologias().find((item) => item.id === typology.id)?.precioBase).toBe(72500);
    await sedeService.deleteTipologia(typology.id);
  });

  it('does not accept an empty or negative base price', async () => {
    const sedeService = TestBed.inject(SedeService);
    const typology = await sedeService.addTipologia({
      nombre: 'Base inválida test',
      capacidad: 2,
      precioBase: 50000,
    });
    fixture.detectChanges();

    component.basePriceDraft[typology.id] = -1;
    expect(component.isValidBasePriceDraft()).toBeFalse();
    await component.saveBasePrices();
    expect(sedeService.tipologias().find((item) => item.id === typology.id)?.precioBase).toBe(50000);

    component.basePriceDraft[typology.id] = null;
    expect(component.isValidBasePriceDraft()).toBeFalse();
    await sedeService.deleteTipologia(typology.id);
  });

  it('stacks the deposit below base prices when there are many typologies', async () => {
    const sedeService = TestBed.inject(SedeService);
    const typologies = await Promise.all(Array.from({ length: 5 }, (_, index) =>
      sedeService.addTipologia({
        nombre: `Responsiva ${index + 1}`,
        capacidad: 2,
        precioBase: 50000,
      })
    ));
    fixture.detectChanges();

    const settings = fixture.nativeElement.querySelector('.settings-grid');
    expect(settings.classList).toContain('settings-grid-many-typologies');

    await Promise.all(typologies.map((typology) => sedeService.deleteTipologia(typology.id)));
  });

  it('loads the stored tariff configuration from the repository', () => {
    expect(component.abonoPorcentaje()).toBe(20);
    expect(component.tarifas()).toEqual([]);
  });

  it('supports different period types and recognizes an active date range', () => {
    const period = component.editTarifa.periodos[0];
    component.changePeriodType(period, 'date-range');
    period.fechaInicio = '2025-01-01';
    period.fechaFin = '2025-01-31';
    component.tarifas.set([{
      id: 1,
      tipoTemporada: 'ALTA',
      activa: true,
      nombre: 'Invierno',
      periodos: [period],
      precios: {},
    }]);
    component.now.set(new Date(2025, 0, 15));

    expect(component.activeTarifas().map((rate) => rate.nombre)).toEqual(['Invierno']);
  });

  it('uses the selected calendar month and year, including leap days', () => {
    const period = component.editTarifa.periodos[0];
    component.changePeriodType(period, 'specific-month-days');
    component.updateSpecificMonth(period, 1);
    component.updateSpecificYear(period, 2028);

    expect(component.daysInSelectedMonth(period).length).toBe(29);
    expect(component.calendarOffset(period)).toBe(1);

    component.toggleMonthDay(period, 29);
    expect(component.periodIsValid(period)).toBeTrue();
    expect(component.periodSummary(period)).toBe('29 de Febrero de 2028');
    component.tarifas.set([{
      id: 2,
      tipoTemporada: 'ALTA',
      activa: true,
      nombre: 'Año bisiesto',
      periodos: [period],
      precios: {},
    }]);
    component.now.set(new Date(2028, 1, 29));
    expect(component.activeTarifas().map((rate) => rate.nombre)).toEqual(['Año bisiesto']);

    component.updateSpecificYear(period, 2027);
    expect(component.daysInSelectedMonth(period).length).toBe(28);
    expect(period.diasMes).toEqual([]);
    component.now.set(new Date(2027, 1, 28));
    expect(component.activeTarifas()).toEqual([]);
  });

  it('prevents later periods from selecting dates already covered by another period', () => {
    const decemberPeriod = component.editTarifa.periodos[0];
    component.toggleMonth(decemberPeriod, 11);

    component.addPeriod();
    const secondPeriod = component.editTarifa.periodos[1];
    component.changePeriodType(secondPeriod, 'specific-month-days');
    expect(component.isSpecificCalendarMonthUnavailable(secondPeriod, 11)).toBeTrue();
    const selectedMonth = secondPeriod.mes;
    component.updateSpecificMonth(secondPeriod, 11);
    expect(secondPeriod.mes).toBe(selectedMonth);

    component.editTarifa.periodos = [decemberPeriod];
    component.changePeriodType(decemberPeriod, 'specific-dates');
    component.addSpecificDate(decemberPeriod, '2027-12-25');
    component.addPeriod();
    const calendarPeriod = component.editTarifa.periodos[1];
    component.changePeriodType(calendarPeriod, 'specific-month-days');
    component.updateSpecificMonth(calendarPeriod, 11);
    component.updateSpecificYear(calendarPeriod, 2027);

    expect(component.isCalendarDayUnavailable(calendarPeriod, 25)).toBeTrue();
    component.toggleMonthDay(calendarPeriod, 25);
    expect(calendarPeriod.diasMes).not.toContain(25);
  });

  it('does not reserve weekdays for individually selected calendar dates', () => {
    const specificDaysPeriod = component.editTarifa.periodos[0];
    component.changePeriodType(specificDaysPeriod, 'specific-month-days');
    component.updateSpecificMonth(specificDaysPeriod, 3);
    component.updateSpecificYear(specificDaysPeriod, 2026);
    component.toggleMonthDay(specificDaysPeriod, 1);
    component.toggleMonthDay(specificDaysPeriod, 2);

    component.addPeriod();
    const weekdaysPeriod = component.editTarifa.periodos[1];
    component.changePeriodType(weekdaysPeriod, 'weekdays');

    expect(component.isWeekdayUnavailable(weekdaysPeriod, 3)).toBeFalse();
    expect(component.isWeekdayUnavailable(weekdaysPeriod, 4)).toBeFalse();
  });

  it('does not block weekday selections when another period already defines a weekday rule', () => {
    const firstWeekdaysPeriod = component.editTarifa.periodos[0];
    component.changePeriodType(firstWeekdaysPeriod, 'weekdays');
    component.toggleWeekday(firstWeekdaysPeriod, 3);
    component.toggleWeekday(firstWeekdaysPeriod, 4);

    component.addPeriod();
    const secondWeekdaysPeriod = component.editTarifa.periodos[1];
    component.changePeriodType(secondWeekdaysPeriod, 'weekdays');

    expect(component.isWeekdayUnavailable(secondWeekdaysPeriod, 3)).toBeFalse();
    expect(component.isWeekdayUnavailable(secondWeekdaysPeriod, 4)).toBeFalse();
    expect(component.isWeekdayUnavailable(secondWeekdaysPeriod, 2)).toBeFalse();
  });

  it('allows periods to overlap when one of them uses the weekday period type', () => {
    component.editTarifa.nombre = 'Tarifa semanal';
    const weekdaysPeriod = component.editTarifa.periodos[0];
    component.changePeriodType(weekdaysPeriod, 'weekdays');
    component.toggleWeekday(weekdaysPeriod, 3);

    component.addPeriod();
    const specificDatePeriod = component.editTarifa.periodos[1];
    component.changePeriodType(specificDatePeriod, 'specific-dates');
    component.addSpecificDate(specificDatePeriod, '2026-04-02');

    component.addPeriod();
    const calendarPeriod = component.editTarifa.periodos[2];
    component.changePeriodType(calendarPeriod, 'specific-month-days');
    component.updateSpecificMonth(calendarPeriod, 3);
    component.updateSpecificYear(calendarPeriod, 2026);
    expect(component.isCalendarDayUnavailable(calendarPeriod, 9)).toBeFalse();
    component.toggleMonthDay(calendarPeriod, 9);

    expect(specificDatePeriod.fechas).toContain('2026-04-02');
    expect(calendarPeriod.diasMes).toContain(9);
    expect(component.isWeekdayUnavailable(weekdaysPeriod, 3)).toBeFalse();
    expect(component.periodHasConflict(weekdaysPeriod)).toBeFalse();
    expect(component.periodHasConflict(specificDatePeriod)).toBeFalse();
    expect(component.periodHasConflict(calendarPeriod)).toBeFalse();
    expect(component.hasValidNameAndPeriods()).toBeTrue();
  });

  it('prevents duplicate weekday rules across different tariffs', () => {
    const existingWeekdays: TarifaPeriodo = {
      id: 'existing-weekdays',
      tipo: 'weekdays',
      meses: [],
      diasSemana: [3],
      diasMes: [],
      fechaInicio: '',
      fechaFin: '',
      fechas: [],
    };
    component.tarifas.set([{
      id: 1,
      tipoTemporada: 'ALTA',
      activa: true,
      nombre: 'Jueves',
      periodos: [existingWeekdays],
      precios: {},
    }]);
    component.editTarifa.nombre = 'Otra tarifa semanal';
    const weekdayPeriod = component.editTarifa.periodos[0];
    component.changePeriodType(weekdayPeriod, 'weekdays');

    expect(component.isWeekdayUnavailable(weekdayPeriod, 3)).toBeTrue();
    component.toggleWeekday(weekdayPeriod, 3);
    expect(weekdayPeriod.diasSemana).toEqual([]);
    weekdayPeriod.diasSemana = [3];
    expect(component.hasValidNameAndPeriods()).toBeFalse();
  });

  it('allows a weekday rule to overlap a month in another tariff', () => {
    const existingApril: TarifaPeriodo = {
      id: 'existing-april',
      tipo: 'months',
      meses: [3],
      diasSemana: [],
      diasMes: [],
      fechaInicio: '',
      fechaFin: '',
      fechas: [],
    };
    component.tarifas.set([{
      id: 1,
      tipoTemporada: 'ALTA',
      activa: true,
      nombre: 'Abril',
      periodos: [existingApril],
      precios: {},
    }]);
    component.editTarifa.nombre = 'Temporada semanal';
    const weekdayPeriod = component.editTarifa.periodos[0];
    component.changePeriodType(weekdayPeriod, 'weekdays');

    expect(component.isWeekdayUnavailable(weekdayPeriod, 3)).toBeFalse();
    component.toggleWeekday(weekdayPeriod, 3);
    expect(weekdayPeriod.diasSemana).toEqual([3]);
    expect(component.hasValidNameAndPeriods()).toBeTrue();

    const existingWeekdays: TarifaPeriodo = {
      id: 'existing-weekdays',
      tipo: 'weekdays',
      meses: [],
      diasSemana: [3],
      diasMes: [],
      fechaInicio: '',
      fechaFin: '',
      fechas: [],
    };
    component.tarifas.set([{
      id: 1,
      tipoTemporada: 'ALTA',
      activa: true,
      nombre: 'Jueves',
      periodos: [existingWeekdays],
      precios: {},
    }]);
    component.changePeriodType(weekdayPeriod, 'months');
    expect(component.isMonthUnavailable(weekdayPeriod, 3)).toBeFalse();
    component.toggleMonth(weekdayPeriod, 3);
    expect(weekdayPeriod.meses).toEqual([3]);
  });

  it('applies the higher per-typology price when month and weekday tariffs overlap', () => {
    const aprilPeriod: TarifaPeriodo = {
      id: 'april-period',
      tipo: 'months',
      meses: [3],
      diasSemana: [],
      diasMes: [],
      fechaInicio: '',
      fechaFin: '',
      fechas: [],
    };
    const thursdayPeriod: TarifaPeriodo = {
      id: 'thursday-period',
      tipo: 'weekdays',
      meses: [],
      diasSemana: [3],
      diasMes: [],
      fechaInicio: '',
      fechaFin: '',
      fechas: [],
    };
    component.tarifas.set([
      {
        id: 1,
      tipoTemporada: 'ALTA',
      activa: true,
        nombre: 'Abril',
        periodos: [aprilPeriod],
        precios: { 1: 120000, 2: 90000 },
      },
      {
        id: 2,
      tipoTemporada: 'ALTA',
      activa: true,
        nombre: 'Jueves',
        periodos: [thursdayPeriod],
        precios: { 1: 110000, 2: 100000 },
      },
    ]);

    expect(component.getAppliedTarifa(1, new Date(2026, 3, 2))?.id).toBe(1);
    expect(component.getAppliedTarifa(2, new Date(2026, 3, 2))?.id).toBe(2);
  });

  it('rejects a specific date that overlaps a weekday rule from another tariff', () => {
    const existingWeekdays: TarifaPeriodo = {
      id: 'existing-weekdays',
      tipo: 'weekdays',
      meses: [],
      diasSemana: [3],
      diasMes: [],
      fechaInicio: '',
      fechaFin: '',
      fechas: [],
    };
    component.tarifas.set([{
      id: 1,
      tipoTemporada: 'ALTA',
      activa: true,
      nombre: 'Jueves',
      periodos: [existingWeekdays],
      precios: {},
    }]);
    const datePeriod = component.editTarifa.periodos[0];
    component.changePeriodType(datePeriod, 'specific-dates');

    component.addSpecificDate(datePeriod, '2026-04-02');

    expect(datePeriod.fechas).toEqual([]);
    expect(component.periodSelectionError()).toContain('ya está incluida en otro periodo');
  });

  it('rejects a date range that overlaps a month selected in another period', () => {
    const decemberPeriod = component.editTarifa.periodos[0];
    component.toggleMonth(decemberPeriod, 11);
    component.addPeriod();
    const dateRangePeriod = component.editTarifa.periodos[1];
    component.changePeriodType(dateRangePeriod, 'date-range');

    component.updateDateRange(dateRangePeriod, 'fechaInicio', '2027-12-20');
    component.updateDateRange(dateRangePeriod, 'fechaFin', '2027-12-31');

    expect(dateRangePeriod.fechaFin).toBe('');
    expect(component.periodSelectionError()).toContain('ya pertenecen a otro periodo');
    expect(component.hasValidNameAndPeriods()).toBeFalse();
  });

  it('does not continue until the tariff name and all periods are valid', () => {
    component.continueToPrices();
    expect(component.rateStep()).toBe(1);

    component.editTarifa.nombre = 'Fin de semana';
    component.continueToPrices();
    expect(component.rateStep()).toBe(1);

    component.toggleMonth(component.editTarifa.periodos[0], 4);
    component.continueToPrices();
    expect(component.rateStep()).toBe(2);

    component.backToPeriods();
    expect(component.rateStep()).toBe(1);
  });
});
