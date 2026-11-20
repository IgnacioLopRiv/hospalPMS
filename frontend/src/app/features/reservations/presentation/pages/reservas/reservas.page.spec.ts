import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HostalService } from '../../../../huespedes/application/hostal.service';
import { SedeService } from '../../../../locations/application/sede.service';
import { LocationsRepository } from '../../../../locations/domain/locations.repository';
import { createLocationsRepositoryStub } from '../../../../locations/domain/testing/locations.repository.stub';
import { HuespedRepository } from '../../../../huespedes/domain/huesped.repository';
import { createHostalRepositoryStubs } from '../../../../huespedes/domain/testing/hostal-repositories.stub';
import { ReservasRepository } from '../../../domain/reservas.repository';
import { Reserva, SedeTipologia } from '../../../../../shared/domain/hostal.model';
import { ReservasPage } from './reservas.page';

describe('ReservasPage', () => {
  let fixture: ComponentFixture<ReservasPage>;
  let component: ReservasPage;
  let hostalService: HostalService;
  let sedeService: SedeService;

  beforeEach(async () => {
    localStorage.removeItem('hospal.sedes');
    localStorage.removeItem('hospal.selectedSede');
    const repositories = createHostalRepositoryStubs();
    const initialSede = { id: 1, nombre: 'Sede test', ciudad: 'Santiago', habitaciones: [], tipologias: [] };
    await TestBed.configureTestingModule({
      imports: [ReservasPage],
      providers: [
        provideHttpClient(),
        { provide: LocationsRepository, useValue: createLocationsRepositoryStub([initialSede]) },
        { provide: HuespedRepository, useValue: repositories.huespedRepository },
        { provide: ReservasRepository, useValue: repositories.reservasRepository },
      ],
    }).compileComponents();

    sedeService = TestBed.inject(SedeService);
    await sedeService.ready;
    const sedeId = sedeService.selectedSede()!.id;
    localStorage.removeItem(`hospal_db_sede_${sedeId}_huespedes`);
    localStorage.removeItem(`hospal_db_sede_${sedeId}_reservas`);
    hostalService = TestBed.inject(HostalService);
    await hostalService.ready;
    fixture = TestBed.createComponent(ReservasPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    const sedeId = sedeService.selectedSede()?.id;
    if (sedeId !== undefined) {
      localStorage.removeItem(`hospal_db_sede_${sedeId}_huespedes`);
      localStorage.removeItem(`hospal_db_sede_${sedeId}_reservas`);
    }
    localStorage.removeItem('hospal.sedes');
    localStorage.removeItem('hospal.selectedSede');
  });

  async function addInventory(): Promise<SedeTipologia> {
    const typology = await sedeService.addTipologia({
      nombre: 'Tipo de prueba',
      capacidad: 2,
    });
    const sede = sedeService.selectedSede()!;
    await sedeService.updateSelectedSede({
      nombre: sede.nombre,
      habitaciones: [...sede.habitaciones, {
        id: sedeService.createHabitacionId(),
        numero: '101',
        tipo: typology.nombre,
        tipologiaId: typology.id,
        tamanoM2: 20,
        disposicionMuebles: '',
      }],
    });
    return typology;
  }

  function dateAfter(days: number): string {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + days);
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0'),
    ].join('-');
  }

  async function addReservation(arrivalOffset: number, departureOffset: number): Promise<Reserva> {
    const typology = await addInventory();
    const guest = await hostalService.registerGuest({
      documento: 'TEST-123',
      nombre: 'Huésped',
      apellido: 'Prueba',
      nacionalidad: 'Chile',
      telefono: '123456',
      email: 'test@example.com',
    });
    return (await hostalService.registerEntry({
      guestId: guest.id_huesped,
      roomId: sedeService.selectedSede()!.habitaciones[0].id,
      personCount: 1,
      arrivalDate: dateAfter(arrivalOffset),
      departureDate: dateAfter(departureOffset),
      arrivalTime: '15:00',
    })).reservation;
  }

  it('creates', () => {
    expect(component).toBeTruthy();
  });

  it('starts the calendar at today and allows selecting future dates', () => {
    expect(component.selectedDate()).toBe(dateAfter(0));
    expect(component.days()[0].dateKey).toBe(dateAfter(0));

    component.selectDay(dateAfter(4));

    expect(component.selectedDate()).toBe(dateAfter(4));
  });

  it('moves the visible period when a distant date is chosen in the mini calendar', () => {
    component.toggleDatePicker();
    component.changePickerYear('2035');
    component.changePickerMonth('5');
    const pickerDay = component.miniCalendarDays().find((day) => day.dateKey === '2035-06-18');
    expect(pickerDay).toBeDefined();
    component.selectPickerDay(pickerDay!);

    expect(component.selectedDate()).toBe('2035-06-18');
    expect(component.days()[0].dateKey).toBe('2035-06-18');
    expect(component.datePickerOpen()).toBeFalse();
  });

  it('shows only managed room types and uses their configured colors', async () => {
    const typology = await addInventory();
    fixture.detectChanges();

    expect(component.categories().length).toBe(1);
    expect(component.categories()[0].name).toBe(typology.nombre);
    expect(typology.color).toBeTruthy();
    expect(component.categories()[0].theme.primary).toBe(typology.color!);
  });

  it('connects the calendar and selected-day counters to persisted reservations', async () => {
    const reservation = await addReservation(0, 2);
    fixture.detectChanges();

    expect(component.reservations().some((entry) => entry.id === reservation.id_reserva)).toBeTrue();
    expect(component.arrivalCount()).toBe(1);
    expect(component.departureCount()).toBe(0);
    expect(component.reservationCount()).toBe(1);

    component.selectDay(dateAfter(2));

    expect(component.arrivalCount()).toBe(0);
    expect(component.departureCount()).toBe(1);
    expect(component.reservationCount()).toBe(0);
  });

  const barOf = (reservationId: number) =>
    [...component.roomBars().values()].flat().find((bar) => bar.reservation.id === reservationId)!;
  const percentOfView = (days: number, time: string) => {
    const [hours, minutes] = time.split(':').map(Number);
    return ((days * 24 * 60 + hours * 60 + minutes) / (10 * 24 * 60)) * 100;
  };

  it('draws the bar proportional to the arrival and departure times', async () => {
    const reservation = await addReservation(1, 3);
    fixture.detectChanges();
    const block = component.reservations().find((entry) => entry.id === reservation.id_reserva)!;
    const bar = barOf(reservation.id_reserva);

    const start = percentOfView(1, block.arrivalTime);
    expect(bar.leftPercent).toBeCloseTo(start, 5);
    expect(bar.widthPercent).toBeCloseTo(percentOfView(3, block.departureTime) - start, 5);
    expect(bar.lane).toBe(0);
  });

  it('keeps the part of a stay that ends on the first visible day, up to its checkout time', async () => {
    const reservation = await addReservation(-1, 0);
    fixture.detectChanges();
    const block = component.reservations().find((entry) => entry.id === reservation.id_reserva)!;
    const bar = barOf(reservation.id_reserva);

    expect(component.visibleReservations()).toContain(block);
    expect(bar.leftPercent).toBe(0);
    expect(bar.widthPercent).toBeCloseTo(percentOfView(0, block.departureTime), 5);
  });

  it('shows 10 days in the calendar', () => {
    expect(component.days().length).toBe(10);
    expect(component.days()[9].dateKey).toBe(dateAfter(9));
  });

  it('opens the reservation detail modal and allows editing and cancelling it', async () => {
    const reservation = await addReservation(1, 3);
    fixture.detectChanges();

    component.openReservation(reservation.id_reserva);
    fixture.detectChanges();
    expect(component.reservationDetail()?.reservation.id_reserva).toBe(reservation.id_reserva);
    expect(component.reservationDetail()?.guestName).toBe('Huésped Prueba');
    expect(component.reservationDetail()?.nights).toBe(2);

    component.startReservationEdit();
    expect(component.reservationModalMode()).toBe('edit');
    component.editReservationForm.fecha_salida = dateAfter(4);
    component.refreshAvailableReservationRooms();
    await component.saveReservationChanges();
    expect(component.reservationError()).toBe('');
    expect(component.reservationModalMode()).toBe('detail');
    expect(component.reservationDetail()?.reservation.fecha_salida).toBe(dateAfter(4));

    component.askCancelReservation();
    expect(component.showCancelReservationConfirm()).toBeTrue();
    await component.confirmCancelReservation();
    expect(component.showCancelReservationConfirm()).toBeFalse();
    expect(component.selectedReservationId()).toBeNull();
    expect(hostalService.getReservations()
      .find((item) => item.id_reserva === reservation.id_reserva)?.estado_reserva).toBe('CANCELADA');
  });

  it('assigns different colors to managed typologies', async () => {
    const first = await sedeService.addTipologia({ nombre: 'Tipo 1', capacidad: 2 });
    const second = await sedeService.addTipologia({ nombre: 'Tipo 2', capacidad: 2 });

    expect(first.color).toBeTruthy();
    expect(second.color).toBeTruthy();
    expect(first.color).not.toBe(second.color);
  });
});
