import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ReportesRepository, ResumenReportes } from '../domain/reportes.repository';

@Injectable()
export class ReportesHttpRepository extends ReportesRepository {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  getResumen(sedeId: number): Observable<ResumenReportes> {
    return this.http.get<ResumenReportes>(`${this.apiUrl}/reportes/resumen`, {
      params: { sedeId },
    });
  }
}
