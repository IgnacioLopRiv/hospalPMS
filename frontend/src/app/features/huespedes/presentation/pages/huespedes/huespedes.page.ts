import { EscapeCloseDirective } from '../../../../../shared/presentation/modal-portal/escape-close.directive';
import { ChangeDetectorRef, Component, DOCUMENT, ElementRef, EventEmitter, Input, OnDestroy, OnInit, Output, Renderer2, ViewChild, DestroyRef, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  peopleOutline,
  checkmarkCircleOutline,
  bedOutline,
  calendarOutline,
  enterOutline,
  exitOutline,
  searchOutline,
  star,
  ellipsisVerticalOutline,
  logoWhatsapp,
  personOutline,
  createOutline,
  trashOutline,
  listOutline,
  gridOutline,
  closeOutline,
  logInOutline,
  logOutOutline,
  informationCircleOutline,
} from 'ionicons/icons';

import { HostalService } from '../../../application/hostal.service';
import { SedeService } from '../../../../locations/application/sede.service';
import { CheckPagePage } from '../../../../reservations/presentation/pages/check-page/check-page.page';
import { GuestCardView, GuestReservationDetail, Habitacion, Huesped, Reserva } from '../../../../../shared/domain/hostal.model';
import { COUNTRY_OPTIONS } from '../../../../../shared/domain/country-options';
import {
  isValidPhoneFormat,
  limitPhoneDigits,
  maxPhoneDigits,
  PHONE_FORMAT_ERROR,
} from '../../../../../shared/domain/phone-format';
import { parsePhoneNumberFromString } from 'libphonenumber-js/max';
import { CountryPickerComponent } from '../../../../../shared/presentation/country-picker/country-picker.component';
import { closeDialogAnimated } from '../../../../../shared/presentation/animations/modal-leave';
import { getApiErrorMessage } from '../../../../../shared/domain/api-error-message';

export interface HuespedModalAction {
  accion: 'detalle' | 'editar-huesped' | 'editar-reserva';
  huesped: number;
  reserva: number;
}

@Component({
  selector: 'app-huespedes',
  templateUrl: './huespedes.page.html',
  styleUrls: ['./huespedes.page.scss'],
  standalone: true,
  imports: [EscapeCloseDirective, 
    CommonModule,
    FormsModule,
    IonIcon,
    CountryPickerComponent,
    CheckPagePage
  ]
})
export class HuespedesPage implements OnInit, OnDestroy {
  private readonly renderer = inject(Renderer2);
  private readonly document = inject(DOCUMENT);
  private readonly changeDetector = inject(ChangeDetectorRef);

  @ViewChild('guestEditDialog') guestEditDialog?: ElementRef<HTMLDialogElement>;
  @ViewChild('reservationEditDialog') reservationEditDialog?: ElementRef<HTMLDialogElement>;
  @ViewChild('guestDeleteDialog') guestDeleteDialog?: ElementRef<HTMLDialogElement>;
  @ViewChild('guestDetailDialog') guestDetailDialog?: ElementRef<HTMLDialogElement>;

  guests: GuestCardView[] = [];
  filteredGuests: GuestCardView[] = [];
  selectedFilter: string = 'todos';
  viewMode: 'cards' | 'list' = 'cards';
  searchTerm: string = '';
  showNewGuestForm = false;
  showReservationAssignment = false;
  reservationAssignmentGuestId: number | null = null;
  guestError = '';
  guestSuccessMessage = '';
  showCancelReservationConfirm = false;
  documentFieldFocused = false;
  emailFieldFocused = false;
  phoneFieldFocused = false;
  editEmailFieldFocused = false;
  editPhoneFieldFocused = false;
  editPhoneCountry = 'cl';
  readonly phoneFormatError = PHONE_FORMAT_ERROR;
  guestForm = this.createEmptyGuestForm();
  readonly countries = COUNTRY_OPTIONS;
  openMenuCardIndex: number | null = null;
  editingGuestId: number | null = null;
  editGuestForm: Omit<Huesped, 'id_huesped' | 'id_sede'> = this.createEmptyEditGuestForm();
  deletingGuestId: number | null = null;
  guestDetail: {
    guest: Huesped;
    card?: GuestCardView;
    active: GuestReservationDetail[];
    history: GuestReservationDetail[];
  } | null = null;
  editingReservationId: number | null = null;
  reservationError = '';
  availableReservationRooms: Habitacion[] = [];
  editReservationForm = {
    fecha_llegada: '',
    fecha_salida: '',
    hora_llegada: '14:00',
    hora_salida: '12:00',
    cantidad_personas: 1,
    id_habitacion: '',
  };

