import { Observable } from 'rxjs';
import { Sede, SedeHabitacion, SedeTipologia } from '../../../shared/domain/hostal.model';

export interface CreateSedeInput {
  nombre: string;
  ciudad: string;
  email?: string | null;
  direccion?: string | null;
  telefono?: string | null;
}

export type CreateTipologiaInput = Omit<SedeTipologia, 'id'>;
export type UpdateTipologiaInput = Partial<Omit<SedeTipologia, 'id'>>;
export type RoomInput = Omit<SedeHabitacion, 'id'>;

export abstract class LocationsRepository {
  abstract listSedes(): Observable<Sede[]>;
  abstract createSede(data: CreateSedeInput): Observable<Sede>;
  abstract updateSede(id: number, data: CreateSedeInput): Observable<Sede>;
  abstract deleteSede(id: number): Observable<void>;
  abstract createTypology(sedeId: number, data: CreateTipologiaInput): Observable<SedeTipologia>;
  abstract updateTypology(id: number, data: UpdateTipologiaInput): Observable<SedeTipologia>;
  abstract deleteTypology(id: number): Observable<void>;
  abstract createRoom(sedeId: number, data: RoomInput): Observable<SedeHabitacion>;
  abstract updateRoom(id: number, data: Partial<RoomInput>): Observable<SedeHabitacion>;
  abstract deleteRoom(id: number): Observable<void>;
}