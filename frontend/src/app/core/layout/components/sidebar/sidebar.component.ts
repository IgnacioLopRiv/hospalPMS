import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AlertController, IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  businessOutline,
  peopleOutline,
  bedOutline,
  calendarOutline,
  swapHorizontalOutline,
  barChartOutline,
  cashOutline,
  logOutOutline,
  cubeOutline,
} from 'ionicons/icons';

import { AuthService } from '../../../auth/application/auth.service';
import { SedeService } from '../../../../features/locations/application/sede.service';

@Component({
  selector: 'app-sidebar',
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    RouterLinkActive,
    IonIcon,
  ],
})
export class SidebarComponent {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly sedeService = inject(SedeService);
  private readonly alertController = inject(AlertController);

  readonly currentUser = this.auth.currentUser;
  readonly canViewReports = this.auth.canViewReports;

  constructor() {
    addIcons({
      businessOutline,
      peopleOutline,
      bedOutline,
      calendarOutline,
      swapHorizontalOutline,
      barChartOutline,
      cashOutline,
      logOutOutline,
      cubeOutline,
    });
  }

  getUserInitials(): string {
    const user = this.currentUser();
    if (!user) return '';
    return user.name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  }

  getUserRoleLabel(): string {
    const user = this.currentUser();
    return user?.role === 'admin' ? 'Administrador' : 'Personal';
  }

  async confirmLogout(): Promise<void> {
    const alert = await this.alertController.create({
      header: 'Confirmar salida',
      message: '¿Estás seguro de que deseas salir?',
      cssClass: 'logout-confirmation-alert',
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel',
        },
        {
          text: 'Salir',
          role: 'destructive',
          handler: () => this.logout(),
        },
      ],
    });

    await alert.present();
  }

  private logout(): void {
    this.auth.logout();
    this.sedeService.clearSede();
    this.router.navigate(['/home']);
  }
}