import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonIcon,
  IonInput,
  IonModal,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  addOutline,
  bedOutline,
  businessOutline,
  cashOutline,
  checkmarkCircleOutline,
  checkmarkOutline,
  closeOutline,
  flameOutline,
  restaurantOutline,
  snowOutline,
  tvOutline,
  waterOutline,
  wifiOutline,
  createOutline,
  peopleOutline,
  pricetagsOutline,
  trashOutline,
} from 'ionicons/icons';
import { SedeService, SedeTipologia } from '../../application/sede.service';
import {
  CARACTERISTICA_ICONO_DEFAULT,
  CaracteristicaService,
} from '../../application/caracteristica.service';
import { Caracteristica } from '../../../../shared/domain/hostal.model';
import { AuthService } from '../../../../core/auth/application/auth.service';

type FormMode = 'add' | 'edit' | null;

interface TipologiaForm {
  nombre: string;
  capacidad: number;
  descripcion: string;
  caracteristicaIds: number[];
}

/** Máximo de chips de características visibles en cada tarjeta. */
const MAX_CHIPS = 4;

@Component({
  selector: 'app-edit-tipologias',
  templateUrl: './edit-tipologias.component.html',
  styleUrls: ['./edit-tipologias.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonModal,
    IonInput,
    // IonTextarea,
    IonIcon,
  ],
})
export class EditTipologiasComponent {
  private readonly sedeService = inject(SedeService);
  private readonly auth = inject(AuthService);
  private readonly caracteristicaService = inject(CaracteristicaService);

  readonly isOpen = input(false);
  readonly closed = output<void>();

  readonly formMode = signal<FormMode>(null);
  readonly editingId = signal<number | null>(null);
  readonly errorMessage = signal('');
  readonly successMessage = signal('');
  readonly deleteConfirmId = signal<number | null>(null);

  readonly form = signal<TipologiaForm>(this.emptyForm());

