import { Observable } from 'rxjs';

export interface TarifasConfig {
  sedeId: number;
  porcentajeAbono: number;
  tarifas: unknown[];
}

export abstract class TarifasRepository {
  abstract getForSede(sedeId: number): Observable<TarifasConfig>;
  abstract saveForSede(config: TarifasConfig): Observable<TarifasConfig>;
}