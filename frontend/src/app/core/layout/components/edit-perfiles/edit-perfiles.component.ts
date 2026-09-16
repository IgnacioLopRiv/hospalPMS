import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonButton, IonIcon, IonInput, IonItem, IonModal, IonSelect, IonSelectOption } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { addOutline, briefcaseOutline, closeOutline, createOutline, peopleOutline, shieldCheckmarkOutline, trashOutline } from 'ionicons/icons';
import { AuthService } from '../../../auth/application/auth.service';
import { StoredUser, UserRole } from '../../../auth/domain/auth.roles';

type FormMode = 'add' | 'edit' | null;

interface UserForm {
  name: string;
  email: string;
  password: string;
  role: UserRole;
}

@Component({
  selector: 'app-edit-perfiles',
  templateUrl: './edit-perfiles.component.html',
  styleUrls: ['./edit-perfiles.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonModal,
    IonButton,
    IonItem,
    IonInput,
    IonSelect,
    IonSelectOption,
    IonIcon,
  ],
})
export class EditPerfilesComponent {
  private readonly auth = inject(AuthService);

  readonly isOpen = input(false);
  readonly closed = output<void>();

  readonly roles: UserRole[] = ['admin', 'staff'];

  readonly formMode = signal<FormMode>(null);
  readonly editingId = signal<number | null>(null);
  readonly errorMessage = signal('');
  readonly deleteConfirmId = signal<number | null>(null);
  readonly successMessage = signal('');

  readonly form = signal<UserForm>({
    name: '',
    email: '',
    password: '',
    role: 'staff',
  });

  /** Usuarios agrupados por rol */
  readonly admins = computed(() => this.auth.users().filter((u) => u.role === 'admin'));
  readonly staff = computed(() => this.auth.users().filter((u) => u.role === 'staff'));

  constructor() {
    addIcons({
      addOutline,
      closeOutline,
      createOutline,
      trashOutline,
      peopleOutline,
      shieldCheckmarkOutline,
      briefcaseOutline,
    });

    effect(() => {
      if (this.isOpen()) {
        // Asegura que los usuarios estén cargados al abrir el banner
        this.auth.ensureUsersLoaded();
        this.resetState();
      }
    });
  }

  // ── Formulario ────────────────────────────────────────────────────────────

  openAdd(): void {
    this.form.set({ name: '', email: '', password: '', role: 'staff' });
    this.editingId.set(null);
    this.formMode.set('add');
    this.errorMessage.set('');
    this.deleteConfirmId.set(null);
  }

  openEdit(user: StoredUser): void {
    this.form.set({
      name: user.name,
      email: user.email,
      password: user.password,
      role: user.role,
    });
    this.editingId.set(user.id);
    this.formMode.set('edit');
    this.errorMessage.set('');
    this.deleteConfirmId.set(null);
  }

  cancelForm(): void {
    this.formMode.set(null);
    this.editingId.set(null);
    this.errorMessage.set('');
  }

  saveForm(): void {
    const f = this.form();
    const name = f.name.trim();
    const email = f.email.trim().toLowerCase();
    const password = f.password.trim();

    if (!name) {
      this.errorMessage.set('El nombre es obligatorio.');
      return;
    }
    if (!email) {
      this.errorMessage.set('El correo es obligatorio.');
      return;
    }
    if (!this.isValidEmail(email)) {
      this.errorMessage.set('El formato del correo no es válido.');
      return;
    }
    if (this.formMode() === 'add' && !password) {
      this.errorMessage.set('La contraseña es obligatoria.');
      return;
    }
    if (password && password.length < 6) {
      this.errorMessage.set('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    if (this.formMode() === 'add') {
      this.auth.addUser({ name, email, password, role: f.role });
      this.showSuccess('Usuario agregado correctamente.');
    } else {
      const patch: Partial<StoredUser> = { name, email, role: f.role };
      if (password) patch['password'] = password;
      this.auth.updateUser(this.editingId()!, patch);
      this.showSuccess('Usuario actualizado correctamente.');
    }

    this.cancelForm();
  }

  patchForm(field: keyof UserForm, value: string): void {
    this.form.update((f) => ({ ...f, [field]: value }));
  }

  // ── Eliminación ───────────────────────────────────────────────────────────

  requestDelete(id: number): void {
    this.deleteConfirmId.set(id);
    this.formMode.set(null);
    this.errorMessage.set('');
  }

  confirmDelete(id: number): void {
    const result = this.auth.deleteUser(id);
    if (!result.ok) {
      this.errorMessage.set(result.message ?? 'No se pudo eliminar el usuario.');
    } else {
      this.showSuccess('Usuario eliminado correctamente.');
    }
    this.deleteConfirmId.set(null);
  }

  cancelDelete(): void {
    this.deleteConfirmId.set(null);
  }

  // ── Cierre ────────────────────────────────────────────────────────────────

  dismiss(): void {
    this.resetState();
    this.closed.emit();
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  isCurrentUser(id: number): boolean {
    return this.auth.currentUser()?.id === id;
  }

  private resetState(): void {
    this.formMode.set(null);
    this.editingId.set(null);
    this.errorMessage.set('');
    this.deleteConfirmId.set(null);
    this.successMessage.set('');
  }

  private showSuccess(msg: string): void {
    this.successMessage.set(msg);
    setTimeout(() => this.successMessage.set(''), 3000);
  }

  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }
}