  // ── Características ───────────────────────────────────────────────────────
  readonly caracteristicas = this.caracteristicaService.caracteristicas;
  readonly caracteristicasLoading = this.caracteristicaService.loading;
  readonly caracteristicasLoadError = this.caracteristicaService.loadError;
  readonly nuevaCaracteristica = signal('');
  readonly caracteristicaError = signal('');
  readonly savingCaracteristica = signal(false);
  readonly deleteCaracteristicaConfirmId = signal<number | null>(null);
  readonly selectedCaracteristicaIds = computed(() => new Set(this.form().caracteristicaIds));

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
      checkmarkOutline,
      'checkmark-circle-outline': checkmarkCircleOutline,
      // Íconos de las características predeterminadas (seed)
      wifi: wifiOutline,
      water: waterOutline,
      snow: snowOutline,
      tv: tvOutline,
      restaurant: restaurantOutline,
      flame: flameOutline,
    });

    effect(() => {
      if (this.isOpen()) {
        this.resetState();
        void this.caracteristicaService.load();
      }
    });
  }

  // ── Formulario ────────────────────────────────────────────────────────────

  openAdd(): void {
    if (!this.isAdmin()) return;
    this.form.set(this.emptyForm());
    this.resetCaracteristicaInput();
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
      descripcion: tipologia.descripcion ?? '',
      caracteristicaIds: [...(tipologia.caracteristicaIds ?? [])],
    });
    this.resetCaracteristicaInput();
    this.editingId.set(tipologia.id);
    this.formMode.set('edit');
    this.errorMessage.set('');
    this.deleteConfirmId.set(null);
  }

  cancelForm(): void {
    this.formMode.set(null);
    this.editingId.set(null);
    this.errorMessage.set('');
    this.resetCaracteristicaInput();
  }

  async saveForm(): Promise<void> {
    if (!this.isAdmin()) {
      this.errorMessage.set('Solo administradores pueden realizar esta acción.');
      return;
    }

    const f = this.form();
    const nombre = f.nombre.trim();
    const capacidad = Number(f.capacidad);
    const descripcion = f.descripcion.trim();
    // Solo se envían ids de características que siguen existiendo.
    const existentes = this.caracteristicaService.byId();
    const caracteristicaIds = f.caracteristicaIds.filter((id) => existentes.has(id));

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

    try {
      if (this.formMode() === 'add') {
        await this.sedeService.addTipologia({
          nombre,
          capacidad,
          descripcion,
          caracteristicaIds,
        });
        this.showSuccess('Tipología agregada correctamente.');
      } else {
        await this.sedeService.updateTipologia(this.editingId()!, {
          nombre,
          capacidad,
          descripcion,
          caracteristicaIds,
        });
        this.showSuccess('Tipología actualizada correctamente.');
      }
    } catch {
      this.errorMessage.set('No se pudo guardar la tipología. Intenta nuevamente.');
      return;
    }

    this.cancelForm();
  }

  patchForm(field: keyof TipologiaForm, value: unknown): void {
    this.form.update((f) => ({ ...f, [field]: value }));
  }

  // ── Características ───────────────────────────────────────────────────────

  isCaracteristicaSelected(id: number): boolean {
    return this.selectedCaracteristicaIds().has(id);
  }

  toggleCaracteristica(id: number, checked: boolean): void {
    this.form.update((f) => {
      const ids = new Set(f.caracteristicaIds);
      if (checked) ids.add(id);
      else ids.delete(id);
      return { ...f, caracteristicaIds: [...ids] };
    });
  }

  async addCaracteristica(): Promise<void> {
    if (!this.isAdmin() || this.savingCaracteristica()) return;
    this.caracteristicaError.set('');
    this.savingCaracteristica.set(true);
    const result = await this.caracteristicaService.create(this.nuevaCaracteristica());
    this.savingCaracteristica.set(false);
    if (!result.ok) {
      this.caracteristicaError.set(result.message);
      return;
    }
    // La nueva característica queda marcada para la tipología en edición.
    this.toggleCaracteristica(result.value.id, true);
    this.nuevaCaracteristica.set('');
  }

  requestDeleteCaracteristica(id: number): void {
    if (!this.isAdmin()) return;
    this.caracteristicaError.set('');
    this.deleteCaracteristicaConfirmId.set(id);
  }

  cancelDeleteCaracteristica(): void {
    this.deleteCaracteristicaConfirmId.set(null);
  }

  async confirmDeleteCaracteristica(id: number): Promise<void> {
    if (!this.isAdmin()) return;
    const result = await this.caracteristicaService.remove(id);
    this.deleteCaracteristicaConfirmId.set(null);
    if (!result.ok) {
      this.caracteristicaError.set(result.message);
      return;
    }
    this.toggleCaracteristica(id, false);
  }

  countTipologiasWith(caracteristicaId: number): number {
    return this.tipologias().filter((t) => t.caracteristicaIds?.includes(caracteristicaId)).length;
  }

  caracteristicaIcon(caracteristica: Caracteristica): string {
    return caracteristica.icono || CARACTERISTICA_ICONO_DEFAULT;
  }

  /** Características asignadas a una tipología, en el orden del catálogo. */
  assignedCaracteristicas(tipologia: SedeTipologia): Caracteristica[] {
    const ids = new Set(tipologia.caracteristicaIds ?? []);
    return this.caracteristicas().filter((c) => ids.has(c.id));
  }

  visibleChips(tipologia: SedeTipologia): Caracteristica[] {
    return this.assignedCaracteristicas(tipologia).slice(0, MAX_CHIPS);
  }

  hiddenChipsCount(tipologia: SedeTipologia): number {
    return Math.max(0, this.assignedCaracteristicas(tipologia).length - MAX_CHIPS);
  }

  // ── Eliminación ───────────────────────────────────────────────────────────

  requestDelete(id: number): void {
    if (!this.isAdmin()) return;
    this.deleteConfirmId.set(id);
    this.formMode.set(null);
    this.errorMessage.set('');
  }

  async confirmDelete(id: number): Promise<void> {
    if (!this.isAdmin()) return;
    const result = await this.sedeService.deleteTipologia(id);
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

  getThemeForColor(color?: string): { primary: string; background: string; border: string } {
    const validColor = color && /^#[0-9a-f]{6}$/i.test(color) ? color : '#64748b';
    return {
      primary: validColor,
      background: `color-mix(in srgb, ${validColor} 13%, white)`,
      border: `color-mix(in srgb, ${validColor} 38%, white)`,
    };
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
    this.resetCaracteristicaInput();
  }

  private resetCaracteristicaInput(): void {
    this.nuevaCaracteristica.set('');
    this.caracteristicaError.set('');
    this.deleteCaracteristicaConfirmId.set(null);
  }

  private emptyForm(): TipologiaForm {
    return { nombre: '', capacidad: 2, descripcion: '', caracteristicaIds: [] };
  }

  private showSuccess(msg: string): void {
    this.successMessage.set(msg);
    setTimeout(() => this.successMessage.set(''), 3000);
  }
}
