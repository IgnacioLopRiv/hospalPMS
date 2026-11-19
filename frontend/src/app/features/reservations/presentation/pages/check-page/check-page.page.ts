import { EscapeCloseDirective } from '../../../../../shared/presentation/modal-portal/escape-close.directive';
import { Component, ComponentRef, EventEmitter, HostListener, inject, Input, OnDestroy, OnInit, Output, Renderer2, ViewContainerRef } from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { IonIcon } from '@ionic/angular/standalone';
import { Subscription } from 'rxjs';
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
import { isValidStayRange, stayInterval } from '../../../domain/stay-schedule';
import { GuestCardView, Huesped, Habitacion, SedeHabitacion, SedeTipologia } from '../../../../../shared/domain/hostal.model';
import { PosCobroService, PosDisponible } from '../../../../payments-pos/application/pos-cobro.service';
import { PosCobroEstadoComponent } from '../../../../payments-pos/presentation/pos-cobro-estado/pos-cobro-estado.component';
import { COUNTRY_OPTIONS } from '../../../../../shared/domain/country-options';
import { CountryPickerComponent } from '../../../../../shared/presentation/country-picker/country-picker.component';
import { FotoHabitacionService } from '../../../../locations/application/foto-habitacion.service';
import { FotoHabitacion } from '../../../../locations/domain/foto-habitacion.model';
import { InventarioService } from '../../../../inventory/application/inventario.service';
import { TarifaPricingService } from './tarifa-pricing.service';
import { ExtendStayModalComponent } from './extend-stay-modal/extend-stay-modal.component';
import { RoomChangeModalComponent } from './room-change-modal/room-change-modal.component';
import { isValidDateKey, chargedNights, formatDayMonth, localDateString, todayKey } from './check-dates';
import { formatRut, isValidEmail, isValidRut, normalizeDocument, sanitizeDigits } from './guest-validation';
import {
  chargeWithPos,
  CheckItemPlaceholder,
  CheckModalResult,
  GuestDraft,
  isCardMethod,
  PAYMENT_METHOD_LABELS,
  PaymentMethod,
  PaymentReceipt,
  ReservationQuote,
  roomBlockedReason,
} from './check-page.models';

export type { CheckItemPlaceholder, GuestDraft, PaymentReceipt } from './check-page.models';
import { ModalPortalDirective } from '../../../../../shared/presentation/modal-portal/modal-portal.directive';
import {
  isValidPhoneFormat,
  limitPhoneDigits,
  maxPhoneDigits,
  PHONE_FORMAT_ERROR,
} from '../../../../../shared/domain/phone-format';


@Component({
  selector: 'app-check-page',
  templateUrl: './check-page.page.html',
  styleUrls: ['./check-page.page.scss'],
  standalone: true,
  imports: [EscapeCloseDirective, CommonModule, FormsModule, IonIcon, CountryPickerComponent, ModalPortalDirective, PosCobroEstadoComponent, ExtendStayModalComponent, RoomChangeModalComponent],
  providers: [TarifaPricingService],
})
export class CheckPagePage implements OnInit, OnDestroy {
  private readonly sedeService = inject(SedeService);
  private readonly hostalService = inject(HostalService);
  private readonly renderer = inject(Renderer2);
  private readonly document = inject(DOCUMENT);
  private readonly fotoHabitacionService = inject(FotoHabitacionService);
  private readonly inventarioService = inject(InventarioService);
  private readonly pricing = inject(TarifaPricingService);
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
    const document = normalizeDocument(this.entryForm.documento);
    if (!document) {
      return undefined;
    }

