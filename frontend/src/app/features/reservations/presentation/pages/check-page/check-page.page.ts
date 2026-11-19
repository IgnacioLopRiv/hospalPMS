import { EscapeCloseDirective } from '../../../../../shared/presentation/modal-portal/escape-close.directive';
import { Component, ComponentRef, EventEmitter, HostListener, inject, Input, OnDestroy, OnInit, Output, Renderer2, ViewContainerRef } from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { IonIcon } from '@ionic/angular/standalone';
import { firstValueFrom, Subscription } from 'rxjs';
import { addIcons } from 'ionicons';
import {
  alertCircleOutline,
  enterOutline,
  exitOutline,
  bedOutline,
  calendarOutline,
  peopleOutline,
  star,
  callOutline,
  logoWhatsapp,
  mailOutline,
  logInOutline,
  logOutOutline,
  ellipsisVerticalOutline,
  informationCircleOutline,
  checkmarkCircleOutline,
  checkmarkOutline,
  swapHorizontalOutline,
  closeOutline,
  cashOutline,
  cardOutline,
  chevronDownOutline,
  searchOutline,
  personOutline,
  closeCircleOutline,
  createOutline,
} from 'ionicons/icons';
import { SedeService } from '../../../../locations/application/sede.service';
import {
  EntryReservationError,
  HostalService,
  ReservationCalendarEntry,
} from '../../../../huespedes/application/hostal.service';
import { getApiErrorMessage } from '../../../../../shared/domain/api-error-message';
import { isRoomReadyForGuest, isValidStayRange, stayInterval } from '../../../domain/stay-schedule';
import { GuestCardView, Huesped, Habitacion, MetodoPagoReserva, MetodoPagoTarjeta, Reserva, SedeHabitacion, SedeTipologia } from '../../../../../shared/domain/hostal.model';
import { PosCobroService, PosDisponible } from '../../../../payments-pos/application/pos-cobro.service';
import { PosCobroEstadoComponent } from '../../../../payments-pos/presentation/pos-cobro-estado/pos-cobro-estado.component';
import { COUNTRY_OPTIONS } from '../../../../../shared/domain/country-options';
import { CountryPickerComponent } from '../../../../../shared/presentation/country-picker/country-picker.component';
import { RoomPickerComponent } from '../../../../../shared/presentation/room-picker/room-picker.component';
import { FotoHabitacionService } from '../../../../locations/application/foto-habitacion.service';
import { FotoHabitacion } from '../../../../locations/domain/foto-habitacion.model';
import { InventarioService } from '../../../../inventory/application/inventario.service';
import { Tarifa, TarifasRepository } from '../../../../locations/domain/tarifas.repository';
import { ModalPortalDirective } from '../../../../../shared/presentation/modal-portal/modal-portal.directive';
import {
  isValidPhoneFormat,
  limitPhoneDigits,
  maxPhoneDigits,
  PHONE_FORMAT_ERROR,
} from '../../../../../shared/domain/phone-format';

export interface GuestDraft {
  documentType: 'rut' | 'passport';
  documento: string;
  nombre: string;
  apellido: string;
  telefono: string;
  phoneCountry: string;
  email: string;
  nacionalidad: string;
}

type PaymentMethod = MetodoPagoReserva;

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  transferencia: 'transferencia',
  efectivo: 'efectivo',
  debito: 'tarjeta de débito',
  credito: 'tarjeta de crédito',
};

const isCardMethod = (method: PaymentMethod | ''): method is MetodoPagoTarjeta =>
  method === 'debito' || method === 'credito';
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

interface StoredTarifa {
  periodos: StoredTarifaPeriod[];
  precios: Record<number, number>;
}

interface ReservationQuote {
  nights: number;
  total: number;
  depositPercentage: number;
  deposit: number;
  typologyName: string;
  roomNumber: string;
  guestName: string;
}

/** Comprobante que se muestra tras cobrar una reserva nueva o el saldo del check-in. */
export interface PaymentReceipt {
  subtitle: string;
  guestName: string;
  roomNumber: string;
  typologyName: string;
  arrivalDate: string;
  arrivalTime: string;
  departureDate: string;
  departureTime: string;
  nights: number;
  personCount: number;
  total: number;
  /** Lo pagado antes de este cobro (abono de la reserva). */
  previouslyPaid?: number;
  paid: number;
  pending: number;
  methodLabel: string;
  reference: string;
  paidAt: Date;
  note?: string;
}

export interface CheckItemPlaceholder {
  id: number;
  guestName: string;
  initials: string;
  country: string;
  phone?: string;
  email?: string;
  roomNumber: string;
  roomType: string;
  dateRange: string;
  nights: number;
  scheduledTime: string;
  timeWindowLabel: string;
  statusBadge: string;
  avatarColor: 'green' | 'orange' | 'blue' | 'purple';
  totalAmount: number;
  amountPaid: number;
  outstandingBalance: number;
  hasPaymentRecord: boolean;
  notes?: string;
  isVip?: boolean;
  /** Llegada o salida de un día anterior que sigue pendiente. */
  isOverdue?: boolean;
}

@Component({
  selector: 'app-check-page',
  templateUrl: './check-page.page.html',
  styleUrls: ['./check-page.page.scss'],
  standalone: true,
  imports: [EscapeCloseDirective, CommonModule, FormsModule, IonIcon, CountryPickerComponent, ModalPortalDirective, PosCobroEstadoComponent, RoomPickerComponent],
})
export class CheckPagePage implements OnInit, OnDestroy {
  private readonly sedeService = inject(SedeService);
  private readonly hostalService = inject(HostalService);
  private readonly renderer = inject(Renderer2);
  private readonly document = inject(DOCUMENT);
  private readonly fotoHabitacionService = inject(FotoHabitacionService);
  private readonly inventarioService = inject(InventarioService);
  private readonly tarifasRepository = inject(TarifasRepository);
  readonly posCobro = inject(PosCobroService);
  private readonly viewContainer = inject(ViewContainerRef);
  /** Página de Huéspedes embebida en modo "solo modales" sobre Recepción. */
  private guestModalRef: ComponentRef<unknown> | null = null;
  /** Terminal POS activo de la sede; sin él, débito y crédito quedan deshabilitados. */
  posDisponible: PosDisponible | null = null;
  posLoading = false;
  /** Comprobante del pago recién aprobado; mientras exista se muestra en lugar del formulario. */
  paymentReceipt: PaymentReceipt | null = null;
  /** Comprobante del saldo cobrado al hacer check-in. */
  checkInReceipt: PaymentReceipt | null = null;
  private receiptMessage = '';
  /** Reserva cuyo saldo ya se cobró en el POS, por si el check-in falla después. */
  private checkInPaidByPos: number | null = null;
  private tarifasConfig: { sedeId: number; porcentajeAbono: number; tarifas: Tarifa[] } | null = null;
  readonly phoneFormatError = PHONE_FORMAT_ERROR;
  @Input() modalOnly = false;
  @Input() guestDraft?: GuestDraft;
  @Input() existingGuestId: number | null = null;
  @Input() startAtReservationDetails = false;
  @Output() entryModalClosed = new EventEmitter<void>();
  @Output() entryRegistered = new EventEmitter<string>();
  readonly sede = this.sedeService.selectedSede;
  readonly sedeTipologias = this.sedeService.tipologias;
  availableGuests: Huesped[] = [];
  guestCardColors = new Map<number, GuestCardView['cardColor']>();
  availableRooms: Habitacion[] = [];
  roomNightlyPrices = new Map<number, number | null>();
  isSearchingRooms = false;
  roomDetails: SedeHabitacion | null = null;
  roomDetailsTab: 'details' | 'inventory' | 'photos' = 'details';
  expandedRoomPhoto: FotoHabitacion | null = null;
  showNewEntryForm = false;
  entryError = '';
  entrySuccessMessage = '';
  movementError = '';
  showCloseConfirmation = false;
  checkInPaymentItem: CheckItemPlaceholder | null = null;
  checkInPaymentMethod: PaymentMethod | '' = '';
  checkInPaymentError = '';
  documentFieldFocused = false;
  emailFieldFocused = false;
  phoneFieldFocused = false;
  guestMode: 'new' | 'existing' = 'new';
  selectedGuestId = '';
  guestPickerOpen = false;
  guestSearchQuery = '';
  entryStep: 1 | 2 | 3 | 4 = 1;
  entryForm = this.createEmptyEntryForm();
  paymentOption: 'deposit' | 'full' = 'deposit';
  paymentMethod: PaymentMethod | '' = '';
  reservationQuote: ReservationQuote | null = null;
  readonly countries = COUNTRY_OPTIONS;

  private clockInterval?: ReturnType<typeof setInterval>;
  private reservationSubscription?: Subscription;
  private currentDateKey = '';

