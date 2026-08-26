import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent, IonIcon, IonItem, IonLabel, IonList } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { businessOutline, chevronForwardOutline } from 'ionicons/icons';
import { Sede, SedeService } from '../../services/sede.service';

@Component({
  selector: 'app-sedes',
  templateUrl: './sedes.page.html',
  styleUrls: ['./sedes.page.scss'],
  imports: [IonContent, IonList, IonItem, IonLabel, IonIcon],
})
export class SedesPage {
  private readonly router = inject(Router);
  private readonly sedeService = inject(SedeService);

  readonly sedes = this.sedeService.sedes;

  constructor() {
    addIcons({ businessOutline, chevronForwardOutline });
  }

  selectSede(sede: Sede): void {
    this.sedeService.selectSede(sede);
    this.router.navigate(['/main']);
  }
}
