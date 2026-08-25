import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { IonButton } from '@ionic/angular/standalone';
import { AuthService } from '../../services/auth.service';
import { SedeService } from '../../services/sede.service';

@Component({
  selector: 'app-sidebar',
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.scss'],
  imports: [IonButton, RouterLink, RouterLinkActive],
})
export class SidebarComponent {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly sedeService = inject(SedeService);

  readonly canViewReports = this.auth.canViewReports;

  logout(): void {
    this.auth.logout();
    this.sedeService.clearSede();
    this.router.navigate(['/home']);
  }
}
