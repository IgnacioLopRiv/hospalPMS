import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { Sede, SedeHabitacion, SedeTipologia } from '../../../shared/domain/hostal.model';
import {
  CreateSedeInput,
  CreateTipologiaInput,
  LocationsRepository,
  RoomInput,
  UpdateTipologiaInput,
} from '../domain/locations.repository';

interface RoomApiDto extends Partial<SedeHabitacion> {
  id: number;
  numero: string;
  tipo?: string;
  tipologiaId: number;
  estado?: SedeHabitacion['estado'];
}

@Injectable()
export class LocationsHttpRepository extends LocationsRepository {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  listSedes(): Observable<Sede[]> {
    return this.http.get<Sede[]>(`${this.apiUrl}/sedes`);
  }

  createSede(data: CreateSedeInput): Observable<Sede> {
    return this.http.post<Sede>(`${this.apiUrl}/sedes`, data);
  }

  updateSede(id: number, data: CreateSedeInput): Observable<Sede> {
    return this.http.patch<Sede>(`${this.apiUrl}/sedes/${id}`, data);
  }

  deleteSede(id: number): Observable<void> {
    return this.http.delete<{ deleted: boolean }>(`${this.apiUrl}/sedes/${id}`).pipe(map(() => undefined));
  }

  createTypology(sedeId: number, data: CreateTipologiaInput): Observable<SedeTipologia> {
    return this.http.post<SedeTipologia>(`${this.apiUrl}/sedes/${sedeId}/tipologias`, data);
  }

  updateTypology(id: number, data: UpdateTipologiaInput): Observable<SedeTipologia> {
    return this.http.patch<SedeTipologia>(`${this.apiUrl}/tipologias/${id}`, data);
  }

  deleteTypology(id: number): Observable<void> {
    return this.http.delete<{ deleted: boolean }>(`${this.apiUrl}/tipologias/${id}`).pipe(map(() => undefined));
  }

  createRoom(sedeId: number, data: RoomInput): Observable<SedeHabitacion> {
    return this.http.post<RoomApiDto>(`${this.apiUrl}/sedes/${sedeId}/habitaciones`, data)
      .pipe(map((row) => this.toRoom(row)));
  }

  updateRoom(id: number, data: Partial<RoomInput>): Observable<SedeHabitacion> {
    return this.http.patch<RoomApiDto>(`${this.apiUrl}/habitaciones/${id}`, data)
      .pipe(map((row) => this.toRoom(row)));
  }

  deleteRoom(id: number): Observable<void> {
    return this.http.delete<{ deleted: boolean }>(`${this.apiUrl}/habitaciones/${id}`).pipe(map(() => undefined));
  }

  private toRoom(row: RoomApiDto): SedeHabitacion {
    return {
      id: row.id,
      numero: row.numero,
      tipo: row.tipo ?? '',
      tipologiaId: row.tipologiaId,
      tamanoM2: row.tamanoM2 ?? null,
      disposicionMuebles: row.disposicionMuebles ?? '',
      descripcion: row.descripcion ?? '',
      inventario: row.inventario ?? [],
      estado: row.estado ?? 'libre',
      huespedActual: row.huespedActual,
      aseoIniciado: row.aseoIniciado,
    };
  }
}