  private readonly sedeService = inject(SedeService);
  private readonly hostalService = inject(HostalService);
  private readonly destroyRef = inject(DestroyRef);
  /**
   * Modo embebido: solo se renderizan los modales (sin la página de fondo). Lo usa Recepción
   * para abrir la ficha / edición del huésped o de la reserva sobre su propia página.
   */
  @Input() modalOnly = false;
  /** Modal a abrir en modo embebido. */
  @Input() modalAction: HuespedModalAction | null = null;
  /** Se emite (con el mensaje de éxito, si lo hubo) cuando se cierra el último modal. */
  @Output() modalClosed = new EventEmitter<string>();
  private pendingModalAction: HuespedModalAction | null = null;
  readonly sede = this.sedeService.selectedSede;

  constructor() {
    addIcons({
      informationCircleOutline,
      closeOutline,
      peopleOutline,
      checkmarkCircleOutline,
      bedOutline,
      calendarOutline,
      enterOutline,
      exitOutline,
      searchOutline,
      star,
      ellipsisVerticalOutline,
      logoWhatsapp,
      personOutline,
      createOutline,
      trashOutline,
      listOutline,
      gridOutline,
      logInOutline,
      logOutOutline
    });

    // React to sede changes — refresh guest data when the user switches sede
    effect(() => {
      const sede = this.sedeService.selectedSede();
      if (sede && !this.modalOnly) {
        this.hostalService.onSedeChanged();
      }
    });
  }

  ngOnInit() {
    if (this.modalOnly) this.pendingModalAction = this.modalAction;
    this.hostalService.guestsView$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((data) => {
      this.guests = data;
      this.applyFilters();
      this.openPendingModalAction();
    });
  }

  /** Abre el modal pedido en modo embebido cuando los datos ya están cargados. */
  private openPendingModalAction(): void {
    const link = this.pendingModalAction;
    if (!link || !this.hostalService.getGuests().some((guest) => guest.id_huesped === link.huesped)) return;
    this.pendingModalAction = null;
    // Espera a que la vista exista (los <dialog> se resuelven con ViewChild).
    setTimeout(() => {
      if (link.accion === 'editar-huesped') this.openGuestEditor(link.huesped);
      else if (link.accion === 'editar-reserva') this.openReservationEditor(link.reserva);
      else this.openGuestDetail(link.huesped);
    });
  }

  /** En modo embebido, avisa al contenedor cuando ya no queda ningún modal abierto. */
  private returnIfDone(): void {
    if (!this.modalOnly) return;
    // Diferido: al pasar de un modal a otro (detalle → editar) el siguiente ya estará abierto.
    setTimeout(() => {
      if (this.guestDetail || this.editingGuestId !== null || this.editingReservationId !== null
        || this.deletingGuestId !== null || this.showReservationAssignment) return;
      this.modalClosed.emit(this.guestSuccessMessage);
    });
  }

  setFilter(filter: string) {
    this.selectedFilter = filter;
    this.applyFilters();
  }

  toggleView(): void {
    this.viewMode = this.viewMode === 'cards' ? 'list' : 'cards';
    this.openMenuCardIndex = null;
  }

  applyFilters() {
    this.filteredGuests = this.guests.filter((guest) => {
      const matchesFilter =
        this.selectedFilter === 'todos' ? true :
          this.selectedFilter === 'hospedados' ? this.hasStatus(guest, 'hospedado') :
            this.selectedFilter === 'checkin' ? this.hasStatus(guest, 'checkin_hoy') :
              this.selectedFilter === 'checkout' ? this.hasStatus(guest, 'checkout_hoy') :
                this.selectedFilter === 'activos' ? guest.hasReservation :
                  this.selectedFilter === 'inactivos' ? !guest.hasReservation : true;

      const matchesSearch =
        guest.guestName.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        guest.roomNumber.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        guest.country.toLowerCase().includes(this.searchTerm.toLowerCase());

      return matchesFilter && matchesSearch;
    });
  }