  ngOnInit(): void {
    this.updateCurrentDateKey();
    this.reservationSubscription = this.hostalService.guestsView$.subscribe((guestCards) => {
      this.guestCardColors.clear();
      guestCards.forEach((guestCard) => {
        if (!this.guestCardColors.has(guestCard.id_huesped)) {
          this.guestCardColors.set(guestCard.id_huesped, guestCard.cardColor);
        }
      });
      this.refreshPendingChecks();
    });
    this.clockInterval = setInterval(() => this.updateCurrentDateKey(), 1000);
    if (this.modalOnly && (this.guestDraft || this.existingGuestId !== null)) {
      this.openNewEntryForm(this.guestDraft);
    }
  }

  get selectedGuest(): Huesped | undefined {
    return this.availableGuests.find((guest) => guest.id_huesped === Number(this.selectedGuestId));
  }

  get filteredGuests(): Huesped[] {
    const query = this.guestSearchQuery.trim().toLocaleLowerCase();
    if (!query) return this.availableGuests;
    return this.availableGuests.filter((guest) =>
      [guest.nombre, guest.apellido, guest.documento, guest.nacionalidad, guest.telefono, guest.email]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase()
        .includes(query)
    );
  }

  get duplicateGuest(): Huesped | undefined {
    const document = this.normalizeDocument(this.entryForm.documento);
    if (!document) {
      return undefined;
    }

    return this.availableGuests.find((guest) =>
      this.normalizeDocument(guest.documento ?? '') === document
    );
  }

  readonly pendingCheckIns: CheckItemPlaceholder[] = [];
  readonly pendingCheckOuts: CheckItemPlaceholder[] = [];

  /** Filtro por nombre de huésped o número de habitación. */
  searchQuery = '';
  /** Menú de acciones (3 puntos) abierto: `checkin-<id>` / `checkout-<id>`. */
  openMenuId: string | null = null;
  cancelTarget: CheckItemPlaceholder | null = null;
  cancelError = '';
  roomChangeItem: CheckItemPlaceholder | null = null;
  roomChangeOptions: Habitacion[] = [];
  roomChangeRoomId = '';
  roomChangeError = '';
  roomChangeSaving = false;
  roomChangeLoading = false;
  roomChangeReservation: Reserva | null = null;

  /**
   * Total y saldo de la reserva si se cambia a la habitación elegida. La diferencia de tarifa
   * entre tipologías se suma al total actual (así se respetan descuentos o ajustes previos).
   * balance < 0 significa saldo a favor del huésped. null si falta un precio.
   */
  get roomChangeQuote(): { delta: number; newTotal: number; paid: number; balance: number } | null {
    const reservation = this.roomChangeReservation;
    const newRoom = this.roomChangeOptions.find((room) => room.id_habitacion === Number(this.roomChangeRoomId));
    if (!reservation || !newRoom) return null;
    const nights = this.getNights(reservation.fecha_llegada, reservation.fecha_salida);
    const delta = this.roomSwapDelta(reservation.id_habitacion, newRoom.id_tipologia, reservation.fecha_llegada, nights);
    if (delta === null) return null;
    const newTotal = Math.max(0, (reservation.precio_total ?? 0) + delta);
    const paid = reservation.monto_pagado ?? 0;
    return { delta, newTotal, paid, balance: newTotal - paid };
  }

