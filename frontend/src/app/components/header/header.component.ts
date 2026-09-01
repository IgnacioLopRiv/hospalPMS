import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonIcon, IonToolbar } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  settingsOutline,
  businessOutline,
  notificationsOutline,
  personCircleOutline
} from 'ionicons/icons';

import { AuthService } from '../../services/auth.service';
import { SedeService } from '../../services/sede.service';
import { EditSedeBannerComponent } from '../edit-sede-banner/edit-sede-banner.component';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss'],
  standalone: true,
  imports: [IonToolbar, CommonModule, IonIcon, EditSedeBannerComponent],
})
export class HeaderComponent {
  private readonly sedeService = inject(SedeService);
  private readonly auth = inject(AuthService);

  readonly editSedeOpen = signal(false);
  readonly hasSede = computed(() => this.sedeService.selectedSede() !== null);
  readonly canEditSede = this.auth.canEditSede;

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

  openEditSede(): void {
    if (!this.hasSede() || !this.canEditSede()) {
      return;
    }
    this.editSedeOpen.set(true);
  }

  closeEditSede(): void {
    this.editSedeOpen.set(false);
  }
}