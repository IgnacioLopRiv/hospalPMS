import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SedeService } from '../../locations/application/sede.service';
import { Sede } from '../../../shared/domain/hostal.model';
import { InventarioService, NuevoInsumo } from './inventario.service';

const INSUMOS_KEY = 'hospal.inventario.insumos';
const ASIGNACIONES_KEY = 'hospal.inventario.habitaciones';

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

describe('InventarioService', () => {
  let service: InventarioService;
  let selectedSede: ReturnType<typeof signal<Sede | null>>;

  beforeEach(() => {
    localStorage.removeItem(INSUMOS_KEY);
    localStorage.removeItem(ASIGNACIONES_KEY);
    selectedSede = signal<Sede | null>(testSede);
    TestBed.configureTestingModule({
      providers: [
        InventarioService,
        {
          provide: SedeService,
          useValue: { selectedSede, habitaciones: signal(testSede.habitaciones) },
        },
      ],
    });
    service = TestBed.inject(InventarioService);
  });

  afterEach(() => {
    localStorage.removeItem(INSUMOS_KEY);
    localStorage.removeItem(ASIGNACIONES_KEY);
    TestBed.resetTestingModule();
  });

  it('creates sede-scoped supplies and persists the database fields', () => {
    const created = service.addInsumo(insumo);

    expect(created).toEqual({ ...insumo, id_insumo: 1, id_sede: testSede.id });
    expect(service.insumos()).toEqual([created]);
    expect(JSON.parse(localStorage.getItem(INSUMOS_KEY) ?? '[]')).toEqual([created]);

    selectedSede.set({ ...testSede, id: 100 });
    expect(service.insumos()).toEqual([]);
  });

  it('records room assignments and prevents assigning more than warehouse stock', () => {
    const created = service.addInsumo(insumo);
    const assignment = service.assignToRoom(created.id_insumo, 1, 3);

    expect(assignment).toEqual(jasmine.objectContaining({
      cantidad: 3,
      estado: 'ACTIVO',
      id_insumo: created.id_insumo,
      id_habitacion: 1,
    }));
    expect(service.habitacionesAsignadas()).toEqual([assignment]);
    expect(() => service.assignToRoom(created.id_insumo, 2, 3)).toThrowError(/Solo hay 2 unidades/);
    expect(JSON.parse(localStorage.getItem(ASIGNACIONES_KEY) ?? '[]')).toEqual([assignment]);
  });

  it('updates the supply while keeping stock at least as high as room assignments', () => {
    const created = service.addInsumo(insumo);
    service.assignToRoom(created.id_insumo, 1, 3);

    expect(() => service.updateInsumo(created.id_insumo, { ...insumo, stock_actual: 2 }))
      .toThrowError(/no puede ser menor que las 3 unidades asignadas/);

    const updated = service.updateInsumo(created.id_insumo, {
      ...insumo,
      nombre_insumo: 'Toalla grande',
      costo_compra: 1500,
      stock_actual: 4,
    });
    expect(updated.nombre_insumo).toBe('Toalla grande');
    expect(updated.costo_compra).toBe(1500);
    expect(updated.stock_actual).toBe(4);
    expect(JSON.parse(localStorage.getItem(INSUMOS_KEY) ?? '[]')).toEqual([updated]);
  });

  it('deletes the supply and its room assignments', () => {
    const created = service.addInsumo(insumo);
    const other = service.addInsumo({ ...insumo, nombre_insumo: 'Sábana' });
    service.assignToRoom(created.id_insumo, 1, 2);
    service.assignToRoom(other.id_insumo, 2, 1);

    service.deleteInsumo(created.id_insumo);

    expect(service.insumos()).toEqual([other]);
    expect(service.habitacionesAsignadas().map((assignment) => assignment.id_insumo))
      .toEqual([other.id_insumo]);
    expect(JSON.parse(localStorage.getItem(INSUMOS_KEY) ?? '[]')).toEqual([other]);
    expect(JSON.parse(localStorage.getItem(ASIGNACIONES_KEY) ?? '[]'))
      .toEqual(service.habitacionesAsignadas());
  });

  it('releases a room assignment back to warehouse stock', () => {
    const created = service.addInsumo(insumo);
    const assignment = service.assignToRoom(created.id_insumo, 1, 3);

    service.releaseRoomAssignment(assignment.id_inventario_hab);

    expect(service.habitacionesAsignadas()).toEqual([]);
    expect(JSON.parse(localStorage.getItem(ASIGNACIONES_KEY) ?? '[]')).toEqual([
      { ...assignment, estado: 'DEVUELTO' },
    ]);
    expect(() => service.releaseRoomAssignment(assignment.id_inventario_hab))
      .toThrowError(/No se encontró la asignación activa/);
  });
});
