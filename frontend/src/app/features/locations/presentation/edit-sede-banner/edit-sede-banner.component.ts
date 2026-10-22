import { Component, effect, inject, input, output, signal } from '@angular/core';
import {
  IonButton,
  IonInput,
  IonItem,
  IonModal,
  IonSelect,
  IonSelectOption,
  IonTextarea,
} from '@ionic/angular/standalone';
import {
  Habitacion,
  SedeService,
} from '../../application/sede.service';

@Component({
  selector: 'app-edit-sede-banner',
  templateUrl: './edit-sede-banner.component.html',
  styleUrls: ['./edit-sede-banner.component.scss'],
  imports: [
    IonModal,
    IonButton,
    IonItem,
    IonInput,
    IonSelect,
    IonSelectOption,
    IonTextarea,
  ],
})
export class EditSedeBannerComponent {
  private readonly sedeService = inject(SedeService);

  readonly isOpen = input(false);
  readonly closed = output<void>();
  readonly close = this.closed;

  readonly tipologias = this.sedeService.tipologias;
  readonly nombre = signal('');
  readonly habitaciones = signal<Habitacion[]>([]);
  readonly cantidadNueva = signal(1);
  readonly tipoNuevo = signal('');
  readonly errorMessage = signal('');

  constructor() {
    effect(() => {
      if (this.isOpen()) {
        this.loadDraft();
      }
    });
  }

  loadDraft(): void {
    const sede = this.sedeService.selectedSede();
    this.nombre.set(sede?.nombre ?? '');
    this.habitaciones.set((sede?.habitaciones ?? []).map((habitacion) => ({ ...habitacion })));
    this.cantidadNueva.set(1);
    const available = this.tipologias();
    this.tipoNuevo.set(available[0]?.nombre ?? '');
    this.errorMessage.set('');
  }

  dismiss(): void {
    this.closed.emit();
  }

  addHabitaciones(): void {
    const cantidad = Math.max(1, Math.floor(this.cantidadNueva() || 0));
    const tipo = this.tipoNuevo();
    const current = this.habitaciones();
    const nextNumero = this.nextRoomNumber(current);
    const matched = this.tipologias().find((t) => t.nombre === tipo);
    if (!matched) {
      this.errorMessage.set('Selecciona una tipología gestionada antes de agregar habitaciones.');
      return;
    }

    const created: Habitacion[] = Array.from({ length: cantidad }, (_, index) => ({
      id: this.sedeService.createHabitacionId(),
      numero: String(nextNumero + index),
      tipo,
      tipologiaId: matched.id,
      tamanoM2: null,
      disposicionMuebles: '',
    }));

    this.habitaciones.set([...current, ...created]);
  }

  updateHabitacionTipo(id: number, nuevoTipo: string): void {
    const matched = this.tipologias().find((t) => t.nombre === nuevoTipo);
    this.updateHabitacion(id, { tipo: nuevoTipo, tipologiaId: matched?.id });
  }

  removeHabitacion(id: number): void {
    this.habitaciones.update((list) => list.filter((habitacion) => habitacion.id !== id));
  }

  updateHabitacion(id: number, patch: Partial<Habitacion>): void {
    this.habitaciones.update((list) =>
      list.map((habitacion) => (habitacion.id === id ? { ...habitacion, ...patch } : habitacion)),
    );
  }

  setCantidadNueva(value: string | number | null | undefined): void {
    this.cantidadNueva.set(Math.max(1, Number(value) || 1));
  }

  setTamano(id: number, value: string | number | null | undefined): void {
    const raw = value === '' || value === null || value === undefined ? null : Number(value);
    this.updateHabitacion(id, { tamanoM2: raw === null || Number.isNaN(raw) ? null : raw });
  }

  async save(): Promise<void> {
    const nombre = this.nombre().trim();
    if (!nombre) {
      this.errorMessage.set('El nombre de la sede es obligatorio.');
      return;
    }

    const invalidRoom = this.habitaciones().find(
      (habitacion) =>
        !habitacion.numero.trim() ||
        habitacion.tamanoM2 === null ||
        habitacion.tamanoM2 <= 0 ||
        !habitacion.disposicionMuebles.trim(),
    );

    if (invalidRoom) {
      this.errorMessage.set(
        'Completa número, tamaño y disposición de muebles en todas las habitaciones.',
      );
      return;
    }

    try {
      await this.sedeService.updateSelectedSede({ nombre, habitaciones: this.habitaciones() });
      this.dismiss();
    } catch (error) {
      this.errorMessage.set(error instanceof Error ? error.message : 'No se pudo guardar la configuración de la sede.');
    }
  }

  private nextRoomNumber(habitaciones: Habitacion[]): number {
    const numbers = habitaciones
      .map((habitacion) => Number.parseInt(habitacion.numero, 10))
      .filter((value) => Number.isFinite(value));

    if (numbers.length === 0) {
      return 101;
    }

    return Math.max(...numbers) + 1;
  }
}
