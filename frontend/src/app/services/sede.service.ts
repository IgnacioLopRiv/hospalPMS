import { Injectable, signal } from '@angular/core';

export interface Sede {
  id: number;
  nombre: string;
  ciudad: string;
}

@Injectable({ providedIn: 'root' })
export class SedeService {
  readonly selectedSede = signal<Sede | null>(null);

  selectSede(sede: Sede): void {
    this.selectedSede.set(sede);
  }

  clearSede(): void {
    this.selectedSede.set(null);
  }
}
