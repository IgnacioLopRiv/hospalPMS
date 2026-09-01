import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { IonButton, IonContent, IonInput, IonItem } from '@ionic/angular/standalone';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-recuperar',
  templateUrl: './recuperar.page.html',
  styleUrls: ['./recuperar.page.scss'],
  imports: [FormsModule, RouterLink, IonContent, IonItem, IonInput, IonButton],
})
export class RecuperarPage {
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);

  email = this.route.snapshot.queryParamMap.get('email') ?? '';
  message = '';
  success = false;
  submitting = false;

  async sendRecovery(): Promise<void> {
    if (this.submitting) {
      return;
    }

    this.submitting = true;
    this.message = '';
    const result = await this.auth.requestPasswordRecovery(this.email);
    this.submitting = false;
    this.success = result.ok;
    this.message = result.message;
  }
}
