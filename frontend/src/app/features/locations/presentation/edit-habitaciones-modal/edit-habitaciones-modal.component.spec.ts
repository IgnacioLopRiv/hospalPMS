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

    fixture = TestBed.createComponent(EditHabitacionesModalComponent);
    component = fixture.componentInstance;
    sedeService = TestBed.inject(SedeService);
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should add habitaciones with addHabitaciones()', () => {
    component.cantidadNueva.set(2);
    component.tipoNuevo.set('Individual');
    component.addHabitaciones();

    expect(component.habitaciones().length).toBe(2);
    expect(component.habitaciones()[0].tipo).toBe('Individual');
  });

  it('should remove a habitacion by id', () => {
    component.cantidadNueva.set(1);
    component.addHabitaciones();
    const createdId = component.habitaciones()[0].id;

    component.removeHabitacion(createdId);
    expect(component.habitaciones().length).toBe(0);
  });

  it('should show error message when saving invalid habitacion data', () => {
    component.cantidadNueva.set(1);
    component.addHabitaciones();
    // tamanoM2 and disposicionMuebles are empty by default
    component.save();

    expect(component.errorMessage()).toContain('Completa número, tamaño y disposición');
  });
});
