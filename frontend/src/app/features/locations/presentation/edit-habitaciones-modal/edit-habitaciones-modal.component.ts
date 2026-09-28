import { Component, EventEmitter, Input, Output, inject, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { bedOutline, trashOutline, alertCircleOutline } from 'ionicons/icons';
import { Habitacion, SedeService, SedeTipologia } from '../../application/sede.service';

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

  readonly tipologias = this.sedeService.tipologias;

  cantidad = 1;
  tipoSeleccionado = '';
  tempHabitaciones: Habitacion[] = [];
  validationMessage = '';

  constructor() {
    addIcons({ bedOutline, trashOutline, alertCircleOutline });
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

    const available = this.tipologias();
    this.tipoSeleccionado = available[0]?.nombre ?? '';
    this.validationMessage = '';
  }

  agregarHabitaciones(): void {
    const cant = Math.max(1, Number(this.cantidad) || 1);
    const startNum = this.tempHabitaciones.length > 0 
      ? Math.max(...this.tempHabitaciones.map((h) => Number(h.numero) || 0)) + 1 
      : 101;

    const available = this.tipologias();
    const matchedTipologia = available.find((t) => t.nombre === this.tipoSeleccionado);
    if (!matchedTipologia) {
      this.validationMessage = 'Selecciona una tipología gestionada antes de agregar habitaciones.';
      return;
    }
    this.validationMessage = '';
    const tipoFinal = matchedTipologia.nombre;
    const tipologiaId = matchedTipologia.id;
    const capacidad = matchedTipologia.capacidad;

    for (let i = 0; i < cant; i++) {
      const nuevoNumero = startNum + i;
      
      // Cálculo de m2 y muebles según capacidad
      let tamano = 22;
      let muebles = '1 Cama Matrimonial';

      if (capacidad === 1) {
        tamano = 14;
        muebles = '1 Cama 1 Plaza';
      } else if (capacidad === 3) {
        tamano = 28;
        muebles = '3 Camas 1 Plaza';
      } else if (capacidad >= 4) {
        tamano = 36;
        muebles = '1 Cama Matrimonial + 2 Camas 1 Plaza';
      }

      this.tempHabitaciones.push({
        id: this.sedeService.createHabitacionId(),
        numero: String(nuevoNumero),
        tipo: tipoFinal,
        tipologiaId: tipologiaId,
        tamanoM2: tamano,
        disposicionMuebles: muebles,
      });
    }
  }

  onTipoChange(hab: Habitacion, nuevoTipo: string): void {
    hab.tipo = nuevoTipo;
    const matched = this.tipologias().find((t) => t.nombre === nuevoTipo);
    if (matched) {
      hab.tipologiaId = matched.id;
      this.validationMessage = '';
    }
  }

  getManagedTypologyName(habitacion: Habitacion): string {
    const managedTypology = this.tipologias().find((tipologia) =>
      tipologia.id === habitacion.tipologiaId ||
      tipologia.nombre.toLowerCase() === habitacion.tipo.toLowerCase()
    );
    return managedTypology?.nombre ?? '';
  }

  eliminarHabitacion(index: number): void {
    this.tempHabitaciones.splice(index, 1);
  }

  guardarCambios(): void {
    const sedeActual = this.sedeService.selectedSede();
    if (sedeActual) {
      const habitacionesGestionadas: Habitacion[] = [];
      for (const habitacion of this.tempHabitaciones) {
        const typology = this.tipologias().find((item) =>
          item.id === habitacion.tipologiaId ||
          item.nombre.toLowerCase() === habitacion.tipo.toLowerCase()
        );
        if (!typology) {
          this.validationMessage = 'Asigna una tipología gestionada o elimina las habitaciones sin tipología antes de guardar.';
          return;
        }
        habitacionesGestionadas.push({
          ...habitacion,
          tipo: typology.nombre,
          tipologiaId: typology.id,
        });
      }
      this.validationMessage = '';
      this.sedeService.updateSelectedSede({
        nombre: sedeActual.nombre,
        habitaciones: habitacionesGestionadas,
      });
    }
    this.dismiss();
  }

  dismiss(): void {
    this.closed.emit();
    this.close.emit();
  }
}