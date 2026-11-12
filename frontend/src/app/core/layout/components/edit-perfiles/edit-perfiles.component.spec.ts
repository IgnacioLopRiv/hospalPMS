import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { IonicModule } from '@ionic/angular';
import { LocationsRepository } from '../../../../features/locations/domain/locations.repository';
import { createLocationsRepositoryStub } from '../../../../features/locations/domain/testing/locations.repository.stub';

import { AuthService } from '../../../auth/application/auth.service';
import { StoredUser } from '../../../auth/domain/auth.roles';
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

  afterEach(async () => {
    const modals = Array.from(document.querySelectorAll('ion-modal'));
    await Promise.all(
      modals.map((modal) =>
        (modal as HTMLElement & { dismiss?: () => Promise<boolean> }).dismiss?.()
      )
    );
    fixture.destroy();
    document.querySelectorAll('ion-modal').forEach((modal) => modal.remove());
    (document.activeElement as HTMLElement | null)?.blur();
    document.body.classList.remove('modal-open', 'entry-modal-open');
  });

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

  it('crea personal de aseo exigiendo una sede asignada', async () => {
    const auth = TestBed.inject(AuthService);
    const addUser = spyOn(auth, 'addUser').and.resolveTo();
    component.openAdd();
    component.patchForm('name', 'Rosa Limpieza');
    component.patchForm('email', 'rosa@hotel.cl');
    component.patchForm('password', 'secreto123');
    component.patchForm('role', 'aseo');

    expect(component.requiresSede()).toBeTrue();
    await component.saveForm();
    expect(component.errorMessage()).toBe('Debes asignar una sede a este usuario.');
    expect(addUser).not.toHaveBeenCalled();

    component.patchForm('sedeId', '2');
    await component.saveForm();
    expect(addUser).toHaveBeenCalledWith(jasmine.objectContaining({ role: 'aseo', sedeId: 2 }));
    expect(component.roles).toContain('aseo');
    expect(component.roleOptionLabel('aseo')).toBe('Personal de aseo');
  });

  it('creates an admin user sending the admin role', async () => {
    const auth = TestBed.inject(AuthService);
    const addUser = spyOn(auth, 'addUser').and.resolveTo();
    component.openAdd();
    component.patchForm('name', 'Jorge Admin');
    component.patchForm('email', 'jorge@hotel.cl');
    component.patchForm('password', 'secreto123');
    component.patchForm('role', 'admin');

    await component.saveForm();

    expect(addUser).toHaveBeenCalledWith(jasmine.objectContaining({ role: 'admin', email: 'jorge@hotel.cl' }));
    expect(component.successMessage()).toBe('Usuario agregado correctamente.');
    expect(component.formMode()).toBeNull();
  });

  it('saves edits of a user loaded from the backend (without password) including the new role', async () => {
    const auth = TestBed.inject(AuthService);
    const updateUser = spyOn(auth, 'updateUser').and.resolveTo();
    component.openEdit({ id: 5, name: 'Carlos Recepción', email: 'carlos@hotel.cl', role: 'staff', sedeId: 2 } as StoredUser);
    expect(component.form().password).toBe('');

    component.patchForm('role', 'admin');
    await component.saveForm();

    expect(updateUser).toHaveBeenCalledWith(5, { name: 'Carlos Recepción', email: 'carlos@hotel.cl', role: 'admin', sedeId: undefined });
    expect(component.successMessage()).toBe('Usuario actualizado correctamente.');
    expect(component.formMode()).toBeNull();
  });

  it('keeps the form open and shows the backend error when the update fails', async () => {
    const auth = TestBed.inject(AuthService);
    spyOn(auth, 'updateUser').and.rejectWith({ error: { message: 'Ya existe un funcionario con ese email.' } });
    component.openEdit({ id: 5, name: 'Carlos Recepción', email: 'carlos@hotel.cl', role: 'staff', sedeId: 2 } as StoredUser);

    await component.saveForm();

    expect(component.errorMessage()).toBe('Ya existe un funcionario con ese email.');
    expect(component.successMessage()).toBe('');
    expect(component.formMode()).toBe('edit');
    expect(component.saving()).toBeFalse();
  });

  it('shows the selected role in the role selector', async () => {
    fixture.componentRef.setInput('isOpen', true);
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 300));
    component.openAdd();
    fixture.detectChanges();
    await fixture.whenStable();

    const select = document.querySelector('.edit-perfiles-modal select') as HTMLSelectElement | null;
    expect(select).not.toBeNull();
    expect(select!.value).toBe('staff');

    component.patchForm('role', 'admin');
    fixture.detectChanges();
    expect(select!.value).toBe('admin');
  });
});
