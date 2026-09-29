import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  chevronBackOutline,
  chevronForwardOutline,
  chevronDownOutline,
  calendarOutline,
  logInOutline,
  logOutOutline,
  bedOutline
} from 'ionicons/icons';
import {
  HostalService,
  ReservationCalendarEntry
} from '../../../../guests/application/hostal.service';
import { SedeService } from '../../../../locations/application/sede.service';

export interface CategoryTheme {
  primary: string;    // Color principal (puntos, bordes principales)
  background: string; // Fondo suave para las tarjetas de reserva
  border: string;     // Borde de la tarjeta de reserva
  text: string;       // Color de la tipografía dentro del bloque
}

export interface ReservationBlock {
  id: number;
  roomNumero: string;
  guestName: string;
  startDate: string;
  departureDate: string;
  categoryName: string; // Nombre dinámico de la tipología
  roomCapacity: number;
}

export interface DayColumn {
  dateKey: string;
  dayName: string;
  dayNumber: number;
  monthName: string;
  isCurrent?: boolean;
}

interface MiniCalendarDay {
  dateKey: string;
  dayNumber: number;
  inCurrentMonth: boolean;
}

const VISIBLE_DAYS = 14;
const NAVIGATION_DAYS = 7;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
const CALENDAR_YEARS = Array.from({ length: 201 }, (_, index) => 1900 + index);
const CALENDAR_MONTHS = Array.from({ length: 12 }, (_, month) =>
  new Date(2024, month, 1).toLocaleDateString('es-ES', { month: 'long' })
);

interface CalendarRoom {
  numero: string;
  name: string;
  capacity: number;
}

interface ReservationCategory {
  name: string;
  count: number;
  theme: CategoryTheme;
  rooms: CalendarRoom[];
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function localDateKey(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')
  ].join('-');
}

function addDaysToDateKey(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  return localDateKey(date);
}

function dateKeyOffset(startDateKey: string, targetDateKey: string): number {
  return (Date.parse(`${targetDateKey}T00:00:00Z`) - Date.parse(`${startDateKey}T00:00:00Z`)) /
    MILLISECONDS_PER_DAY;
}

