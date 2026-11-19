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
import { AuthService } from '../../../auth/application/auth.service';
import { ConfigOptionsComponent } from '../../../../features/locations/presentation/config-options/config-options.component';
import { EditPerfilesComponent } from '../edit-perfiles/edit-perfiles.component';
import { ClockComponent } from '../../../../shared/presentation/clock/clock.component';
import { AlertasPanelComponent } from '../../../../features/alerts/presentation/alertas-panel/alertas-panel.component';
import { AlertasService } from '../../../../features/alerts/application/alertas.service';
import { PosConfigModalComponent } from '../../../../features/payments-pos/presentation/pos-config-modal/pos-config-modal.component';

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
    ClockComponent,
    PosConfigModalComponent,
    AlertasPanelComponent,
  ],
})
export class HeaderComponent {
  private readonly sedeService = inject(SedeService);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  /** RF-20: alertas de Recepción (campana). */
  readonly alertas = inject(AlertasService);
  readonly alertasOpen = signal(false);

  /** El personal de aseo trabaja solo en su sede: ve el nombre pero no puede cambiarla. */
  readonly canChangeSede = this.auth.canChangeSede;

  readonly configOptionsOpen = signal(false);
  readonly sedeOptionsOpen = signal(false);
  readonly editPerfilesOpen = signal(false);
  readonly posConfigOpen = signal(false);

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
    if (!this.canChangeSede()) return;
    this.sedeOptionsOpen.update((open) => !open);
  }

  closeSedeOptions(): void {
    this.sedeOptionsOpen.set(false);
  }

  // ── Alertas (RF-20) ───────────────────────────────────────────────────────

  toggleAlertas(): void {
    const open = !this.alertasOpen();
    this.alertasOpen.set(open);
    if (open) void this.alertas.refresh();
  }

  closeAlertas(): void {
    this.alertasOpen.set(false);
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

  // ── Terminal de pago (POS) ────────────────────────────────────────────────

  openPosConfig(): void {
    this.closeConfigOptions();
    this.posConfigOpen.set(true);
  }

  closePosConfig(): void {
    this.posConfigOpen.set(false);
  }

}