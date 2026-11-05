import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of } from 'rxjs';
import { FotoHabitacionService } from './foto-habitacion.service';
import { FotoHabitacionRepository } from '../domain/foto-habitacion.repository';
import { FotoHabitacion } from '../domain/foto-habitacion.model';

describe('FotoHabitacionService', () => {
  let repository: jasmine.SpyObj<FotoHabitacionRepository>;

  beforeEach(() => {
    repository = jasmine.createSpyObj<FotoHabitacionRepository>('FotoHabitacionRepository', [
      'listPhotos',
      'createPhoto',
      'deletePhoto',
    ]);
    TestBed.configureTestingModule({
      providers: [
        { provide: FotoHabitacionRepository, useValue: repository },
      ],
    });
  });

  it('filters photos by room from the repository', async () => {
    const photos: FotoHabitacion[] = [
      {
        id: 1,
        habitacionId: 12,
        url: 'data:image/jpeg;base64,abc',
        titulo: 'Dormitorio',
        fechaSubida: '2026-10-05T00:00:00.000Z',
      },
    ];
    repository.listPhotos.and.returnValue(of(photos));
    const service = TestBed.inject(FotoHabitacionService);

    await expectAsync(service.loadRoomPhotos(12)).toBeResolvedTo(photos);
    expect(service.forRoom('12')).toEqual(photos);
    expect(service.photos()).toEqual(photos);
    expect(localStorage.getItem('hospal.sedes')).toBeNull();
  });

  it('removes photos through the repository', async () => {
    const photos: FotoHabitacion[] = [
      { id: 1, habitacionId: 2, url: 'data:image/jpeg;base64,a', fechaSubida: '2026-10-05' },
    ];
    repository.listPhotos.and.returnValue(of(photos));
    repository.deletePhoto.and.returnValue(of(undefined));
    const service = TestBed.inject(FotoHabitacionService);

    await service.loadRoomPhotos(2);
    await service.removePhoto(1);

    expect(repository.deletePhoto).toHaveBeenCalledWith(1);
    expect(service.photos()).toEqual([]);
  });
});
