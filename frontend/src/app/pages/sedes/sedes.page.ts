import { Component } from '@angular/core';
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
  readonly sedes: Sede[] = [
    { id: 1, nombre: 'Hotel Centro', ciudad: 'Santiago' },
    { id: 2, nombre: 'Hotel Playa', ciudad: 'Viña del Mar' },
    { id: 3, nombre: 'Hotel Montaña', ciudad: 'Pucón' },
  ];

  constructor(
    private readonly router: Router,
    private readonly sedeService: SedeService,
  ) {
    addIcons({ businessOutline, chevronForwardOutline });
  }

  selectSede(sede: Sede): void {
    this.sedeService.selectSede(sede);
    this.router.navigate(['/main']);
  }
}
