import { Component, EventEmitter, Input, Output, inject, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { bedOutline, trashOutline } from 'ionicons/icons';
import { Habitacion, ROOM_TYPES, RoomType, SedeService } from '../../application/sede.service';

@Component({
  selector: 'app-edit-habitaciones-modal',
  templateUrl: './edit-habitaciones-modal.component.html',
  styleUrls: ['./edit-habitaciones-modal.component.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonIcon],
})
export class EditHabitacionesModalComponent implements OnChanges {
  private readonly sedeService = inject(SedeService);

  @Input() isOpen = false;
  @Output() closed = new EventEmitter<void>();
  @Output() close = new EventEmitter<void>();

  readonly roomTypes: RoomType[] = [...ROOM_TYPES];

  cantidad = 1;
  tipoSeleccionado: RoomType = 'Doble';
  tempHabitaciones: Habitacion[] = [];

  constructor() {
    addIcons({ bedOutline, trashOutline });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen'] && this.isOpen) {
      this.cargarHabitacionesActuales();
    }
  }

  cargarHabitacionesActuales(): void {
    const actuales = this.sedeService.habitaciones();
    this.tempHabitaciones = actuales.map((h) => ({ ...h }));
    this.cantidad = 1;
    this.tipoSeleccionado = 'Doble';
  }

  agregarHabitaciones(): void {
    const cant = Math.max(1, Number(this.cantidad) || 1);
    const startNum = this.tempHabitaciones.length > 0 
      ? Math.max(...this.tempHabitaciones.map((h) => Number(h.numero) || 0)) + 1 
      : 101;

    for (let i = 0; i < cant; i++) {
      const nuevoNumero = startNum + i;
      
      // Cálculo de m2 según tipología en español
      let tamano = 22;
      let muebles = '1 Cama Matrimonial';

      if (this.tipoSeleccionado === 'Individual') {
        tamano = 14;
        muebles = '1 Cama 1 Plaza';
      } else if (this.tipoSeleccionado === 'Triple') {
        tamano = 28;
        muebles = '3 Camas 1 Plaza';
      } else if (this.tipoSeleccionado === 'Familiar') {
        tamano = 36;
        muebles = '1 Cama Matrimonial + 2 Camas 1 Plaza';
      }

      this.tempHabitaciones.push({
        id: this.sedeService.createHabitacionId(),
        numero: String(nuevoNumero),
        tipo: this.tipoSeleccionado,
        tamanoM2: tamano,
        disposicionMuebles: muebles,
      });
    }
  }

  eliminarHabitacion(index: number): void {
    this.tempHabitaciones.splice(index, 1);
  }

  guardarCambios(): void {
    const sedeActual = this.sedeService.selectedSede();
    if (sedeActual) {
      this.sedeService.updateSelectedSede({
        nombre: sedeActual.nombre,
        habitaciones: this.tempHabitaciones,
      });
    }
    this.dismiss();
  }

  dismiss(): void {
    this.closed.emit();
    this.close.emit();
  }
}