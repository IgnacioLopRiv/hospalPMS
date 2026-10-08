import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HostalService } from '../../../../guests/application/hostal.service';
import { SedeService } from '../../../../locations/application/sede.service';
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
    await TestBed.configureTestingModule({
      imports: [ReservasPage],
    }).compileComponents();

    sedeService = TestBed.inject(SedeService);
    const sedeId = sedeService.selectedSede()!.id;
    localStorage.removeItem(`hospal_db_sede_${sedeId}_huespedes`);
    localStorage.removeItem(`hospal_db_sede_${sedeId}_reservas`);
    hostalService = TestBed.inject(HostalService);
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

  function addInventory(): SedeTipologia {
    const typology = sedeService.addTipologia({
      nombre: 'Tipo de prueba',
      capacidad: 2,
    });
    const sede = sedeService.selectedSede()!;
    sedeService.updateSelectedSede({
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

  function addReservation(arrivalOffset: number, departureOffset: number): Reserva {
    const typology = addInventory();
    const guest = hostalService.registerGuest({
      documento: 'TEST-123',
      nombre: 'Huésped',
      apellido: 'Prueba',
      nacionalidad: 'Chile',
      telefono: '123456',
      email: 'test@example.com',
    });
    return hostalService.registerEntry({
      guestId: guest.id_huesped,
      roomId: sedeService.selectedSede()!.habitaciones[0].id,
      personCount: 1,
      arrivalDate: dateAfter(arrivalOffset),
      departureDate: dateAfter(departureOffset),
      arrivalTime: '15:00',
    }).reservation;
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

  it('shows only managed room types and uses their configured colors', () => {
    const typology = addInventory();
    fixture.detectChanges();

    expect(component.categories().length).toBe(1);
    expect(component.categories()[0].name).toBe(typology.nombre);
    expect(typology.color).toBeTruthy();
    expect(component.categories()[0].theme.primary).toBe(typology.color!);
  });

  it('connects the calendar and selected-day counters to persisted reservations', () => {
    const reservation = addReservation(0, 2);
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

  it('shows the reservation bar from arrival through departure day', () => {
    const reservation = addReservation(1, 3);
    fixture.detectChanges();
    const block = component.reservations().find((entry) => entry.id === reservation.id_reserva)!;

    expect(component.getGridColumnStart(block)).toBe(2);
    expect(component.getGridColumnSpan(block)).toBe(3);
  });

  it('keeps the checkout day visible when it is the first day of the calendar', () => {
    const reservation = addReservation(-1, 0);
    fixture.detectChanges();
    const block = component.reservations().find((entry) => entry.id === reservation.id_reserva)!;

    expect(component.visibleReservations()).toContain(block);
    expect(component.getGridColumnStart(block)).toBe(1);
    expect(component.getGridColumnSpan(block)).toBe(1);
  });

  it('assigns different colors to managed typologies', () => {
    const first = sedeService.addTipologia({ nombre: 'Tipo 1', capacidad: 2 });
    const second = sedeService.addTipologia({ nombre: 'Tipo 2', capacidad: 2 });

    expect(first.color).toBeTruthy();
    expect(second.color).toBeTruthy();
    expect(first.color).not.toBe(second.color);
  });
});
