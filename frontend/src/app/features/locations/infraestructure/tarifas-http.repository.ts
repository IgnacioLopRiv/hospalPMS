import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { TarifasConfig, TarifasRepository } from '../domain/tarifas.repository';

@Injectable()
export class TarifasHttpRepository extends TarifasRepository {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  getForSede(sedeId: number): Observable<TarifasConfig> {
    return this.http.get<TarifasConfig>(`${this.apiUrl}/sedes/${sedeId}/configuracion-tarifas`);
  }

  saveForSede(config: TarifasConfig): Observable<TarifasConfig> {
    return this.http.put<TarifasConfig>(
      `${this.apiUrl}/sedes/${config.sedeId}/configuracion-tarifas`,
      { porcentajeAbono: config.porcentajeAbono, tarifas: config.tarifas },
    );
  }
}