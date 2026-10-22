import { Observable } from 'rxjs';

export interface Hostal {
  id: number;
  rutEmpresa: string;
  razonSocial: string;
  nombreFantasia: string;
  giro: string;
  direccion: string;
  logoUrl: string | null;
}

export type CreateHostal = Omit<Hostal, 'id'>;

export abstract class HostalRepository {
  abstract list(): Observable<Hostal[]>;
  abstract create(data: CreateHostal): Observable<Hostal>;
  abstract update(id: number, data: Partial<CreateHostal>): Observable<Hostal>;
  abstract remove(id: number): Observable<void>;
}