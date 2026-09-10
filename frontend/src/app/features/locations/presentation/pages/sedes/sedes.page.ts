import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent, IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { businessOutline, chevronForwardOutline, locationOutline } from 'ionicons/icons';
import { Sede, SedeService } from '../../../application/sede.service';

@Component({
  selector: 'app-sedes',
  templateUrl: './sedes.page.html',
  styleUrls: ['./sedes.page.scss'],
  imports: [IonContent, IonIcon],
})
export class SedesPage {
  private readonly router = inject(Router);
  private readonly sedeService = inject(SedeService);

  readonly sedes = this.sedeService.sedes;

  constructor() {
    addIcons({ businessOutline, chevronForwardOutline, locationOutline });
  }

  selectSede(sede: Sede): void {
    this.sedeService.selectSede(sede);
    this.router.navigate(['/main']);
  }
}