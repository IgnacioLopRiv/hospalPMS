import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import {
  ActionSheetController,
  AlertController,
  IonContent,
  IonIcon
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  addOutline,
  businessOutline,
  chevronForwardOutline,
  createOutline,
  ellipsisVerticalOutline,
  locationOutline,
  trashOutline
} from 'ionicons/icons';
import { Sede, SedeService } from '../../../application/sede.service';
import { AuthService } from '../../../../../core/auth/application/auth.service';

@Component({
  selector: 'app-sedes',
  templateUrl: './sedes.page.html',
  styleUrls: ['./sedes.page.scss'],
  imports: [IonContent, IonIcon],
})
export class SedesPage {
  private readonly router = inject(Router);
  private readonly sedeService = inject(SedeService);
  private readonly auth = inject(AuthService);
  private readonly alertCtrl = inject(AlertController);
  private readonly actionSheetCtrl = inject(ActionSheetController);

  readonly sedes = this.sedeService.sedes;
  readonly canEditSede = this.auth.canEditSede;

  constructor() {
    addIcons({
      businessOutline,
      chevronForwardOutline,
      locationOutline,
      addOutline,
      ellipsisVerticalOutline,
      createOutline,
      trashOutline
    });
  }

  selectSede(sede: Sede): void {
    this.sedeService.selectSede(sede);
    this.router.navigate(['/check-page']);
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
      header: `Opciones de ${sede.nombre}`,
      cssClass: 'hospal-custom-action-sheet',
      buttons: [
        {
          text: 'Editar Sede',
          icon: 'create-outline',
          handler: () => {
            this.openEditSedeAlert(sede);
          },
        },
        {
          text: 'Eliminar Sede',
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

  /**
   * Modal para Crear nueva Sede
   */
  async openCreateSedeAlert(): Promise<void> {
    if (!this.canEditSede()) {
      return;
    }

    const alert = await this.alertCtrl.create({
      header: 'Nueva Sede',
      subHeader: 'Ingresa los datos del establecimiento',
      message: '',
      cssClass: 'hospal-custom-alert',
      inputs: [
        {
          name: 'nombre',
          type: 'text',
          placeholder: 'Nombre de la sede (ej. Hotel Playa)',
        },
        {
          name: 'ciudad',
          type: 'text',
          placeholder: 'Ciudad (ej. Viña del Mar)',
        },
      ],
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel',
        },
        {
          text: 'Guardar',
          cssClass: 'btn-confirm',
          handler: async (data) => {
            if (!data.nombre?.trim() || !data.ciudad?.trim()) {
              return false;
            }
            try {
              await this.sedeService.createSede({ nombre: data.nombre, ciudad: data.ciudad });
              return true;
            } catch {
              alert.message = 'No se pudo guardar la sede. Verifica la conexión y que exista un hostal registrado en la base de datos.';
              return false;
            }
          },
        },
      ],
    });

    await alert.present();
  }

  /**
   * Modal para Editar Sede existente
   */
  async openEditSedeAlert(sede: Sede): Promise<void> {
    if (!this.canEditSede()) {
      return;
    }

    const alert = await this.alertCtrl.create({
      header: 'Editar Sede',
      subHeader: 'Modifica los datos del establecimiento',
      message: '',
      cssClass: 'hospal-custom-alert',
      inputs: [
        {
          name: 'nombre',
          type: 'text',
          value: sede.nombre,
          placeholder: 'Nombre de la sede',
        },
        {
          name: 'ciudad',
          type: 'text',
          value: sede.ciudad,
          placeholder: 'Ciudad',
        },
      ],
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel',
        },
        {
          text: 'Actualizar',
          cssClass: 'btn-confirm',
          handler: async (data) => {
            if (!data.nombre?.trim() || !data.ciudad?.trim()) {
              return false;
            }
            try {
              await this.sedeService.updateSedeInfo(sede.id, { nombre: data.nombre, ciudad: data.ciudad });
              return true;
            } catch {
              alert.message = 'No se pudieron actualizar los datos de la sede. Verifica la conexión con el servidor.';
              return false;
            }
          },
        },
      ],
    });

    await alert.present();
  }

  /**
   * Confirmación de Eliminación
   */
  async confirmDeleteSede(sede: Sede): Promise<void> {
    if (!this.canEditSede()) {
      return;
    }

    const alert = await this.alertCtrl.create({
      header: '¿Eliminar sede?',
      message: `¿Estás seguro de que deseas eliminar <strong>${sede.nombre}</strong>? Esta acción no se puede deshacer.`,
      cssClass: 'hospal-custom-alert',
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel',
        },
        {
          text: 'Eliminar',
          role: 'destructive',
          handler: async () => {
            try {
              await this.sedeService.deleteSede(sede.id);
            } catch {
              const errorAlert = await this.alertCtrl.create({
                header: 'No se pudo eliminar la sede',
                message: 'Comprueba que la sede no tenga registros asociados y vuelve a intentarlo.',
                buttons: ['Aceptar'],
              });
              await errorAlert.present();
            }
          },
        },
      ],
    });

    await alert.present();
  }
}