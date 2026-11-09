import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ReportesPage } from './reportes.page';
import { LocationsRepository } from '../../../../locations/domain/locations.repository';
import { createLocationsRepositoryStub } from '../../../../locations/domain/testing/locations.repository.stub';
import { SedeService } from '../../../../locations/application/sede.service';
import { ReservasRepository } from '../../../../reservations/domain/reservas.repository';
import { HuespedRepository } from '../../../../huespedes/domain/huesped.repository';
import { TarifasRepository } from '../../../../locations/domain/tarifas.repository';
import { Reserva } from '../../../../../shared/domain/hostal.model';

describe('ReportesPage', () => {
  let component: ReportesPage;
  let fixture: ComponentFixture<ReportesPage>;
  let reservasRepository: { listBySede: jasmine.Spy };

  const today = new Date();
  const dateKey = (offset: number) => {
    const date = new Date(today.getFullYear(), today.getMonth(), 1 + offset);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };
  const reservas: Reserva[] = [
    {
      id_reserva: 1, id_huesped: 4, id_habitacion: 10, fecha_llegada: dateKey(1), fecha_salida: dateKey(3),
      estado_reserva: 'CONFIRMADA', precio_total: 90000, porcentaje_abono: 20, monto_pagado: 18000, metodo_pago: 'transferencia',
    },
    {
      id_reserva: 2, id_huesped: 5, id_habitacion: 10, fecha_llegada: dateKey(5), fecha_salida: dateKey(6),
      estado_reserva: 'FINALIZADA', precio_total: 50000, monto_pagado: 50000, pago_completo: true, metodo_pago: 'efectivo',
    },
  ];

  beforeEach(async () => {
    const initialSede = {
      id: 1,
      nombre: 'Sede de prueba',
      ciudad: 'Santiago',
      tipologias: [{ id: 1, nombre: 'Doble', capacidad: 2, precioBase: 50000 }],
      habitaciones: [{ id: 10, numero: '101', tipo: 'Doble', tipologiaId: 1, tamanoM2: null, disposicionMuebles: '' }],
    };
    const otraSede = {
      id: 2,
      nombre: 'Sede costa',
      ciudad: 'Valparaíso',
      tipologias: [{ id: 2, nombre: 'Doble', capacidad: 2, precioBase: 60000 }],
      habitaciones: [{ id: 20, numero: '201', tipo: 'Doble', tipologiaId: 2, tamanoM2: null, disposicionMuebles: '' }],
    };
    const reservasCosta: Reserva[] = [{
      id_reserva: 3, id_huesped: 9, id_habitacion: 20, fecha_llegada: dateKey(2), fecha_salida: dateKey(4),
      estado_reserva: 'CONFIRMADA', precio_total: 120000, monto_pagado: 0, metodo_pago: 'efectivo',
    }];
    reservasRepository = {
      listBySede: jasmine.createSpy().and.callFake((sedeId: number) => of(sedeId === 2 ? reservasCosta : reservas)),
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: LocationsRepository, useValue: createLocationsRepositoryStub([initialSede, otraSede]) },
        { provide: ReservasRepository, useValue: reservasRepository },
        {
          provide: HuespedRepository,
          useValue: {
            list: () => of([
              { id: 4, sedeId: 1, rutPasaporte: '22.222.222-2', nombres: 'Luis', apellidos: 'Soto', paisResidencia: 'Chile', email: '', telefono: '' },
              { id: 5, sedeId: 1, rutPasaporte: '11.111.111-1', nombres: 'Ana', apellidos: 'Pérez', paisResidencia: 'Chile', email: '', telefono: '' },
            ]),
          },
        },
        {
          provide: TarifasRepository,
          useValue: { listTarifas: () => of([]), getAbono: () => of({ sedeId: 1, porcentajeAbono: 20 }) },
        },
      ],
    });
    localStorage.removeItem('hospal.selectedSede');
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

  it('switches the demand ranking between room types, rates and payment methods', () => {
    const card: HTMLElement = fixture.nativeElement.querySelector('.demand-card');
    expect(card.textContent).toContain('Doble');

    component.vistaRanking.set('pagos');
    fixture.detectChanges();
    expect(card.textContent).toContain('Transferencia');
    expect(card.textContent).toContain('Efectivo');
  });

  it('summarizes the filtered transactions by payment status', () => {
    const resumen = component.resumenEstados();
    expect(resumen.find((item) => item.estado === 'PAGADO')).toEqual({ estado: 'PAGADO', cantidad: 1, monto: 50000 });
    expect(resumen.find((item) => item.estado === 'ABONADO')).toEqual({ estado: 'ABONADO', cantidad: 1, monto: 90000 });
  });

  it('loads the reservations of the active location as transactions of the current month', () => {
    expect(reservasRepository.listBySede).toHaveBeenCalledWith(1);
    expect(component.transaccionesPeriodo().length).toBe(2);
    expect(component.kpis().ingresos).toBe(140000);
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('TRX-00001');
    expect(text).toContain('Luis Soto');
  });

  it('combines every location when the global scope is selected', async () => {
    expect(reservasRepository.listBySede).not.toHaveBeenCalledWith(2);

    component.setAlcance('global');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(reservasRepository.listBySede).toHaveBeenCalledWith(2);
    expect(component.transaccionesPeriodo().length).toBe(3);
    expect(component.kpis().ingresos).toBe(260000);
    expect(component.kpis().capacidad).toBe(2 * component.diasPeriodo());
    expect(component.tipologiasPopulares().length).toBe(1);
    expect(component.tipologiasPopulares()[0]).toEqual(jasmine.objectContaining({ nombre: 'Doble', reservas: 3 }));
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Sede costa');

    component.setAlcance('sede');
    fixture.detectChanges();
    expect(component.transaccionesPeriodo().length).toBe(2);
  });

  it('filters the transaction history by payment method and search text', () => {
    component.setMetodoPagoFiltro('efectivo');
    expect(component.transaccionesFiltradas().map((trx) => trx.reservaId)).toEqual([2]);

    component.limpiarFiltros();
    component.setBusqueda('perez');
    expect(component.transaccionesFiltradas().map((trx) => trx.reservaId)).toEqual([2]);

    component.setBusqueda('R-0001');
    expect(component.transaccionesFiltradas().map((trx) => trx.reservaId)).toEqual([1]);
  });

  it('opens the transaction detail with the charge breakdown and closes it with Escape', () => {
    component.openDetalle(component.transacciones().find((trx) => trx.reservaId === 1)!);
    fixture.detectChanges();

    const modal: HTMLElement = fixture.nativeElement.querySelector('.detail-modal');
    expect(modal.textContent).toContain('TRX-00001');
    expect(modal.textContent).toContain('Saldo pendiente');
    expect(modal.textContent).toContain('$72.000');

    component.onEscape();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.detail-modal')).toBeNull();
  });
});
