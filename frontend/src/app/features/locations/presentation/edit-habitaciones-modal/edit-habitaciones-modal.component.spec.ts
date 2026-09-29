import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { EditHabitacionesModalComponent } from './edit-habitaciones-modal.component';
import { SedeService } from '../../application/sede.service';

describe('EditHabitacionesModalComponent', () => {
  let component: EditHabitacionesModalComponent;
  let fixture: ComponentFixture<EditHabitacionesModalComponent>;
  let sedeService: SedeService;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [EditHabitacionesModalComponent],
      providers: [SedeService],
    }).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(EditHabitacionesModalComponent);
    component = fixture.componentInstance;
    sedeService = TestBed.inject(SedeService);
    sedeService.addTipologia({ nombre: 'Tipología administrada', capacidad: 2 });
    component.cargarHabitacionesActuales();
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

  it('creates rooms using a typology configured in the manager', () => {
    component.cantidad = 2;
    component.agregarHabitaciones();

    expect(component.tempHabitaciones.length).toBe(2);
    expect(component.tempHabitaciones[0].tipo).toBe('Tipología administrada');
    expect(component.tempHabitaciones[0].tipologiaId).toBe(1);
  });

  it('removes a room by its list index', () => {
    component.agregarHabitaciones();

    component.eliminarHabitacion(0);

    expect(component.tempHabitaciones.length).toBe(0);
  });

  it('saves changes to the selected sede', () => {
    component.tempHabitaciones = [{
      id: 99,
      numero: '999',
      tipo: 'Tipología administrada',
      tipologiaId: 1,
      tamanoM2: 22,
      disposicionMuebles: '',
    }];

    component.guardarCambios();

    expect(sedeService.habitaciones().length).toBe(1);
    expect(sedeService.habitaciones()[0].numero).toBe('999');
  });
});
