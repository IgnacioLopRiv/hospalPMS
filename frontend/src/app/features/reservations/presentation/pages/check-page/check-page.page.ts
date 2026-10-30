import { Component, EventEmitter, inject, Input, OnDestroy, OnInit, Output, Renderer2 } from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { IonIcon } from '@ionic/angular/standalone';
import { firstValueFrom, Subscription } from 'rxjs';
import { addIcons } from 'ionicons';
import {
  enterOutline,
  exitOutline,
  bedOutline,
  calendarOutline,
  timeOutline,
  peopleOutline,
  star,
  callOutline,
  mailOutline,
  logInOutline,
  logOutOutline,
  ellipsisVerticalOutline,
  informationCircleOutline,
  checkmarkCircleOutline,
  swapHorizontalOutline,
  closeOutline,
  cashOutline,
  chevronDownOutline,
  searchOutline,
} from 'ionicons/icons';
import { SedeService } from '../../../../locations/application/sede.service';
import { HostalService, ReservationCalendarEntry } from '../../../../huespedes/application/hostal.service';
import { GuestCardView, Huesped, Habitacion, SedeHabitacion, SedeTipologia } from '../../../../../shared/domain/hostal.model';
import { COUNTRY_OPTIONS } from '../../../../../shared/domain/country-options';
import { CountryPickerComponent } from '../../../../../shared/presentation/country-picker/country-picker.component';
import { FotoHabitacionService } from '../../../../locations/application/foto-habitacion.service';
import { FotoHabitacion } from '../../../../locations/domain/foto-habitacion.model';
import { InventarioService } from '../../../../inventory/application/inventario.service';
import { TarifasConfig, TarifasRepository } from '../../../../locations/domain/tarifas.repository';

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

type PaymentMethod = 'transferencia' | 'efectivo';
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
}

