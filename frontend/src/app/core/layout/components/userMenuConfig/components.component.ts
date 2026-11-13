import { EscapeCloseDirective } from '../../../../shared/presentation/modal-portal/escape-close.directive';
import { Component, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonButton,
  IonInput,
  IonItem,
  IonModal,
  IonSelect,
  IonSelectOption,
} from '@ionic/angular/standalone';
import { AuthService } from '../../../auth/application/auth.service';
import { AuthUser, UserRole } from '../../../auth/domain/auth.roles';

@Component({
  selector: 'app-user-menu-config',
  templateUrl: './components.component.html',
  styleUrls: ['./components.component.scss'],
  standalone: true,
  imports: [EscapeCloseDirective, 
    CommonModule,
    FormsModule,
    IonModal,
    IonButton,
    IonItem,
    IonInput,
    IonSelect,
    IonSelectOption,
  ],
})
export class UserMenuConfigComponent {
  private readonly auth = inject(AuthService);

  readonly isOpen = input(false);
  readonly closed = output<void>();

  readonly roles: UserRole[] = ['admin', 'staff'];
  readonly name = signal('');
  readonly email = signal('');
  readonly role = signal<UserRole>('staff');
  readonly errorMessage = signal('');

  loadDraft(): void {
    const user = this.auth.currentUser();
    if (user) {
      this.name.set(user.name);
      this.email.set(user.email);
      this.role.set(user.role);
    }
    this.errorMessage.set('');
  }

  dismiss(): void {
    this.closed.emit();
  }

  save(): void {
    const trimmedName = this.name().trim();
    const trimmedEmail = this.email().trim();

    if (!trimmedName) {
      this.errorMessage.set('El nombre es obligatorio.');
      return;
    }

    if (!trimmedEmail) {
      this.errorMessage.set('El correo es obligatorio.');
      return;
    }

    if (!this.isValidEmail(trimmedEmail)) {
      this.errorMessage.set('El formato del correo no es válido.');
      return;
    }

    const updatedUser: AuthUser = {
      id: this.auth.currentUser()!.id,
      name: trimmedName,
      email: trimmedEmail,
      role: this.role(),
    };

    this.auth.updateCurrentUser(updatedUser);
    this.dismiss();
  }

  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }
}
