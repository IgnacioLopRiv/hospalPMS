import { Component, computed, inject, signal, OnInit, OnDestroy, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  bedOutline,
  businessOutline,
  createOutline,
  checkmarkCircleOutline,
  sparklesOutline,
  personOutline,
  timeOutline,
  checkmarkOutline,
  logInOutline,
  waterOutline,
  refreshOutline
} from 'ionicons/icons';
import { Habitacion, SedeService, EstadoHabitacion } from '../../../application/sede.service';
import { AuthService } from '../../../../../core/auth/application/auth.service';
import { EditHabitacionesModalComponent } from '../../edit-habitaciones-modal/edit-habitaciones-modal.component';
import { ClockComponent, useEffect } from '../../../../../shared/presentation/clock/clock.component';

@Component({
  selector: 'app-habitaciones',
  templateUrl: './habitaciones.page.html',
  styleUrls: ['./habitaciones.page.scss'],
  standalone: true,
  imports: [CommonModule, IonIcon, EditHabitacionesModalComponent, ClockComponent],
})
export class HabitacionesPage implements OnInit, OnDestroy {
  private readonly sedeService = inject(SedeService);
  private readonly authService = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  readonly sede = this.sedeService.selectedSede;
  readonly habitaciones = this.sedeService.habitaciones;
  readonly tipologias = this.sedeService.tipologias;
  readonly isAdmin = computed(() => this.authService.currentUser()?.role === 'admin');
  readonly editHabitacionesOpen = signal(false);

  // Señal de tick en vivo para actualizar tiempos relativos de aseo
  readonly liveTick = signal<number>(Date.now());

  // Métricas de estado en tiempo real
  readonly totalLibres = computed(() =>
    this.habitaciones().filter((h) => (h.estado || 'libre') === 'libre').length
  );
  readonly totalOcupadas = computed(() =>
    this.habitaciones().filter((h) => h.estado === 'ocupada').length
  );
  readonly totalEnAseo = computed(() =>
    this.habitaciones().filter((h) => h.estado === 'en aseo').length
  );

  constructor() {
    addIcons({
      bedOutline,
      createOutline,
      businessOutline,
      checkmarkCircleOutline,
      sparklesOutline,
      personOutline,
      timeOutline,
      checkmarkOutline,
      logInOutline,
      waterOutline,
      refreshOutline,
    });

    // Hook reactivo useEffect con setInterval para revisar estados y auto-liberar aseo en vivo
    useEffect(() => {
      const interval = setInterval(() => {
        this.liveTick.set(Date.now());
        // Auto-libera habitaciones en aseo luego de 30 minutos de limpieza
        this.sedeService.autoLiberarAseo(30);
      }, 5000);

      return () => {
        clearInterval(interval);
      };
    }, this.destroyRef);
  }

  ngOnInit(): void {
    this.sedeService.autoLiberarAseo(30);
  }

  ngOnDestroy(): void {}

  addHabitaciones(): void {
    if (!this.isAdmin()) {
      return;
    }
    this.editHabitacionesOpen.set(true);
  }

  closeEditHabitaciones(): void {
    this.editHabitacionesOpen.set(false);
  }

  getManagedTypologyName(room: Habitacion): string {
    return this.tipologias().find((typology) =>
      typology.id === room.tipologiaId ||
      typology.nombre.toLocaleLowerCase() === room.tipo.toLocaleLowerCase()
    )?.nombre ?? 'Tipología no gestionada';
  }

  getEstadoLabel(estado?: EstadoHabitacion): string {
    switch (estado) {
      case 'ocupada':
        return 'Ocupada';
      case 'en aseo':
        return 'En Aseo';
      case 'libre':
      default:
        return 'Libre';
    }
  }

  getTiempoEnAseo(habitacion: Habitacion): string {
    this.liveTick(); // Suscripción reactiva al tick en vivo
    if (!habitacion.aseoIniciado) {
      return 'En curso';
    }
    const diffMin = Math.floor((Date.now() - habitacion.aseoIniciado) / (60 * 1000));
    return diffMin <= 0 ? 'Recién iniciado' : `Hace ${diffMin} min`;
  }

  marcarLibre(habitacion: Habitacion, event?: Event): void {
    event?.stopPropagation();
    this.sedeService.marcarLibre(habitacion.numero);
  }

  marcarEnAseo(habitacion: Habitacion, event?: Event): void {
    event?.stopPropagation();
    this.sedeService.marcarEnAseo(habitacion.numero);
  }

  marcarOcupada(habitacion: Habitacion, event?: Event): void {
    event?.stopPropagation();
    this.sedeService.marcarOcupada(habitacion.numero, 'Check-in manual');
  }
}