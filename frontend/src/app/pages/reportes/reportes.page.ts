import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonHeader} from '@ionic/angular/standalone';
import { SedeService } from '../../services/sede.service';
import { HeaderComponent } from '../../components/header/header.component';
import { SidebarComponent } from '../../components/sidebar/sidebar.component';


@Component({
  selector: 'app-reportes',
  templateUrl: './reportes.page.html',
  styleUrls: ['./reportes.page.scss'],
  standalone: true,
  imports: [IonContent, IonHeader, CommonModule, FormsModule, HeaderComponent, SidebarComponent]
})
export class ReportesPage {
  private readonly router = inject(Router);
  private readonly sedeService = inject(SedeService);

  readonly sede = this.sedeService.selectedSede;
  constructor() {
    if (!this.sedeService.selectedSede()) {
      this.router.navigate(['/sedes']);
    }
  }

}
