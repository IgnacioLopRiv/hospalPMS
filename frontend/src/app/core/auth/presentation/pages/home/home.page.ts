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

    // Si el usuario es staff con sede asignada, ir directo a la sede
    const loggedUser = this.auth.currentUser();
    if (loggedUser?.role === 'staff' && loggedUser.sedeId) {
      const sede = this.sedeService.sedes().find((s) => s.id === loggedUser.sedeId);
      if (sede) {
        this.sedeService.selectSede(sede);
        this.router.navigate(['/guests-view']);
        return;
      }
    }

    this.router.navigate(['/sedes']);
  }

  goRecover(): void {
    this.router.navigate(['/recuperar'], {
      queryParams: this.email.trim() ? { email: this.email.trim() } : undefined,
    });
  }
}