  /** Diferencia de precio de `nights` noches desde `from` entre la tipología nueva y la de la habitación actual. */
  private roomSwapDelta(currentRoomId: number, newTypologyId: number, from: string, nights: number): number | null {
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

  /** Precio de `nights` noches desde `from` con las tarifas vigentes; null si falta precio. */
  private priceNights(typology: SedeTipologia, from: string, nights: number): number | null {
    let rates: StoredTarifa[];
    try {
      rates = this.loadStoredTarifas();
    } catch {
      return null;
    }
    let total = 0;
    for (let offset = 0; offset < nights; offset++) {
      const price = this.getEffectiveNightlyPrice(typology, new Date(`${this.addDays(from, offset)}T00:00:00`), rates);
      if (price === undefined || !Number.isFinite(price) || price < 0) return null;
      total += price;
    }
    return Math.round(total);
  }

  get filteredCheckIns(): CheckItemPlaceholder[] {
    return this.applySearch(this.pendingCheckIns);
  }

  get filteredCheckOuts(): CheckItemPlaceholder[] {
    return this.applySearch(this.pendingCheckOuts);
  }

  get overdueCount(): number {
    return [...this.pendingCheckIns, ...this.pendingCheckOuts].filter((item) => item.isOverdue).length;
  }

  private applySearch(items: CheckItemPlaceholder[]): CheckItemPlaceholder[] {
    const query = this.searchQuery.trim().toLowerCase();
    if (!query) return items;
    return items.filter((item) =>
      item.guestName.toLowerCase().includes(query) || String(item.roomNumber).toLowerCase().includes(query)
    );
  }

  @HostListener('document:click')
  closeMenuOnOutsideClick(): void {
    this.openMenuId = null;
  }

  toggleMenu(menuId: string, event: Event): void {
    event.stopPropagation();
    this.openMenuId = this.openMenuId === menuId ? null : menuId;
  }

  /**
   * Abre sobre Recepción el modal de Huéspedes que corresponde a la acción (ficha, editar datos
   * del huésped o editar la reserva), sin cambiar de página.
   */
  // ── Extender estadía ────────────────────────────────────────────────────────
  /** Opciones rápidas de extensión, en noches. */
  readonly extendNightOptions = [1, 2, 3, 7];
  extendItem: CheckItemPlaceholder | null = null;
  extendReservation: Reserva | null = null;
  extendTypology: SedeTipologia | null = null;
  extendNights = 0;
  extendCustomDate = '';
  extendPaymentMethod: PaymentMethod | '' = '';
  extendError = '';
  extendSaving = false;
  extendLoading = false;
  /** Mantener la habitación actual (por defecto) o mudar al huésped a otra para la extensión. */
  extendKeepRoom = true;
  extendRoomId = '';
  private extendPaidByPos: number | null = null;

  /** Habitaciones libres para toda la estadía extendida (sin la actual), listas para recibir al huésped. */
  get extendRoomOptions(): Habitacion[] {
    const reservation = this.extendReservation;
    if (!reservation || this.extendNights < 1) return [];
    return this.hostalService
      .getAvailableRooms(
        reservation.fecha_llegada,
        this.addDays(reservation.fecha_salida, this.extendNights),
        reservation.cantidad_personas,
        reservation.id_reserva,
        { arrivalTime: reservation.hora_llegada, departureTime: reservation.hora_salida },
      )
      .filter((room) => room.id_habitacion !== reservation.id_habitacion && !this.checkInBlockedReason(room.numero_habitacion));
  }

  /** Habitación nueva elegida (solo si se desmarcó "mantener la habitación"). */
  get extendNewRoom(): Habitacion | null {
    if (this.extendKeepRoom || !this.extendRoomId) return null;
    return this.extendRoomOptions.find((room) => room.id_habitacion === Number(this.extendRoomId)) ?? null;
  }

  /** Tipología con la que se cobran las noches extra: la de la habitación nueva, si se cambia. */
  private get extendPricingTypology(): SedeTipologia | null {
    const newRoom = this.extendNewRoom;
    if (!newRoom) return this.extendTypology;
    return this.sedeService.tipologias().find((t) => t.id === newRoom.id_tipologia) ?? null;
  }


  setExtendKeepRoom(keep: boolean): void {
    this.extendKeepRoom = keep;
    this.extendRoomId = '';
    if (this.extendNights > 0) this.extendError = this.extendBlockedReason(this.extendNights) ?? '';
  }

  /** Si la habitación elegida deja de estar libre con las nuevas noches, se limpia la selección. */
  private syncExtendRoomSelection(): void {
    if (this.extendRoomId && !this.extendNewRoom) this.extendRoomId = '';
  }

  /** Nueva fecha de salida según las noches elegidas (o la fecha personalizada). */
  get extendNewDeparture(): string {
    if (!this.extendReservation || this.extendNights < 1) return '';
    return this.addDays(this.extendReservation.fecha_salida, this.extendNights);
  }

  /** Costo de las noches extra según las tarifas vigentes; null si falta precio. */
  get extendCost(): number | null {
    const reservation = this.extendReservation;
    const typology = this.extendPricingTypology;
    if (!reservation || !typology || this.extendNights < 1) return null;
    return this.priceNights(typology, reservation.fecha_salida, this.extendNights);
  }

  /**
   * Si se cambia de habitación a mitad de estadía, las noches que quedan (desde hoy hasta la
   * salida actual) se recalculan con la tipología nueva: puede sumar o restar. 0 si no hay cambio.
   */
  get extendRoomChangeDelta(): number | null {
    const reservation = this.extendReservation;
    const newRoom = this.extendNewRoom;
    if (!reservation || !newRoom) return 0;
    const today = this.localDateString(new Date());
    const from = reservation.fecha_llegada > today ? reservation.fecha_llegada : today;
    const remaining = Math.max(0, this.daysBetween(from, reservation.fecha_salida));
    return this.roomSwapDelta(reservation.id_habitacion, newRoom.id_tipologia, from, remaining);
  }

  /** Nuevo total de la estadía con la extensión (y el ajuste por cambio de habitación). */
  get extendNewTotal(): number {
    return Math.max(0, (this.extendReservation?.precio_total ?? 0) + (this.extendCost ?? 0) + (this.extendRoomChangeDelta ?? 0));
  }

  /** Lo que se cobra ahora: nuevo total menos lo ya pagado (incluye saldo previo, si lo hubiera). */
  get extendAmountDue(): number {
    return Math.max(0, this.extendNewTotal - (this.extendReservation?.monto_pagado ?? 0));
  }

  async openExtendStay(item: CheckItemPlaceholder): Promise<void> {
    this.openMenuId = null;
    const reservation = this.hostalService.getReservations().find((r) => r.id_reserva === item.id);
    if (!reservation) {
      this.movementError = 'La reserva ya no existe. Actualiza la lista e inténtalo otra vez.';
      return;
    }
    const room = this.sedeService.habitaciones().find((h) => h.id === reservation.id_habitacion);
    this.extendTypology = this.sedeService.tipologias().find((t) => t.id === room?.tipologiaId) ?? null;
    this.extendItem = item;
    this.extendReservation = reservation;
    this.extendNights = 0;
    this.extendCustomDate = '';
    this.extendPaymentMethod = '';
    this.extendError = '';
    this.extendKeepRoom = true;
    this.extendRoomId = '';
    this.extendPaidByPos = null;
    this.posCobro.reset();
    this.extendLoading = true;
    try {
      await Promise.all([this.loadTarifasConfig(), this.loadPosDisponible()]);
    } catch (error) {
      this.extendError = getApiErrorMessage(error, 'No se pudieron cargar las tarifas.');
    } finally {
      this.extendLoading = false;
    }
  }

  closeExtendStay(): void {
    if (this.extendSaving || this.posCobro.enCurso()) return;
    this.posCobro.reset();
    this.extendItem = null;
    this.extendReservation = null;
    this.extendTypology = null;
  }

  /** La habitación sigue libre si se extiende la salida esa cantidad de noches. */
  canExtendBy(nights: number): boolean {
    return this.extendBlockedReason(nights) === null;
  }

  /** Motivo por el que no se puede extender esa cantidad de noches, o null si se puede. */
  extendBlockedReason(nights: number): string | null {
    const reservation = this.extendReservation;
    if (!reservation || nights < 1) return 'Elige cuántas noches quieres extender.';
    // Estadía atrasada: la nueva salida no puede quedar en el pasado.
    if (this.addDays(reservation.fecha_salida, nights) < this.localDateString(new Date())) {
      return 'La nueva salida no puede quedar en el pasado.';
    }
    // Si se cambia de habitación, la actual puede estar tomada: la disponibilidad se valida con la nueva.
    if (!this.extendKeepRoom) return null;
    const free = this.hostalService
      .getAvailableRooms(
        reservation.fecha_llegada,
        this.addDays(reservation.fecha_salida, nights),
        reservation.cantidad_personas,
        reservation.id_reserva,
        { arrivalTime: reservation.hora_llegada, departureTime: reservation.hora_salida },
      )
      .some((room) => room.id_habitacion === reservation.id_habitacion);
    return free ? null : `La habitación ${this.extendItem?.roomNumber} tiene otra reserva en esas fechas. Desmarca "Mantener la habitación" para elegir otra.`;
  }

  selectExtendNights(nights: number): void {
    if (this.extendSaving || this.posCobro.enCurso()) return;
    this.extendNights = nights;
    this.extendCustomDate = '';
    this.extendError = this.extendBlockedReason(nights) ?? '';
    this.syncExtendRoomSelection();
  }

  onExtendCustomDate(value: string): void {
    this.extendCustomDate = value;
    const reservation = this.extendReservation;
    if (!reservation || !value) {
      this.extendNights = 0;
      return;
    }
    const nights = this.daysBetween(reservation.fecha_salida, value);
    if (nights < 1) {
      this.extendNights = 0;
      this.extendError = 'La nueva salida debe ser posterior a la salida actual.';
      return;
    }
    this.extendNights = nights;
    this.extendError = this.extendBlockedReason(nights) ?? '';
    this.syncExtendRoomSelection();
  }

  get extendMinCustomDate(): string {
    if (!this.extendReservation) return '';
    const next = this.addDays(this.extendReservation.fecha_salida, 1);
    const today = this.localDateString(new Date());
    return next > today ? next : today;
  }

  async confirmExtendStay(): Promise<void> {
    const item = this.extendItem;
    const reservation = this.extendReservation;
    if (!item || !reservation || this.extendNights < 1) {
      this.extendError = 'Elige cuántas noches quieres extender.';
      return;
    }
    const blocked = this.extendBlockedReason(this.extendNights);
    if (blocked) {
      this.extendError = blocked;
      return;
    }
    const newRoom = this.extendNewRoom;
    if (!this.extendKeepRoom && !newRoom) {
      this.extendError = 'Elige la nueva habitación.';
      return;
    }
    const cost = this.extendCost;
    if (cost === null || this.extendRoomChangeDelta === null) {
      this.extendError = `Configura un precio para la tipología ${this.extendPricingTypology?.nombre ?? 'de la habitación'} en /tarifas antes de extender.`;
      return;
    }
    const amount = this.extendAmountDue;
    if (amount > 0 && this.extendPaymentMethod === '') {
      this.extendError = 'Selecciona el medio de pago de la extensión.';
      return;
    }
    if (this.posCobro.enCurso()) return;
    this.extendError = '';
    this.extendSaving = true;

    let method = this.extendPaymentMethod;
    // Con tarjeta se cobra primero en el terminal (registra el pago); luego se guarda la nueva salida.
    if (amount > 0 && isCardMethod(method) && this.extendPaidByPos !== reservation.id_reserva) {
      const used = await this.chargeWithPos(reservation.id_reserva, amount, 'PAGO_FINAL', method);
      if (!used) {
        this.extendSaving = false;
        this.extendError = 'La extensión no se cobró. Reintenta o elige otro medio de pago.';
        return;
      }
      method = used;
      this.extendPaidByPos = reservation.id_reserva;
    }

    const newDeparture = this.extendNewDeparture;
    const previouslyPaid = reservation.monto_pagado ?? 0;
    try {
      const saved = await this.hostalService.extendStay(reservation.id_reserva, {
        newDeparture,
        newTotal: this.extendNewTotal,
        amount,
        method: method || undefined,
        roomId: newRoom?.id_habitacion,
      });
      // Cambio de habitación: la anterior queda en aseo y la nueva pasa a ocupada.
      if (newRoom) {
        await this.sedeService.marcarEnAseo(item.roomNumber);
        await this.sedeService.marcarOcupada(newRoom.numero_habitacion, item.guestName);
      }
      const roomNumber = newRoom?.numero_habitacion ?? item.roomNumber;
      const typologyName = newRoom ? (this.extendPricingTypology?.nombre ?? item.roomType) : item.roomType;
      const nights = this.getNights(saved.fecha_llegada, saved.fecha_salida);
      const message = `Estadía de ${item.guestName} extendida ${this.extendNights} ${this.extendNights === 1 ? 'noche' : 'noches'}: nueva salida ${this.formatDate(newDeparture)}.`
        + (newRoom ? ` Se cambió a la habitación ${roomNumber}; la ${item.roomNumber} quedó en aseo.` : '');
      if (amount > 0 && method) {
        this.checkInReceipt = {
          subtitle: `Extensión de estadía · ${this.extendNights} ${this.extendNights === 1 ? 'noche' : 'noches'} más`,
          guestName: item.guestName,
          roomNumber,
          typologyName,
          arrivalDate: saved.fecha_llegada,
          arrivalTime: saved.hora_llegada ?? '',
          departureDate: saved.fecha_salida,
          departureTime: saved.hora_salida ?? '',
          nights,
          personCount: saved.cantidad_personas ?? 1,
          total: this.extendNewTotal,
          previouslyPaid,
          paid: amount,
          pending: 0,
          methodLabel: PAYMENT_METHOD_LABELS[method],
          reference: (isCardMethod(method) ? this.posCobro.transaccion()?.externalReference : null) || `Reserva #${reservation.id_reserva}`,
          paidAt: new Date(),
        };
      }
      this.entrySuccessMessage = message;
      this.movementError = '';
      this.extendPaidByPos = null;
      this.extendSaving = false;
      this.closeExtendStay();
    } catch (error) {
      this.extendSaving = false;
      this.extendError = getApiErrorMessage(error, 'No se pudo extender la estadía.')
        + (this.extendPaidByPos === reservation.id_reserva ? ' El cobro con tarjeta ya quedó registrado: reintenta sin volver a cobrar.' : '');
    }
  }

  private addDays(dateKey: string, days: number): string {
    const date = new Date(`${dateKey}T00:00:00`);
    date.setDate(date.getDate() + days);
    return this.localDateString(date);
  }

  private daysBetween(from: string, to: string): number {
    return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / (24 * 60 * 60 * 1000));
  }