  getCount(status?: string): number {
    if (!status) return this.guests.length;
    if (status === 'activos') return this.guests.filter((guest) => guest.hasReservation).length;
    if (status === 'inactivos') return this.guests.filter((guest) => !guest.hasReservation).length;
    return this.guests.filter((g) => this.hasStatus(g, status as GuestCardView['status'])).length;
  }

  /** A guest matches a status if any of their active reservations has it. */
  private hasStatus(guest: GuestCardView, status: GuestCardView['status']): boolean {
    return (guest.statuses ?? [guest.status]).includes(status);
  }

  /** WhatsApp Web chat link for the guest's phone, or null when there is no usable number. */
  whatsappUrl(phone?: string): string | null {
    const digits = (phone ?? '').replace(/\D/g, '');
    return digits.length >= 6 ? `https://web.whatsapp.com/send?phone=${digits}` : null;
  }

  openGuestDetail(guestId: number): void {
    const guest = this.hostalService.getGuests().find((item) => item.id_huesped === guestId);
    if (!guest) {
      this.guestError = 'No se encontró el huésped. Actualiza la lista e inténtalo otra vez.';
      return;
    }
    const reservations = this.hostalService.getGuestReservationDetails(guestId);
    const isPast = (detail: GuestReservationDetail) =>
      ['FINALIZADA', 'CANCELADA'].includes(detail.reservation.estado_reserva);
    this.guestDetail = {
      guest,
      card: this.guests.find((item) => item.id_huesped === guestId),
      active: reservations.filter((detail) => !isPast(detail)),
      history: reservations.filter(isPast).reverse(),
    };
    this.openMenuCardIndex = null;
    this.setPageScrollLocked(true);
    this.changeDetector.detectChanges();
    const dialog = this.guestDetailDialog?.nativeElement;
    if (dialog && !dialog.open) {
      dialog.showModal();
    }
  }

  closeGuestDetail(): void {
    const dialog = this.guestDetailDialog?.nativeElement;
    if (dialog?.open) {
      closeDialogAnimated(dialog);
      // El <dialog> devuelve el foco a la tarjeta que lo abrió; al cerrar con Escape eso
      // deja visible el anillo de foco. Lo quitamos para que la tarjeta quede limpia.
      setTimeout(() => {
        const active = document.activeElement;
        if (active instanceof HTMLElement && active.classList.contains('guest-card')) {
          active.blur();
        }
      });
    }
    this.guestDetail = null;
    this.setPageScrollLocked(false);
    this.returnIfDone();
  }

  onGuestDetailDialogCancel(event: Event): void {
    event.preventDefault();
    this.closeGuestDetail();
  }

  /** Runs an action from the detail modal after closing it, so only one dialog is open. */
  fromGuestDetail(action: 'edit' | 'assign' | 'delete'): void {
    const guestId = this.guestDetail?.guest.id_huesped;
    this.closeGuestDetail();
    if (guestId === undefined) return;
    if (action === 'edit') this.openGuestEditor(guestId);
    else if (action === 'delete') this.requestGuestDeletion(guestId);
    else this.assignReservationToGuest(guestId);
  }

