import { Component, DOCUMENT, OnDestroy, OnInit, Renderer2, inject } from '@angular/core';
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
  personOutline
} from 'ionicons/icons';

import { HostalService } from '../../../application/hostal.service';
import { GuestCardView } from '../../../../../shared/domain/hostal.model';
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
  private preserveScrollLockOnDestroy = false;

  guests: GuestCardView[] = [];
  filteredGuests: GuestCardView[] = [];
  selectedFilter: string = 'todos';
  searchTerm: string = '';
  showNewGuestForm = false;
  guestError = '';
  guestSuccessMessage = '';
  guestForm = this.createEmptyGuestForm();
  readonly countries = COUNTRY_OPTIONS;

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
      personOutline
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

  openNewGuestForm(): void {
    this.guestForm = this.createEmptyGuestForm();
    this.guestError = '';
    this.guestSuccessMessage = '';
    this.showNewGuestForm = true;
    this.setPageScrollLocked(true);
  }

  closeNewGuestForm(): void {
    this.showNewGuestForm = false;
    this.guestError = '';
    this.setPageScrollLocked(false);
  }

  ngOnDestroy(): void {
    if (!this.preserveScrollLockOnDestroy) {
      this.setPageScrollLocked(false);
    }
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

  private setPageScrollLocked(locked: boolean): void {
    if (locked) {
      this.renderer.addClass(this.document.body, 'entry-modal-open');
    } else {
      this.renderer.removeClass(this.document.body, 'entry-modal-open');
    }
  }
}