import { Observable } from 'rxjs';
import { Caracteristica } from '../../../shared/domain/hostal.model';

export interface CreateCaracteristicaInput {
  nombre: string;
  icono?: string | null;
}

export abstract class CaracteristicaRepository {
  abstract list(): Observable<Caracteristica[]>;
  abstract create(data: CreateCaracteristicaInput): Observable<Caracteristica>;
  abstract delete(id: number): Observable<void>;
}
