import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { GuestCardView } from '../../../../../shared/domain/hostal.model';
import { HostalService, ReservationCalendarEntry } from '../../../../guests/application/hostal.service';
import { SedeService, SedeTipologia } from '../../../../locations/application/sede.service';
import { ReservasPage } from './reservas.page';

interface SavedRoomForTest {
  id: number;
  numero: string;
  tipo: string;
  tipologiaId?: number;
  tamanoM2: number | null;
  disposicionMuebles: string;
}

describe('ReservasPage', () => {
  let component: ReservasPage;
  let fixture: ComponentFixture<ReservasPage>;
  let guestsView: BehaviorSubject<GuestCardView[]>;
  let calendarReservations: ReservationCalendarEntry[];
  let savedRooms: ReturnType<typeof signal<SavedRoomForTest[]>>;
  let savedRoomTypes: ReturnType<typeof signal<SedeTipologia[]>>;

  beforeEach(() => {
    guestsView = new BehaviorSubject<GuestCardView[]>([]);
    calendarReservations = [];
    savedRooms = signal<SavedRoomForTest[]>([]);
    savedRoomTypes = signal<SedeTipologia[]>([
      { id: 1, nombre: 'Habitación Privada', capacidad: 2, color: '#A32471' },
      { id: 2, nombre: 'Dorm 6-camas', capacidad: 6, color: '#2475A3' }
    ]);
    const hostalService = {
      guestsView$: guestsView.asObservable(),
      getReservationCalendarData: jasmine.createSpy().and.callFake(() => calendarReservations)
    };
    const sedeService = {
      habitaciones: savedRooms,
      tipologias: savedRoomTypes
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: HostalService, useValue: hostalService },
        { provide: SedeService, useValue: sedeService }
      ]
    });
    fixture = TestBed.createComponent(ReservasPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should show 14 days starting from the selected date', () => {
    component.viewStartDate.set(new Date(2026, 5, 16));

    expect(component.days().length).toBe(14);
    expect(component.days()[0].dateKey).toBe('2026-06-16');
    expect(component.days()[13].dateKey).toBe('2026-06-29');
  });

  it('should navigate by a week and return to today', () => {
    component.viewStartDate.set(new Date(2026, 5, 16));

    component.goToNextWeek();
    expect(component.days()[0].dateKey).toBe('2026-06-23');

    component.goToPreviousWeek();
    expect(component.days()[0].dateKey).toBe('2026-06-16');

    component.goToToday();
    const today = new Date();
    const todayKey = [
      today.getFullYear(),
      String(today.getMonth() + 1).padStart(2, '0'),
      String(today.getDate()).padStart(2, '0')
    ].join('-');
    expect(component.days()[0].dateKey).toBe(todayKey);
    expect(component.selectedDate()).toBe(todayKey);
    expect(component.days().some((day) => day.isCurrent)).toBeTrue();
  });

  it('should select a day from the calendar header', () => {
    const selectedDay = component.days()[3];
    fixture.detectChanges();
    const dayButton = fixture.nativeElement.querySelectorAll('.day-cell')[3] as HTMLButtonElement;
    dayButton.click();
    fixture.detectChanges();

    expect(component.selectedDate()).toBe(selectedDay.dateKey);
    expect(dayButton.getAttribute('aria-pressed')).toBe('true');
  });

  it('should open a mini calendar and jump to a distant date', () => {
    fixture.detectChanges();
    const periodButton = fixture.nativeElement.querySelector('.date-range-badge') as HTMLButtonElement;
    periodButton.click();
    fixture.detectChanges();

    expect(component.datePickerOpen()).toBeTrue();
    expect(fixture.nativeElement.querySelector('[role="dialog"]')).toBeTruthy();

    component.changePickerYear('2050');
    component.changePickerMonth('0');
    fixture.detectChanges();
    const distantDay = fixture.nativeElement.querySelector(
      '.mini-calendar-day[aria-label="2050-01-15"]'
    ) as HTMLButtonElement;
    distantDay.click();
    fixture.detectChanges();

    expect(component.datePickerOpen()).toBeFalse();
    expect(component.selectedDate()).toBe('2050-01-15');
    expect(component.days()[0].dateKey).toBe('2050-01-15');
    expect(fixture.nativeElement.querySelector('.date-range-badge').textContent).toContain('2050');
  });

  it('should recalculate reservation, arrival, and departure counts for the selected day', () => {
    savedRooms.set([createRoom(101, '101', 'Habitación Privada', 1)]);
    const selectedDay = addDays(component.days()[0].dateKey, 5);
    component.selectDay(selectedDay);
    component.reservations.set([
      {
        id: 1,
        guestName: 'Alojado',
        roomNumero: '101',
        startDate: addDays(selectedDay, -2),
        departureDate: addDays(selectedDay, 2),
        categoryName: 'Habitación Privada',
        roomCapacity: 2
      },
      {
        id: 2,
        guestName: 'Llegada',
        roomNumero: '101',
        startDate: selectedDay,
        departureDate: addDays(selectedDay, 1),
        categoryName: 'Habitación Privada',
        roomCapacity: 2
      },
      {
        id: 3,
        guestName: 'Salida',
        roomNumero: '101',
        startDate: addDays(selectedDay, -2),
        departureDate: selectedDay,
        categoryName: 'Habitación Privada',
        roomCapacity: 2
      }
    ]);

    expect(component.reservationCount()).toBe(2);
    expect(component.arrivalCount()).toBe(1);
    expect(component.departureCount()).toBe(1);

    component.selectDay(addDays(selectedDay, 1));

    expect(component.reservationCount()).toBe(1);
    expect(component.arrivalCount()).toBe(0);
    expect(component.departureCount()).toBe(1);
  });

  it('should display only reservations received from the guest reservation service', () => {
    savedRooms.set([createRoom(204, '204', 'Dorm 6-camas', 2)]);
    component.selectDay(component.days()[2].dateKey);
    calendarReservations = [{
      id: 41,
      guestId: 1,
      guestName: 'Huésped Reservado',
      country: 'Chile',
      phone: '+56912345678',
      email: 'reservado@example.com',
      isVip: false,
      roomNumber: '204',
      roomType: 'Tipo heredado distinto',
      roomCapacity: 6,
      arrivalDate: component.days()[2].dateKey,
      departureDate: component.days()[5].dateKey,
      arrivalTime: '14:00'
    }, {
      id: 42,
      guestId: 2,
      guestName: 'Habitación que no existe en /habitaciones',
      country: 'Argentina',
      phone: '+5491112345678',
      email: 'inexistente@example.com',
      isVip: false,
      roomNumber: '999',
      roomType: 'Suite',
      roomCapacity: 2,
      arrivalDate: component.days()[2].dateKey,
      departureDate: component.days()[5].dateKey,
      arrivalTime: '14:00'
    }];
    guestsView.next([]);

    expect(component.reservations().length).toBe(2);
    expect(component.visibleReservations().map((reservation) => reservation.guestName))
      .toEqual(['Huésped Reservado']);
    expect(component.categories().map((category) => category.name)).toEqual(['Dorm 6-camas']);
    expect(component.reservationCount()).toBe(1);
    fixture.detectChanges();
    const reservationCard = fixture.nativeElement.querySelector('.reservation-card') as HTMLElement;
    expect(reservationCard.style.backgroundColor).toBe(component.categories()[0].theme.background);
    expect(reservationCard.style.borderColor).toBe(component.categories()[0].theme.border);
    expect(reservationCard.style.color).toBe(component.categories()[0].theme.text);
    expect(component.categories()[0].theme.primary).toBe('#2475A3');

    calendarReservations = [];
    guestsView.next([]);

    expect(component.reservations()).toEqual([]);
    expect(component.categories().map((category) => category.name)).toEqual(['Dorm 6-camas']);
  });

  it('should display the saved rooms from /habitaciones by their saved room types', () => {
    savedRooms.set([
      createRoom(101, '101', 'Habitación Privada', 1),
      createRoom(102, '102', 'Habitación Privada', 1),
      createRoom(204, '204', 'Dorm 6-camas', 2)
    ]);

    expect(component.categories().map((category) => category.name))
      .toEqual(['Habitación Privada', 'Dorm 6-camas']);
    expect(component.categories()[0].rooms.map((room) => room.numero)).toEqual(['101', '102']);
    expect(component.categories()[1].rooms.map((room) => room.numero)).toEqual(['204']);
    expect(component.reservations()).toEqual([]);
  });

  it('should update the calendar when saved rooms change', () => {
    savedRooms.set([createRoom(101, '101', 'Habitación Privada', 1)]);
    expect(component.categories()[0].rooms.map((room) => room.numero)).toEqual(['101']);

    savedRooms.set([createRoom(102, '102', 'Habitación Privada', 1)]);
    expect(component.categories()[0].rooms.map((room) => room.numero)).toEqual(['102']);
  });

  it('should show categories from managed room types, including types without rooms', () => {
    savedRoomTypes.set([
      ...savedRoomTypes(),
      { id: 3, nombre: 'Suite nueva', capacidad: 3, color: '#A37824' }
    ]);

    const newCategory = component.categories().find((category) => category.name === 'Suite nueva');
    expect(newCategory).toBeTruthy();
    expect(newCategory?.count).toBe(0);
    expect(newCategory?.rooms).toEqual([]);
  });

  it('should clip reservation blocks to the visible date range', () => {
    const firstDate = component.days()[0].dateKey;
    savedRooms.set([createRoom(101, '101', 'Suite', 1)]);
    component.reservations.set([{
      id: 42,
      guestName: 'Huésped',
      roomNumero: '101',
      startDate: addDays(firstDate, -2),
      departureDate: addDays(firstDate, 3),
      categoryName: 'Suite',
      roomCapacity: 2
    }]);

    expect(component.getReservationsForRoom('101').length).toBe(1);
    expect(component.getGridColumnStart(component.getReservationsForRoom('101')[0])).toBe(1);
    expect(component.getGridColumnSpan(component.getReservationsForRoom('101')[0])).toBe(3);
  });
});

function createRoom(id: number, numero: string, tipo: string, tipologiaId: number) {
  return { id, numero, tipo, tipologiaId, tamanoM2: null, disposicionMuebles: '' };
}

function addDays(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(year, month - 1, day + days);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')
  ].join('-');
}
