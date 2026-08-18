import { Component } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonButton,
  IonContent,
  IonInput,
  IonItem,
  IonLabel,
  IonSegment,
  IonSegmentButton,
} from '@ionic/angular/standalone';
import { FormsModule } from '@angular/forms';

type AuthMode = 'login' | 'register';

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
  authMode: AuthMode = 'login';
  email = '';
  password = '';

  constructor(private readonly router: Router) {}

  continue(): void {
    this.router.navigate(['/sedes']);
  }
}