  async openGuestAction(item: CheckItemPlaceholder, accion: 'detalle' | 'editar-huesped' | 'editar-reserva'): Promise<void> {
    this.openMenuId = null;
    const reservation = this.hostalService.getReservations().find((r) => r.id_reserva === item.id);
    if (!reservation) {
      this.movementError = 'La reserva ya no existe. Actualiza la lista e inténtalo otra vez.';
      return;
    }
    this.closeGuestModal();
    // Import dinámico: Huéspedes ya importa esta página (modal de nueva reserva), así se evita el ciclo.
    const { HuespedesPage } = await import('../../../../huespedes/presentation/pages/huespedes/huespedes.page');
    const ref = this.viewContainer.createComponent(HuespedesPage);
    ref.setInput('modalOnly', true);
    ref.setInput('modalAction', { accion, huesped: reservation.id_huesped, reserva: reservation.id_reserva });
    ref.instance.modalClosed.subscribe((message: string) => {
      if (message) this.entrySuccessMessage = message;
      this.closeGuestModal();
    });
    this.guestModalRef = ref;
  }

  private closeGuestModal(): void {
    this.guestModalRef?.destroy();
    this.guestModalRef = null;
  }

  askCancelReservation(item: CheckItemPlaceholder): void {
    this.openMenuId = null;
    this.cancelError = '';
    this.cancelTarget = item;
  }

  closeCancelReservation(): void {
    this.cancelTarget = null;
    this.cancelError = '';
  }

  async confirmCancelReservation(): Promise<void> {
    const item = this.cancelTarget;
    if (!item) return;
    try {
      await this.hostalService.cancelReservation(item.id);
      this.entrySuccessMessage = `Reserva de ${item.guestName} (Hab. ${item.roomNumber}) cancelada como no-show.`;
      this.closeCancelReservation();
    } catch (error) {
      this.cancelError = getApiErrorMessage(error, 'No se pudo cancelar la reserva.');
    }
  }

  async openRoomChange(item: CheckItemPlaceholder): Promise<void> {
    this.openMenuId = null;
    this.roomChangeError = '';
    this.roomChangeRoomId = '';
    const reservation = this.hostalService.getReservations().find((r) => r.id_reserva === item.id);
    if (!reservation) {
      this.movementError = 'La reserva ya no existe. Actualiza la lista e inténtalo otra vez.';
      return;
    }
    this.roomChangeReservation = reservation;
    this.roomChangeOptions = this.hostalService
      .getAvailableRooms(
        reservation.fecha_llegada,
        reservation.fecha_salida,
        reservation.cantidad_personas,
        reservation.id_reserva,
        { arrivalTime: reservation.hora_llegada, departureTime: reservation.hora_salida },
      )
      .filter((room) => room.id_habitacion !== reservation.id_habitacion && !this.checkInBlockedReason(room.numero_habitacion));
    this.roomChangeItem = item;
    // Las tarifas hacen falta para recalcular el total con la nueva tipología.
    this.roomChangeLoading = true;
    try {
      await this.loadTarifasConfig();
    } catch (error) {
      this.roomChangeError = getApiErrorMessage(error, 'No se pudieron cargar las tarifas.');
    } finally {
      this.roomChangeLoading = false;
    }
  }

  closeRoomChange(): void {
    if (this.roomChangeSaving) return;
    this.roomChangeItem = null;
    this.roomChangeReservation = null;
    this.roomChangeOptions = [];
  }

  async confirmRoomChange(): Promise<void> {
    const item = this.roomChangeItem;
    const roomId = Number(this.roomChangeRoomId);
    if (!item || !roomId) {
      this.roomChangeError = 'Selecciona la nueva habitación.';
      return;
    }
    const reservation = this.hostalService.getReservations().find((r) => r.id_reserva === item.id);
    if (!reservation) {
      this.roomChangeError = 'La reserva ya no existe.';
      return;
    }
    const quote = this.roomChangeQuote;
    if (!quote) {
      this.roomChangeError = 'Configura el precio de la tipología de esa habitación en /tarifas antes de cambiarla.';
      return;
    }
    this.roomChangeSaving = true;
    try {
      await this.hostalService.updateReservation(item.id, {
        id_habitacion: roomId,
        fecha_llegada: reservation.fecha_llegada,
        fecha_salida: reservation.fecha_salida,
        hora_llegada: reservation.hora_llegada ?? item.scheduledTime,
        hora_salida: reservation.hora_salida,
        cantidad_personas: reservation.cantidad_personas ?? 1,
        precio_total: quote.newTotal,
        pago_completo: quote.paid >= quote.newTotal,
      });
      const newRoom = this.roomChangeOptions.find((room) => room.id_habitacion === roomId);
      const money = (value: number) => `$${Math.abs(value).toLocaleString('es-CL')}`;
      const balanceNote = quote.balance > 0
        ? ` Nuevo total ${money(quote.newTotal)}: quedan ${money(quote.balance)} por cobrar en el check-in.`
        : quote.balance < 0
          ? ` Nuevo total ${money(quote.newTotal)}: el huésped tiene ${money(quote.balance)} a favor.`
          : ` Nuevo total ${money(quote.newTotal)}: la reserva queda pagada.`;
      this.entrySuccessMessage = `${item.guestName} ahora está asignado a la habitación ${newRoom?.numero_habitacion ?? roomId}.${balanceNote}`;
      this.roomChangeSaving = false;
      this.closeRoomChange();
    } catch (error) {
      this.roomChangeSaving = false;
      this.roomChangeError = getApiErrorMessage(error, 'No se pudo cambiar la habitación.');
    }
  }

  get totalRoomsInvolved(): number {
    const rooms = new Set<string>();
    this.pendingCheckIns.forEach((c) => rooms.add(c.roomNumber));
    this.pendingCheckOuts.forEach((c) => rooms.add(c.roomNumber));
    return rooms.size;
  }

  constructor() {
    addIcons({
      alertCircleOutline,
      enterOutline,
      exitOutline,
      bedOutline,
      calendarOutline,
      peopleOutline,
      star,
      callOutline,
      logoWhatsapp,
      mailOutline,
      logInOutline,
      logOutOutline,
      ellipsisVerticalOutline,
      informationCircleOutline,
      checkmarkCircleOutline,
      checkmarkOutline,
      swapHorizontalOutline,
      closeOutline,
      cashOutline,
      cardOutline,
      chevronDownOutline,
      searchOutline,
      personOutline,
      closeCircleOutline,
      createOutline,
    });
  }

  openNewEntryForm(guestDraft?: GuestDraft): void {
    this.availableGuests.splice(0, this.availableGuests.length, ...this.hostalService.getGuests());
    this.entryForm = this.createEmptyEntryForm();
    this.phoneFieldFocused = false;
    this.guestMode = 'new';
    this.selectedGuestId = '';
    this.guestPickerOpen = false;
    this.guestSearchQuery = '';
    this.entryStep = 1;
    this.paymentOption = 'deposit';
    this.paymentMethod = '';
    this.reservationQuote = null;
    this.paymentReceipt = null;
    this.posCobro.reset();
    void this.loadPosDisponible();
    if (guestDraft) {
      this.entryForm = {
        ...this.entryForm,
        ...guestDraft,
      };
      const normalizedDocument = this.normalizeDocument(guestDraft.documento);
      const existingGuest = normalizedDocument
        ? this.availableGuests.find((guest) =>
          this.normalizeDocument(guest.documento ?? '') === normalizedDocument
        )
        : undefined;
      if (existingGuest) {
        this.guestMode = 'existing';
        this.selectedGuestId = String(existingGuest.id_huesped);
      }
    }
    const selectedExistingGuest = this.existingGuestId === null
      ? undefined
      : this.availableGuests.find((guest) => guest.id_huesped === this.existingGuestId);
    if (selectedExistingGuest) {
      this.guestMode = 'existing';
      this.selectedGuestId = String(selectedExistingGuest.id_huesped);
    }
    this.entryStep = this.startAtReservationDetails && selectedExistingGuest ? 2 : 1;
    this.entryError = this.existingGuestId !== null && !selectedExistingGuest
      ? 'No se encontró el huésped. Cierra el modal y vuelve a intentarlo.'
      : '';
    this.entrySuccessMessage = '';
    this.documentFieldFocused = false;
    this.emailFieldFocused = false;
    this.showNewEntryForm = true;
    this.showCloseConfirmation = false;
    this.setPageScrollLocked(true);
    this.availableRooms = [];
  }

  closeNewEntryForm(): void {
    // No se puede cerrar mientras el terminal procesa el cobro.
    if (this.posCobro.enCurso()) return;
    if (this.paymentReceipt) {
      this.closeReceipt();
      return;
    }
    this.posCobro.reset();
    this.showNewEntryForm = false;
    this.showCloseConfirmation = false;
    this.entryError = '';
    if (!this.modalOnly) {
      this.setPageScrollLocked(false);
    }
    if (this.modalOnly) {
      this.entryModalClosed.emit();
    }
  }

