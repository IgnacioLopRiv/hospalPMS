import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { HeaderComponent } from './core/layout/components/header/header.component';
import { SidebarComponent } from './core/layout/components/sidebar/sidebar.component';
import { HostalService } from './features/huespedes/application/hostal.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonApp,
    IonRouterOutlet,
    HeaderComponent,
    SidebarComponent
  ],
})
export class AppComponent {
  private readonly router = inject(Router);
  private readonly hostalService = inject(HostalService);

  private readonly excludedRoutes = [
    '/home',
    '/sedes',
  ];

  readonly showLayout = signal<boolean>(true);

  constructor() {
    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event: NavigationEnd) => {
        const currentUrl = event.urlAfterRedirects.split('?')[0];
        const isExcluded = this.excludedRoutes.some(
          route => currentUrl === route || currentUrl.startsWith(`${route}/`)
        );
        this.showLayout.set(!isExcluded);
      });

    // One-time cleanup of legacy (non-sede-scoped) storage keys
    this.hostalService.clearLegacyData();
  }
}