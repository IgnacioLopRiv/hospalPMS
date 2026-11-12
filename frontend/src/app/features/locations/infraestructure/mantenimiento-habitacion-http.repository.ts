import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  IniciarMantenimientoInput,
  MantenimientoHabitacion,
} from '../domain/mantenimiento-habitacion.model';

@Injectable({ providedIn: 'root' })
export class MantenimientoHabitacionHttpRepository {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  listBySede(sedeId: number): Observable<MantenimientoHabitacion[]> {
    return this.http.get<MantenimientoHabitacion[]>(`${this.apiUrl}/sedes/${sedeId}/mantenimientos`);
  }

  iniciar(habitacionId: number, data: IniciarMantenimientoInput): Observable<MantenimientoHabitacion> {
    return this.http.post<MantenimientoHabitacion>(
      `${this.apiUrl}/habitaciones/${habitacionId}/mantenimientos`,
      data,
    );
  }

  finalizar(habitacionId: number): Observable<MantenimientoHabitacion | null> {
    return this.http.post<MantenimientoHabitacion | null>(
      `${this.apiUrl}/habitaciones/${habitacionId}/mantenimientos/finalizar`,
      {},
    );
  }
}
