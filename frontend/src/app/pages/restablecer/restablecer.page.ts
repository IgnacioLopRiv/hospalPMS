import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { IonButton, IonContent, IonInput, IonItem } from '@ionic/angular/standalone';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-restablecer',
  templateUrl: './restablecer.page.html',
  styleUrls: ['./restablecer.page.scss'],
  imports: [FormsModule, RouterLink, IonContent, IonItem, IonInput, IonButton],
})
export class RestablecerPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly token = this.route.snapshot.queryParamMap.get('token') ?? '';
  password = '';
  confirmPassword = '';
  message = '';
  success = false;
  submitting = false;

  async savePassword(): Promise<void> {
    if (this.submitting) {
      return;
    }

    this.submitting = true;
    const result = await this.auth.resetPassword(this.token, this.password, this.confirmPassword);
    this.submitting = false;
    this.success = result.ok;
    this.message = result.message;

    if (result.ok) {
      this.router.navigate(['/home']);
    }
  }
}
