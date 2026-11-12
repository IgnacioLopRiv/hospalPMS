import { TestBed } from '@angular/core/testing';
import { CaracteristicaService } from './caracteristica.service';
import { SedeService } from './sede.service';
import { CaracteristicaRepository } from '../domain/caracteristica.repository';
import { createCaracteristicaRepositoryStub } from '../domain/testing/caracteristica.repository.stub';
import { LocationsRepository } from '../domain/locations.repository';
import { createLocationsRepositoryStub } from '../domain/testing/locations.repository.stub';
import { Caracteristica, Sede } from '../../../shared/domain/hostal.model';

describe('CaracteristicaService', () => {
  const base: Caracteristica[] = [
    { id: 1, nombre: 'Wi-Fi gratuito', icono: 'wifi', predeterminada: true },
    { id: 2, nombre: 'Jacuzzi', icono: null, predeterminada: false },
  ];
  const sede: Sede = {
    id: 1,
    nombre: 'Central',
    ciudad: 'Coquimbo',
    habitaciones: [],
    tipologias: [{ id: 10, nombre: 'Doble', capacidad: 2, caracteristicaIds: [1, 2] }],
  } as Sede;

  let service: CaracteristicaService;
  let sedeService: SedeService;

  beforeEach(async () => {
    localStorage.removeItem('hospal.selectedSede');
    TestBed.configureTestingModule({
      providers: [
        { provide: CaracteristicaRepository, useValue: createCaracteristicaRepositoryStub(base) },
        { provide: LocationsRepository, useValue: createLocationsRepositoryStub([sede]) },
      ],
    });
    service = TestBed.inject(CaracteristicaService);
    sedeService = TestBed.inject(SedeService);
    await sedeService.ready;
    await service.load();
  });

  it('loads features with the default ones first', () => {
    expect(service.caracteristicas().map((c) => c.id)).toEqual([1, 2]);
  });

  it('creates a custom feature', async () => {
    const result = await service.create('  Balcón  ');
    expect(result.ok).toBeTrue();
    const created = service.caracteristicas().find((c) => c.nombre === 'Balcón');
    expect(created?.predeterminada).toBeFalse();
  });

  it('rejects duplicate names ignoring case', async () => {
    const result = await service.create('wi-fi GRATUITO');
    expect(result.ok).toBeFalse();
    expect(service.caracteristicas().length).toBe(2);
  });

  it('removes a feature and strips it from the typologies', async () => {
    const result = await service.remove(2);
    expect(result.ok).toBeTrue();
    expect(service.caracteristicas().map((c) => c.id)).toEqual([1]);
    const tipologia = sedeService.sedes()[0].tipologias?.[0];
    expect(tipologia?.caracteristicaIds).toEqual([1]);
  });
});
