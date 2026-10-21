import { of } from 'rxjs';
import { Sede, SedeHabitacion, SedeTipologia } from '../../../../shared/domain/hostal.model';
import { LocationsRepository } from '../locations.repository';

export function createLocationsRepositoryStub(initialSedes: Sede[] = []): LocationsRepository {
  let sedes = initialSedes.map((sede) => ({ ...sede }));
  let nextSedeId = Math.max(0, ...sedes.map((sede) => sede.id)) + 1;
  let nextTypologyId = Math.max(0, ...sedes.flatMap((sede) => sede.tipologias ?? []).map((item) => item.id)) + 1;
  let nextRoomId = Math.max(0, ...sedes.flatMap((sede) => sede.habitaciones).map((item) => item.id)) + 1;

  return {
    listSedes: () => of(sedes),
    createSede: (data) => {
      const created: Sede = { id: nextSedeId++, ...data, tipologias: [], habitaciones: [] };
      sedes = [...sedes, created];
      return of(created);
    },
    updateSede: (id, data) => {
      sedes = sedes.map((sede) => sede.id === id ? { ...sede, ...data } : sede);
      return of(sedes.find((sede) => sede.id === id)!);
    },
    deleteSede: (id) => {
      sedes = sedes.filter((sede) => sede.id !== id);
      return of(undefined);
    },
    createTypology: (sedeId, data) => {
      const created: SedeTipologia = { id: nextTypologyId++, ...data };
      sedes = sedes.map((sede) => sede.id === sedeId
        ? { ...sede, tipologias: [...(sede.tipologias ?? []), created] }
        : sede);
      return of(created);
    },
    updateTypology: (id, data) => {
      let updated: SedeTipologia | undefined;
      sedes = sedes.map((sede) => ({
        ...sede,
        tipologias: (sede.tipologias ?? []).map((typology) => {
          if (typology.id !== id) return typology;
          updated = { ...typology, ...data };
          return updated;
        }),
      }));
      return of(updated!);
    },
    deleteTypology: (id) => {
      sedes = sedes.map((sede) => ({
        ...sede,
        tipologias: (sede.tipologias ?? []).filter((typology) => typology.id !== id),
      }));
      return of(undefined);
    },
    createRoom: (sedeId, data) => {
      const created: SedeHabitacion = { id: nextRoomId++, ...data };
      sedes = sedes.map((sede) => sede.id === sedeId
        ? { ...sede, habitaciones: [...sede.habitaciones, created] }
        : sede);
      return of(created);
    },
    updateRoom: (id, data) => {
      let updated: SedeHabitacion | undefined;
      sedes = sedes.map((sede) => ({
        ...sede,
        habitaciones: sede.habitaciones.map((room) => {
          if (room.id !== id) return room;
          updated = { ...room, ...data };
          return updated;
        }),
      }));
      return of(updated ?? { id, numero: '', tipo: '', tamanoM2: null, disposicionMuebles: '', ...data });
    },
    deleteRoom: (id) => {
      sedes = sedes.map((sede) => ({
        ...sede,
        habitaciones: sede.habitaciones.filter((room) => room.id !== id),
      }));
      return of(undefined);
    },
  } as LocationsRepository;
}
