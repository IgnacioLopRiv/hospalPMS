import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { bedOutline, businessOutline, createOutline } from 'ionicons/icons';
import { SedeService } from '../../../application/sede.service';
import { AuthService } from '../../../../../core/auth/application/auth.service';
import { EditHabitacionesModalComponent } from '../../edit-habitaciones-modal/edit-habitaciones-modal.component';

@Component({
  selector: 'app-habitaciones',
  templateUrl: './habitaciones.page.html',
  styleUrls: ['./habitaciones.page.scss'],
  standalone: true,
  imports: [CommonModule, IonIcon, EditHabitacionesModalComponent],
})
export class HabitacionesPage {
  private readonly sedeService = inject(SedeService);
  private readonly authService = inject(AuthService);

  readonly sede = this.sedeService.selectedSede;
  readonly habitaciones = this.sedeService.habitaciones;
  readonly isAdmin = computed(() => this.authService.currentUser()?.role === 'admin');
  readonly editHabitacionesOpen = signal(false);

  constructor() {
    addIcons({ bedOutline, createOutline, businessOutline });
  }

  addHabitaciones(): void {
    if (!this.isAdmin()) {
      return;
    }
    this.editHabitacionesOpen.set(true);
  }

  closeEditHabitaciones(): void {
    this.editHabitacionesOpen.set(false);
  }
}