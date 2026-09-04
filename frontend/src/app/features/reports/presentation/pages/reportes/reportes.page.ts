import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonContent, IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  bedOutline,
  calendarOutline,
  cashOutline,
  trendingUpOutline,
} from 'ionicons/icons';
import { SedeService } from '../../../../locations/application/sede.service';

@Component({
  selector: 'app-reportes',
  templateUrl: './reportes.page.html',
  styleUrls: ['./reportes.page.scss'],
  standalone: true,
  imports: [IonContent, CommonModule, IonIcon]
})
export class ReportesPage {
  private readonly sedeService = inject(SedeService);

  readonly sede = this.sedeService.selectedSede;

  constructor() {
    addIcons({ bedOutline, calendarOutline, cashOutline, trendingUpOutline });
  }
}
