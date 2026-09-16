import { Component, inject, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  peopleOutline,
  logOutOutline,
  closeOutline,
  shieldCheckmarkOutline,
} from 'ionicons/icons';

import { AuthService } from '../../../../core/auth/application/auth.service';
import { SedeService } from '../../application/sede.service';

@Component({
  selector: 'app-config-options',
  templateUrl: './config-options.component.html',
  styleUrls: ['./config-options.component.scss'],
  standalone: true,
  imports: [CommonModule, IonIcon],
})
export class ConfigOptionsComponent {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly sedeService = inject(SedeService);

  readonly close = output<void>();
  readonly manageProfiles = output<void>();
  readonly logout = output<void>();

  /** Reutiliza el mismo patrón de permisos que canEditSede en el header */
  readonly canManageUsers = this.auth.canManageUsers;

  constructor() {
    addIcons({
      peopleOutline,
      logOutOutline,
      closeOutline,
      shieldCheckmarkOutline,
    });
  }

  dismiss(): void {
    this.close.emit();
  }

  handleManageProfiles(): void {
    this.manageProfiles.emit();
    this.dismiss();
  }

  handleLogout(): void {
    this.logout.emit();
    this.auth.logout();
    this.sedeService.clearSede();
    this.router.navigate(['/home']);
    this.dismiss();
  }
}
