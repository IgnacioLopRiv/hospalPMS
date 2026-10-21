import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { IonicModule } from '@ionic/angular';
import { LocationsRepository } from '../../../../features/locations/domain/locations.repository';
import { createLocationsRepositoryStub } from '../../../../features/locations/domain/testing/locations.repository.stub';

import { EditPerfilesComponent } from './edit-perfiles.component';

describe('EditPerfilesComponent', () => {
  let component: EditPerfilesComponent;
  let fixture: ComponentFixture<EditPerfilesComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [EditPerfilesComponent, IonicModule.forRoot()],
      providers: [
        provideHttpClient(),
        { provide: LocationsRepository, useValue: createLocationsRepositoryStub() },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(EditPerfilesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize with closed state and handle dismiss', () => {
    spyOn(component.closed, 'emit');
    component.dismiss();
    expect(component.closed.emit).toHaveBeenCalled();
  });

  it('binds isOpen input to ion-modal with edit-perfiles-modal class', () => {
    fixture.componentRef.setInput('isOpen', true);
    fixture.detectChanges();

    const ionModal = fixture.nativeElement.querySelector('ion-modal');
    expect(ionModal).not.toBeNull();
    expect(ionModal.classList.contains('edit-perfiles-modal')).toBeTrue();
  });

  it('opens add mode with empty form and cancels correctly', () => {
    component.openAdd();
    expect(component.formMode()).toBe('add');
    expect(component.form().name).toBe('');
    expect(component.form().role).toBe('staff');

    component.cancelForm();
    expect(component.formMode()).toBeNull();
  });

  it('opens edit mode with existing user data', () => {
    component.openEdit({
      id: 5,
      name: 'Carlos Recepción',
      email: 'carlos@hotel.cl',
      password: 'password123',
      role: 'staff',
      sedeId: 2,
    });

    expect(component.formMode()).toBe('edit');
    expect(component.editingId()).toBe(5);
    expect(component.form().name).toBe('Carlos Recepción');
    expect(component.form().email).toBe('carlos@hotel.cl');
    expect(component.form().sedeId).toBe(2);
  });

  it('patches form fields and cleans sedeId when switching to admin', () => {
    component.patchForm('sedeId', '3');
    expect(component.form().sedeId).toBe(3);

    component.patchForm('role', 'admin');
    expect(component.form().role).toBe('admin');
    expect(component.form().sedeId).toBeNull();
  });

  it('validates required fields on saveForm', () => {
    component.openAdd();
    component.saveForm();
    expect(component.errorMessage()).toBe('El nombre es obligatorio.');
  });
});
