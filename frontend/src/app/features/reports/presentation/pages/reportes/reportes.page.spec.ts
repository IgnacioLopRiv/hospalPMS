import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ReportesPage } from './reportes.page';
import { LocationsRepository } from '../../../../locations/domain/locations.repository';
import { createLocationsRepositoryStub } from '../../../../locations/domain/testing/locations.repository.stub';
import { SedeService } from '../../../../locations/application/sede.service';
import { ReportesRepository, ResumenReportes } from '../../../domain/reportes.repository';

describe('ReportesPage', () => {
  let component: ReportesPage;
  let fixture: ComponentFixture<ReportesPage>;
  let reportesRepository: jasmine.SpyObj<ReportesRepository>;

  const resumen: ResumenReportes = {
    sedeId: 1,
    fecha: '2026-11-04T12:00:00.000Z',
    habitaciones: { total: 4, ocupadas: 2, disponibles: 2, tasaOcupacion: 50 },
    reservas: {
      total: 5,
      mes: 3,
      canceladasMes: 1,
      pendientes: 1,
      enCurso: 2,
      finalizadas: 1,
      canceladas: 1,
      estadiaPromedioNoches: 2.5,
    },
    ingresos: {
      mes: 100000,
      mesAnterior: 80000,
      anio: 500000,
      anioAnterior: 400000,
      pendiente: 20000,
    },
    inventario: { totalInsumos: 3, bajoMinimo: 1 },
  };

  beforeEach(async () => {
    reportesRepository = jasmine.createSpyObj<ReportesRepository>('ReportesRepository', ['getResumen']);
    reportesRepository.getResumen.and.returnValue(of(resumen));
    const initialSede = {
      id: 1,
      nombre: 'Sede de prueba',
      ciudad: 'Santiago',
      tipologias: [],
      habitaciones: [],
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: LocationsRepository, useValue: createLocationsRepositoryStub([initialSede]) },
        { provide: ReportesRepository, useValue: reportesRepository },
      ],
    });
    const sedeService = TestBed.inject(SedeService);
    await sedeService.ready;
    fixture = TestBed.createComponent(ReportesPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows real report data', () => {
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('2');
    expect(text).toContain('50%');
    expect(text).toContain('$100.000');
    expect(text).toContain('3');
  });
});
