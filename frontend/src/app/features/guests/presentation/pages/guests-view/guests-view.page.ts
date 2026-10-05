import { ChangeDetectorRef, Component, DOCUMENT, ElementRef, OnDestroy, OnInit, Renderer2, ViewChild, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
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
  mailOutline,
  callOutline,
  personOutline,
  createOutline,
  trashOutline,
  listOutline,
  gridOutline
} from 'ionicons/icons';

import { HostalService } from '../../../application/hostal.service';
import { SedeService } from '../../../../locations/application/sede.service';
import { GuestCardView, Habitacion, Huesped } from '../../../../../shared/domain/hostal.model';
import { COUNTRY_OPTIONS } from '../../../../../shared/domain/country-options';
import { CountryPickerComponent } from '../../../../../shared/presentation/country-picker/country-picker.component';

@Component({
  selector: 'app-guests-view',
  templateUrl: './guests-view.page.html',
  styleUrls: ['./guests-view.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonIcon,
    CountryPickerComponent
  ]
})
export class GuestsViewPage implements OnInit, OnDestroy {
  private readonly renderer = inject(Renderer2);
  private readonly document = inject(DOCUMENT);
  private readonly router = inject(Router);
  private readonly changeDetector = inject(ChangeDetectorRef);
  private preserveScrollLockOnDestroy = false;

  @ViewChild('guestEditDialog') guestEditDialog?: ElementRef<HTMLDialogElement>;
  @ViewChild('reservationEditDialog') reservationEditDialog?: ElementRef<HTMLDialogElement>;
  @ViewChild('guestDeleteDialog') guestDeleteDialog?: ElementRef<HTMLDialogElement>;

  guests: GuestCardView[] = [];
  filteredGuests: GuestCardView[] = [];
  selectedFilter: string = 'todos';
  viewMode: 'cards' | 'list' = 'cards';
  searchTerm: string = '';
  showNewGuestForm = false;
  guestError = '';
  guestSuccessMessage = '';
  documentFieldFocused = false;
  emailFieldFocused = false;
  guestForm = this.createEmptyGuestForm();
  readonly countries = COUNTRY_OPTIONS;
  openMenuCardIndex: number | null = null;
  editingGuestId: number | null = null;
  editGuestForm: Omit<Huesped, 'id_huesped' | 'id_sede'> = this.createEmptyEditGuestForm();
  deletingGuestId: number | null = null;
  editingReservationId: number | null = null;
  reservationError = '';
  availableReservationRooms: Habitacion[] = [];
  editReservationForm = {
    fecha_llegada: '',
    fecha_salida: '',
    hora_llegada: '14:00',
    cantidad_personas: 1,
    id_habitacion: '',
  };

  private readonly sedeService = inject(SedeService);

  constructor(private hostalService: HostalService) {
    addIcons({
      peopleOutline,
      checkmarkCircleOutline,
      bedOutline,
      calendarOutline,
      enterOutline,
      exitOutline,
      searchOutline,
      star,
      ellipsisVerticalOutline,
      mailOutline,
      callOutline,
      personOutline,
      createOutline,
      trashOutline,
      listOutline,
      gridOutline
    });

    // React to sede changes — refresh guest data when the user switches sede
    effect(() => {
      const sede = this.sedeService.selectedSede();
      if (sede) {
        this.hostalService.onSedeChanged();
      }
    });
  }

