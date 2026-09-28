import { Component, inject, OnDestroy, OnInit, Renderer2 } from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { Router } from '@angular/router';
import { IonIcon } from '@ionic/angular/standalone';
import { Subscription } from 'rxjs';
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
} from 'ionicons/icons';
import { SedeService } from '../../../../locations/application/sede.service';
import { HostalService } from '../../../../guests/application/hostal.service';
import { Huesped, Habitacion } from '../../../../../shared/domain/hostal.model';
import { COUNTRY_OPTIONS } from '../../../../../shared/domain/country-options';
import { CountryPickerComponent } from '../../../../../shared/presentation/country-picker/country-picker.component';

interface GuestDraft {
  documentType: 'rut' | 'passport';
  documento: string;
  nombre: string;
  apellido: string;
  telefono: string;
  phoneCountry: string;
  email: string;
  nacionalidad: string;
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
  private readonly router = inject(Router);
  readonly sede = this.sedeService.selectedSede;
  availableGuests: Huesped[] = [];
  availableRooms: Habitacion[] = [];
  showNewEntryForm = false;
  entryError = '';
  entrySuccessMessage = '';
  documentFieldFocused = false;
  emailFieldFocused = false;
  guestMode: 'new' | 'existing' = 'new';
  selectedGuestId = '';
  entryStep: 1 | 2 = 1;
  entryForm = this.createEmptyEntryForm();
  readonly countries = COUNTRY_OPTIONS;

  currentDateFormatted = '';
  currentTimeFormatted = '';
  private clockInterval?: ReturnType<typeof setInterval>;
  private reservationSubscription?: Subscription;
  private currentDateKey = '';

  ngOnInit(): void {
    this.updateCurrentDateTime();
    this.reservationSubscription = this.hostalService.guestsView$.subscribe(() => {
      this.refreshPendingChecks();
    });
    this.clockInterval = setInterval(() => this.updateCurrentDateTime(), 1000);

    const guestDraft = this.router.getCurrentNavigation()?.extras.state?.['guestDraft'];
    if (this.isGuestDraft(guestDraft)) {
      this.openNewEntryForm(guestDraft);
    }
  }

  get selectedGuest(): Huesped | undefined {
    return this.availableGuests.find((guest) => guest.id_huesped === Number(this.selectedGuestId));
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
    });
  }

  openNewEntryForm(guestDraft?: GuestDraft): void {
    this.availableGuests.splice(0, this.availableGuests.length, ...this.hostalService.getGuests());
    this.entryForm = this.createEmptyEntryForm();
    this.guestMode = 'new';
    this.selectedGuestId = '';
    this.entryStep = 1;
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
    this.entryError = '';
    this.entrySuccessMessage = '';
    this.documentFieldFocused = false;
    this.emailFieldFocused = false;
    this.showNewEntryForm = true;
    this.setPageScrollLocked(true);
    this.updateAvailableRooms();
  }

  closeNewEntryForm(): void {
    this.showNewEntryForm = false;
    this.entryError = '';
    this.setPageScrollLocked(false);
  }

  ngOnDestroy(): void {
    this.reservationSubscription?.unsubscribe();
    if (this.clockInterval !== undefined) {
      clearInterval(this.clockInterval);
    }
    this.setPageScrollLocked(false);
  }

  refreshPendingChecks(): void {
    const today = this.localDateString(new Date());
    const reservationsById = new Map(
      this.hostalService.getReservations().map((reservation) => [reservation.id_reserva, reservation])
    );
    const calendarEntries = this.hostalService.getReservationCalendarData();
    const checkIns = calendarEntries.filter((entry) =>
      entry.arrivalDate === today &&
      reservationsById.get(entry.id)?.estado_reserva !== 'HOSPEDADO'
    );
    const checkOuts = calendarEntries.filter((entry) => entry.departureDate === today);

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
    this.entryError = '';
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

  goToReservationStep(form: NgForm): void {
    if (!this.isGuestStepValid(form)) {
      form.form.markAllAsTouched();
      return;
    }
    this.entryError = '';
    this.entryStep = 2;
  }

  returnToGuestStep(): void {
    this.entryError = '';
    this.entryStep = 1;
  }

  isEntryStepValid(form: NgForm): boolean {
    const guestIsValid = this.guestMode === 'existing'
      ? !!this.selectedGuest
      : this.areNewGuestFieldsValid();
    return form.valid === true && guestIsValid;
  }

  updateAvailableRooms(): void {
    this.availableRooms = this.hostalService.getAvailableRooms(
      this.entryForm.arrivalDate,
      this.entryForm.departureDate,
      this.entryForm.personCount
    );
    this.entryForm.roomId = '';
  }

  registerEntry(): void {
    this.entryError = '';
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
      const registered = this.hostalService.registerEntry({
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
      });
      this.entrySuccessMessage = `Ingreso registrado para ${registered.guest.nombre} ${registered.guest.apellido} en la habitación ${this.availableRooms.find((room) => room.id_habitacion === registered.reservation.id_habitacion)?.numero_habitacion ?? ''}.`;
      this.showNewEntryForm = false;
      this.setPageScrollLocked(false);
    } catch (error) {
      this.entryError = error instanceof Error ? error.message : 'No se pudo registrar el ingreso. Inténtalo nuevamente.';
    }
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
    if (!/^\d{1,8}[0-9K]$/.test(rut) || /^0+$/.test(rut)) {
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

  private isGuestDraft(value: unknown): value is GuestDraft {
    if (!value || typeof value !== 'object') return false;
    const draft = value as Partial<GuestDraft>;
    return (draft.documentType === 'rut' || draft.documentType === 'passport') &&
      typeof draft.documento === 'string' &&
      typeof draft.nombre === 'string' &&
      typeof draft.apellido === 'string' &&
      typeof draft.telefono === 'string' &&
      typeof draft.phoneCountry === 'string' &&
      typeof draft.email === 'string' &&
      typeof draft.nacionalidad === 'string';
  }

  private localDateString(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private updateCurrentDateTime(): void {
    const now = new Date();
    const dateKey = this.localDateString(now);
    const dateLabel = now.toLocaleDateString('es-CL', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    this.currentDateFormatted = `${dateLabel.charAt(0).toLocaleUpperCase()}${dateLabel.slice(1)}`;
    this.currentTimeFormatted = [
      String(now.getHours()).padStart(2, '0'),
      String(now.getMinutes()).padStart(2, '0'),
      String(now.getSeconds()).padStart(2, '0'),
    ].join(':');

    if (dateKey !== this.currentDateKey) {
      this.currentDateKey = dateKey;
      this.refreshPendingChecks();
    }
  }

  private toCheckItem(
    entry: ReturnType<HostalService['getReservationCalendarData']>[number],
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
      isVip: entry.isVip,
      notes: entry.isVip ? 'Huésped recurrente' : undefined,
    };
  }

  private getNights(arrivalDate: string, departureDate: string): number {
    const arrival = Date.parse(`${arrivalDate}T00:00:00Z`);
    const departure = Date.parse(`${departureDate}T00:00:00Z`);
    return Math.round((departure - arrival) / (24 * 60 * 60 * 1000));
  }

  private formatDate(dateKey: string): string {
    const [, month, day] = dateKey.split('-');
    return `${day}/${month}`;
  }
}