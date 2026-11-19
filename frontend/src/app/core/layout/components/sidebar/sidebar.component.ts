import { ChangeDetectorRef, Component, ElementRef, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  peopleOutline,
  bedOutline,
  calendarOutline,
  swapHorizontalOutline,
  barChartOutline,
  cashOutline,
  logOutOutline,
  cubeOutline,
  closeOutline,
} from 'ionicons/icons';

import { AuthService } from '../../../auth/application/auth.service';
import { ROLE_LABELS } from '../../../auth/domain/auth.roles';
import { SedeService } from '../../../../features/locations/application/sede.service';

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
  ],
})
export class SidebarComponent {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly sedeService = inject(SedeService);
  private readonly changeDetector = inject(ChangeDetectorRef);

  @ViewChild('logoutDialog') logoutDialog?: ElementRef<HTMLDialogElement>;
  isLogoutDialogOpen = false;

  readonly currentUser = this.auth.currentUser;
  readonly canViewReports = this.auth.canViewReports;
  readonly canUseFrontDesk = this.auth.canUseFrontDesk;
  readonly canViewRooms = this.auth.canViewRooms;
  readonly canViewInventory = this.auth.canViewInventory;

  constructor() {
    addIcons({
      peopleOutline,
      bedOutline,
      calendarOutline,
      swapHorizontalOutline,
      barChartOutline,
      cashOutline,
      logOutOutline,
      cubeOutline,
      closeOutline,
    });
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
    return user ? ROLE_LABELS[user.role] ?? 'Personal' : '';
  }

  confirmLogout(): void {
    this.isLogoutDialogOpen = true;
    this.changeDetector.detectChanges();
    const dialog = this.logoutDialog?.nativeElement;
    if (dialog && !dialog.open) {
      dialog.showModal();
    }
  }

  cancelLogout(): void {
    const dialog = this.logoutDialog?.nativeElement;
    if (dialog?.open) {
      dialog.close();
    }
    this.isLogoutDialogOpen = false;
  }

  onLogoutDialogCancel(event: Event): void {
    event.preventDefault();
    this.cancelLogout();
  }

  confirmLogoutAction(): void {
    this.cancelLogout();
    this.logout();
  }

  private logout(): void {
    this.auth.logout();
    this.sedeService.clearSede();
    this.router.navigate(['/home']);
  }
}