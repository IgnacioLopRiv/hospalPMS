import { FotoHabitacionService } from './foto-habitacion.service';
import { FotoHabitacion } from '../domain/foto-habitacion.model';

const STORAGE_KEY = 'hospal_fotos_habitaciones';

describe('FotoHabitacionService', () => {
  beforeEach(() => localStorage.removeItem(STORAGE_KEY));
  afterEach(() => localStorage.removeItem(STORAGE_KEY));

  it('filters photos by room and persists removals using its dedicated key', () => {
    const photos: FotoHabitacion[] = [
      {
        id: 'foto-1',
        habitacionId: 12,
        url: 'data:image/jpeg;base64,abc',
        titulo: 'Dormitorio',
        fechaSubida: '2026-10-05T00:00:00.000Z',
      },
      {
        id: 'foto-2',
        habitacionId: '13',
        url: 'data:image/jpeg;base64,def',
        fechaSubida: '2026-10-05T00:00:00.000Z',
      },
    ];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(photos));
    const service = new FotoHabitacionService();

    expect(service.forRoom('12')).toEqual([photos[0]]);
    service.removePhoto('foto-1');
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')).toEqual([photos[1]]);
    expect(localStorage.getItem('hospal.sedes')).toBeNull();
  });

  it('removes only the selected room gallery', () => {
    const photos: FotoHabitacion[] = [
      { id: 'a', habitacionId: 2, url: 'data:image/jpeg;base64,a', fechaSubida: '2026-10-05' },
      { id: 'b', habitacionId: 3, url: 'data:image/jpeg;base64,b', fechaSubida: '2026-10-05' },
    ];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(photos));
    const service = new FotoHabitacionService();

    service.removeRoomPhotos(2);

    expect(service.photos()).toEqual([photos[1]]);
  });

  it('reports storage quota errors without changing the in-memory photo list', () => {
    const photos: FotoHabitacion[] = [
      { id: 'a', habitacionId: 2, url: 'data:image/jpeg;base64,a', fechaSubida: '2026-10-05' },
    ];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(photos));
    const service = new FotoHabitacionService();
    spyOn(Storage.prototype, 'setItem').and.callFake(() => {
      throw new DOMException('Storage full', 'QuotaExceededError');
    });

    expect(() => service.removePhoto('a')).toThrowError(/No hay espacio suficiente/);
    expect(service.photos()).toEqual(photos);
  });
});
