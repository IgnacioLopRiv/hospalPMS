import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonContent, IonIcon } from '@ionic/angular/standalone';
import { firstValueFrom } from 'rxjs';
import { addIcons } from 'ionicons';
import {
  bedOutline,
  calendarOutline,
  cashOutline,
  trendingUpOutline,
} from 'ionicons/icons';
import { SedeService } from '../../../../locations/application/sede.service';
import { ReportesRepository, ResumenReportes } from '../../../domain/reportes.repository';

@Component({
  selector: 'app-reportes',
  templateUrl: './reportes.page.html',
  styleUrls: ['./reportes.page.scss'],
  standalone: true,
  imports: [IonContent, CommonModule, IonIcon]
})
export class ReportesPage implements OnInit {
  private readonly sedeService = inject(SedeService);
  private readonly reportesRepository = inject(ReportesRepository);

  readonly sede = this.sedeService.selectedSede;
  readonly resumen = signal<ResumenReportes | null>(null);
  readonly error = signal('');

  async ngOnInit(): Promise<void> {
    await this.loadResumen();
  }

  async loadResumen(): Promise<void> {
    const sedeId = this.sede()?.id;
    if (sedeId === undefined) {
      this.error.set('Selecciona una sede para ver los reportes.');
      return;
    }
    try {
      this.error.set('');
      this.resumen.set(await firstValueFrom(this.reportesRepository.getResumen(sedeId)));
    } catch (error) {
      this.resumen.set(null);
      this.error.set(error instanceof Error ? error.message : 'No se pudieron cargar los reportes.');
    }
  }

  formatMoney(value: number | null | undefined): string {
    return `$${(value ?? 0).toLocaleString('es-CL')}`;
  }

  formatMonth(dateIso: string | null | undefined): string {
    if (!dateIso) return '';
    const date = new Date(dateIso);
    const month = date.toLocaleString('es-CL', { month: 'long' });
    return `${month.charAt(0).toUpperCase()}${month.slice(1)} ${date.getFullYear()}`;
  }
}
