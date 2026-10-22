import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { Reserva } from '../../../shared/domain/hostal.model';
import { CreateReserva, ReservasRepository, UpdateReserva } from '../domain/reservas.repository';

@Injectable()
export class ReservasHttpRepository extends ReservasRepository {
  private readonly http = inject(HttpClient);
  private readonly endpoint = `${environment.apiUrl}/reservas`;

  listBySede(sedeId: number): Observable<Reserva[]> {
    return this.http.get<Reserva[]>(this.endpoint, { params: { sedeId } });
  }

  create(data: CreateReserva): Observable<Reserva> {
    return this.http.post<Reserva>(this.endpoint, data);
  }

  update(id: number, data: UpdateReserva): Observable<Reserva> {
    return this.http.patch<Reserva>(`${this.endpoint}/${id}`, data);
  }

  remove(id: number): Observable<void> {
    return this.http.delete<{ deleted: boolean }>(`${this.endpoint}/${id}`).pipe(map(() => undefined));
  }
}