import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent, IonHeader } from '@ionic/angular/standalone';
import { SedeService } from '../../../../locations/application/sede.service';

@Component({
  selector: 'app-main',
  templateUrl: './main.page.html',
  styleUrls: ['./main.page.scss'],
  imports: [IonContent],
})
export class MainPage {
  private readonly router = inject(Router);
  private readonly sedeService = inject(SedeService);

  readonly sede = this.sedeService.selectedSede;

  constructor() {
    if (!this.sedeService.selectedSede()) {
      this.router.navigate(['/sedes']);
    }
  }
}
