import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { Sede } from '../../../shared/domain/hostal.model';
import { SedeService } from '../../locations/application/sede.service';
import {
  AsignacionInventario,
  CreateAsignacionInventario,
  CreateInsumo,
  Insumo,
  InventarioRepository,
} from '../domain/inventario.repository';
import { InventarioService, NuevoInsumo } from './inventario.service';

const testSede: Sede = {
  id: 99,
  nombre: 'Sede de prueba',
  ciudad: 'Santiago',
  tipologias: [],
  habitaciones: [
    { id: 1, numero: '101', tipo: 'Doble', tamanoM2: null, disposicionMuebles: '' },
    { id: 2, numero: '102', tipo: 'Doble', tamanoM2: null, disposicionMuebles: '' },
  ],
};

const insumo: NuevoInsumo = {
  nombre_insumo: 'Toalla',
  descripcion: 'Toalla de baño',
  costo_compra: 1200,
  stock_actual: 5,
  stock_minimo: 2,
  producto_activo: true,
};

describe('InventarioService HTTP persistence', () => {
  let service: InventarioService;
  let selectedSede: ReturnType<typeof signal<Sede | null>>;
  let supplies: Insumo[];
  let assignments: AsignacionInventario[];
  let repository: {
    listSupplies: jasmine.Spy;
    createSupply: jasmine.Spy;
    updateSupply: jasmine.Spy;
    deleteSupply: jasmine.Spy;
    listRoomAssignments: jasmine.Spy;
    createRoomAssignment: jasmine.Spy;
    updateRoomAssignment: jasmine.Spy;
  };

  beforeEach(async () => {
    supplies = [];
    assignments = [];
    repository = {
      listSupplies: jasmine.createSpy().and.callFake(() => of(supplies)),
      createSupply: jasmine.createSpy().and.callFake((data: CreateInsumo) => {
        const saved: Insumo = { ...data, id: supplies.length + 1 };
        supplies = [...supplies, saved];
        return of(saved);
      }),
      updateSupply: jasmine.createSpy().and.callFake((id: number, data: Partial<CreateInsumo>) => {
        supplies = supplies.map((item) => item.id === id ? { ...item, ...data } : item);
        return of(supplies.find((item) => item.id === id));
      }),
      deleteSupply: jasmine.createSpy().and.callFake((id: number) => {
        supplies = supplies.filter((item) => item.id !== id);
        assignments = assignments.filter((item) => item.insumoId !== id);
        return of(undefined);
      }),
      listRoomAssignments: jasmine.createSpy().and.callFake(() => of(assignments)),
      createRoomAssignment: jasmine.createSpy().and.callFake((data: CreateAsignacionInventario) => {
        const saved: AsignacionInventario = {
          ...data,
          id: assignments.length + 1,
          fechaAsignacion: new Date().toISOString(),
        };
        assignments = [...assignments, saved];
        return of(saved);
      }),
      updateRoomAssignment: jasmine.createSpy().and.callFake((id: number, data: Partial<Pick<AsignacionInventario, 'cantidad' | 'estado'>>) => {
        assignments = assignments.map((item) => item.id === id ? { ...item, ...data } : item);
        return of(assignments.find((item) => item.id === id));
      }),
    };
    selectedSede = signal<Sede | null>(testSede);
    TestBed.configureTestingModule({
      providers: [
        InventarioService,
        { provide: InventarioRepository, useValue: repository },
        { provide: SedeService, useValue: {
          ready: Promise.resolve(),
          selectedSede,
          habitaciones: signal(testSede.habitaciones),
        } },
      ],
    });
    service = TestBed.inject(InventarioService);
    await service.ready;
  });

  afterEach(() => TestBed.resetTestingModule());

  it('loads supply and assignment data scoped to the selected sede', () => {
    expect(repository.listSupplies).toHaveBeenCalledWith(testSede.id);
    expect(repository.listRoomAssignments).toHaveBeenCalledWith(testSede.id);
    expect(service.insumos()).toEqual([]);
  });

  it('creates, updates, and deletes supplies through the repository', async () => {
    const created = await service.addInsumo(insumo);
    expect(created).toEqual({ ...insumo, id_insumo: 1, id_sede: testSede.id });

    const updated = await service.updateInsumo(created.id_insumo, {
      ...insumo,
      nombre_insumo: 'Toalla grande',
      costo_compra: 1500,
      stock_actual: 6,
    });
    expect(updated.nombre_insumo).toBe('Toalla grande');
    expect(repository.updateSupply).toHaveBeenCalledWith(1, jasmine.objectContaining({ stockActual: 6 }));

    await service.deleteInsumo(created.id_insumo);
    expect(repository.deleteSupply).toHaveBeenCalledWith(1);
    expect(service.insumos()).toEqual([]);
  });

  it('validates stock and room assignment before writing', async () => {
    const created = await service.addInsumo(insumo);
    const assignment = await service.assignToRoom(created.id_insumo, 1, 3);
    expect(assignment.estado).toBe('ACTIVO');
    await expectAsync(service.assignToRoom(created.id_insumo, 2, 3))
      .toBeRejectedWithError(/Solo hay 2 unidades/);
    await expectAsync(service.updateInsumo(created.id_insumo, { ...insumo, stock_actual: 2 }))
      .toBeRejectedWithError(/no puede ser menor que las 3 unidades asignadas/);
  });

  it('releases a room assignment in the backend and updates the view', async () => {
    const created = await service.addInsumo(insumo);
    const assignment = await service.assignToRoom(created.id_insumo, 1, 3);

    await service.releaseRoomAssignment(assignment.id_inventario_hab);

    expect(repository.updateRoomAssignment).toHaveBeenCalledWith(assignment.id_inventario_hab, { estado: 'DEVUELTO' });
    expect(service.habitacionesAsignadas()).toEqual([]);
  });
});