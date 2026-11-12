import {
  ChangeDetectorRef,
  Component,
  computed,
  DestroyRef,
  DOCUMENT,
  ElementRef,
  inject,
  OnDestroy,
  OnInit,
  Renderer2,
  signal,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  bedOutline,
  calendarOutline,
  chevronBackOutline,
  chevronDownOutline,
  chevronForwardOutline,
  closeCircleOutline,
  createOutline,
  logInOutline,
  logOutOutline,
  logoWhatsapp,
  peopleOutline,
  timeOutline,
} from 'ionicons/icons';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HostalService, ReservationCalendarEntry } from '../../../../huespedes/application/hostal.service';
import { SedeService } from '../../../../locations/application/sede.service';
import { Habitacion, Huesped, Reserva } from '../../../../../shared/domain/hostal.model';
import { toTimelineMinutes } from '../../../domain/stay-schedule';

const VISIBLE_DAYS = 10;
const NAVIGATION_DAYS = 7;
const MINUTES_PER_DAY = 24 * 60;
const VISIBLE_MINUTES = VISIBLE_DAYS * MINUTES_PER_DAY;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];
const WEEKDAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

function dateKey(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function fromDateKey(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function addDays(value: string, days: number): string {
  const date = fromDateKey(value);
  date.setDate(date.getDate() + days);
  return dateKey(date);
}

export interface CategoryTheme {
  primary: string;
  background: string;
  border: string;
  text: string;
}

/** Barra de una reserva en la línea de tiempo: posición proporcional a la hora real. */
export interface ReservationBar {
  reservation: ReservationBlock;
  /** Inicio y ancho en % del rango visible (VISIBLE_DAYS). */
  leftPercent: number;
  widthPercent: number;
  /** Fila dentro de la habitación (solo > 0 si hay reservas antiguas que se cruzan). */
  lane: number;
}

export interface ReservationBlock {
  id: number;
  guestName: string;
  roomNumber: string;
  roomType: string;
  arrivalDate: string;
  departureDate: string;
  arrivalTime: string;
  departureTime: string;
  status: ReservationCalendarEntry['status'];
}

export interface DayColumn {
  dateKey: string;
  dayName: string;
  dayNumber: number;
  monthName: string;
  isCurrent: boolean;
}

/** Datos que muestra el modal al hacer click en una reserva del calendario. */
export interface ReservationDetail {
  reservation: Reserva;
  guest: Huesped | undefined;
  guestName: string;
  roomNumber: string;
  roomType: string;
  nights: number;
}

interface CalendarDay {
  dateKey: string;
  dayNumber: number;
  isCurrentMonth: boolean;
  isSelected: boolean;
  isToday: boolean;
}

@Component({
  selector: 'app-reservas',
  templateUrl: './reservas.page.html',
  styleUrls: ['./reservas.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonIcon],
})
export class ReservasPage implements OnInit, OnDestroy {
  private readonly hostalService = inject(HostalService);
  private readonly sedeService = inject(SedeService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly renderer = inject(Renderer2);
  private readonly document = inject(DOCUMENT);
  private readonly changeDetector = inject(ChangeDetectorRef);

  @ViewChild('reservationDialog') reservationDialog?: ElementRef<HTMLDialogElement>;

  /** Reserva abierta en el modal y si se está viendo el detalle o editándola. */
  readonly selectedReservationId = signal<number | null>(null);
  readonly reservationModalMode = signal<'detail' | 'edit'>('detail');
  readonly reservationError = signal('');
  readonly reservationMessage = signal('');
  availableReservationRooms: Habitacion[] = [];
  editReservationForm = {
    fecha_llegada: '',
    fecha_salida: '',
    hora_llegada: '14:00',
    hora_salida: '12:00',
    cantidad_personas: 1,
    id_habitacion: '',
  };

  readonly reservationDetail = computed<ReservationDetail | null>(() => {
    const id = this.selectedReservationId();
    // Se lee la señal para recalcular cuando el servicio refresca las reservas.
    this.reservations();
    if (id === null) return null;
    const reservation = this.hostalService.getReservations().find((item) => item.id_reserva === id);
    if (!reservation) return null;
    const detail = this.hostalService.getGuestReservationDetails(reservation.id_huesped)
      .find((item) => item.reservation.id_reserva === id);
    const guest = this.hostalService.getGuests().find((item) => item.id_huesped === reservation.id_huesped);
    return {
      reservation,
      guest,
      guestName: guest ? `${guest.nombre} ${guest.apellido}` : 'Huésped',
      roomNumber: detail?.roomNumber ?? '',
      roomType: detail?.roomType ?? '',
      nights: detail?.nights ?? 0,
    };
  });

  readonly sede = this.sedeService.selectedSede;
  readonly savedRooms = this.sedeService.habitaciones;
  readonly roomTypes = this.sedeService.tipologias;
  readonly reservations = signal<ReservationBlock[]>([]);
  readonly collapsedCategories = signal<Set<string>>(new Set());
  readonly viewStartDate = signal(dateKey(new Date()));
  readonly selectedDate = signal(dateKey(new Date()));
  readonly datePickerOpen = signal(false);
  readonly pickerMonth = signal(new Date(new Date().getFullYear(), new Date().getMonth(), 1));

  readonly days = computed(() => this.createDays(this.viewStartDate()));
  readonly miniCalendarDays = computed(() => this.createMiniCalendarDays(this.pickerMonth()));
  readonly dateRangeLabel = computed(() => {
    const first = this.days()[0];
    const last = this.days()[this.days().length - 1];
    return `${first.dayNumber} ${first.monthName} — ${last.dayNumber} ${last.monthName} ${last.dateKey.slice(0, 4)}`;
  });

  readonly categories = computed(() => {
    const types = this.roomTypes();
    const groups = new Map<string, {
      theme: CategoryTheme;
      rooms: { numero: string; name: string; capacity: number }[];
    }>();

    types.forEach((type) => groups.set(type.nombre, {
      theme: this.getThemeForColor(type.color ?? '#64748b'),
      rooms: [],
    }));

    this.savedRooms().forEach((room) => {
      const type = types.find((item) => item.id === room.tipologiaId) ??
        types.find((item) => item.nombre.toLocaleLowerCase() === room.tipo.toLocaleLowerCase());
      if (!type) return;
      groups.get(type.nombre)?.rooms.push({
        numero: room.numero,
        name: `Habitación ${room.numero}`,
        capacity: type.capacidad,
      });
    });

    return Array.from(groups.entries()).map(([name, group]) => ({
      name,
      count: group.rooms.length,
      theme: group.theme,
      rooms: group.rooms,
    }));
  });

  private readonly managedRoomNumbers = computed(() => {
    const numbers = new Set<string>();
    this.categories().forEach((category) =>
      category.rooms.forEach((room) => numbers.add(room.numero))
    );
    return numbers;
  });

  readonly visibleReservations = computed(() => {
    const start = this.viewStartDate();
    const end = addDays(start, VISIBLE_DAYS);
    const managedRooms = this.managedRoomNumbers();
    return this.reservations().filter((reservation) =>
      managedRooms.has(reservation.roomNumber) &&
      reservation.status !== 'CANCELADA' &&
      reservation.arrivalDate < end &&
      reservation.departureDate >= start
    );
  });

  readonly selectedDateReservations = computed(() => {
    const selected = this.selectedDate();
    const managedRooms = this.managedRoomNumbers();
    return this.reservations().filter((reservation) =>
      managedRooms.has(reservation.roomNumber) &&
      reservation.status !== 'CANCELADA' &&
      reservation.arrivalDate <= selected &&
      (reservation.departureDate > selected || reservation.arrivalDate === selected)
    );
  });

  readonly reservationCount = computed(() => this.selectedDateReservations().length);
  readonly arrivalCount = computed(() =>
    this.reservations().filter((reservation) =>
      reservation.status !== 'CANCELADA' &&
      reservation.arrivalDate === this.selectedDate() &&
      this.managedRoomNumbers().has(reservation.roomNumber)
    ).length
  );
  readonly departureCount = computed(() =>
    this.reservations().filter((reservation) =>
      reservation.status !== 'CANCELADA' &&
      reservation.departureDate === this.selectedDate() &&
      this.managedRoomNumbers().has(reservation.roomNumber)
    ).length
  );

  constructor() {
    addIcons({
      bedOutline,
      calendarOutline,
      chevronBackOutline,
      chevronDownOutline,
      chevronForwardOutline,
      closeCircleOutline,
      createOutline,
      logInOutline,
      logOutOutline,
      logoWhatsapp,
      peopleOutline,
      timeOutline,
    });
  }

  ngOnDestroy(): void {
    const dialog = this.reservationDialog?.nativeElement;
    if (dialog?.open) dialog.close();
    this.setPageScrollLocked(false);
  }

  // ── Modal de reserva ──────────────────────────────────────────────────────

  openReservation(reservationId: number): void {
    if (!this.hostalService.getReservations().some((item) => item.id_reserva === reservationId)) {
      this.reservationMessage.set('No se encontró la reserva. Actualiza la vista e inténtalo otra vez.');
      return;
    }
    this.selectedReservationId.set(reservationId);
    this.reservationModalMode.set('detail');
    this.reservationError.set('');
    this.reservationMessage.set('');
    this.setPageScrollLocked(true);
    this.changeDetector.detectChanges();
    const dialog = this.reservationDialog?.nativeElement;
    if (dialog && !dialog.open) dialog.showModal();
  }

  closeReservationModal(): void {
    const dialog = this.reservationDialog?.nativeElement;
    if (dialog?.open) dialog.close();
    this.selectedReservationId.set(null);
    this.reservationModalMode.set('detail');
    this.reservationError.set('');
    this.setPageScrollLocked(false);
  }

  onReservationDialogCancel(event: Event): void {
    event.preventDefault();
    if (this.reservationModalMode() === 'edit') this.backToReservationDetail();
    else this.closeReservationModal();
  }

  startReservationEdit(): void {
    const reservation = this.reservationDetail()?.reservation;
    if (!reservation) return;
    this.editReservationForm = {
      fecha_llegada: reservation.fecha_llegada,
      fecha_salida: reservation.fecha_salida,
      hora_llegada: reservation.hora_llegada ?? '14:00',
      hora_salida: reservation.hora_salida ?? '12:00',
      cantidad_personas: reservation.cantidad_personas ?? 1,
      id_habitacion: String(reservation.id_habitacion),
    };
    this.reservationError.set('');
    this.refreshAvailableReservationRooms();
    this.reservationModalMode.set('edit');
  }

  backToReservationDetail(): void {
    this.reservationError.set('');
    this.reservationModalMode.set('detail');
  }

  refreshAvailableReservationRooms(): void {
    const id = this.selectedReservationId();
    if (id === null) return;
    this.availableReservationRooms = this.hostalService.getAvailableRooms(
      this.editReservationForm.fecha_llegada,
      this.editReservationForm.fecha_salida,
      this.editReservationForm.cantidad_personas,
      id,
      { arrivalTime: this.editReservationForm.hora_llegada, departureTime: this.editReservationForm.hora_salida },
    );
  }

  get isReservationRoomAvailable(): boolean {
    return this.availableReservationRooms.some(
      (room) => room.id_habitacion === Number(this.editReservationForm.id_habitacion)
    );
  }

  async saveReservationChanges(): Promise<void> {
    const id = this.selectedReservationId();
    if (id === null) return;
    try {
      await this.hostalService.updateReservation(id, {
        id_habitacion: Number(this.editReservationForm.id_habitacion),
        fecha_llegada: this.editReservationForm.fecha_llegada,
        fecha_salida: this.editReservationForm.fecha_salida,
        hora_llegada: this.editReservationForm.hora_llegada,
        hora_salida: this.editReservationForm.hora_salida || '12:00',
        cantidad_personas: this.editReservationForm.cantidad_personas,
      });
      this.reservationError.set('');
      this.reservationModalMode.set('detail');
      this.reservationMessage.set('Reserva actualizada correctamente.');
    } catch (error) {
      this.reservationError.set(error instanceof Error ? error.message : 'No se pudo actualizar la reserva.');
    }
  }

  async cancelReservation(): Promise<void> {
    const id = this.selectedReservationId();
    if (id === null) return;
    if (!this.document.defaultView?.confirm('¿Confirmas que quieres cancelar esta reserva? El huésped permanecerá registrado.')) {
      return;
    }
    try {
      await this.hostalService.cancelReservation(id);
      this.closeReservationModal();
      this.reservationMessage.set('Reserva cancelada. El huésped continúa registrado.');
    } catch (error) {
      this.reservationError.set(error instanceof Error ? error.message : 'No se pudo cancelar la reserva.');
    }
  }

  canCancelReservation(status: Reserva['estado_reserva']): boolean {
    return status !== 'FINALIZADA' && status !== 'CANCELADA';
  }

  reservationStatusClass(status: Reserva['estado_reserva']): string {
    const classes: Record<Reserva['estado_reserva'], string> = {
      'HOSPEDADO': 'hospedado',
      'CHECK-IN HOY': 'checkin_hoy',
      'CHECK-OUT HOY': 'checkout_hoy',
      'CONFIRMADA': 'confirmada',
      'FINALIZADA': 'finalizada',
      'CANCELADA': 'cancelada',
    };
    return classes[status];
  }

  formatDate(value: string): string {
    const [year, month, day] = value.split('-');
    return day && month && year ? `${day}/${month}/${year}` : value;
  }

  /** Enlace de WhatsApp Web para el teléfono del huésped, o null si no hay número usable. */
  whatsappUrl(phone?: string): string | null {
    const digits = (phone ?? '').replace(/\D/g, '');
    return digits.length >= 6 ? `https://web.whatsapp.com/send?phone=${digits}` : null;
  }

  private setPageScrollLocked(locked: boolean): void {
    if (locked) this.renderer.addClass(this.document.body, 'entry-modal-open');
    else this.renderer.removeClass(this.document.body, 'entry-modal-open');
  }

  ngOnInit(): void {
    this.hostalService.guestsView$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.reservations.set(this.hostalService.getReservationCalendarData()
          .map((reservation) => this.toReservationBlock(reservation)));
      });
  }

  toggleCategory(name: string): void {
    this.collapsedCategories.update((current) => {
      const next = new Set(current);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  isCategoryCollapsed(name: string): boolean {
    return this.collapsedCategories().has(name);
  }

  goToPreviousWeek(): void {
    this.moveCalendar(-NAVIGATION_DAYS);
  }

  goToNextWeek(): void {
    this.moveCalendar(NAVIGATION_DAYS);
  }

  goToToday(): void {
    const today = dateKey(new Date());
    this.viewStartDate.set(today);
    this.selectedDate.set(today);
    this.pickerMonth.set(new Date());
  }

  selectDay(value: string): void {
    this.selectedDate.set(value);
    const start = this.viewStartDate();
    const end = addDays(start, VISIBLE_DAYS);
    if (value < start || value >= end) this.viewStartDate.set(value);
  }

  toggleDatePicker(): void {
    this.datePickerOpen.update((open) => !open);
    if (this.datePickerOpen()) this.pickerMonth.set(fromDateKey(this.selectedDate()));
  }

  movePickerMonth(offset: number): void {
    this.pickerMonth.update((month) => new Date(month.getFullYear(), month.getMonth() + offset, 1));
  }

  changePickerMonth(month: string): void {
    this.pickerMonth.update((current) => new Date(current.getFullYear(), Number(month), 1));
  }

  changePickerYear(year: string): void {
    this.pickerMonth.update((current) => new Date(Number(year), current.getMonth(), 1));
  }

  selectPickerDay(day: CalendarDay): void {
    this.selectDay(day.dateKey);
    this.datePickerOpen.set(false);
  }

  /**
   * Barras de cada habitación posicionadas por fecha + hora dentro de los días visibles
   * (llegar a las 14:00 empieza en el 58% del día). Si dos reservas se cruzan (datos antiguos),
   * van en filas distintas para no taparse.
   */
  readonly roomBars = computed(() => {
    const viewStart = toTimelineMinutes(this.viewStartDate(), '00:00');
    const viewEnd = viewStart + VISIBLE_MINUTES;
    const bars = new Map<string, ReservationBar[]>();

    const sorted = [...this.visibleReservations()]
      .map((reservation) => ({ reservation, ...this.reservationMinutes(reservation) }))
      .filter((item) => item.end > viewStart && item.start < viewEnd)
      .sort((a, b) => a.start - b.start);

    const laneEnds = new Map<string, number[]>();
    for (const item of sorted) {
      const room = item.reservation.roomNumber;
      const lanes = laneEnds.get(room) ?? [];
      let lane = lanes.findIndex((end) => end <= item.start);
      if (lane === -1) lane = lanes.length;
      lanes[lane] = item.end;
      laneEnds.set(room, lanes);

      const start = Math.max(item.start, viewStart);
      const end = Math.min(item.end, viewEnd);
      const list = bars.get(room) ?? [];
      list.push({
        reservation: item.reservation,
        leftPercent: ((start - viewStart) / VISIBLE_MINUTES) * 100,
        widthPercent: ((end - start) / VISIBLE_MINUTES) * 100,
        lane,
      });
      bars.set(room, list);
    }
    return bars;
  });

  getRoomBars(roomNumber: string): ReservationBar[] {
    return this.roomBars().get(roomNumber) ?? [];
  }

  getRoomLaneCount(roomNumber: string): number {
    return Math.max(1, ...this.getRoomBars(roomNumber).map((bar) => bar.lane + 1));
  }

  private reservationMinutes(reservation: ReservationBlock): { start: number; end: number } {
    const time = (value: string, fallback: string) => (TIME_PATTERN.test(value) ? value : fallback);
    return {
      start: toTimelineMinutes(reservation.arrivalDate, time(reservation.arrivalTime, '14:00')),
      end: toTimelineMinutes(reservation.departureDate, time(reservation.departureTime, '12:00')),
    };
  }

  getThemeForColor(color: string): CategoryTheme {
    const validColor = /^#[0-9a-f]{6}$/i.test(color) ? color : '#64748b';
    return {
      primary: validColor,
      background: `color-mix(in srgb, ${validColor} 13%, white)`,
      border: `color-mix(in srgb, ${validColor} 38%, white)`,
      text: validColor,
    };
  }

  private moveCalendar(offset: number): void {
    this.viewStartDate.update((start) => addDays(start, offset));
  }

  private toReservationBlock(reservation: ReservationCalendarEntry): ReservationBlock {
    return {
      id: reservation.id,
      guestName: reservation.guestName,
      roomNumber: reservation.roomNumber,
      roomType: reservation.roomType,
      arrivalDate: reservation.arrivalDate,
      departureDate: reservation.departureDate,
      arrivalTime: reservation.arrivalTime || '14:00',
      departureTime: reservation.departureTime || '12:00',
      status: reservation.status,
    };
  }

  private createDays(start: string): DayColumn[] {
    const today = dateKey(new Date());
    return Array.from({ length: VISIBLE_DAYS }, (_, index) => {
      const value = addDays(start, index);
      const date = fromDateKey(value);
      return {
        dateKey: value,
        dayName: WEEKDAYS[date.getDay()].toUpperCase(),
        dayNumber: date.getDate(),
        monthName: MONTHS[date.getMonth()].slice(0, 3),
        isCurrent: value === today,
      };
    });
  }

  private createMiniCalendarDays(month: Date): CalendarDay[] {
    const year = month.getFullYear();
    const monthIndex = month.getMonth();
    const firstDay = new Date(year, monthIndex, 1);
    const offset = firstDay.getDay();
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const previousMonthDays = new Date(year, monthIndex, 0).getDate();
    const today = dateKey(new Date());

    return Array.from({ length: 42 }, (_, index) => {
      const dayNumber = index - offset + 1;
      const date = dayNumber < 1
        ? new Date(year, monthIndex - 1, previousMonthDays + dayNumber)
        : dayNumber > daysInMonth
          ? new Date(year, monthIndex + 1, dayNumber - daysInMonth)
          : new Date(year, monthIndex, dayNumber);
      const value = dateKey(date);
      return {
        dateKey: value,
        dayNumber: date.getDate(),
        isCurrentMonth: date.getMonth() === monthIndex,
        isSelected: value === this.selectedDate(),
        isToday: value === today,
      };
    });
  }
}
