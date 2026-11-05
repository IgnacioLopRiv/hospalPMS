import { Observable } from 'rxjs';

export interface Huesped {
  id: number;
  sedeId: number;
  rutPasaporte: string;
  nombres: string;
  apellidos: string;
  paisResidencia: string;
  email: string;
  telefono: string;
  esRecurrente?: boolean;
  diasUltimoRegistro?: number;
}

export type CreateHuesped = Omit<Huesped, 'id'>;

export abstract class HuespedRepository {
  abstract list(sedeId?: number): Observable<Huesped[]>;
  abstract create(data: CreateHuesped): Observable<Huesped>;
  abstract update(id: number, data: Partial<CreateHuesped>, sedeId?: number): Observable<Huesped>;
  abstract remove(id: number, sedeId?: number): Observable<void>;
}