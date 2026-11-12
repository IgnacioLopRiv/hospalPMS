import { of } from 'rxjs';
import { Caracteristica } from '../../../../shared/domain/hostal.model';
import { CaracteristicaRepository } from '../caracteristica.repository';

export function createCaracteristicaRepositoryStub(initial: Caracteristica[] = []): CaracteristicaRepository {
  let items = initial.map((item) => ({ ...item }));
  let nextId = Math.max(0, ...items.map((item) => item.id)) + 1;

  return {
    list: () => of(items.map((item) => ({ ...item }))),
    create: (data) => {
      const created: Caracteristica = {
        id: nextId++,
        nombre: data.nombre,
        icono: data.icono ?? null,
        predeterminada: false,
      };
      items = [...items, created];
      return of(created);
    },
    delete: (id) => {
      items = items.filter((item) => item.id !== id);
      return of(undefined);
    },
  };
}