  editReservationFromDetail(reservationId: number): void {
    this.closeGuestDetail();
    this.openReservationEditor(reservationId);
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

  get isReservationRoomAvailable(): boolean {
    return this.availableReservationRooms.some(
      (room) => room.id_habitacion === Number(this.editReservationForm.id_habitacion)
    );
  }

  toggleGuestMenu(event: Event, cardIndex: number): void {
    event.stopPropagation();
    this.openMenuCardIndex = this.openMenuCardIndex === cardIndex ? null : cardIndex;
  }

  openGuestEditor(guestId: number): void {
    const guest = this.hostalService.getGuests().find((item) => item.id_huesped === guestId);
    if (!guest) {
      this.guestError = 'No se encontró el huésped. Actualiza la lista e inténtalo otra vez.';
      return;
    }
    this.editingGuestId = guestId;
    const phone = this.splitPhone(guest.telefono ?? '');
    this.editPhoneCountry = phone.country;
    this.editEmailFieldFocused = false;
    this.editPhoneFieldFocused = false;
    this.editGuestForm = {
      documento: guest.documento ?? '',
      nombre: guest.nombre,
      apellido: guest.apellido,
      telefono: phone.number,
      email: guest.email,
      nacionalidad: guest.nacionalidad,
      es_recurrente: guest.es_recurrente,
      dias_ultimo_registro: guest.dias_ultimo_registro,
    };
    this.guestError = '';
    this.openMenuCardIndex = null;
    this.setPageScrollLocked(true);
    this.openGuestEditDialog();
  }

  async saveGuestChanges(): Promise<void> {
    if (this.editingGuestId === null) return;
    this.guestError = '';
    if (!this.isValidEmail(this.editGuestForm.email)) {
      this.guestError = 'Ingresa un email válido, por ejemplo nombre@dominio.com.';
      return;
    }
    if (!this.isEditPhoneFormatValid) {
      this.guestError = PHONE_FORMAT_ERROR;
      return;
    }
    const original = this.hostalService.getGuests().find((item) => item.id_huesped === this.editingGuestId);
    try {
      const guest = await this.hostalService.updateGuest(this.editingGuestId, {
        ...this.editGuestForm,
        // El documento (RUT/pasaporte) no se puede modificar.
        documento: original?.documento ?? this.editGuestForm.documento,
        nombre: this.editGuestForm.nombre.trim(),
        apellido: this.editGuestForm.apellido.trim(),
        telefono: `${this.editPhoneCountryOption.callingCode} ${this.editGuestForm.telefono.trim()}`,
        email: this.editGuestForm.email.trim(),
        nacionalidad: this.editGuestForm.nacionalidad.trim(),
      });
      this.guestSuccessMessage = `Datos actualizados para ${guest.nombre} ${guest.apellido}.`;
      this.closeGuestEditor();
    } catch (error) {
      this.guestError = getApiErrorMessage(error, 'No se pudieron actualizar los datos del huésped.');
    }
  }

  closeGuestEditor(): void {
    this.closeGuestEditDialog();
    this.editingGuestId = null;
    this.guestError = '';
    this.setPageScrollLocked(false);
    this.returnIfDone();
  }

  requestGuestDeletion(guestId: number): void {
    this.deletingGuestId = guestId;
    this.openMenuCardIndex = null;
    this.guestError = '';
    this.setPageScrollLocked(true);
    this.openGuestDeleteDialog();
  }

  async deleteGuest(): Promise<void> {
    if (this.deletingGuestId === null) return;
    try {
      const guestId = this.deletingGuestId;
      const guest = this.hostalService.getGuests().find((item) => item.id_huesped === guestId);
      await this.hostalService.deleteGuest(guestId);
      this.guestSuccessMessage = `Se eliminó a ${guest ? `${guest.nombre} ${guest.apellido}` : 'el huésped'} y sus reservas asignadas.`;
      this.closeGuestDeleteDialog();
      this.deletingGuestId = null;
      this.guestError = '';
      this.setPageScrollLocked(false);
    } catch (error) {
      this.guestError = getApiErrorMessage(error, 'No se pudo eliminar el huésped.');
    }
  }

  cancelGuestDeletion(): void {
    this.closeGuestDeleteDialog();
    this.deletingGuestId = null;
    this.guestError = '';
    this.setPageScrollLocked(false);
    this.returnIfDone();
  }

  openReservationEditor(reservationId: number | undefined): void {
    if (reservationId === undefined) return;
    const reservation = this.hostalService.getReservations()
      .find((item) => item.id_reserva === reservationId);
    if (!reservation) {
      this.reservationError = 'No se encontró la reserva. Actualiza la lista e inténtalo otra vez.';
      return;
    }

    this.editingReservationId = reservation.id_reserva;
    this.editReservationForm = {
      fecha_llegada: reservation.fecha_llegada,
      fecha_salida: reservation.fecha_salida,
      hora_llegada: reservation.hora_llegada ?? '14:00',
      hora_salida: reservation.hora_salida ?? '12:00',
      cantidad_personas: reservation.cantidad_personas ?? 1,
      id_habitacion: String(reservation.id_habitacion),
    };
    this.reservationError = '';
    this.openMenuCardIndex = null;
    this.refreshAvailableReservationRooms();
    this.setPageScrollLocked(true);
    this.openReservationEditDialog();
  }

  refreshAvailableReservationRooms(): void {
    if (this.editingReservationId === null) return;
    this.availableReservationRooms = this.hostalService.getAvailableRooms(
      this.editReservationForm.fecha_llegada,
      this.editReservationForm.fecha_salida,
      this.editReservationForm.cantidad_personas,
      this.editingReservationId,
      { arrivalTime: this.editReservationForm.hora_llegada, departureTime: this.editReservationForm.hora_salida },
    );
  }

  async saveReservationChanges(): Promise<void> {
    if (this.editingReservationId === null) return;
    try {
      await this.hostalService.updateReservation(this.editingReservationId, {
        id_habitacion: Number(this.editReservationForm.id_habitacion),
        fecha_llegada: this.editReservationForm.fecha_llegada,
        fecha_salida: this.editReservationForm.fecha_salida,
        hora_llegada: this.editReservationForm.hora_llegada,
        hora_salida: this.editReservationForm.hora_salida || '12:00',
        cantidad_personas: this.editReservationForm.cantidad_personas,
      });
      this.guestSuccessMessage = 'Reserva actualizada correctamente.';
      this.closeReservationEditor();
    } catch (error) {
      this.reservationError = getApiErrorMessage(error, 'No se pudo actualizar la reserva.');
    }
  }

  async confirmCancelReservation(): Promise<void> {
    this.showCancelReservationConfirm = false;
    if (this.editingReservationId === null) return;

    try {
      await this.hostalService.cancelReservation(this.editingReservationId);
      this.guestSuccessMessage = 'Reserva cancelada. El huésped continúa registrado.';
      this.closeReservationEditor();
    } catch (error) {
      this.reservationError = getApiErrorMessage(error, 'No se pudo cancelar la reserva.');
    }
  }

  closeReservationEditor(): void {
    this.showCancelReservationConfirm = false;
    this.closeReservationEditDialog();
    this.editingReservationId = null;
    this.reservationError = '';
    this.setPageScrollLocked(false);
    this.returnIfDone();
  }

  openNewGuestForm(): void {
    this.guestForm = this.createEmptyGuestForm();
    this.showReservationAssignment = false;
    this.guestError = '';
    this.guestSuccessMessage = '';
    this.documentFieldFocused = false;
    this.emailFieldFocused = false;
    this.phoneFieldFocused = false;
    this.showNewGuestForm = true;
    this.setPageScrollLocked(true);
  }

  closeNewGuestForm(): void {
    this.showNewGuestForm = false;
    this.showReservationAssignment = false;
    this.guestError = '';
    this.setPageScrollLocked(false);
  }

  ngOnDestroy(): void {
    // Al salir de la página se cierran sin animación (no tiene sentido animar algo que se va).
    for (const ref of [this.guestEditDialog, this.reservationEditDialog, this.guestDeleteDialog, this.guestDetailDialog]) {
      if (ref?.nativeElement.open) ref.nativeElement.close();
    }
    this.setPageScrollLocked(false);
  }

  onGuestEditDialogCancel(event: Event): void {
    event.preventDefault();
    this.closeGuestEditor();
  }

  onReservationEditDialogCancel(event: Event): void {
    event.preventDefault();
    if (this.showCancelReservationConfirm) {
      this.showCancelReservationConfirm = false;
      return;
    }
    this.closeReservationEditor();
  }

  onGuestDeleteDialogCancel(event: Event): void {
    event.preventDefault();
    this.cancelGuestDeletion();
  }

  async registerGuest(): Promise<void> {
    this.guestError = '';
    if (!this.isValidEmail(this.guestForm.email)) {
      this.guestError = 'Ingresa un email válido, por ejemplo nombre@dominio.com.';
      return;
    }
    if (this.guestForm.documentType === 'rut' && !this.isValidRut(this.guestForm.documento)) {
      this.guestError = 'Ingresa un RUT chileno válido.';
      return;
    }
    if (!this.isPhoneFormatValid) {
      this.guestError = PHONE_FORMAT_ERROR;
      return;
    }

    try {
      const guest = await this.hostalService.registerGuest({
        documento: this.guestForm.documento.trim(),
        nombre: this.guestForm.nombre.trim(),
        apellido: this.guestForm.apellido.trim(),
        telefono: `${this.phoneCountry.callingCode} ${this.guestForm.telefono.trim()}`,
        email: this.guestForm.email.trim(),
        nacionalidad: this.guestForm.nacionalidad.trim(),
      });
      this.guestSuccessMessage = `Huésped registrado: ${guest.nombre} ${guest.apellido}.`;
      this.closeNewGuestForm();
    } catch (error) {
      this.guestError = error instanceof Error
        ? error.message
        : 'No se pudo registrar el huésped. Inténtalo nuevamente.';
    }
  }

  assignReservation(): void {
    this.guestError = '';
    this.reservationAssignmentGuestId = null;
    this.showReservationAssignment = true;
  }

  assignReservationToGuest(guestId: number): void {
    const guest = this.hostalService.getGuests().find((item) => item.id_huesped === guestId);
    if (!guest) {
      this.guestError = 'No se encontró el huésped. Actualiza la lista e inténtalo otra vez.';
      this.openMenuCardIndex = null;
      return;
    }

    this.guestError = '';
    this.reservationAssignmentGuestId = guest.id_huesped;
    this.showNewGuestForm = false;
    this.showReservationAssignment = true;
    this.openMenuCardIndex = null;
    this.setPageScrollLocked(true);
  }

  closeReservationAssignment(): void {
    this.showReservationAssignment = false;
    if (this.reservationAssignmentGuestId !== null) {
      this.reservationAssignmentGuestId = null;
      this.setPageScrollLocked(false);
    } else {
      this.setPageScrollLocked(true);
    }
    this.returnIfDone();
  }

  completeReservationAssignment(message: string): void {
    this.showReservationAssignment = false;
    this.showNewGuestForm = false;
    this.reservationAssignmentGuestId = null;
    this.guestSuccessMessage = message;
    this.setPageScrollLocked(false);
  }

  formatRut(value: string): void {
    const cleaned = value.replace(/[^0-9k]/gi, '').toUpperCase();
    const hasCheckDigitK = cleaned.endsWith('K');
    const digits = cleaned.replace(/\D/g, '').slice(0, 9);

    if (digits.length === 0) {
      this.guestForm.documento = '';
      return;
    }
    if (hasCheckDigitK) {
      const body = digits.slice(0, 8);
      this.guestForm.documento = body
        ? `${body.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}-K`
        : 'K';
      return;
    }

    // The last digit is always the check digit, whatever the RUT length.
    this.guestForm.documento = digits.length === 1
      ? digits
      : `${digits.slice(0, -1).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}-${digits.slice(-1)}`;
  }

  handleDocumentInput(event: Event): void {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) return;

    if (this.guestForm.documentType === 'rut') {
      this.formatRut(input.value);
    } else {
      this.guestForm.documento = input.value.replace(/\D/g, '').slice(0, 20);
    }
    input.value = this.guestForm.documento;
  }

