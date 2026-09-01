import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonHeader} from '@ionic/angular/standalone';
import { SedeService } from '../../../services/sede.service';

@Component({
  selector: 'app-reportes',
  templateUrl: './reportes.page.html',
  styleUrls: ['./reportes.page.scss'],
  standalone: true,
  imports: [IonContent, IonHeader, CommonModule, FormsModule]
})
export class ReportesPage {
  private readonly router = inject(Router);
  private readonly sedeService = inject(SedeService);

  readonly sede = this.sedeService.selectedSede;
}
