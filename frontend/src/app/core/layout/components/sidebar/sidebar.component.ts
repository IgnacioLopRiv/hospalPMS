import { Component, inject, signal } from '@angular/core';
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

import { AuthService } from '../../../auth/application/auth.service';
import { SedeService } from '../../../../features/locations/application/sede.service';
import { UserMenuConfigComponent } from '../userMenuConfig/components.component';

@Component({
  selector: 'app-sidebar',
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    RouterLinkActive,
    IonIcon,
    UserMenuConfigComponent,
  ],
})
export class SidebarComponent {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly sedeService = inject(SedeService);

  readonly currentUser = this.auth.currentUser;
  readonly canViewReports = this.auth.canViewReports;
  readonly userMenuOpen = signal(false);

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

  openUserMenu(): void {
    this.userMenuOpen.set(true);
  }

  closeUserMenu(): void {
    this.userMenuOpen.set(false);
  }

  getUserInitials(): string {
    const user = this.currentUser();
    if (!user) return '';
    return user.name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  }

  getUserRoleLabel(): string {
    const user = this.currentUser();
    return user?.role === 'admin' ? 'Administrador' : 'Personal';
  }

  logout(): void {
    this.auth.logout();
    this.sedeService.clearSede();
    this.router.navigate(['/home']);
  }
}