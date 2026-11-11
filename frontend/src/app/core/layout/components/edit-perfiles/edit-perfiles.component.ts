import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonIcon, IonModal } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  addOutline,
  alertCircleOutline,
  briefcaseOutline,
  businessOutline,
  checkmarkOutline,
  closeOutline,
  createOutline,
  lockClosedOutline,
  mailOutline,
  peopleOutline,
  personAddOutline,
  personOutline,
  shieldCheckmarkOutline,
  trashOutline,
} from 'ionicons/icons';
import { AuthService } from '../../../auth/application/auth.service';
import { StoredUser, UserRole } from '../../../auth/domain/auth.roles';
import { SedeService } from '../../../../features/locations/application/sede.service';

type FormMode = 'add' | 'edit' | null;

interface UserForm {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  /** Solo 'staff' */
  sedeId: number | null;
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
    IonIcon,
  ],
})
export class EditPerfilesComponent {
  private readonly auth = inject(AuthService);
  private readonly sedeService = inject(SedeService);

  readonly isOpen = input(false);
  readonly closed = output<void>();

  readonly roles: UserRole[] = ['admin', 'staff'];

  readonly formMode = signal<FormMode>(null);
  readonly editingId = signal<number | null>(null);
  readonly errorMessage = signal('');
  readonly deleteConfirmId = signal<number | null>(null);
  readonly successMessage = signal('');
  readonly saving = signal(false);

  readonly form = signal<UserForm>({
    name: '',
    email: '',
    password: '',
    role: 'staff',
    sedeId: null,
  });

  /** Lista de sedes disponibles para asignar al staff */
  readonly sedes = this.sedeService.sedes;

  /** True cuando el rol seleccionado requiere elegir sede */
  readonly requiresSede = computed(() => this.form().role === 'staff');

  readonly admins = computed(() => this.auth.users().filter((u) => u.role === 'admin'));
  readonly staff = computed(() => this.auth.users().filter((u) => u.role === 'staff'));

  constructor() {
    addIcons({
      addOutline,
      alertCircleOutline,
      briefcaseOutline,
      businessOutline,
      checkmarkOutline,
      closeOutline,
      createOutline,
      lockClosedOutline,
      mailOutline,
      peopleOutline,
      personAddOutline,
      personOutline,
      shieldCheckmarkOutline,
      trashOutline,
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
    this.form.set({ name: '', email: '', password: '', role: 'staff', sedeId: null });
    this.editingId.set(null);
    this.formMode.set('add');
    this.errorMessage.set('');
    this.deleteConfirmId.set(null);
  }

  openEdit(user: StoredUser): void {
    this.form.set({
      name: user.name,
      email: user.email,
      // El backend nunca devuelve la contraseña; vacía = mantener la actual.
      password: '',
      role: user.role,
      sedeId: user.sedeId ?? null,
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

  async saveForm(): Promise<void> {
    if (this.saving()) return;
    const f = this.form();
    const name = f.name.trim();
    const email = f.email.trim().toLowerCase();
    const password = (f.password ?? '').trim();

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
    if (f.role === 'staff' && !f.sedeId) {
      this.errorMessage.set('Debes asignar una sede al personal (staff).');
      return;
    }

    const sedeId = f.role === 'staff' ? f.sedeId ?? undefined : undefined;

    this.errorMessage.set('');
    this.saving.set(true);
    try {
      if (this.formMode() === 'add') {
        await this.auth.addUser({ name, email, password, role: f.role, sedeId });
        this.showSuccess('Usuario agregado correctamente.');
      } else {
        const patch: Partial<StoredUser> = { name, email, role: f.role, sedeId };
        if (password) patch['password'] = password;
        await this.auth.updateUser(this.editingId()!, patch);
        this.showSuccess('Usuario actualizado correctamente.');
      }
      this.cancelForm();
    } catch (error: any) {
      this.errorMessage.set(
        error?.error?.message || 'No se pudieron guardar los cambios. Inténtalo de nuevo.',
      );
    } finally {
      this.saving.set(false);
    }
  }

  patchForm(field: keyof UserForm, value: string | number | null): void {
    let finalValue = value;
    if (field === 'sedeId' && value !== null && value !== '') {
      finalValue = Number(value);
    }
    this.form.update((f) => {
      const updated = { ...f, [field]: finalValue };
      // Si cambia el rol a admin, limpiar la sede asignada
      if (field === 'role' && value === 'admin') {
        updated.sedeId = null;
      }
      return updated;
    });
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

  /** Devuelve el nombre de la sede asignada, o un texto de fallback */
  getSedeNombre(sedeId: number): string {
    const sede = this.sedes().find((s) => s.id === sedeId);
    return sede ? `${sede.nombre} — ${sede.ciudad}` : 'Sede desconocida';
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
