import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { HeaderComponent } from './components/header/header.component';
import { SidebarComponent } from './components/sidebar/sidebar.component';

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
  }
}