import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonButton,
  IonIcon,
  IonInput,
  IonItem,
  IonModal,
  IonTextarea,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  addOutline,
  bedOutline,
  businessOutline,
  cashOutline,
  closeOutline,
  createOutline,
  peopleOutline,
  pricetagsOutline,
  trashOutline,
} from 'ionicons/icons';
import { SedeService, SedeTipologia } from '../../application/sede.service';
import { AuthService } from '../../../../core/auth/application/auth.service';

type FormMode = 'add' | 'edit' | null;

interface TipologiaForm {
  nombre: string;
  capacidad: number;
  precioBase: number | null;
  descripcion: string;
}

@Component({
  selector: 'app-edit-tipologias',
  templateUrl: './edit-tipologias.component.html',
  styleUrls: ['./edit-tipologias.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonModal,
    IonButton,
    IonItem,
    IonInput,
    IonTextarea,
    IonIcon,
  ],
})
export class EditTipologiasComponent {
  private readonly sedeService = inject(SedeService);
  private readonly auth = inject(AuthService);

  readonly isOpen = input(false);
  readonly closed = output<void>();

  readonly formMode = signal<FormMode>(null);
  readonly editingId = signal<number | null>(null);
  readonly errorMessage = signal('');
  readonly successMessage = signal('');
  readonly deleteConfirmId = signal<number | null>(null);

  readonly form = signal<TipologiaForm>({
    nombre: '',
    capacidad: 2,
    precioBase: null,
    descripcion: '',
  });

  readonly sede = this.sedeService.selectedSede;
  readonly tipologias = this.sedeService.tipologias;
  readonly isAdmin = computed(() => this.auth.currentUser()?.role === 'admin');

  constructor() {
    addIcons({
      addOutline,
      closeOutline,
      createOutline,
      trashOutline,
      pricetagsOutline,
      peopleOutline,
      cashOutline,
      bedOutline,
      businessOutline,
    });

    effect(() => {
      if (this.isOpen()) {
        this.resetState();
      }
    });
  }

  // ── Formulario ────────────────────────────────────────────────────────────

  openAdd(): void {
    if (!this.isAdmin()) return;
    this.form.set({
      nombre: '',
      capacidad: 2,
      precioBase: null,
      descripcion: '',
    });
    this.editingId.set(null);
    this.formMode.set('add');
    this.errorMessage.set('');
    this.deleteConfirmId.set(null);
  }

  openEdit(tipologia: SedeTipologia): void {
    if (!this.isAdmin()) return;
    this.form.set({
      nombre: tipologia.nombre,
      capacidad: tipologia.capacidad,
      precioBase: tipologia.precioBase ?? null,
      descripcion: tipologia.descripcion ?? '',
    });
    this.editingId.set(tipologia.id);
    this.formMode.set('edit');
    this.errorMessage.set('');
    this.deleteConfirmId.set(null);
  }

  cancelForm(): void {
    this.formMode.set(null);
    this.editingId.set(null);
    this.errorMessage.set('');
  }

  saveForm(): void {
    if (!this.isAdmin()) {
      this.errorMessage.set('Solo administradores pueden realizar esta acción.');
      return;
    }

    const f = this.form();
    const nombre = f.nombre.trim();
    const capacidad = Number(f.capacidad);
    const precioBase = f.precioBase !== null && f.precioBase !== undefined && f.precioBase !== ('' as unknown)
      ? Number(f.precioBase)
      : undefined;
    const descripcion = f.descripcion.trim();

    if (!nombre) {
      this.errorMessage.set('El nombre de la tipología es obligatorio.');
      return;
    }

    if (!capacidad || capacidad <= 0) {
      this.errorMessage.set('La capacidad debe ser de al menos 1 persona.');
      return;
    }

    // Verificar nombre duplicado en la misma sede
    const exists = this.tipologias().some(
      (t) => t.nombre.toLowerCase() === nombre.toLowerCase() && t.id !== this.editingId()
    );
    if (exists) {
      this.errorMessage.set('Ya existe una tipología con ese nombre en esta sede.');
      return;
    }

    if (this.formMode() === 'add') {
      this.sedeService.addTipologia({
        nombre,
        capacidad,
        precioBase,
        descripcion,
      });
      this.showSuccess('Tipología agregada correctamente.');
    } else {
      this.sedeService.updateTipologia(this.editingId()!, {
        nombre,
        capacidad,
        precioBase,
        descripcion,
      });
      this.showSuccess('Tipología actualizada correctamente.');
    }

    this.cancelForm();
  }

  patchForm(field: keyof TipologiaForm, value: unknown): void {
    this.form.update((f) => ({ ...f, [field]: value }));
  }

  // ── Eliminación ───────────────────────────────────────────────────────────

  requestDelete(id: number): void {
    if (!this.isAdmin()) return;
    this.deleteConfirmId.set(id);
    this.formMode.set(null);
    this.errorMessage.set('');
  }

  confirmDelete(id: number): void {
    if (!this.isAdmin()) return;
    const result = this.sedeService.deleteTipologia(id);
    if (!result.ok) {
      this.errorMessage.set(result.message ?? 'No se pudo eliminar la tipología.');
    } else {
      this.showSuccess('Tipología eliminada correctamente.');
    }
    this.deleteConfirmId.set(null);
  }

  cancelDelete(): void {
    this.deleteConfirmId.set(null);
  }

  // ── Cantidad de habitaciones usando la tipología ──────────────────────────

  getRoomsCount(tipologia: SedeTipologia): number {
    const habitaciones = this.sede()?.habitaciones ?? [];
    return habitaciones.filter(
      (h) => h.tipologiaId === tipologia.id || h.tipo.toLowerCase() === tipologia.nombre.toLowerCase()
    ).length;
  }

  // ── Cierre ────────────────────────────────────────────────────────────────

  dismiss(): void {
    this.resetState();
    this.closed.emit();
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private resetState(): void {
    this.formMode.set(null);
    this.editingId.set(null);
    this.errorMessage.set('');
    this.deleteConfirmId.set(null);
    this.successMessage.set('');
  }

  private showSuccess(msg: string): void {
    this.successMessage.set(msg);
    setTimeout(() => this.successMessage.set(''), 3000);
  }
}
