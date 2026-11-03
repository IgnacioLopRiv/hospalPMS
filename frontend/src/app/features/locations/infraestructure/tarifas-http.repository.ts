import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { Tarifa, TarifaAbono, TarifaInput, TarifasRepository } from '../domain/tarifas.repository';

interface TarifaApiDto extends Tarifa {
  sedeId: number;
  tarifaAbonoId: number;
  precioBase: number | null;
  fechaInicio: string | null;
  fechaFin: string | null;
}

@Injectable()
export class TarifasHttpRepository extends TarifasRepository {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  getAbono(sedeId: number): Observable<TarifaAbono> {
    return this.http.get<TarifaAbono>(`${this.apiUrl}/sedes/${sedeId}/tarifa-abono`)
      .pipe(map((row) => this.toAbono(row)));
  }

  saveAbono(sedeId: number, porcentajeAbono: number): Observable<TarifaAbono> {
    return this.http.put<TarifaAbono>(`${this.apiUrl}/sedes/${sedeId}/tarifa-abono`, { porcentajeAbono })
      .pipe(map((row) => this.toAbono(row)));
  }

  listTarifas(sedeId: number): Observable<Tarifa[]> {
    return this.http.get<TarifaApiDto[]>(`${this.apiUrl}/sedes/${sedeId}/tarifas`)
      .pipe(map((rows) => rows.map((row) => this.toTarifa(row))));
  }

  createTarifa(sedeId: number, data: TarifaInput): Observable<Tarifa> {
    return this.http.post<TarifaApiDto>(`${this.apiUrl}/sedes/${sedeId}/tarifas`, data)
      .pipe(map((row) => this.toTarifa(row)));
  }

  updateTarifa(id: number, data: Partial<TarifaInput>): Observable<Tarifa> {
    return this.http.patch<TarifaApiDto>(`${this.apiUrl}/tarifas/${id}`, data)
      .pipe(map((row) => this.toTarifa(row)));
  }

  deleteTarifa(id: number): Observable<void> {
    return this.http.delete<{ deleted: boolean }>(`${this.apiUrl}/tarifas/${id}`).pipe(map(() => undefined));
  }

  private toAbono(row: TarifaAbono): TarifaAbono {
    return { sedeId: row.sedeId, porcentajeAbono: row.porcentajeAbono };
  }

  private toTarifa(row: TarifaApiDto): Tarifa {
    return {
      id: row.id,
      nombre: row.nombre,
      tipoTemporada: row.tipoTemporada,
      activa: row.activa,
      periodos: row.periodos,
      precios: row.precios,
    };
  }
}
