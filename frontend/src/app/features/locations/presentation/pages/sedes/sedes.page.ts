import { EscapeCloseDirective } from '../../../../../shared/presentation/modal-portal/escape-close.directive';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  ActionSheetController,
  IonContent,
  IonIcon
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  addOutline,
  businessOutline,
  checkmarkCircleOutline,
  chevronForwardOutline,
  closeOutline,
  createOutline,
  ellipsisVerticalOutline,
  locationOutline,
  trashOutline
} from 'ionicons/icons';
import { Sede, SedeService } from '../../../application/sede.service';
import { AuthService } from '../../../../../core/auth/application/auth.service';
import { COUNTRY_OPTIONS } from '../../../../../shared/domain/country-options';
import {
  isValidPhoneFormat,
  limitPhoneDigits,
  maxPhoneDigits,
  PHONE_FORMAT_ERROR,
} from '../../../../../shared/domain/phone-format';
import { CountryPickerComponent } from '../../../../../shared/presentation/country-picker/country-picker.component';

interface SedeForm {
  nombre: string;
  ciudad: string;
  email: string;
  direccion: string;
  phoneCountry: string;
  telefono: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DEFAULT_PHONE_COUNTRY = 'cl';

@Component({
  selector: 'app-sedes',
  templateUrl: './sedes.page.html',
  styleUrls: ['./sedes.page.scss'],
  imports: [EscapeCloseDirective, IonContent, IonIcon, FormsModule, CountryPickerComponent],
})
export class SedesPage {
  private readonly router = inject(Router);
  private readonly sedeService = inject(SedeService);
  private readonly auth = inject(AuthService);
  private readonly actionSheetCtrl = inject(ActionSheetController);

  readonly sedes = this.sedeService.sedes;
  readonly canEditSede = this.auth.canEditSede;
  readonly countries = COUNTRY_OPTIONS;
  readonly phoneFormatError = PHONE_FORMAT_ERROR;

  /** null = modal cerrado; 'new' = creando; número = id de la sede en edición. */
  readonly editingSede = signal<'new' | number | null>(null);
  readonly saving = signal(false);
  readonly formError = signal('');
  /** Sede pendiente de confirmación de eliminación (null = modal cerrado). */
  readonly sedeToDelete = signal<Sede | null>(null);
  readonly deleting = signal(false);
  readonly deleteError = signal('');
  form: SedeForm = this.emptyForm();
  phoneFieldFocused = false;
  emailFieldFocused = false;

  constructor() {
    addIcons({
      businessOutline,
      chevronForwardOutline,
      locationOutline,
      addOutline,
      ellipsisVerticalOutline,
      createOutline,
      trashOutline,
      closeOutline,
      checkmarkCircleOutline
    });
  }

  selectSede(sede: Sede): void {
    this.sedeService.selectSede(sede);
    this.router.navigate(['/recepcion']);
  }

  /**
   * Menú contextual de opciones para una sede
   */
  async openSedeOptions(event: Event, sede: Sede): Promise<void> {
    event.stopPropagation();
    if (!this.canEditSede()) {
      return;
    }

    const actionSheet = await this.actionSheetCtrl.create({
      header: sede.nombre,
      cssClass: 'hospal-custom-action-sheet',
      buttons: [
        {
          text: 'Editar sede',
          icon: 'create-outline',
          handler: () => {
            this.openEditSedeForm(sede);
          },
        },
        {
          text: 'Eliminar sede',
          role: 'destructive',
          icon: 'trash-outline',
          handler: () => {
            this.confirmDeleteSede(sede);
          },
        },
        {
          text: 'Cancelar',
          role: 'cancel',
        },
      ],
    });

    await actionSheet.present();
  }

  openCreateSedeForm(): void {
    if (!this.canEditSede()) {
      return;
    }
    this.form = this.emptyForm();
    this.openForm('new');
  }

  openEditSedeForm(sede: Sede): void {
    if (!this.canEditSede()) {
      return;
    }
    const phone = this.splitPhone(sede.telefono);
    this.form = {
      nombre: sede.nombre,
      ciudad: sede.ciudad,
      email: sede.email ?? '',
      direccion: sede.direccion ?? '',
      phoneCountry: phone.country,
      telefono: phone.number,
    };
    this.openForm(sede.id);
  }

  closeForm(): void {
    if (this.saving()) {
      return;
    }
    this.editingSede.set(null);
  }

