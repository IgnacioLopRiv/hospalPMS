import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HabitacionesPage } from './habitaciones.page';
import { AuthService } from '../../../../../core/auth/application/auth.service';
import { SedeService } from '../../../application/sede.service';

describe('HabitacionesPage', () => {
  let component: HabitacionesPage;
  let fixture: ComponentFixture<HabitacionesPage>;
  let authService: AuthService;
  let sedeService: SedeService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HabitacionesPage],
      providers: [provideHttpClient()],
    }).compileComponents();

    sedeService = TestBed.inject(SedeService);
    sedeService.selectedSede.set({
      id: 1,
      nombre: 'Hostal Playa',
      ciudad: 'Viña del Mar',
      tipologias: [],
      habitaciones: [{
        id: 10,
        numero: '105',
        tipo: 'Doble',
        tamanoM2: 22,
        disposicionMuebles: '1 Cama Matrimonial',
        estado: 'libre',
      }],
    });
    fixture = TestBed.createComponent(HabitacionesPage);
    component = fixture.componentInstance;
    authService = TestBed.inject(AuthService);
    fixture.detectChanges();
  });

  afterEach(() => {
    localStorage.removeItem('hospal.sedes');
    localStorage.removeItem('hospal.selectedSede');
    TestBed.resetTestingModule();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should not open the new room modal when user is not admin', () => {
    authService.currentUser.set({
      id: 2,
      name: 'Recepcionista',
      email: 'recepcion@hostal.cl',
      role: 'staff',
    });

    component.openNewRoomForm();
    expect(component.newRoomFormOpen()).toBeFalse();
  });

  it('should open the new room modal when user is admin', () => {
    authService.currentUser.set({
      id: 1,
      name: 'Administrador',
      email: 'admin@hostal.cl',
      role: 'admin',
    });

    component.openNewRoomForm();
    expect(component.newRoomFormOpen()).toBeTrue();
  });

  it('creates one room with the selected typology and automatically assigns the next number when blank', () => {
    authService.currentUser.set({
      id: 1,
      name: 'Administrador',
      email: 'admin@hostal.cl',
      role: 'admin',
    });
    const typology = sedeService.addTipologia({ nombre: 'Doble', capacidad: 2 });

    component.openNewRoomForm();
    component.createHabitacion();

    expect(sedeService.habitaciones().length).toBe(2);
    expect(sedeService.habitaciones()[1]).toEqual(jasmine.objectContaining({
      numero: '106',
      tipo: 'Doble',
      tipologiaId: typology.id,
      estado: 'libre',
    }));
    expect(component.newRoomFormOpen()).toBeFalse();
  });

  it('creates one room with a manually entered number', () => {
    authService.currentUser.set({
      id: 1,
      name: 'Administrador',
      email: 'admin@hostal.cl',
      role: 'admin',
    });
    const typology = sedeService.addTipologia({ nombre: 'Doble', capacidad: 2 });

    component.openNewRoomForm();
    component.newRoomNumber.set('208');
    component.createHabitacion();

    expect(sedeService.habitaciones()[1]).toEqual(jasmine.objectContaining({
      numero: '208',
      tipo: 'Doble',
      tipologiaId: typology.id,
    }));
    expect(component.newRoomError()).toBe('');
  });

  it('does not create a room with a duplicate number', () => {
    authService.currentUser.set({
      id: 1,
      name: 'Administrador',
      email: 'admin@hostal.cl',
      role: 'admin',
    });
    sedeService.addTipologia({ nombre: 'Doble', capacidad: 2 });

    component.openNewRoomForm();
    component.newRoomNumber.set('105');
    component.createHabitacion();

    expect(sedeService.habitaciones().length).toBe(1);
    expect(component.newRoomError()).toBe('Ya existe una habitación con el número 105.');
    expect(component.newRoomFormOpen()).toBeTrue();
  });
});