  confirmCloseNewEntryForm(): void {
    if (this.posCobro.enCurso()) return;
    if (this.paymentReceipt) {
      this.closeReceipt();
      return;
    }
    this.showCloseConfirmation = true;
  }

  cancelCloseNewEntryForm(): void {
    this.showCloseConfirmation = false;
  }

  discardNewEntryForm(): void {
    this.closeNewEntryForm();
  }

  ngOnDestroy(): void {
    this.closeGuestModal();
    this.reservationSubscription?.unsubscribe();
    if (this.clockInterval !== undefined) {
      clearInterval(this.clockInterval);
    }
    if (!this.modalOnly) {
      this.setPageScrollLocked(false);
    }
  }

  /** Mismo enlace de WhatsApp que las tarjetas de huéspedes. */
  whatsappUrl(phone?: string): string | null {
    const digits = (phone ?? '').replace(/\D/g, '');
    return digits.length >= 6 ? `https://web.whatsapp.com/send?phone=${digits}` : null;
  }

  refreshPendingChecks(): void {
    const today = this.localDateString(new Date());
    const entries = this.hostalService.getReservationCalendarData();
    // Llegadas de hoy y llegadas atrasadas cuya estadía aún no termina.
    const checkIns = entries.filter((entry) =>
      ['CONFIRMADA', 'CHECK-IN HOY'].includes(entry.status)
      && (entry.arrivalDate === today || (entry.arrivalDate < today && entry.departureDate > today))
    );
    // Solo salidas de hoy (o atrasadas que siguen hospedadas). El check-out anticipado se hace
    // modificando la fecha de salida de la reserva en el apartado de huéspedes.
    const checkOuts = entries.filter((entry) =>
      entry.departureDate <= today && ['HOSPEDADO', 'CHECK-OUT HOY'].includes(entry.status)
    );

    this.pendingCheckIns.splice(
      0,
      this.pendingCheckIns.length,
      ...checkIns.map((entry, index) => this.toCheckItem(entry, 'checkin', index, entry.arrivalDate < today))
    );
    this.pendingCheckOuts.splice(
      0,
      this.pendingCheckOuts.length,
      ...checkOuts.map((entry, index) => this.toCheckItem(entry, 'checkout', index, entry.departureDate < today))
    );
  }

  setGuestMode(mode: 'new' | 'existing'): void {
    this.guestMode = mode;
    this.selectedGuestId = '';
    this.guestPickerOpen = false;
    this.guestSearchQuery = '';
    this.entryError = '';
  }

  toggleGuestPicker(): void {
    this.guestPickerOpen = !this.guestPickerOpen;
    if (this.guestPickerOpen) this.guestSearchQuery = '';
  }

  selectRegisteredGuest(guest: Huesped): void {
    this.selectedGuestId = String(guest.id_huesped);
    this.guestPickerOpen = false;
    this.guestSearchQuery = '';
  }

  getGuestInitials(guest: Huesped): string {
    return `${guest.nombre.charAt(0)}${guest.apellido.charAt(0)}`.toLocaleUpperCase();
  }

  getGuestCardColor(guest: Huesped): GuestCardView['cardColor'] {
    return this.guestCardColors.get(guest.id_huesped) ?? 'blue';
  }

  isGuestStepValid(form: NgForm): boolean {
    if (this.guestMode === 'existing') {
      return form.valid === true && !!this.selectedGuest;
    }

    return this.isNewGuestDetailsValid(form);
  }

  private isNewGuestDetailsValid(form: NgForm): boolean {
    return form.valid === true && this.areNewGuestFieldsValid();
  }

  private areNewGuestFieldsValid(): boolean {
    return !!this.entryForm.documento.trim() &&
      !!this.entryForm.nombre.trim() &&
      !!this.entryForm.apellido.trim() &&
      !!this.entryForm.telefono.trim() &&
      this.isPhoneFormatValid &&
      !!this.entryForm.nacionalidad.trim() &&
      this.isValidEmail(this.entryForm.email) &&
      (this.entryForm.documentType !== 'rut' || this.isValidRut(this.entryForm.documento)) &&
      !this.duplicateGuest;
  }

  goToReservationDetailsStep(form: NgForm): void {
    if (!this.isGuestStepValid(form)) {
      form.form.markAllAsTouched();
      return;
    }
    this.entryError = '';
    this.entryStep = 2;
  }

  async goToRoomSelectionStep(form: NgForm): Promise<void> {
    if (!this.isReservationDetailsValid(form)) {
      form.form.markAllAsTouched();
      if (this.entryForm.arrivalDate && this.entryForm.arrivalDate < this.minArrivalDate) {
        this.entryError = 'La fecha de llegada no puede ser anterior a hoy.';
      }
      return;
    }
    this.entryError = '';
    this.entryStep = 3;
    this.entryForm.roomId = '';
    this.availableRooms = [];
    this.isSearchingRooms = true;
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    try {
      await this.loadTarifasConfig();
      this.updateAvailableRooms();
    } catch (error) {
      this.entryError = error instanceof Error
        ? `No se pudieron buscar habitaciones: ${error.message}`
        : 'No se pudieron buscar habitaciones disponibles.';
    } finally {
      this.isSearchingRooms = false;
    }
  }

  returnToGuestStep(): void {
    this.entryError = '';
    this.entryStep = 1;
  }

  returnToReservationDetailsStep(): void {
    this.entryError = '';
    this.entryStep = 2;
  }

  goToPaymentStep(form: NgForm): void {
    if (!this.isEntryStepValid(form)) {
      form.form.markAllAsTouched();
      return;
    }
    this.entryError = '';
    try {
      this.reservationQuote = this.createReservationQuote();
      this.entryStep = 4;
    } catch (error) {
      this.entryError = error instanceof Error
        ? error.message
        : 'No se pudo calcular el monto de la reserva.';
    }
  }

  returnToRoomSelectionStep(): void {
    this.entryError = '';
    this.entryStep = 3;
  }

  get paymentAmount(): number {
    if (!this.reservationQuote) return 0;
    return this.paymentOption === 'full'
      ? this.reservationQuote.total
      : this.reservationQuote.deposit;
  }

  isPaymentStepValid(): boolean {
    return this.entryStep === 4 && this.reservationQuote !== null && this.paymentMethod !== '' &&
      (!isCardMethod(this.paymentMethod) || this.posDisponible !== null) &&
      !this.posCobro.enCurso();
  }

  isCardMethod(method: PaymentMethod | ''): boolean {
    return isCardMethod(method);
  }

  get entrySubmitLabel(): string {
    if (this.posCobro.enCurso()) return 'Cobrando en el terminal…';
    if (this.posCobro.etapa() === 'fallido' && isCardMethod(this.paymentMethod)) {
      return 'Reintentar cobro en el terminal';
    }
    return isCardMethod(this.paymentMethod)
      ? 'Cobrar en el terminal y guardar reserva'
      : 'Confirmar pago y guardar reserva';
  }

  private async loadPosDisponible(): Promise<void> {
    const sedeId = this.sedeService.selectedSede()?.id;
    this.posDisponible = null;
    if (!sedeId) return;
    this.posLoading = true;
    try {
      this.posDisponible = await this.posCobro.posDisponible(sedeId);
    } finally {
      this.posLoading = false;
    }
  }

  /** Envía el cobro con tarjeta al terminal; true si quedó aprobado y registrado. */
  private async chargeWithPos(
    reservaId: number,
    monto: number,
    tipoOperacion: 'ABONO' | 'PAGO_FINAL',
    method: MetodoPagoTarjeta,
  ): Promise<MetodoPagoTarjeta | null> {
    if (!this.posDisponible) return null;
    const tx = await this.posCobro.cobrar(
      { reservaId, monto, tipoOperacion, tipoTarjeta: method === 'debito' ? 'DEBITO' : 'CREDITO' },
      this.posDisponible,
    );
    if (tx?.estado !== 'APROBADA' || !tx.pagoId) return null;
    // El terminal informa el tipo real de tarjeta usado.
    return tx.metodoPago === 'TARJETA_DEBITO' ? 'debito' : tx.metodoPago === 'TARJETA_CREDITO' ? 'credito' : method;
  }

  /** Cierra el comprobante y termina el ingreso. */
  closeReceipt(): void {
    this.entrySuccessMessage = this.receiptMessage;
    this.paymentReceipt = null;
    this.posCobro.reset();
    this.showNewEntryForm = false;
    this.showCloseConfirmation = false;
    this.setPageScrollLocked(false);
    if (this.modalOnly) {
      this.entryRegistered.emit(this.entrySuccessMessage);
    }
  }

