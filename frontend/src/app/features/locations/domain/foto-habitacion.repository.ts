import { Observable } from 'rxjs';
import { FotoHabitacion } from './foto-habitacion.model';

export interface CreateFotoHabitacion {
  url: string;
  titulo?: string;
  descripcion?: string;
}

export abstract class FotoHabitacionRepository {
  abstract listPhotos(habitacionId: number): Observable<FotoHabitacion[]>;
  abstract createPhoto(habitacionId: number, data: CreateFotoHabitacion): Observable<FotoHabitacion>;
  abstract deletePhoto(id: number): Observable<void>;
}
