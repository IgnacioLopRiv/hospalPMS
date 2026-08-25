import { Component, inject, input, output, signal } from '@angular/core';
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
  ROOM_TYPES,
  RoomType,
  SedeService,
} from '../../services/sede.service';

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

  readonly roomTypes = ROOM_TYPES;
  readonly nombre = signal('');
  readonly habitaciones = signal<Habitacion[]>([]);
  readonly cantidadNueva = signal(1);
  readonly tipoNuevo = signal<RoomType>('Doble');
  readonly errorMessage = signal('');

  loadDraft(): void {
    const sede = this.sedeService.selectedSede();
    this.nombre.set(sede?.nombre ?? '');
    this.habitaciones.set((sede?.habitaciones ?? []).map((habitacion) => ({ ...habitacion })));
    this.cantidadNueva.set(1);
    this.tipoNuevo.set('Doble');
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

    const created: Habitacion[] = Array.from({ length: cantidad }, (_, index) => ({
      id: this.sedeService.createHabitacionId(),
      numero: String(nextNumero + index),
      tipo,
      tamanoM2: null,
      disposicionMuebles: '',
    }));

    this.habitaciones.set([...current, ...created]);
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

  save(): void {
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

    this.sedeService.updateSelectedSede({
      nombre,
      habitaciones: this.habitaciones(),
    });
    this.dismiss();
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