  private showReceipt(reservationId: number, guestName: string, roomNumber: string, method: PaymentMethod): void {
    const quote = this.reservationQuote!;
    const paid = this.paymentAmount;
    const reference = this.posCobro.transaccion()?.externalReference;
    this.receiptMessage = `Reserva confirmada para ${guestName} en la habitación ${roomNumber}. Se registró un pago de ${paid.toLocaleString('es-CL')} CLP por ${PAYMENT_METHOD_LABELS[method]}.`;
    const pending = Math.max(0, quote.total - paid);
    this.paymentReceipt = {
      subtitle: 'La reserva quedó confirmada',
      note: pending > 0 ? 'El saldo se cobra en el check-in.' : undefined,
      guestName,
      roomNumber,
      typologyName: quote.typologyName,
      arrivalDate: this.entryForm.arrivalDate,
      arrivalTime: this.entryForm.arrivalTime,
      departureDate: this.entryForm.departureDate,
      departureTime: this.entryForm.departureTime || '12:00',
      nights: quote.nights,
      personCount: this.entryForm.personCount,
      total: quote.total,
      paid,
      pending,
      methodLabel: PAYMENT_METHOD_LABELS[method],
      reference: reference || `Reserva #${reservationId}`,
      paidAt: new Date(),
    };
    this.entryError = '';
  }

  /** El cobro no se completó: se elimina la reserva para que no quede guardada sin pago. */
  private async discardUnpaidReservation(reservationId: number, guest: Huesped): Promise<void> {
    if (this.guestMode === 'new') {
      // El huésped sí quedó registrado: el reintento lo reutiliza en vez de duplicarlo.
      this.availableGuests.splice(0, this.availableGuests.length, ...this.hostalService.getGuests());
      this.guestMode = 'existing';
      this.selectedGuestId = String(guest.id_huesped);
    }
    try {
      await this.hostalService.deleteReservation(reservationId);
      this.entryError = 'El pago no se procesó, por lo que la reserva no se guardó. Reintenta el cobro o elige otro medio de pago.';
    } catch (error) {
      this.entryError = `El pago no se procesó y no se pudo descartar la reserva: ${getApiErrorMessage(error, 'error desconocido.')} Revísala en el calendario antes de reintentar.`;
    }
  }

  clearRoomSelection(): void {
    this.availableRooms = [];
    this.roomNightlyPrices.clear();
    this.entryForm.roomId = '';
  }

  selectRoom(roomId: number): void {
    this.entryForm.roomId = String(roomId);
    this.entryError = '';
  }

  isRoomSelected(roomId: number): boolean {
    return this.entryForm.roomId === String(roomId);
  }

  openRoomDetails(roomId: number): void {
    this.roomDetails = this.sedeService.habitaciones().find((room) => room.id === roomId) ?? null;
    this.roomDetailsTab = 'details';
    this.expandedRoomPhoto = null;
  }

  roomDetailsFor(room: Habitacion): SedeHabitacion | undefined {
    return this.sedeService.habitaciones().find((managedRoom) => managedRoom.id === room.id_habitacion);
  }

  closeRoomDetails(): void {
    this.roomDetails = null;
    this.expandedRoomPhoto = null;
  }

  roomTypology(room: SedeHabitacion): SedeTipologia | undefined {
    return this.sedeService.tipologias().find((typology) =>
      typology.id === room.tipologiaId ||
      typology.nombre.toLocaleLowerCase() === room.tipo.toLocaleLowerCase()
    );
  }

  roomPhotos(room: SedeHabitacion): FotoHabitacion[] {
    return this.fotoHabitacionService.forRoom(room.id);
  }

  roomInventory(room: SedeHabitacion): Array<{ name: string; quantity: number; description: string }> {
    const supplies = new Map(this.inventarioService.insumos().map((supply) => [supply.id_insumo, supply]));
    return this.inventarioService.habitacionesAsignadas()
      .filter((assignment) => assignment.id_habitacion === room.id)
      .flatMap((assignment) => {
        const supply = supplies.get(assignment.id_insumo);
        return supply
          ? [{ name: supply.nombre_insumo, quantity: assignment.cantidad, description: supply.descripcion }]
          : [];
      });
  }

  /** La salida debe ser posterior a la llegada por fecha y hora (se permiten estadías del mismo día). */
  isEntryStayValid(): boolean {
    return isValidStayRange(stayInterval(
      this.entryForm.arrivalDate,
      this.entryForm.arrivalTime,
      this.entryForm.departureDate,
      this.entryForm.departureTime || '12:00',
    ));
  }

  /** Fecha mínima de llegada (hoy, en hora local); el backend rechaza fechas pasadas. */
  get minArrivalDate(): string {
    return this.localDateString(new Date());
  }

  isReservationDetailsValid(form: NgForm): boolean {
    return form.valid === true &&
      this.isValidReservationDate(this.entryForm.arrivalDate) &&
      this.entryForm.arrivalDate >= this.minArrivalDate &&
      this.isValidReservationDate(this.entryForm.departureDate) &&
      this.isEntryStayValid() &&
      Number.isInteger(this.entryForm.personCount) &&
      this.entryForm.personCount >= 1 &&
      /^([01]\d|2[0-3]):[0-5]\d$/.test(this.entryForm.arrivalTime) &&
      (!this.entryForm.departureTime || /^([01]\d|2[0-3]):[0-5]\d$/.test(this.entryForm.departureTime));
  }

  isEntryStepValid(form: NgForm): boolean {
    const guestIsValid = this.guestMode === 'existing'
      ? !!this.selectedGuest
      : this.areNewGuestFieldsValid();
    return form.valid === true && guestIsValid &&
      this.isValidReservationDate(this.entryForm.arrivalDate) &&
      this.isValidReservationDate(this.entryForm.departureDate) &&
      this.isEntryStayValid() &&
      Number.isInteger(this.entryForm.personCount) &&
      this.entryForm.personCount >= 1 &&
      /^([01]\d|2[0-3]):[0-5]\d$/.test(this.entryForm.arrivalTime) &&
      (!this.entryForm.departureTime || /^([01]\d|2[0-3]):[0-5]\d$/.test(this.entryForm.departureTime)) &&
      this.availableRooms.some((room) => room.id_habitacion === Number(this.entryForm.roomId));
  }

  updateAvailableRooms(): void {
    this.availableRooms = this.hostalService.getAvailableRooms(
      this.entryForm.arrivalDate,
      this.entryForm.departureDate,
      this.entryForm.personCount,
      undefined,
      { arrivalTime: this.entryForm.arrivalTime, departureTime: this.entryForm.departureTime || '12:00' },
    );
    this.updateRoomNightlyPrices();
    this.entryForm.roomId = '';
  }

  roomNightlyPrice(room: Habitacion): number | null {
    return this.roomNightlyPrices.get(room.id_tipologia) ?? null;
  }

  async registerEntry(): Promise<void> {
    this.entryError = '';
    if (!this.isPaymentStepValid() || !this.reservationQuote || this.paymentMethod === '') {
      this.entryError = 'Selecciona el medio de pago para confirmar la reserva.';
      return;
    }
    const paymentMethod = this.paymentMethod;
    if (this.guestMode === 'new' && !this.isValidEmail(this.entryForm.email)) {
      this.entryError = 'Ingresa un email válido, por ejemplo nombre@dominio.com.';
      return;
    }

    if (this.guestMode === 'new' && this.entryForm.documentType === 'rut' &&
      !this.isValidRut(this.entryForm.documento)) {
      this.entryError = 'Ingresa un RUT chileno válido.';
      return;
    }

    try {
      const registered = await this.hostalService.registerEntry({
        ...(this.guestMode === 'existing'
          ? { guestId: Number(this.selectedGuestId) }
          : {
            newGuest: {
              documento: this.entryForm.documento.trim(),
              nombre: this.entryForm.nombre.trim(),
              apellido: this.entryForm.apellido.trim(),
              telefono: `${this.phoneCountry.callingCode} ${this.entryForm.telefono.trim()}`,
              email: this.entryForm.email.trim(),
              nacionalidad: this.entryForm.nacionalidad.trim(),
            },
          }),
        roomId: Number(this.entryForm.roomId),
        personCount: this.entryForm.personCount,
        arrivalDate: this.entryForm.arrivalDate,
        departureDate: this.entryForm.departureDate,
        arrivalTime: this.entryForm.arrivalTime,
        departureTime: this.entryForm.departureTime || '12:00',
        payment: {
          totalAmount: this.reservationQuote.total,
          paidAmount: this.paymentAmount,
          depositPercentage: this.reservationQuote.depositPercentage,
          method: paymentMethod,
          paidInFull: this.paymentOption === 'full',
        },
      });
      const roomAssigned = this.availableRooms.find((room) => room.id_habitacion === registered.reservation.id_habitacion);
      const roomNum = roomAssigned?.numero_habitacion ?? '';
      const guestName = `${registered.guest.nombre} ${registered.guest.apellido}`;
      const reservationId = registered.reservation.id_reserva;
      let usedMethod: PaymentMethod = paymentMethod;
      if (isCardMethod(paymentMethod)) {
        // El cobro POS necesita la reserva; si no se aprueba, se elimina.
        const used = await this.chargeWithPos(
          reservationId, this.paymentAmount, this.paymentOption === 'full' ? 'PAGO_FINAL' : 'ABONO', paymentMethod,
        );
        if (!used) {
          await this.discardUnpaidReservation(reservationId, registered.guest);
          return;
        }
        this.hostalService.applyPosPayment(reservationId, this.paymentAmount, used);
        usedMethod = used;
      }
      this.showReceipt(reservationId, guestName, roomNum, usedMethod);
    } catch (error) {
      if (error instanceof EntryReservationError) {
        this.availableGuests.splice(0, this.availableGuests.length, ...this.hostalService.getGuests());
        this.guestMode = 'existing';
        this.selectedGuestId = String(error.guest.id_huesped);
      }
      this.entryError = getApiErrorMessage(error, 'No se pudo registrar el ingreso. Inténtalo nuevamente.');
    }
  }

