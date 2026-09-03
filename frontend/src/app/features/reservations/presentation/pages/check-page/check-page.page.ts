import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SedeService } from '../../../../locations/application/sede.service';

@Component({
  selector: 'app-check-page',
  templateUrl: './check-page.page.html',
  styleUrls: ['./check-page.page.scss'],
  standalone: true,
  imports: [CommonModule],
})
export class CheckPagePage {
  private readonly sedeService = inject(SedeService);

  readonly sede = this.sedeService.selectedSede;
}