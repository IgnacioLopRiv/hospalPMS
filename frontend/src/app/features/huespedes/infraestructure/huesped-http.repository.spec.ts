import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { HuespedHttpRepository } from './huesped-http.repository';

describe('HuespedHttpRepository', () => {
  let repository: HuespedHttpRepository;
  let httpTesting: HttpTestingController;
  const endpoint = `${environment.apiUrl}/huespedes`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        HuespedHttpRepository,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    repository = TestBed.inject(HuespedHttpRepository);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('lists huéspedes from GET /huespedes scoped by sede and maps the API DTO', () => {
    let result: unknown;
    repository.list(5).subscribe((huespedes) => result = huespedes);

    const request = httpTesting.expectOne(`${endpoint}?sedeId=5`);
    expect(request.request.method).toBe('GET');
    request.flush([{
      id_huesped: 12,
      id_sede: 5,
      documento: '12.345.678-9',
      nombre: 'Ana',
      apellido: 'Pérez',
      nacionalidad: 'Chile',
      telefono: '+56912345678',
      email: 'ana@example.com',
      es_recurrente: true,
      dias_ultimo_registro: 30,
    }]);

    expect(result).toEqual([jasmine.objectContaining({
      id: 12,
      sedeId: 5,
      rutPasaporte: '12.345.678-9',
      nombres: 'Ana',
      apellidos: 'Pérez',
      esRecurrente: true,
      diasUltimoRegistro: 30,
    })]);
  });

  it('creates huéspedes using the controller field names', () => {
    let result: unknown;
    repository.create({
      sedeId: 5,
      rutPasaporte: '12.345.678-9',
      nombres: 'Ana',
      apellidos: 'Pérez',
      paisResidencia: 'Chile',
      telefono: '+56912345678',
      email: 'ana@example.com',
    }).subscribe((huesped) => result = huesped);

    const request = httpTesting.expectOne(endpoint);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(jasmine.objectContaining({
      id_sede: 5,
      sedeId: 5,
      documento: '12.345.678-9',
      nombre: 'Ana',
      apellido: 'Pérez',
      nacionalidad: 'Chile',
    }));
    request.flush({
      id_huesped: 12,
      id_sede: 5,
      documento: '12.345.678-9',
      nombre: 'Ana',
      apellido: 'Pérez',
      nacionalidad: 'Chile',
      telefono: '+56912345678',
      email: 'ana@example.com',
    });
    expect(result).toEqual(jasmine.objectContaining({ id: 12, sedeId: 5, nombres: 'Ana' }));
  });

  it('updates and removes huéspedes with PATCH and DELETE', () => {
    repository.update(12, { email: 'nuevo@example.com' }, 5).subscribe();
    const updateRequest = httpTesting.expectOne(`${endpoint}/12?sedeId=5`);
    expect(updateRequest.request.method).toBe('PATCH');
    expect(updateRequest.request.body).toEqual({ email: 'nuevo@example.com' });
    updateRequest.flush({
      id_huesped: 12,
      id_sede: 5,
      documento: '12.345.678-9',
      nombre: 'Ana',
      apellido: 'Pérez',
      nacionalidad: 'Chile',
      telefono: '+56912345678',
      email: 'nuevo@example.com',
    });

    repository.remove(12, 5).subscribe();
    const deleteRequest = httpTesting.expectOne(`${endpoint}/12?sedeId=5`);
    expect(deleteRequest.request.method).toBe('DELETE');
    deleteRequest.flush({ deleted: true });
  });
});