  realizarCheckIn(item: CheckItemPlaceholder): void {
    this.movementError = '';
    const blocked = this.checkInBlockedReason(item.roomNumber);
    if (blocked) {
      this.movementError = `No se puede hacer el check-in: ${blocked}. Debe quedar libre antes de recibir al huésped.`;
      return;
    }
    this.checkInPaymentItem = item;
    this.checkInPaymentMethod = '';
    this.checkInPaymentError = '';
    this.checkInPaidByPos = null;
    this.posCobro.reset();
    if (item.outstandingBalance > 0) void this.loadPosDisponible();
  }

  closeCheckInPayment(): void {
    if (this.posCobro.enCurso()) return;
    this.posCobro.reset();
    this.checkInPaymentItem = null;
    this.checkInPaymentMethod = '';
    this.checkInPaymentError = '';
  }

  closeCheckInReceipt(): void {
    this.checkInReceipt = null;
  }

  async confirmCheckInPayment(): Promise<void> {
    const item = this.checkInPaymentItem;
    if (!item) return;
    if (item.outstandingBalance > 0 && this.checkInPaymentMethod === '') {
      this.checkInPaymentError = 'Selecciona el medio de pago para cobrar el saldo pendiente.';
      return;
    }
    if (this.posCobro.enCurso()) return;
    this.checkInPaymentError = '';

    let method = this.checkInPaymentMethod;
    if (item.outstandingBalance > 0 && isCardMethod(method) && this.checkInPaidByPos !== item.id) {
      const used = await this.chargeWithPos(item.id, item.outstandingBalance, 'PAGO_FINAL', method);
      if (!used) {
        this.checkInPaymentError = 'El saldo no se cobró. Reintenta o elige otro medio de pago.';
        return;
      }
      method = used;
      this.checkInPaidByPos = item.id;
    }

    try {
      const reserva = await this.hostalService.processCheckIn(item.id, method || undefined);
      await this.sedeService.marcarOcupada(item.roomNumber, item.guestName);
      if (item.outstandingBalance > 0 && method) {
        this.checkInReceipt = {
          subtitle: `Check-in completado · Habitación ${item.roomNumber} ocupada`,
          guestName: item.guestName,
          roomNumber: item.roomNumber,
          typologyName: item.roomType,
          arrivalDate: reserva.fecha_llegada,
          arrivalTime: reserva.hora_llegada ?? '',
          departureDate: reserva.fecha_salida,
          departureTime: reserva.hora_salida ?? '',
          nights: item.nights,
          personCount: reserva.cantidad_personas ?? 1,
          total: item.totalAmount,
          previouslyPaid: item.amountPaid,
          paid: item.outstandingBalance,
          pending: 0,
          methodLabel: PAYMENT_METHOD_LABELS[method],
          reference: (isCardMethod(method) ? this.posCobro.transaccion()?.externalReference : null) || `Reserva #${item.id}`,
          paidAt: new Date(),
        };
      }
      this.entrySuccessMessage = item.outstandingBalance > 0
        ? `Check-in completado para ${item.guestName}. Se cobraron ${item.outstandingBalance.toLocaleString('es-CL')} CLP con ${method ? PAYMENT_METHOD_LABELS[method] : ''}. La habitación ${item.roomNumber} ahora está OCUPADA.`
        : `Check-in completado para ${item.guestName}. ${item.hasPaymentRecord ? 'El pago de la reserva ya estaba completo.' : 'No había saldo pendiente registrado.'} La habitación ${item.roomNumber} ahora está OCUPADA.`;
      this.movementError = '';
      this.checkInPaidByPos = null;
      this.posCobro.reset();
      this.closeCheckInPayment();
    } catch (error) {
      this.checkInPaymentError = error instanceof Error
        ? error.message
        : 'No se pudo procesar el check-in.';
    }
  }

  async realizarCheckOut(item: CheckItemPlaceholder): Promise<void> {
    this.movementError = '';
    try {
      await this.hostalService.processCheckOut(item.id);
      await this.sedeService.marcarEnAseo(item.roomNumber);
      this.movementError = '';
      this.entrySuccessMessage = `Check-out procesado para ${item.guestName}. La habitación ${item.roomNumber} pasa a estado EN ASEO.`;
    } catch (error) {
      this.movementError = error instanceof Error
        ? error.message
        : 'No se pudo procesar el check-out.';
    }
  }

  isRoomOcupada(roomNumber: string): boolean {
    const room = this.sedeService.habitaciones().find((h) => String(h.numero).trim() === String(roomNumber).trim());
    return room?.estado === 'ocupada';
  }

  /** Motivo por el que la habitación no puede recibir un check-in, o null si está libre. */
  checkInBlockedReason(roomNumber: string): string | null {
    const room = this.sedeService.habitaciones().find((h) => String(h.numero).trim() === String(roomNumber).trim());
    if (isRoomReadyForGuest(room?.estado)) return null;
    return room?.estado === 'en aseo'
      ? `la habitación ${roomNumber} está en aseo`
      : `la habitación ${roomNumber} está ocupada`;
  }

  isRoomEnAseo(roomNumber: string): boolean {
    const room = this.sedeService.habitaciones().find((h) => String(h.numero).trim() === String(roomNumber).trim());
    return room?.estado === 'en aseo';
  }

  formatRut(value: string): void {
    const cleaned = value.replace(/[^0-9k]/gi, '').toUpperCase();
    const hasCheckDigitK = cleaned.endsWith('K');
    const digits = cleaned.replace(/\D/g, '').slice(0, 9);

    if (digits.length === 0) {
      this.entryForm.documento = '';
      return;
    }

    if (hasCheckDigitK) {
      const body = digits.slice(0, 8);
      this.entryForm.documento = body
        ? `${body.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}-K`
        : 'K';
      return;
    }

    // The last digit is always the check digit, whatever the RUT length.
    this.entryForm.documento = digits.length === 1
      ? digits
      : `${digits.slice(0, -1).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}-${digits.slice(-1)}`;
  }

  sanitizeDigits(value: string, maxLength = 20): string {
    return value.replace(/\D/g, '').slice(0, maxLength);
  }

