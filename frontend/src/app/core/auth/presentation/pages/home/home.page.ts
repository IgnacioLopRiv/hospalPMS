import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import {
  IonButton,
  IonContent,
  IonInput,
  IonItem,
  IonLabel,
  IonSegment,
  IonSegmentButton,
} from '@ionic/angular/standalone';
import { AuthService } from '../../../application/auth.service';

@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
  imports: [
    FormsModule,
    IonContent,
    IonSegment,
    IonSegmentButton,
    IonLabel,
    IonItem,
    IonInput,
    IonButton,
  ],
})
export class HomePage {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);

  email = '';
  password = '';
  errorMessage = '';
  showRecover = false;
  submitting = false;

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

    this.router.navigate(['/sedes']);
  }

  goRecover(): void {
    this.router.navigate(['/recuperar'], {
      queryParams: this.email.trim() ? { email: this.email.trim() } : undefined,
    });
  }
}
