import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { Caracteristica } from '../../../shared/domain/hostal.model';
import { CaracteristicaRepository, CreateCaracteristicaInput } from '../domain/caracteristica.repository';

@Injectable()
export class CaracteristicaHttpRepository extends CaracteristicaRepository {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/caracteristicas`;

  list(): Observable<Caracteristica[]> {
    return this.http.get<Caracteristica[]>(this.apiUrl);
  }

  create(data: CreateCaracteristicaInput): Observable<Caracteristica> {
    return this.http.post<Caracteristica>(this.apiUrl, data);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<{ deleted: boolean }>(`${this.apiUrl}/${id}`).pipe(map(() => undefined));
  }
}