  async saveSede(): Promise<void> {
    const target = this.editingSede();
    if (target === null || this.saving()) {
      return;
    }
    if (!this.form.nombre.trim() || !this.form.ciudad.trim() || !this.form.direccion.trim()) {
      this.formError.set('El nombre, la ciudad y la dirección son obligatorios.');
      return;
    }
    if (!this.isEmailValid) {
      this.formError.set('Ingresa un correo electrónico válido o deja el campo vacío.');
      return;
    }
    if (!this.isPhoneValid) {
      this.formError.set(PHONE_FORMAT_ERROR);
      return;
    }

    const data = {
      nombre: this.form.nombre,
      ciudad: this.form.ciudad,
      email: this.form.email,
      direccion: this.form.direccion,
      telefono: this.form.telefono.trim() ? `${this.phoneCountry.callingCode} ${this.form.telefono.trim()}` : null,
    };

    this.saving.set(true);
    this.formError.set('');
    try {
      if (target === 'new') {
        await this.sedeService.createSede(data);
      } else {
        await this.sedeService.updateSedeInfo(target, data);
      }
      this.saving.set(false);
      this.closeForm();
    } catch {
      this.saving.set(false);
      this.formError.set(target === 'new'
        ? 'No se pudo guardar la sede. Verifica la conexión y que exista un hostal registrado en la base de datos.'
        : 'No se pudieron actualizar los datos de la sede. Verifica la conexión con el servidor.');
    }
  }

  handlePhoneInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.form.telefono = limitPhoneDigits(this.form.phoneCountry, input.value);
    input.value = this.form.telefono;
  }

  onPhoneCountryChange(code: string): void {
    this.form.phoneCountry = code;
    this.form.telefono = limitPhoneDigits(code, this.form.telefono);
  }

  get phoneMaxLength(): number {
    return maxPhoneDigits(this.form.phoneCountry) + 1;
  }

  /** El teléfono es opcional: vacío es válido, si se escribe debe tener formato del país. */
  get isPhoneValid(): boolean {
    return !this.form.telefono || isValidPhoneFormat(this.form.phoneCountry, this.form.telefono);
  }

  get isEmailValid(): boolean {
    const email = this.form.email.trim();
    return !email || EMAIL_PATTERN.test(email);
  }

  get phoneCountry(): (typeof COUNTRY_OPTIONS)[number] {
    return COUNTRY_OPTIONS.find((country) => country.code === this.form.phoneCountry) ?? COUNTRY_OPTIONS[0];
  }

  /**
   * Confirmación de Eliminación
   */
  async confirmDeleteSede(sede: Sede): Promise<void> {
    if (!this.canEditSede()) {
      return;
    }

    this.deleteError.set('');
    this.sedeToDelete.set(sede);
  }

  cancelDeleteSede(): void {
    if (this.deleting()) {
      return;
    }
    this.sedeToDelete.set(null);
    this.deleteError.set('');
  }

  async deleteSedeConfirmed(): Promise<void> {
    const sede = this.sedeToDelete();
    if (!sede || this.deleting()) {
      return;
    }

    this.deleting.set(true);
    this.deleteError.set('');
    try {
      await this.sedeService.deleteSede(sede.id);
      this.sedeToDelete.set(null);
    } catch {
      this.deleteError.set('No se pudo eliminar la sede. Comprueba que no tenga registros asociados y vuelve a intentarlo.');
    } finally {
      this.deleting.set(false);
    }
  }

  private openForm(target: 'new' | number): void {
    this.formError.set('');
    this.phoneFieldFocused = false;
    this.emailFieldFocused = false;
    this.editingSede.set(target);
  }

  private emptyForm(): SedeForm {
    return { nombre: '', ciudad: '', email: '', direccion: '', phoneCountry: DEFAULT_PHONE_COUNTRY, telefono: '' };
  }

  /** Separa "+56 912345678" en país y número nacional, como se guarda desde el formulario. */
  private splitPhone(value?: string | null): { country: string; number: string } {
    const phone = (value ?? '').trim();
    const match = /^(\+\d+)\s+(.*)$/.exec(phone);
    if (!match) {
      return { country: DEFAULT_PHONE_COUNTRY, number: phone.replace(/\D/g, '') };
    }
    const [, callingCode, rest] = match;
    const country = COUNTRY_OPTIONS.find((item) => item.code === DEFAULT_PHONE_COUNTRY && item.callingCode === callingCode)
      ?? COUNTRY_OPTIONS.find((item) => item.callingCode === callingCode);
    return { country: country?.code ?? DEFAULT_PHONE_COUNTRY, number: rest.replace(/\D/g, '') };
  }
}
