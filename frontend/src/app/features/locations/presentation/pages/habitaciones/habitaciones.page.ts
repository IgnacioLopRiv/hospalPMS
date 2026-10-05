import { Component, computed, inject, signal, OnInit, OnDestroy, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  addOutline,
  bedOutline,
  businessOutline,
  checkmarkCircleOutline,
  closeOutline,
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
import { useEffect } from '../../../../../shared/presentation/clock/clock.component';

@Component({
  selector: 'app-habitaciones',
  templateUrl: './habitaciones.page.html',
  styleUrls: ['./habitaciones.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonIcon],
})
export class HabitacionesPage implements OnInit, OnDestroy {
  private readonly sedeService = inject(SedeService);
  private readonly authService = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  readonly sede = this.sedeService.selectedSede;
  readonly habitaciones = this.sedeService.habitaciones;
  readonly tipologias = this.sedeService.tipologias;
  readonly isAdmin = computed(() => this.authService.currentUser()?.role === 'admin');
  readonly newRoomFormOpen = signal(false);
  readonly newRoomTypologyId = signal<number | null>(null);

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
      addOutline,
      bedOutline,
      businessOutline,
      closeOutline,
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

  openNewRoomForm(): void {
    if (!this.isAdmin()) {
      return;
    }
    this.newRoomTypologyId.set(this.tipologias()[0]?.id ?? null);
    this.newRoomFormOpen.set(true);
  }

  closeNewRoomForm(): void {
    this.newRoomFormOpen.set(false);
  }

  selectNewRoomTypology(event: Event): void {
    const selectedId = Number((event.target as HTMLSelectElement).value);
    this.newRoomTypologyId.set(Number.isFinite(selectedId) ? selectedId : null);
  }

  createHabitacion(): void {
    if (!this.isAdmin()) {
      return;
    }

    const sedeActual = this.sede();
    const tipologia = this.tipologias().find((item) => item.id === this.newRoomTypologyId());
    if (!sedeActual || !tipologia) {
      return;
    }

    const numeros = this.habitaciones()
      .map((habitacion) => Number(habitacion.numero))
      .filter((numero) => Number.isFinite(numero));
    const numero = (numeros.length > 0 ? Math.max(...numeros) : 100) + 1;
    const { tamanoM2, disposicionMuebles } = this.getRoomDefaults(tipologia.capacidad);
    const nuevaHabitacion: Habitacion = {
      id: this.sedeService.createHabitacionId(),
      numero: String(numero),
      tipo: tipologia.nombre,
      tipologiaId: tipologia.id,
      tamanoM2,
      disposicionMuebles,
      estado: 'libre',
    };

    this.sedeService.updateSelectedSede({
      nombre: sedeActual.nombre,
      habitaciones: [...this.habitaciones(), nuevaHabitacion],
    });
    this.closeNewRoomForm();
  }

  private getRoomDefaults(capacidad: number): Pick<Habitacion, 'tamanoM2' | 'disposicionMuebles'> {
    if (capacidad === 1) {
      return { tamanoM2: 14, disposicionMuebles: '1 Cama 1 Plaza' };
    }
    if (capacidad === 3) {
      return { tamanoM2: 28, disposicionMuebles: '3 Camas 1 Plaza' };
    }
    if (capacidad >= 4) {
      return { tamanoM2: 36, disposicionMuebles: '1 Cama Matrimonial + 2 Camas 1 Plaza' };
    }
    return { tamanoM2: 22, disposicionMuebles: '1 Cama Matrimonial' };
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