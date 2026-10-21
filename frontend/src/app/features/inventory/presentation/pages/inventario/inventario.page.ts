import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AlertController, IonIcon, IonPopover } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  addOutline,
  alertCircleOutline,
  archiveOutline,
  businessOutline,
  closeOutline,
  cubeOutline,
  createOutline,
  ellipsisVerticalOutline,
  trashOutline,
} from 'ionicons/icons';
import { SedeService } from '../../../../locations/application/sede.service';
import { AsignacionInventarioHabitacion, InsumoInventario, InventarioService } from '../../../application/inventario.service';

interface InsumoForm {
  nombre_insumo: string;
  descripcion: string;
  costo_compra: number | null;
  stock_actual: number | null;
  stock_minimo: number | null;
  producto_activo: boolean;
}

interface InsumoConStock extends InsumoInventario {
  stock_habitaciones: number;
  stock_bodega: number;
}

@Component({
  selector: 'app-inventario',
  templateUrl: './inventario.page.html',
  styleUrls: ['./inventario.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonIcon, IonPopover],
})
export class InventarioPage {
  private readonly sedeService = inject(SedeService);
  private readonly inventarioService = inject(InventarioService);
  private readonly alertController = inject(AlertController);

  readonly sede = this.sedeService.selectedSede;
  readonly habitaciones = this.sedeService.habitaciones;
  readonly insumoModalAbierto = signal(false);
  readonly editingInsumoId = signal<number | null>(null);
  readonly openActionsId = signal<number | null>(null);
  readonly actionsMenuEvent = signal<Event | undefined>(undefined);
  readonly errorFormulario = signal('');
  readonly insumoForm = signal<InsumoForm>(this.emptyForm());
  readonly insumos = computed<InsumoConStock[]>(() =>
    this.inventarioService.insumos().map((insumo) => {
      const stockHabitaciones = this.inventarioService.habitacionesAsignadas()
        .filter((asignacion) => asignacion.id_insumo === insumo.id_insumo && asignacion.estado === 'ACTIVO')
        .reduce((total, asignacion) => total + asignacion.cantidad, 0);
      return {
        ...insumo,
        stock_habitaciones: stockHabitaciones,
        stock_bodega: insumo.stock_actual - stockHabitaciones,
      };
    }),
  );
  readonly totalUnidades = computed(() => this.insumos().reduce((total, insumo) => total + insumo.stock_actual, 0));
  readonly productosBajoMinimo = computed(() => this.insumos().filter(
    (insumo) => insumo.producto_activo && insumo.stock_actual <= insumo.stock_minimo,
  ).length);
  readonly actionsMenuInsumo = computed(() =>
    this.insumos().find((insumo) => insumo.id_insumo === this.openActionsId()) ?? null,
  );
  constructor() {
    addIcons({
      addOutline,
      alertCircleOutline,
      archiveOutline,
      businessOutline,
      closeOutline,
      cubeOutline,
      createOutline,
      ellipsisVerticalOutline,
      trashOutline,
    });
  }

  openInsumoModal(): void {
    this.editingInsumoId.set(null);
    this.insumoForm.set(this.emptyForm());
    this.errorFormulario.set('');
    this.insumoModalAbierto.set(true);
  }

  editInsumo(insumo: InsumoConStock): void {
    this.openActionsId.set(null);
    this.editingInsumoId.set(insumo.id_insumo);
    this.insumoForm.set({
      nombre_insumo: insumo.nombre_insumo,
      descripcion: insumo.descripcion,
      costo_compra: insumo.costo_compra,
      stock_actual: insumo.stock_actual,
      stock_minimo: insumo.stock_minimo,
      producto_activo: insumo.producto_activo,
    });
    this.errorFormulario.set('');
    this.insumoModalAbierto.set(true);
  }

  closeInsumoModal(): void {
    this.insumoModalAbierto.set(false);
    this.editingInsumoId.set(null);
  }

  async saveInsumo(): Promise<void> {
    const form = this.insumoForm();
    if (form.costo_compra === null || form.stock_actual === null || form.stock_minimo === null) {
      this.errorFormulario.set('Completa el costo y ambos campos de stock.');
      return;
    }
    try {
      const data = {
        ...form,
        costo_compra: form.costo_compra,
        stock_actual: form.stock_actual,
        stock_minimo: form.stock_minimo,
      };
      const editingId = this.editingInsumoId();
      if (editingId === null) {
        await this.inventarioService.addInsumo(data);
      } else {
        await this.inventarioService.updateInsumo(editingId, data);
      }
      this.closeInsumoModal();
    } catch (error) {
      this.errorFormulario.set(this.getErrorMessage(error, 'No se pudo guardar el insumo.'));
    }
  }

  toggleActions(idInsumo: number, event: MouseEvent): void {
    if (this.openActionsId() === idInsumo) {
      this.closeActionsMenu();
      return;
    }
    this.actionsMenuEvent.set(event);
    this.openActionsId.set(idInsumo);
  }

  closeActionsMenu(): void {
    this.openActionsId.set(null);
    this.actionsMenuEvent.set(undefined);
  }

  async confirmDeleteInsumo(insumo: InsumoConStock): Promise<void> {
    this.openActionsId.set(null);
    const alert = await this.alertController.create({
      header: 'Eliminar insumo',
      message: `¿Deseas eliminar "${insumo.nombre_insumo}"? También se eliminarán sus asignaciones a habitaciones.`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Eliminar',
          role: 'destructive',
          handler: async () => this.deleteInsumo(insumo.id_insumo),
        },
      ],
    });
    await alert.present();
  }

  private async deleteInsumo(idInsumo: number): Promise<void> {
    try {
      await this.inventarioService.deleteInsumo(idInsumo);
    } catch (error) {
      this.showDeleteError(this.getErrorMessage(error, 'No se pudo eliminar el insumo.'));
    }
  }

  private async showDeleteError(message: string): Promise<void> {
    const alert = await this.alertController.create({
      header: 'No se pudo eliminar',
      message,
      buttons: ['Aceptar'],
    });
    await alert.present();
  }

  assignedToRoom(insumoId: number, habitacionId: number): number {
    return this.inventarioService.habitacionesAsignadas()
      .filter((asignacion: AsignacionInventarioHabitacion) =>
        asignacion.id_insumo === insumoId
        && asignacion.id_habitacion === habitacionId
        && asignacion.estado === 'ACTIVO',
      )
      .reduce((total, asignacion) => total + asignacion.cantidad, 0);
  }

  private emptyForm(): InsumoForm {
    return {
      nombre_insumo: '',
      descripcion: '',
      costo_compra: null,
      stock_actual: null,
      stock_minimo: null,
      producto_activo: true,
    };
  }

  private getErrorMessage(error: unknown, fallback: string): string {
    return error instanceof Error ? error.message : fallback;
  }
}
