import { Injectable, signal } from '@angular/core';

/** Estado compartido del layout (menú lateral en pantallas pequeñas). */
@Injectable({ providedIn: 'root' })
export class LayoutService {
  readonly sidebarOpen = signal(false);

  toggleSidebar(): void {
    this.sidebarOpen.update((open) => !open);
  }

  closeSidebar(): void {
    this.sidebarOpen.set(false);
  }
}
