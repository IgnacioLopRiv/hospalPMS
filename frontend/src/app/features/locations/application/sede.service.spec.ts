import { TestBed } from '@angular/core/testing';
import { SedeService } from './sede.service';
import { LocationsRepository } from '../domain/locations.repository';
import { createLocationsRepositoryStub } from '../domain/testing/locations.repository.stub';
import { Sede } from '../../../shared/domain/hostal.model';

describe('SedeService', () => {
  const sede: Sede = {
    id: 1,
    nombre: 'Central',
    ciudad: 'Coquimbo',
    habitaciones: [],
    tipologias: [
      { id: 10, nombre: 'Single', capacidad: 1, precioBase: 0, color: '#1f77b4' },
      { id: 11, nombre: 'Doble', capacidad: 2, precioBase: 0, color: '#2ca02c' },
      { id: 12, nombre: 'Triple', capacidad: 3, precioBase: 0, color: '#d62728' },
    ],
  } as Sede;

  let service: SedeService;

  beforeEach(async () => {
    localStorage.removeItem('hospal.selectedSede');
    TestBed.configureTestingModule({
      providers: [{ provide: LocationsRepository, useValue: createLocationsRepositoryStub([sede]) }],
    });
    service = TestBed.inject(SedeService);
    await service.ready;
  });

  it('keeps every base price when several typologies are updated in parallel', async () => {
    await Promise.all([
      service.updateTipologia(10, { precioBase: 20000 }),
      service.updateTipologia(11, { precioBase: 30000 }),
      service.updateTipologia(12, { precioBase: 40000 }),
    ]);

    const precios = Object.fromEntries(service.tipologias().map((t) => [t.id, t.precioBase]));
    expect(precios).toEqual({ 10: 20000, 11: 30000, 12: 40000 });
    expect(service.sedes()[0].tipologias?.map((t) => t.precioBase)).toEqual([20000, 30000, 40000]);
  });
});
