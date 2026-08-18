import { Component, computed, inject } from '@angular/core';
import { IonButton, IonToolbar } from '@ionic/angular/standalone';
import { SedeService } from '../../services/sede.service';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss'],
  imports: [IonToolbar, IonButton],
})
export class HeaderComponent {
  private readonly sedeService = inject(SedeService);

  readonly sedeLabel = computed(() => {
    const sede = this.sedeService.selectedSede();
    return sede ? `${sede.nombre} · ${sede.ciudad}` : 'Hospal PMS';
  });
}