  ngOnInit() {
    this.hostalService.guestsView$.subscribe((data) => {
      this.guests = data;
      this.applyFilters();
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
          this.selectedFilter === 'hospedados' ? guest.status === 'hospedado' :
            this.selectedFilter === 'checkin' ? guest.status === 'checkin_hoy' :
              this.selectedFilter === 'checkout' ? guest.status === 'checkout_hoy' :
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
    return this.guests.filter((g) => g.status === status).length;
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
    this.editGuestForm = {
      documento: guest.documento ?? '',
      nombre: guest.nombre,
      apellido: guest.apellido,
      telefono: guest.telefono,
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

  saveGuestChanges(): void {
    if (this.editingGuestId === null) return;
    try {
      const guest = this.hostalService.updateGuest(this.editingGuestId, this.editGuestForm);
      this.guestSuccessMessage = `Datos actualizados para ${guest.nombre} ${guest.apellido}.`;
      this.closeGuestEditor();
    } catch (error) {
      this.guestError = error instanceof Error ? error.message : 'No se pudieron actualizar los datos del huésped.';
    }
  }

  closeGuestEditor(): void {
    this.closeGuestEditDialog();
    this.editingGuestId = null;
    this.guestError = '';
    this.setPageScrollLocked(false);
  }

  requestGuestDeletion(guestId: number): void {
    this.deletingGuestId = guestId;
    this.openMenuCardIndex = null;
    this.guestError = '';
    this.setPageScrollLocked(true);
    this.openGuestDeleteDialog();
  }

  deleteGuest(): void {
    if (this.deletingGuestId === null) return;
    try {
      const guestId = this.deletingGuestId;
      const guest = this.hostalService.getGuests().find((item) => item.id_huesped === guestId);
      this.hostalService.deleteGuest(guestId);
      this.guestSuccessMessage = `Se eliminó a ${guest ? `${guest.nombre} ${guest.apellido}` : 'el huésped'} y sus reservas asignadas.`;
      this.closeGuestDeleteDialog();
      this.deletingGuestId = null;
      this.guestError = '';
      this.setPageScrollLocked(false);
    } catch (error) {
      this.guestError = error instanceof Error ? error.message : 'No se pudo eliminar el huésped.';
    }
  }

  cancelGuestDeletion(): void {
    this.closeGuestDeleteDialog();
    this.deletingGuestId = null;
    this.guestError = '';
    this.setPageScrollLocked(false);
  }

  openReservationEditor(guest: GuestCardView): void {
    if (guest.id_reserva === undefined) return;
    const reservation = this.hostalService.getReservations()
      .find((item) => item.id_reserva === guest.id_reserva);
    if (!reservation) {
      this.reservationError = 'No se encontró la reserva. Actualiza la lista e inténtalo otra vez.';
      return;
    }

    this.editingReservationId = reservation.id_reserva;
    this.editReservationForm = {
      fecha_llegada: reservation.fecha_llegada,
      fecha_salida: reservation.fecha_salida,
      hora_llegada: reservation.hora_llegada ?? '14:00',
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
      this.editingReservationId
    );
  }

  saveReservationChanges(): void {
    if (this.editingReservationId === null) return;
    try {
      this.hostalService.updateReservation(this.editingReservationId, {
        id_habitacion: Number(this.editReservationForm.id_habitacion),
        fecha_llegada: this.editReservationForm.fecha_llegada,
        fecha_salida: this.editReservationForm.fecha_salida,
        hora_llegada: this.editReservationForm.hora_llegada,
        cantidad_personas: this.editReservationForm.cantidad_personas,
      });
      this.guestSuccessMessage = 'Reserva actualizada correctamente.';
      this.closeReservationEditor();
    } catch (error) {
      this.reservationError = error instanceof Error ? error.message : 'No se pudo actualizar la reserva.';
    }
  }

  cancelReservation(): void {
    if (this.editingReservationId === null) return;
    if (!this.document.defaultView?.confirm('¿Confirmas que quieres cancelar esta reserva? El huésped permanecerá registrado.')) {
      return;
    }

    try {
      this.hostalService.cancelReservation(this.editingReservationId);
      this.guestSuccessMessage = 'Reserva cancelada. El huésped continúa registrado.';
      this.closeReservationEditor();
    } catch (error) {
      this.reservationError = error instanceof Error ? error.message : 'No se pudo cancelar la reserva.';
    }
  }

  closeReservationEditor(): void {
    this.closeReservationEditDialog();
    this.editingReservationId = null;
    this.reservationError = '';
    this.setPageScrollLocked(false);
  }

  openNewGuestForm(): void {
    this.guestForm = this.createEmptyGuestForm();
    this.guestError = '';
    this.guestSuccessMessage = '';
    this.documentFieldFocused = false;
    this.emailFieldFocused = false;
    this.showNewGuestForm = true;
    this.setPageScrollLocked(true);
  }

  closeNewGuestForm(): void {
    this.showNewGuestForm = false;
    this.guestError = '';
    this.setPageScrollLocked(false);
  }

  ngOnDestroy(): void {
    this.closeGuestEditDialog();
    this.closeReservationEditDialog();
    this.closeGuestDeleteDialog();
    if (!this.preserveScrollLockOnDestroy) {
      this.setPageScrollLocked(false);
    }
  }

  onGuestEditDialogCancel(event: Event): void {
    event.preventDefault();
    this.closeGuestEditor();
  }

  onReservationEditDialogCancel(event: Event): void {
    event.preventDefault();
    this.closeReservationEditor();
  }

  onGuestDeleteDialogCancel(event: Event): void {
    event.preventDefault();
    this.cancelGuestDeletion();
  }

  registerGuest(): void {
    this.guestError = '';
    if (!this.isValidEmail(this.guestForm.email)) {
      this.guestError = 'Ingresa un email válido, por ejemplo nombre@dominio.com.';
      return;
    }
    if (this.guestForm.documentType === 'rut' && !this.isValidRut(this.guestForm.documento)) {
      this.guestError = 'Ingresa un RUT chileno válido.';
      return;
    }

    try {
      const guest = this.hostalService.registerGuest({
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

  async assignReservation(): Promise<void> {
    this.guestError = '';
    this.preserveScrollLockOnDestroy = true;
    try {
      const navigated = await this.router.navigate(['/check-page'], {
        state: { guestDraft: { ...this.guestForm } },
      });
      if (!navigated) {
        this.preserveScrollLockOnDestroy = false;
        this.guestError = 'No se pudo abrir el formulario para asignar la reserva.';
        return;
      }
      this.showNewGuestForm = false;
    } catch {
      this.preserveScrollLockOnDestroy = false;
      this.guestError = 'No se pudo abrir el formulario para asignar la reserva.';
    }
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

    const formattedDigits = digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    this.guestForm.documento = digits.length === 9
      ? `${digits.slice(0, 8).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}-${digits.slice(-1)}`
      : formattedDigits;
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

    this.guestForm.telefono = input.value.replace(/\D/g, '').slice(0, 9);
    input.value = this.guestForm.telefono;
  }

  get phoneCountry(): (typeof COUNTRY_OPTIONS)[number] {
    return COUNTRY_OPTIONS.find((country) => country.code === this.guestForm.phoneCountry) ?? COUNTRY_OPTIONS[0];
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
      dialog.close();
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
      dialog.close();
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
      dialog.close();
    }
  }

}