import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SedeService } from '../../../../locations/application/sede.service';

@Component({
  selector: 'app-reservas',
  templateUrl: './reservas.page.html',
  styleUrls: ['./reservas.page.scss'],
  standalone: true,
  imports: [CommonModule],
})
export class ReservasPage {
  private readonly sedeService = inject(SedeService);

  readonly sede = this.sedeService.selectedSede;
}