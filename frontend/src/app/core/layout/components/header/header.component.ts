import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  settingsOutline,
  businessOutline,
  notificationsOutline,
  personCircleOutline,
  chevronDownOutline,
} from 'ionicons/icons';

import { SedeService } from '../../../../features/locations/application/sede.service';
import { ConfigOptionsComponent } from '../../../../features/locations/presentation/config-options/config-options.component';
import { EditPerfilesComponent } from '../edit-perfiles/edit-perfiles.component';
import { EditTipologiasComponent } from '../../../../features/locations/presentation/edit-tipologias/edit-tipologias.component';
import { ClockComponent } from '../../../../shared/presentation/clock/clock.component';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonIcon,
    ConfigOptionsComponent,
    EditPerfilesComponent,
    EditTipologiasComponent,
    ClockComponent,
  ],
})
export class HeaderComponent {
  private readonly sedeService = inject(SedeService);
  private readonly router = inject(Router);

  readonly configOptionsOpen = signal(false);
  readonly sedeOptionsOpen = signal(false);
  readonly editPerfilesOpen = signal(false);
  readonly editTipologiasOpen = signal(false);

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
      personCircleOutline,
      chevronDownOutline,
    });
  }

  changeSede(): void {
    this.sedeOptionsOpen.set(false);
    void this.router.navigate(['/sedes']);
  }

  toggleSedeOptions(): void {
    this.sedeOptionsOpen.update((open) => !open);
  }

  closeSedeOptions(): void {
    this.sedeOptionsOpen.set(false);
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

  // ── Gestionar tipologías ──────────────────────────────────────────────────

  openEditTipologias(): void {
    this.closeConfigOptions();
    this.editTipologiasOpen.set(true);
  }

  closeEditTipologias(): void {
    this.editTipologiasOpen.set(false);
  }
}