@Component({
  selector: 'app-check-page',
  templateUrl: './check-page.page.html',
  styleUrls: ['./check-page.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonIcon, CountryPickerComponent],
})
export class CheckPagePage implements OnInit, OnDestroy {
  private readonly sedeService = inject(SedeService);
  private readonly hostalService = inject(HostalService);
  private readonly renderer = inject(Renderer2);
  private readonly document = inject(DOCUMENT);
  private readonly fotoHabitacionService = inject(FotoHabitacionService);
  private readonly inventarioService = inject(InventarioService);
  private readonly tarifasRepository = inject(TarifasRepository);
  private tarifasConfig: TarifasConfig | null = null;
  @Input() modalOnly = false;
  @Input() guestDraft?: GuestDraft;
  @Input() existingGuestId: number | null = null;
  @Input() startAtReservationDetails = false;
  @Output() entryModalClosed = new EventEmitter<void>();
  @Output() entryRegistered = new EventEmitter<string>();
  readonly sede = this.sedeService.selectedSede;
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

  get totalRoomsInvolved(): number {
    const rooms = new Set<string>();
    this.pendingCheckIns.forEach((c) => rooms.add(c.roomNumber));
    this.pendingCheckOuts.forEach((c) => rooms.add(c.roomNumber));
    return rooms.size;
  }

  constructor() {
    addIcons({
      enterOutline,
      exitOutline,
      bedOutline,
      calendarOutline,
      timeOutline,
      peopleOutline,
      star,
      callOutline,
      mailOutline,
      logInOutline,
      logOutOutline,
      ellipsisVerticalOutline,
      informationCircleOutline,
      checkmarkCircleOutline,
      swapHorizontalOutline,
      closeOutline,
      cashOutline,
      chevronDownOutline,
      searchOutline,
    });
  }

  openNewEntryForm(guestDraft?: GuestDraft): void {
    this.availableGuests.splice(0, this.availableGuests.length, ...this.hostalService.getGuests());
    this.entryForm = this.createEmptyEntryForm();
    this.guestMode = 'new';
    this.selectedGuestId = '';
    this.guestPickerOpen = false;
    this.guestSearchQuery = '';
    this.entryStep = 1;
    this.paymentOption = 'deposit';
    this.paymentMethod = '';
    this.reservationQuote = null;
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
    this.showCloseConfirmation = true;
  }

  cancelCloseNewEntryForm(): void {
    this.showCloseConfirmation = false;
  }

  discardNewEntryForm(): void {
    this.closeNewEntryForm();
  }

  ngOnDestroy(): void {
    this.reservationSubscription?.unsubscribe();
    if (this.clockInterval !== undefined) {
      clearInterval(this.clockInterval);
    }
    if (!this.modalOnly) {
      this.setPageScrollLocked(false);
    }
  }

  refreshPendingChecks(): void {
    const today = this.localDateString(new Date());
    const entries = this.hostalService.getReservationCalendarData();
    const checkIns = entries.filter((entry) =>
      entry.arrivalDate === today && ['CONFIRMADA', 'CHECK-IN HOY'].includes(entry.status)
    );
    const checkOuts = entries.filter((entry) =>
      entry.departureDate === today && ['HOSPEDADO', 'CHECK-OUT HOY'].includes(entry.status)
    );

    this.pendingCheckIns.splice(
      0,
      this.pendingCheckIns.length,
      ...checkIns.map((entry, index) => this.toCheckItem(entry, 'checkin', index))
    );
    this.pendingCheckOuts.splice(
      0,
      this.pendingCheckOuts.length,
      ...checkOuts.map((entry, index) => this.toCheckItem(entry, 'checkout', index))
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
    return this.entryStep === 4 && this.reservationQuote !== null &&
      (this.paymentMethod === 'transferencia' || this.paymentMethod === 'efectivo');
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

  isReservationDetailsValid(form: NgForm): boolean {
    return form.valid === true &&
      this.isValidReservationDate(this.entryForm.arrivalDate) &&
      this.isValidReservationDate(this.entryForm.departureDate) &&
      this.entryForm.arrivalDate < this.entryForm.departureDate &&
      Number.isInteger(this.entryForm.personCount) &&
      this.entryForm.personCount >= 1 &&
      /^([01]\d|2[0-3]):[0-5]\d$/.test(this.entryForm.arrivalTime);
  }

  isEntryStepValid(form: NgForm): boolean {
    const guestIsValid = this.guestMode === 'existing'
      ? !!this.selectedGuest
      : this.areNewGuestFieldsValid();
    return form.valid === true && guestIsValid &&
      this.isValidReservationDate(this.entryForm.arrivalDate) &&
      this.isValidReservationDate(this.entryForm.departureDate) &&
      this.entryForm.arrivalDate < this.entryForm.departureDate &&
      Number.isInteger(this.entryForm.personCount) &&
      this.entryForm.personCount >= 1 &&
      /^([01]\d|2[0-3]):[0-5]\d$/.test(this.entryForm.arrivalTime) &&
      this.availableRooms.some((room) => room.id_habitacion === Number(this.entryForm.roomId));
  }

  updateAvailableRooms(): void {
    this.availableRooms = this.hostalService.getAvailableRooms(
      this.entryForm.arrivalDate,
      this.entryForm.departureDate,
      this.entryForm.personCount
    );
    this.updateRoomNightlyPrices();
    this.entryForm.roomId = '';
  }

  roomNightlyPrice(room: Habitacion): number | null {
    return this.roomNightlyPrices.get(room.id_tipologia) ?? null;
  }

  async registerEntry(): Promise<void> {
    this.entryError = '';
    if (!this.isPaymentStepValid() || !this.reservationQuote) {
      this.entryError = 'Selecciona el medio de pago para confirmar la reserva.';
      return;
    }
    if (this.paymentMethod !== 'transferencia' && this.paymentMethod !== 'efectivo') {
      this.entryError = 'Selecciona transferencia o efectivo como medio de pago.';
      return;
    }
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
        payment: {
          totalAmount: this.reservationQuote.total,
          paidAmount: this.paymentAmount,
          depositPercentage: this.reservationQuote.depositPercentage,
          method: this.paymentMethod,
          paidInFull: this.paymentOption === 'full',
        },
      });
      const roomAssigned = this.availableRooms.find((room) => room.id_habitacion === registered.reservation.id_habitacion);
      const roomNum = roomAssigned?.numero_habitacion ?? '';
      this.entrySuccessMessage = `Reserva confirmada para ${registered.guest.nombre} ${registered.guest.apellido} en la habitación ${roomNum}. Se registró un pago de ${this.paymentAmount.toLocaleString('es-CL')} CLP por ${this.paymentMethod}.`;
      this.showNewEntryForm = false;
      this.setPageScrollLocked(false);
      if (this.modalOnly) {
        this.entryRegistered.emit(this.entrySuccessMessage);
      }
    } catch (error) {
      this.entryError = error instanceof Error ? error.message : 'No se pudo registrar el ingreso. Inténtalo nuevamente.';
    }
  }

  realizarCheckIn(item: CheckItemPlaceholder): void {
    this.movementError = '';
    this.checkInPaymentItem = item;
    this.checkInPaymentMethod = '';
    this.checkInPaymentError = '';
  }

  closeCheckInPayment(): void {
    this.checkInPaymentItem = null;
    this.checkInPaymentMethod = '';
    this.checkInPaymentError = '';
  }

  async confirmCheckInPayment(): Promise<void> {
    const item = this.checkInPaymentItem;
    if (!item) return;
    if (item.outstandingBalance > 0 &&
      this.checkInPaymentMethod !== 'transferencia' &&
      this.checkInPaymentMethod !== 'efectivo') {
      this.checkInPaymentError = 'Selecciona el medio de pago para cobrar el saldo pendiente.';
      return;
    }

    try {
      await this.hostalService.processCheckIn(item.id, this.checkInPaymentMethod || undefined);
      await this.sedeService.marcarOcupada(item.roomNumber, item.guestName);
      this.entrySuccessMessage = item.outstandingBalance > 0
        ? `Check-in completado para ${item.guestName}. Se cobraron ${item.outstandingBalance.toLocaleString('es-CL')} CLP por ${this.checkInPaymentMethod}. La habitación ${item.roomNumber} ahora está OCUPADA.`
        : `Check-in completado para ${item.guestName}. ${item.hasPaymentRecord ? 'El pago de la reserva ya estaba completo.' : 'No había saldo pendiente registrado.'} La habitación ${item.roomNumber} ahora está OCUPADA.`;
      this.movementError = '';
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

    const formattedDigits = digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    this.entryForm.documento = digits.length === 9
      ? `${digits.slice(0, 8).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}-${digits.slice(-1)}`
      : formattedDigits;
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

    this.entryForm.telefono = this.sanitizeDigits(input.value, 9);
    input.value = this.entryForm.telefono;
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
    index: number
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
      scheduledTime: type === 'checkin' ? entry.arrivalTime || 'Por confirmar' : 'Por confirmar',
      timeWindowLabel: type === 'checkin' ? 'Hora de llegada' : 'Hora de salida',
      statusBadge: type === 'checkin' ? 'CHECK-IN HOY' : 'CHECK-OUT HOY',
      avatarColor: colors[index % colors.length],
      totalAmount: entry.totalAmount,
      amountPaid: entry.amountPaid,
      outstandingBalance: Math.max(0, entry.totalAmount - entry.amountPaid),
      hasPaymentRecord: entry.hasPaymentRecord,
      isVip: entry.isVip,
      notes: entry.isVip ? 'Huésped recurrente' : undefined,
    };
  }

  private getNights(arrivalDate: string, departureDate: string): number {
    const arrival = Date.parse(`${arrivalDate}T00:00:00Z`);
    const departure = Date.parse(`${departureDate}T00:00:00Z`);
    return Math.round((departure - arrival) / (24 * 60 * 60 * 1000));
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
    this.tarifasConfig = await firstValueFrom(this.tarifasRepository.getForSede(sedeId));
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