import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent, IonHeader } from '@ionic/angular/standalone';
import { HeaderComponent } from '../../components/header/header.component';
import { SidebarComponent } from '../../components/sidebar/sidebar.component';
import { SedeService } from '../../services/sede.service';

@Component({
  selector: 'app-habitaciones',
  templateUrl: './habitaciones.page.html',
  styleUrls: ['./habitaciones.page.scss'],
  imports: [IonHeader, IonContent, HeaderComponent, SidebarComponent],
})
export class HabitacionesPage {
  private readonly router = inject(Router);
  private readonly sedeService = inject(SedeService);

  readonly sede = this.sedeService.selectedSede;

  constructor() {
    if (!this.sedeService.selectedSede()) {
      this.router.navigate(['/sedes']);
    }
  }
}