  isValidEmail(value: string): boolean {
    return /^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?)+$/i.test(value.trim());
  }

  handleDocumentInput(event: Event): void {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) {
      return;
    }

    if (this.entryForm.documentType === 'rut') {
      this.formatRut(input.value);
    } else {
      this.entryForm.documento = this.sanitizeDigits(input.value);
    }
    input.value = this.entryForm.documento;
  }

  handlePhoneInput(event: Event): void {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) {
      return;
    }

    this.entryForm.telefono = limitPhoneDigits(this.entryForm.phoneCountry, input.value);
    input.value = this.entryForm.telefono;
  }

  /** Al cambiar de país se recorta el número si excede el nuevo máximo. */
  onPhoneCountryChange(code: string): void {
    this.entryForm.phoneCountry = code;
    this.entryForm.telefono = limitPhoneDigits(code, this.entryForm.telefono);
  }

  get phoneMaxLength(): number {
    return maxPhoneDigits(this.entryForm.phoneCountry) + 1;
  }

  /** Formato válido para el país elegido (libphonenumber, local y gratis). */
  get isPhoneFormatValid(): boolean {
    return isValidPhoneFormat(this.entryForm.phoneCountry, this.entryForm.telefono);
  }

  get phoneCountry(): (typeof COUNTRY_OPTIONS)[number] {
    return COUNTRY_OPTIONS.find((country) => country.code === this.entryForm.phoneCountry) ?? COUNTRY_OPTIONS[0];
  }

  isValidRut(value: string): boolean {
    const rut = value.replace(/[.\s-]/g, '').toUpperCase();
    if (!/^\d{7,8}[0-9K]$/.test(rut) || /^0+$/.test(rut)) {
      return false;
    }

    const body = rut.slice(0, -1);
    let multiplier = 2;
    const sum = [...body].reverse().reduce((total, digit) => {
      const updatedTotal = total + Number(digit) * multiplier;
      multiplier = multiplier === 7 ? 2 : multiplier + 1;
      return updatedTotal;
    }, 0);
    const remainder = 11 - (sum % 11);
    const verifier = remainder === 11 ? '0' : remainder === 10 ? 'K' : String(remainder);
    return rut.endsWith(verifier);
  }

  private normalizeDocument(value: string): string {
    return value.replace(/[.\s-]/g, '').toUpperCase();
  }

  private isValidReservationDate(value: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00`);
    return !Number.isNaN(date.getTime()) && this.localDateString(date) === value;
  }

  private setPageScrollLocked(locked: boolean): void {
    if (locked) {
      this.renderer.addClass(this.document.body, 'entry-modal-open');
    } else {
      this.renderer.removeClass(this.document.body, 'entry-modal-open');
    }
  }

  private createEmptyEntryForm(): {
    documentType: 'rut' | 'passport';
    documento: string;
    nombre: string;
    apellido: string;
    telefono: string;
    phoneCountry: string;
    email: string;
    nacionalidad: string;
    arrivalDate: string;
    departureDate: string;
    arrivalTime: string;
    departureTime: string;
    personCount: number;
    roomId: string;
  } {
    const arrival = this.localDateString(new Date());
    const departureDate = new Date();
    departureDate.setDate(departureDate.getDate() + 1);
    return {
      documentType: 'rut',
      documento: '',
      nombre: '',
      apellido: '',
      telefono: '',
      phoneCountry: 'cl',
      email: '',
      nacionalidad: '',
      arrivalDate: arrival,
      departureDate: this.localDateString(departureDate),
      arrivalTime: '14:00',
      departureTime: '12:00',
      personCount: 1,
      roomId: '',
    };
  }

  private localDateString(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private updateCurrentDateKey(): void {
    const dateKey = this.localDateString(new Date());

    if (dateKey !== this.currentDateKey) {
      this.currentDateKey = dateKey;
      this.refreshPendingChecks();
    }
  }

  private toCheckItem(
    entry: ReservationCalendarEntry,
    type: 'checkin' | 'checkout',
    index: number,
    isOverdue = false
  ): CheckItemPlaceholder {
    const nights = this.getNights(entry.arrivalDate, entry.departureDate);
    const colors: CheckItemPlaceholder['avatarColor'][] = ['green', 'orange', 'blue', 'purple'];
    const initials = entry.guestName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0))
      .join('')
      .toUpperCase();

    return {
      id: entry.id,
      guestName: entry.guestName,
      initials,
      country: entry.country,
      phone: entry.phone,
      email: entry.email,
      roomNumber: entry.roomNumber,
      roomType: entry.roomType,
      dateRange: `${this.formatDate(entry.arrivalDate)} → ${this.formatDate(entry.departureDate)}`,
      nights,
      scheduledTime: type === 'checkin' ? (entry.arrivalTime || '14:00') : (entry.departureTime || '12:00'),
      timeWindowLabel: type === 'checkin' ? 'Hora de llegada' : 'Hora de salida',
      statusBadge: isOverdue ? 'ATRASADO' : type === 'checkin' ? 'CHECK-IN HOY' : 'CHECK-OUT HOY',
      isOverdue,
      avatarColor: colors[index % colors.length],
      totalAmount: entry.totalAmount,
      amountPaid: entry.amountPaid,
      outstandingBalance: Math.max(0, entry.totalAmount - entry.amountPaid),
      hasPaymentRecord: entry.hasPaymentRecord,
      isVip: entry.isVip,
      notes: entry.isVip ? 'Huésped recurrente' : undefined,
    };
  }

  /** Noches cobradas; una estadía del mismo día (pocas horas) se cobra como 1 noche mínima. */
  private getNights(arrivalDate: string, departureDate: string): number {
    const arrival = Date.parse(`${arrivalDate}T00:00:00Z`);
    const departure = Date.parse(`${departureDate}T00:00:00Z`);
    return Math.max(1, Math.round((departure - arrival) / (24 * 60 * 60 * 1000)));
  }

  private createReservationQuote(): ReservationQuote {
    const roomId = Number(this.entryForm.roomId);
    const room = this.availableRooms.find((candidate) => candidate.id_habitacion === roomId);
    const typology = room
      ? this.sedeService.tipologias().find((candidate) => candidate.id === room.id_tipologia)
      : undefined;
    if (!room || !typology) {
      throw new Error('No se encontró la tipología de la habitación seleccionada.');
    }

    const rates = this.loadStoredTarifas();
    const nights = this.getNights(this.entryForm.arrivalDate, this.entryForm.departureDate);
    if (nights < 1) {
      throw new Error('El rango de fechas debe incluir al menos una noche.');
    }

    let total = 0;
    for (let offset = 0; offset < nights; offset++) {
      const date = new Date(`${this.entryForm.arrivalDate}T00:00:00`);
      date.setDate(date.getDate() + offset);
      const nightlyPrice = this.getEffectiveNightlyPrice(typology, date, rates);
      if (nightlyPrice === undefined || !Number.isFinite(nightlyPrice) || nightlyPrice < 0) {
        throw new Error(`Configura un precio para la tipología ${typology.nombre} en /tarifas antes de confirmar.`);
      }
      total += nightlyPrice;
    }

    const depositPercentage = this.loadDepositPercentage();
    total = Math.round(total);
    return {
      nights,
      total,
      depositPercentage,
      deposit: Math.round(total * depositPercentage / 100),
      typologyName: typology.nombre,
      roomNumber: room.numero_habitacion,
      guestName: this.guestMode === 'existing'
        ? `${this.selectedGuest?.nombre ?? ''} ${this.selectedGuest?.apellido ?? ''}`.trim()
        : `${this.entryForm.nombre} ${this.entryForm.apellido}`.trim(),
    };
  }

  private updateRoomNightlyPrices(): void {
    this.roomNightlyPrices.clear();
    if (this.availableRooms.length === 0) return;
    const rates = this.loadStoredTarifas();
    const arrivalDate = new Date(`${this.entryForm.arrivalDate}T00:00:00`);
    for (const typology of this.sedeService.tipologias()) {
      const price = this.getEffectiveNightlyPrice(typology, arrivalDate, rates);
      this.roomNightlyPrices.set(typology.id, price ?? null);
    }
  }

  private getEffectiveNightlyPrice(
    typology: SedeTipologia,
    date: Date,
    rates: StoredTarifa[]
  ): number | undefined {
    const matchingRates = rates.filter((rate) =>
      rate.periodos.some((period) => this.tarifaPeriodMatches(period, date))
    );
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

  private async loadTarifasConfig(): Promise<void> {
    const sedeId = this.sede()?.id;
    if (sedeId === undefined) {
      throw new Error('Selecciona una sede para consultar sus tarifas.');
    }
    const [abono, tarifas] = await Promise.all([
      firstValueFrom(this.tarifasRepository.getAbono(sedeId)),
      firstValueFrom(this.tarifasRepository.listTarifas(sedeId)),
    ]);
    this.tarifasConfig = {
      sedeId,
      porcentajeAbono: abono.porcentajeAbono,
      tarifas: tarifas.filter((tarifa) => tarifa.activa),
    };
  }

  private loadStoredTarifas(): StoredTarifa[] {
    const sedeId = this.sede()?.id;
    if (sedeId === undefined) {
      throw new Error('Selecciona una sede para consultar sus tarifas.');
    }
    if (this.tarifasConfig?.sedeId !== sedeId) return [];
    const parsed: unknown = this.tarifasConfig.tarifas;
    if (!Array.isArray(parsed) || !parsed.every((rate) => this.isStoredTarifa(rate))) {
      throw new Error('Las tarifas guardadas tienen un formato inválido. Revísalas en /tarifas.');
    }
    return parsed.filter((rate): rate is StoredTarifa => this.isStoredTarifa(rate));
  }

  private isStoredTarifa(value: unknown): value is StoredTarifa {
    if (!value || typeof value !== 'object') return false;
    const rate = value as Record<string, unknown>;
    const periodTypes: TarifaPeriodType[] = [
      'months', 'weekdays', 'month-days', 'specific-month-days', 'date-range', 'specific-dates',
    ];
    return Array.isArray(rate['periodos']) &&
      rate['periodos'].every((period: unknown) => {
        if (!period || typeof period !== 'object') return false;
        const item = period as Record<string, unknown>;
        return typeof item['tipo'] === 'string' && periodTypes.includes(item['tipo'] as TarifaPeriodType) &&
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

  private loadDepositPercentage(): number {
    const sedeId = this.sede()?.id;
    if (sedeId === undefined) {
      throw new Error('Selecciona una sede para consultar el porcentaje de abono.');
    }
    if (this.tarifasConfig?.sedeId !== sedeId) return 20;
    const percentage = this.tarifasConfig.porcentajeAbono;
    if (!Number.isFinite(percentage) || percentage < 1 || percentage > 100) {
      throw new Error('El porcentaje de abono configurado en /tarifas no es válido.');
    }
    return percentage;
  }

  private tarifaPeriodMatches(period: StoredTarifaPeriod, date: Date): boolean {
    const dateString = this.localDateString(date);
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

  private formatDate(dateKey: string): string {
    const [, month, day] = dateKey.split('-');
    return `${day}/${month}`;
  }
}