  handlePhoneInput(event: Event): void {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) return;

    this.guestForm.telefono = limitPhoneDigits(this.guestForm.phoneCountry, input.value);
    input.value = this.guestForm.telefono;
  }

  /** Al cambiar de país se recorta el número si excede el nuevo máximo. */
  onPhoneCountryChange(code: string): void {
    this.guestForm.phoneCountry = code;
    this.guestForm.telefono = limitPhoneDigits(code, this.guestForm.telefono);
  }

  get phoneMaxLength(): number {
    return maxPhoneDigits(this.guestForm.phoneCountry) + 1;
  }

  get isPhoneFormatValid(): boolean {
    return isValidPhoneFormat(this.guestForm.phoneCountry, this.guestForm.telefono);
  }

  get phoneCountry(): (typeof COUNTRY_OPTIONS)[number] {
    return COUNTRY_OPTIONS.find((country) => country.code === this.guestForm.phoneCountry) ?? COUNTRY_OPTIONS[0];
  }

  handleEditPhoneInput(event: Event): void {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) return;
    this.editGuestForm.telefono = limitPhoneDigits(this.editPhoneCountry, input.value);
    input.value = this.editGuestForm.telefono;
  }

  onEditPhoneCountryChange(code: string): void {
    this.editPhoneCountry = code;
    this.editGuestForm.telefono = limitPhoneDigits(code, this.editGuestForm.telefono);
  }

  get editPhoneMaxLength(): number {
    return maxPhoneDigits(this.editPhoneCountry) + 1;
  }

  get isEditPhoneFormatValid(): boolean {
    return isValidPhoneFormat(this.editPhoneCountry, this.editGuestForm.telefono);
  }

  get editPhoneCountryOption(): (typeof COUNTRY_OPTIONS)[number] {
    return COUNTRY_OPTIONS.find((country) => country.code === this.editPhoneCountry) ?? COUNTRY_OPTIONS[0];
  }

  /** Separa un teléfono guardado ("+56 912345678") en país y número nacional. */
  private splitPhone(value: string): { country: string; number: string } {
    const trimmed = value.trim();
    const parsed = parsePhoneNumberFromString(trimmed.startsWith('+') ? trimmed : `+${trimmed}`);
    if (parsed?.country) {
      const code = parsed.country.toLowerCase();
      if (COUNTRY_OPTIONS.some((country) => country.code === code)) {
        return { country: code, number: String(parsed.nationalNumber) };
      }
    }
    const [prefix = '', ...rest] = trimmed.split(/\s+/);
    const match = prefix.startsWith('+')
      ? COUNTRY_OPTIONS.find((country) => country.callingCode === prefix)
      : undefined;
    if (match) {
      return { country: match.code, number: rest.join('').replace(/\D/g, '') };
    }
    return { country: 'cl', number: trimmed.replace(/\D/g, '') };
  }

  isValidEmail(value: string): boolean {
    return /^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?)+$/i.test(value.trim());
  }

  isValidRut(value: string): boolean {
    const rut = value.replace(/[.\s-]/g, '').toUpperCase();
    if (!/^\d{1,8}[0-9K]$/.test(rut) || /^0+$/.test(rut)) return false;

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

  private createEmptyGuestForm(): {
    documentType: 'rut' | 'passport';
    documento: string;
    nombre: string;
    apellido: string;
    telefono: string;
    phoneCountry: string;
    email: string;
    nacionalidad: string;
  } {
    return {
      documentType: 'rut',
      documento: '',
      nombre: '',
      apellido: '',
      telefono: '',
      phoneCountry: 'cl',
      email: '',
      nacionalidad: '',
    };
  }

  private createEmptyEditGuestForm(): Omit<Huesped, 'id_huesped' | 'id_sede'> {
    return {
      documento: '',
      nombre: '',
      apellido: '',
      telefono: '',
      email: '',
      nacionalidad: '',
    };
  }

  private setPageScrollLocked(locked: boolean): void {
    if (locked) {
      this.renderer.addClass(this.document.body, 'entry-modal-open');
    } else {
      this.renderer.removeClass(this.document.body, 'entry-modal-open');
    }
  }

  private openGuestEditDialog(): void {
    this.changeDetector.detectChanges();
    const dialog = this.guestEditDialog?.nativeElement;
    if (dialog && !dialog.open) {
      dialog.showModal();
    }
  }

  private closeGuestEditDialog(): void {
    const dialog = this.guestEditDialog?.nativeElement;
    if (dialog?.open) {
      closeDialogAnimated(dialog);
    }
  }

  private openReservationEditDialog(): void {
    this.changeDetector.detectChanges();
    const dialog = this.reservationEditDialog?.nativeElement;
    if (dialog && !dialog.open) {
      dialog.showModal();
    }
  }

  private closeReservationEditDialog(): void {
    const dialog = this.reservationEditDialog?.nativeElement;
    if (dialog?.open) {
      closeDialogAnimated(dialog);
    }
  }

  private openGuestDeleteDialog(): void {
    this.changeDetector.detectChanges();
    const dialog = this.guestDeleteDialog?.nativeElement;
    if (dialog && !dialog.open) {
      dialog.showModal();
    }
  }

  private closeGuestDeleteDialog(): void {
    const dialog = this.guestDeleteDialog?.nativeElement;
    if (dialog?.open) {
      closeDialogAnimated(dialog);
    }
  }

}