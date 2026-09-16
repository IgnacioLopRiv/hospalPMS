import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  settingsOutline,
  businessOutline,
  notificationsOutline,
  personCircleOutline
} from 'ionicons/icons';

import { AuthService } from '../../../auth/application/auth.service';
import { SedeService } from '../../../../features/locations/application/sede.service';
import { EditSedeBannerComponent } from '../../../../features/locations/presentation/edit-sede-banner/edit-sede-banner.component';
import { ConfigOptionsComponent } from '../../../../features/locations/presentation/config-options/config-options.component';
import { EditPerfilesComponent } from '../edit-perfiles/edit-perfiles.component';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss'],
  standalone: true,
  imports: [CommonModule, IonIcon, EditSedeBannerComponent, ConfigOptionsComponent, EditPerfilesComponent],
})
export class HeaderComponent {
  private readonly sedeService = inject(SedeService);
  private readonly auth = inject(AuthService);

  readonly editSedeOpen = signal(false);
  readonly configOptionsOpen = signal(false);
  readonly editPerfilesOpen = signal(false);

  readonly hasSede = computed(() => this.sedeService.selectedSede() !== null);
  readonly canEditSede = computed(() => {
    const user = this.auth.currentUser();
    if (user) {
      return this.auth.can('editSede');
    }
    return true;
  });

  readonly sedeLabel = computed(() => {
    const sede = this.sedeService.selectedSede();
    return sede ? `${sede.nombre} · ${sede.ciudad}` : 'Hospal PMS';
  });

  constructor() {
    addIcons({
      settingsOutline,
      businessOutline,
      notificationsOutline,
      personCircleOutline
    });
  }

  // ── Sede ──────────────────────────────────────────────────────────────────

  openEditSede(): void {
    if (!this.canEditSede()) {
      return;
    }
    this.closeConfigOptions();
    if (!this.sedeService.selectedSede()) {
      const first = this.sedeService.sedes()[0];
      if (first) {
        this.sedeService.selectSede(first);
      }
    }
    this.editSedeOpen.set(true);
  }

  toggleEditSede(): void {
    if (this.editSedeOpen()) {
      this.closeEditSede();
    } else {
      this.openEditSede();
    }
  }

  closeEditSede(): void {
    this.editSedeOpen.set(false);
  }

  // ── Config options ────────────────────────────────────────────────────────

  configOptions(): void {
    if (this.editSedeOpen()) {
      this.closeEditSede();
    }
    this.configOptionsOpen.update((open) => !open);
  }

  closeConfigOptions(): void {
    this.configOptionsOpen.set(false);
  }

  // ── Gestionar perfiles ────────────────────────────────────────────────────

  openEditPerfiles(): void {
    this.closeConfigOptions();
    this.closeEditSede();
    this.editPerfilesOpen.set(true);
  }

  closeEditPerfiles(): void {
    this.editPerfilesOpen.set(false);
  }
}