import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  businessOutline,
  peopleOutline,
  bedOutline,
  calendarOutline,
  swapHorizontalOutline,
  barChartOutline,
  logOutOutline,
  chevronDownOutline,
} from 'ionicons/icons';

import { AuthService } from '../../services/auth.service';
import { SedeService } from '../../services/sede.service';

@Component({
  selector: 'app-sidebar',
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.scss'],
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, IonIcon],
})
export class SidebarComponent {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly sedeService = inject(SedeService);

  readonly canViewReports = this.auth.canViewReports;

  constructor() {
    addIcons({
      businessOutline,
      peopleOutline,
      bedOutline,
      calendarOutline,
      swapHorizontalOutline,
      barChartOutline,
      logOutOutline,
      chevronDownOutline,
    });
  }

  logout(): void {
    this.auth.logout();
    this.sedeService.clearSede();
    this.router.navigate(['/home']);
  }
}