import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  IniciarCobroInput,
  TransaccionPos,
  PosConfig,
  PosConfigInput,
  PosDevice,
  PosProviderInfo,
  PosRepository,
  PosTestResult,
} from '../domain/pos.repository';

@Injectable()
export class PosHttpRepository extends PosRepository {
  private readonly http = inject(HttpClient);
  private readonly endpoint = `${environment.apiUrl}/pos`;

  listProviders(): Observable<PosProviderInfo[]> {
    return this.http.get<PosProviderInfo[]>(`${this.endpoint}/proveedores`);
  }

  getConfig(sedeId: number): Observable<PosConfig> {
    return this.http.get<PosConfig>(`${this.endpoint}/config/${sedeId}`);
  }

  saveConfig(sedeId: number, input: PosConfigInput): Observable<PosConfig> {
    return this.http.put<PosConfig>(`${this.endpoint}/config/${sedeId}`, input);
  }

  testConnection(sedeId: number, input: PosConfigInput): Observable<PosTestResult> {
    return this.http.post<PosTestResult>(`${this.endpoint}/config/${sedeId}/test`, input);
  }

  listDevices(sedeId: number, input: PosConfigInput): Observable<PosDevice[]> {
    return this.http.post<PosDevice[]>(`${this.endpoint}/config/${sedeId}/dispositivos`, input);
  }

  iniciarCobro(input: IniciarCobroInput): Observable<TransaccionPos> {
    return this.http.post<TransaccionPos>(`${this.endpoint}/cobros`, input);
  }

  obtenerCobro(id: number): Observable<TransaccionPos> {
    return this.http.get<TransaccionPos>(`${this.endpoint}/cobros/${id}`);
  }

  cancelarCobro(id: number): Observable<TransaccionPos> {
    return this.http.post<TransaccionPos>(`${this.endpoint}/cobros/${id}/cancelar`, {});
  }

  reportarResultado(id: number, resultado: unknown): Observable<TransaccionPos> {
    return this.http.post<TransaccionPos>(`${this.endpoint}/cobros/${id}/resultado`, { resultado });
  }
}
