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

import { SedeService } from '../../../../features/locations/application/sede.service';
import { ConfigOptionsComponent } from '../../../../features/locations/presentation/config-options/config-options.component';
import { EditPerfilesComponent } from '../edit-perfiles/edit-perfiles.component';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss'],
  standalone: true,
  imports: [CommonModule, IonIcon, ConfigOptionsComponent, EditPerfilesComponent],
})
export class HeaderComponent {
  private readonly sedeService = inject(SedeService);

  readonly configOptionsOpen = signal(false);
  readonly editPerfilesOpen = signal(false);

  // Genera el texto fijo: Estás en "Nombre Sede"
  readonly sedeInfoLabel = computed(() => {
    const sede = this.sedeService.selectedSede();
    return sede ? `Estás en ${sede.nombre}` : 'HosPal PMS';
  });

  constructor() {
    addIcons({
      settingsOutline,
      businessOutline,
      notificationsOutline,
      personCircleOutline
    });
  }

  // ── Config options ────────────────────────────────────────────────────────

  configOptions(): void {
    this.configOptionsOpen.update((open) => !open);
  }

  closeConfigOptions(): void {
    this.configOptionsOpen.set(false);
  }

  // ── Gestionar perfiles ────────────────────────────────────────────────────

  openEditPerfiles(): void {
    this.closeConfigOptions();
    this.editPerfilesOpen.set(true);
  }

  closeEditPerfiles(): void {
    this.editPerfilesOpen.set(false);
  }
}