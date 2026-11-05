import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { CreateFotoHabitacion, FotoHabitacionRepository } from '../domain/foto-habitacion.repository';
import { FotoHabitacion } from '../domain/foto-habitacion.model';

interface FotoApiDto {
  id: number;
  habitacionId: number;
  url: string;
  titulo?: string;
  descripcion?: string;
  fechaSubida: string;
}

@Injectable()
export class FotoHabitacionHttpRepository extends FotoHabitacionRepository {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  listPhotos(habitacionId: number): Observable<FotoHabitacion[]> {
    return this.http.get<FotoApiDto[]>(`${this.apiUrl}/habitaciones/${habitacionId}/fotos`)
      .pipe(map((rows) => rows.map((row) => this.toDomain(row))));
  }

  createPhoto(habitacionId: number, data: CreateFotoHabitacion): Observable<FotoHabitacion> {
    return this.http.post<FotoApiDto>(`${this.apiUrl}/habitaciones/${habitacionId}/fotos`, data)
      .pipe(map((row) => this.toDomain(row)));
  }

  deletePhoto(id: number): Observable<void> {
    return this.http.delete<{ deleted: boolean }>(`${this.apiUrl}/fotos-habitacion/${id}`)
      .pipe(map(() => undefined));
  }

  private toDomain(row: FotoApiDto): FotoHabitacion {
    return {
      id: row.id,
      habitacionId: row.habitacionId,
      url: row.url,
      titulo: row.titulo,
      descripcion: row.descripcion,
      fechaSubida: row.fechaSubida,
    };
  }
}