    return this.availableGuests.find((guest) =>
      normalizeDocument(guest.documento ?? '') === document
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

  // ── Extender estadía / cambio de habitación (modales hijos) ──────────────────
  extendItem: CheckItemPlaceholder | null = null;
  roomChangeItem: CheckItemPlaceholder | null = null;

  openExtendStay(item: CheckItemPlaceholder): void {
    this.openMenuId = null;
    if (!this.reservationExists(item)) return;
    this.extendItem = item;
  }

  openRoomChange(item: CheckItemPlaceholder): void {
    this.openMenuId = null;
    if (!this.reservationExists(item)) return;
    this.roomChangeItem = item;
  }

  /** Mensaje y comprobante (si hubo cobro) que devuelve un modal hijo al terminar. */
  onCheckModalCompleted(result: CheckModalResult): void {
    this.entrySuccessMessage = result.message;
    this.movementError = '';
    if (result.receipt) this.checkInReceipt = result.receipt;
  }

  private reservationExists(item: CheckItemPlaceholder): boolean {
    const exists = this.hostalService.getReservations().some((r) => r.id_reserva === item.id);
    if (!exists) this.movementError = 'La reserva ya no existe. Actualiza la lista e inténtalo otra vez.';
    return exists;
  }

  /**
   * Abre sobre Recepción el modal de Huéspedes que corresponde a la acción (ficha, editar datos
   * del huésped o editar la reserva), sin cambiar de página.
   */


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
      const normalizedDocument = normalizeDocument(guestDraft.documento);
      const existingGuest = normalizedDocument
        ? this.availableGuests.find((guest) =>
          normalizeDocument(guest.documento ?? '') === normalizedDocument
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
    const today = todayKey();
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
      await this.pricing.load();
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
    return todayKey();
  }

  isReservationDetailsValid(form: NgForm): boolean {
    return form.valid === true &&
      isValidDateKey(this.entryForm.arrivalDate) &&
      this.entryForm.arrivalDate >= this.minArrivalDate &&
      isValidDateKey(this.entryForm.departureDate) &&
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
      isValidDateKey(this.entryForm.arrivalDate) &&
      isValidDateKey(this.entryForm.departureDate) &&
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
        const used = await chargeWithPos(this.posCobro, this.posDisponible,
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
      const used = await chargeWithPos(this.posCobro, this.posDisponible, item.id, item.outstandingBalance, 'PAGO_FINAL', method);
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
    return this.roomEstado(roomNumber) === 'ocupada';
  }

  isRoomEnAseo(roomNumber: string): boolean {
    return this.roomEstado(roomNumber) === 'en aseo';
  }

  private roomEstado(roomNumber: string): string | undefined {
    return this.sedeService.habitaciones().find((h) => String(h.numero).trim() === String(roomNumber).trim())?.estado;
  }

  /** Motivo por el que la habitación no puede recibir un check-in, o null si está libre. */
  checkInBlockedReason(roomNumber: string): string | null {
    return roomBlockedReason(this.sedeService.habitaciones(), roomNumber);
  }

  formatRut(value: string): void {
    this.entryForm.documento = formatRut(value);
  }

  sanitizeDigits(value: string, maxLength = 20): string {
    return sanitizeDigits(value, maxLength);
  }

  isValidEmail(value: string): boolean {
    return isValidEmail(value);
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
    return isValidRut(value);
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
    const arrival = todayKey();
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
      departureDate: localDateString(departureDate),
      arrivalTime: '14:00',
      departureTime: '12:00',
      personCount: 1,
      roomId: '',
    };
  }


  private updateCurrentDateKey(): void {
    const dateKey = todayKey();

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
    const nights = chargedNights(entry.arrivalDate, entry.departureDate);
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
      dateRange: `${formatDayMonth(entry.arrivalDate)} → ${formatDayMonth(entry.departureDate)}`,
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


  private createReservationQuote(): ReservationQuote {
    const roomId = Number(this.entryForm.roomId);
    const room = this.availableRooms.find((candidate) => candidate.id_habitacion === roomId);
    const typology = room
      ? this.sedeService.tipologias().find((candidate) => candidate.id === room.id_tipologia)
      : undefined;
    if (!room || !typology) {
      throw new Error('No se encontró la tipología de la habitación seleccionada.');
    }

    const rates = this.pricing.rates();
    const nights = chargedNights(this.entryForm.arrivalDate, this.entryForm.departureDate);
    if (nights < 1) {
      throw new Error('El rango de fechas debe incluir al menos una noche.');
    }

    let total = 0;
    for (let offset = 0; offset < nights; offset++) {
      const date = new Date(`${this.entryForm.arrivalDate}T00:00:00`);
      date.setDate(date.getDate() + offset);
      const nightlyPrice = this.pricing.nightlyPrice(typology, date, rates);
      if (nightlyPrice === undefined || !Number.isFinite(nightlyPrice) || nightlyPrice < 0) {
        throw new Error(`Configura un precio para la tipología ${typology.nombre} en /tarifas antes de confirmar.`);
      }
      total += nightlyPrice;
    }

    const depositPercentage = this.pricing.depositPercentage();
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
    const rates = this.pricing.rates();
    const arrivalDate = new Date(`${this.entryForm.arrivalDate}T00:00:00`);
    for (const typology of this.sedeService.tipologias()) {
      const price = this.pricing.nightlyPrice(typology, arrivalDate, rates);
      this.roomNightlyPrices.set(typology.id, price ?? null);
    }
  }


}