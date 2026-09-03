import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SedeService } from '../../../application/sede.service';

@Component({
  selector: 'app-habitaciones',
  templateUrl: './habitaciones.page.html',
  styleUrls: ['./habitaciones.page.scss'],
  standalone: true,
  imports: [CommonModule],
})
export class HabitacionesPage {
  private readonly sedeService = inject(SedeService);

  readonly sede = this.sedeService.selectedSede;
  readonly habitaciones = this.sedeService.habitaciones;
}