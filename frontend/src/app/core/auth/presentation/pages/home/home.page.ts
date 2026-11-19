import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { IonContent, IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  alertCircleOutline,
  businessOutline,
  chevronForwardOutline,
  lockClosedOutline,
  mailOutline,
} from 'ionicons/icons';
import { AuthService } from '../../../application/auth.service';
import { ROLES_WITH_SEDE } from '../../../domain/auth.roles';
import { SedeService } from '../../../../../features/locations/application/sede.service';

@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
  imports: [
    FormsModule,
    IonContent,
    IonIcon,
  ],
})
export class HomePage {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly sedeService = inject(SedeService);

  email = '';
  password = '';
  errorMessage = '';
  showRecover = false;
  submitting = false;

  constructor() {
    addIcons({
      businessOutline,
      chevronForwardOutline,
      mailOutline,
      lockClosedOutline,
      alertCircleOutline,
    });
  }

  async continue(): Promise<void> {
    if (this.submitting) {
      return;
    }

    this.submitting = true;
    this.errorMessage = '';
    this.showRecover = false;

    const result = await this.auth.login(this.email, this.password);
    this.submitting = false;

    if (!result.ok) {
      this.errorMessage = result.message ?? 'No se pudo iniciar sesión.';
      this.showRecover = result.error === 'email' || result.error === 'password';
      return;
    }

    // Con el token ya emitido, cargar las sedes (antes del login la API responde 401)
    await this.sedeService.reload();

    // Si el usuario trabaja en una sede asignada (staff o aseo), ir directo a ella
    const loggedUser = this.auth.currentUser();
    if (loggedUser && ROLES_WITH_SEDE.includes(loggedUser.role) && loggedUser.sedeId) {
      const sede = this.sedeService.sedes().find((s) => s.id === loggedUser.sedeId);
      if (sede) {
        this.sedeService.selectSede(sede);
        this.router.navigate([this.auth.homeRoute()]);
        return;
      }
    }

    // Aseo sin sede asignada no puede elegirla: igual entra a su página de inicio
    this.router.navigate([this.auth.can('changeSede') ? '/sedes' : this.auth.homeRoute()]);
  }

  goRecover(): void {
    this.router.navigate(['/recuperar'], {
      queryParams: this.email.trim() ? { email: this.email.trim() } : undefined,
    });
  }
}