@Component({
  selector: 'app-reservas',
  templateUrl: './reservas.page.html',
  styleUrls: ['./reservas.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonIcon]
})
export class ReservasPage implements OnInit {
  private readonly hostalService = inject(HostalService);
  private readonly sedeService = inject(SedeService);
  private readonly destroyRef = inject(DestroyRef);

  readonly reservations = signal<ReservationBlock[]>([]);
  readonly savedRooms = this.sedeService.habitaciones;
  readonly roomTypes = this.sedeService.tipologias;
  readonly collapsedCategories = signal<Set<string>>(new Set<string>());
  readonly viewStartDate = signal(startOfDay(new Date()));
  readonly selectedDate = signal(localDateKey(new Date()));
  readonly datePickerOpen = signal(false);
  readonly pickerMonth = signal(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  readonly calendarMonths = CALENDAR_MONTHS;
  readonly calendarYears = CALENDAR_YEARS;
  readonly days = computed(() => this.createDays(this.viewStartDate()));
  readonly miniCalendarDays = computed(() => this.createMiniCalendarDays(this.pickerMonth()));
  readonly managedRoomNumbers = computed(() => {
    const roomNumbers = new Set<string>();
    this.categories().forEach((category) =>
      category.rooms.forEach((room) => roomNumbers.add(room.numero))
    );
    return roomNumbers;
  });
  readonly visibleReservations = computed(() => {
    const startDate = localDateKey(this.viewStartDate());
    const endDate = addDaysToDateKey(startDate, VISIBLE_DAYS);
    const managedRoomNumbers = this.managedRoomNumbers();
    return this.reservations().filter((reservation) =>
      managedRoomNumbers.has(reservation.roomNumero) &&
      reservation.startDate < endDate && reservation.departureDate > startDate
    );
  });
  readonly selectedDateReservations = computed(() => {
    const selectedDate = this.selectedDate();
    const managedRoomNumbers = this.managedRoomNumbers();
    return this.reservations().filter((reservation) =>
      managedRoomNumbers.has(reservation.roomNumero) &&
      reservation.startDate <= selectedDate && reservation.departureDate > selectedDate
    );
  });
  readonly reservationCount = computed(() => this.selectedDateReservations().length);
  readonly arrivalCount = computed(() => this.reservations().filter((reservation) =>
    reservation.startDate === this.selectedDate() &&
    this.managedRoomNumbers().has(reservation.roomNumero)
  ).length);
  readonly departureCount = computed(() => this.reservations().filter((reservation) =>
    reservation.departureDate === this.selectedDate() &&
    this.managedRoomNumbers().has(reservation.roomNumero)
  ).length);
  readonly dateRangeLabel = computed(() => {
    const firstDay = this.days()[0];
    const lastDay = this.days()[this.days().length - 1];
    return `${firstDay.dayNumber} ${firstDay.monthName} — ${lastDay.dayNumber} ${lastDay.monthName} ${lastDay.dateKey.slice(0, 4)}`;
  });

  readonly categories = computed(() => {
    const grouped = new Map<string, {
      rooms: Map<string, CalendarRoom>;
      theme: CategoryTheme;
    }>();
    const tipologias = this.roomTypes();

    tipologias.forEach((tipologia) => {
      grouped.set(tipologia.nombre, {
        rooms: new Map(),
        theme: this.getThemeForColor(tipologia.color ?? '#64748b')
      });
    });

    this.savedRooms().forEach((room) => {
      const tipologia = tipologias.find((item) => item.id === room.tipologiaId) ??
        tipologias.find((item) => item.nombre.toLocaleLowerCase() === room.tipo.toLocaleLowerCase());
      if (!tipologia) return;
      grouped.get(tipologia.nombre)!.rooms.set(room.numero, {
        numero: room.numero,
        name: `Habitación ${room.numero}`,
        capacity: tipologia.capacidad
      });
    });

    return Array.from(grouped.entries()).map(([name, category]): ReservationCategory => ({
      name,
      count: category.rooms.size,
      theme: category.theme,
      rooms: Array.from(category.rooms.values())
    }));
  });

  constructor() {
    addIcons({
      chevronBackOutline,
      chevronForwardOutline,
      chevronDownOutline,
      calendarOutline,
      logInOutline,
      logOutOutline,
      bedOutline
    });
  }

  ngOnInit(): void {
    this.hostalService.guestsView$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.reservations.set(this.hostalService.getReservationCalendarData()
          .map((reservation) => this.toReservationBlock(reservation)));
      });
  }

  toggleCategory(categoryName: string): void {
    this.collapsedCategories.update((set) => {
      const updated = new Set(set);
      if (updated.has(categoryName)) {
        updated.delete(categoryName);
      } else {
        updated.add(categoryName);
      }
      return updated;
    });
  }

  isCategoryCollapsed(categoryName: string): boolean {
    return this.collapsedCategories().has(categoryName);
  }

  goToPreviousWeek(): void {
    this.moveCalendar(-NAVIGATION_DAYS);
  }

  goToNextWeek(): void {
    this.moveCalendar(NAVIGATION_DAYS);
  }

  goToToday(): void {
    const today = startOfDay(new Date());
    this.viewStartDate.set(today);
    this.selectedDate.set(localDateKey(today));
  }

  toggleDatePicker(): void {
    if (!this.datePickerOpen()) {
      const [year, month, day] = this.selectedDate().split('-').map(Number);
      this.pickerMonth.set(new Date(year, month - 1, day));
    }
    this.datePickerOpen.update((isOpen) => !isOpen);
  }

  closeDatePicker(): void {
    this.datePickerOpen.set(false);
  }

  changePickerMonth(month: string): void {
    const current = this.pickerMonth();
    this.pickerMonth.set(new Date(current.getFullYear(), Number(month), 1));
  }

  changePickerYear(year: string): void {
    const current = this.pickerMonth();
    this.pickerMonth.set(new Date(Number(year), current.getMonth(), 1));
  }

  movePickerMonth(offset: number): void {
    const current = this.pickerMonth();
    this.pickerMonth.set(new Date(current.getFullYear(), current.getMonth() + offset, 1));
  }

  selectPickerDate(dateKey: string): void {
    const date = this.dateFromKey(dateKey);
    this.selectedDate.set(dateKey);
    this.viewStartDate.set(date);
    this.closeDatePicker();
  }

  selectDay(dateKey: string): void {
    this.selectedDate.set(dateKey);
  }

  isToday(dateKey: string): boolean {
    return dateKey === localDateKey(new Date());
  }

  getThemeForColor(color: string): CategoryTheme {
    return {
      primary: color,
      background: `color-mix(in srgb, ${color} 12%, white)`,
      border: `color-mix(in srgb, ${color} 38%, white)`,
      text: `color-mix(in srgb, ${color} 78%, #111827)`
    };
  }

  getReservationsForRoom(roomNumero: string): ReservationBlock[] {
    return this.visibleReservations().filter((res) => String(res.roomNumero) === String(roomNumero));
  }

  getGridColumnStart(reservation: ReservationBlock): number {
    const firstVisibleDate = this.days()[0].dateKey;
    return Math.max(0, dateKeyOffset(firstVisibleDate, reservation.startDate)) + 1;
  }

  getGridColumnSpan(reservation: ReservationBlock): number {
    const firstVisibleDate = this.days()[0].dateKey;
    const arrivalOffset = Math.max(0, dateKeyOffset(firstVisibleDate, reservation.startDate));
    const departureOffset = Math.min(VISIBLE_DAYS, dateKeyOffset(firstVisibleDate, reservation.departureDate));
    return Math.max(1, departureOffset - arrivalOffset);
  }

  private moveCalendar(days: number): void {
    const nextStartDate = new Date(this.viewStartDate());
    nextStartDate.setDate(nextStartDate.getDate() + days);
    this.viewStartDate.set(nextStartDate);
    this.selectedDate.set(addDaysToDateKey(this.selectedDate(), days));
  }

  private createDays(startDate: Date): DayColumn[] {
    return Array.from({ length: VISIBLE_DAYS }, (_, index) => {
      const date = new Date(startDate);
      date.setDate(date.getDate() + index);
      const dateKey = localDateKey(date);

      return {
        dateKey,
        dayName: date.toLocaleDateString('es-ES', { weekday: 'short' }).replace('.', '').toUpperCase(),
        dayNumber: date.getDate(),
        monthName: date.toLocaleDateString('es-ES', { month: 'short' })
          .replace('.', '')
          .replace(/^./, (character) => character.toLocaleUpperCase()),
        isCurrent: dateKey === localDateKey(new Date())
      };
    });
  }

  private createMiniCalendarDays(month: Date): MiniCalendarDay[] {
    const firstOfMonth = new Date(month.getFullYear(), month.getMonth(), 1);
    const firstVisibleDate = new Date(firstOfMonth);
    firstVisibleDate.setDate(firstVisibleDate.getDate() - ((firstOfMonth.getDay() + 6) % 7));

    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(firstVisibleDate);
      date.setDate(date.getDate() + index);
      return {
        dateKey: localDateKey(date),
        dayNumber: date.getDate(),
        inCurrentMonth: date.getMonth() === month.getMonth()
      };
    });
  }

  private dateFromKey(dateKey: string): Date {
    const [year, month, day] = dateKey.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  private toReservationBlock(reservation: ReservationCalendarEntry): ReservationBlock {
    return {
      id: reservation.id,
      roomNumero: reservation.roomNumber,
      guestName: reservation.guestName,
      startDate: reservation.arrivalDate,
      departureDate: reservation.departureDate,
      categoryName: reservation.roomType,
      roomCapacity: reservation.roomCapacity
    };
  }
}