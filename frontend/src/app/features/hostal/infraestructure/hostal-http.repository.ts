import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { CreateHostal, Hostal, HostalRepository } from '../domain/hostal.repository';

@Injectable()
export class HostalHttpRepository extends HostalRepository {
  private readonly http = inject(HttpClient);
  private readonly endpoint = `${environment.apiUrl}/hostales`;

  list(): Observable<Hostal[]> {
    return this.http.get<Hostal[]>(this.endpoint);
  }

  create(data: CreateHostal): Observable<Hostal> {
    return this.http.post<Hostal>(this.endpoint, data);
  }

  update(id: number, data: Partial<CreateHostal>): Observable<Hostal> {
    return this.http.patch<Hostal>(`${this.endpoint}/${id}`, data);
  }

  remove(id: number): Observable<void> {
    return this.http.delete<{ deleted: boolean }>(`${this.endpoint}/${id}`).pipe(map(() => undefined));
  }
}