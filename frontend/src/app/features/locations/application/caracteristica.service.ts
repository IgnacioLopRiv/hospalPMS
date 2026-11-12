import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Caracteristica } from '../../../shared/domain/hostal.model';
import { CaracteristicaRepository } from '../domain/caracteristica.repository';
import { SedeService } from './sede.service';

export type CaracteristicaResult<T = void> =
  | { ok: true; value: T }
  | { ok: false; message: string };

/** Ícono usado cuando una característica no tiene uno propio. */
export const CARACTERISTICA_ICONO_DEFAULT = 'checkmark-circle-outline';

@Injectable({ providedIn: 'root' })
export class CaracteristicaService {
  private readonly repository = inject(CaracteristicaRepository);
  private readonly sedeService = inject(SedeService);

  readonly caracteristicas = signal<Caracteristica[]>([]);
  readonly loading = signal(false);
  readonly loadError = signal('');

  readonly byId = computed(() => new Map(this.caracteristicas().map((c) => [c.id, c])));

  async load(): Promise<void> {
    this.loading.set(true);
    this.loadError.set('');
    try {
      const items = await firstValueFrom(this.repository.list());
      this.caracteristicas.set(this.sort(items));
    } catch {
      this.loadError.set('No se pudieron cargar las características.');
    } finally {
      this.loading.set(false);
    }
  }

  async create(nombre: string): Promise<CaracteristicaResult<Caracteristica>> {
    const clean = nombre.trim();
    if (!clean) {
      return { ok: false, message: 'Escribe el nombre de la característica.' };
    }
    const normalized = clean.toLocaleLowerCase('es');
    if (this.caracteristicas().some((c) => c.nombre.toLocaleLowerCase('es') === normalized)) {
      return { ok: false, message: 'Ya existe una característica con ese nombre.' };
    }
    try {
      const created = await firstValueFrom(this.repository.create({ nombre: clean }));
      this.caracteristicas.update((list) => this.sort([...list, created]));
      return { ok: true, value: created };
    } catch (error) {
      return { ok: false, message: this.errorMessage(error, 'No se pudo crear la característica.') };
    }
  }

  async remove(id: number): Promise<CaracteristicaResult> {
    try {
      await firstValueFrom(this.repository.delete(id));
      this.caracteristicas.update((list) => list.filter((c) => c.id !== id));
      this.sedeService.removeCaracteristicaFromTipologias(id);
      return { ok: true, value: undefined };
    } catch (error) {
      return { ok: false, message: this.errorMessage(error, 'No se pudo eliminar la característica.') };
    }
  }

  private sort(items: Caracteristica[]): Caracteristica[] {
    return [...items].sort((a, b) =>
      Number(b.predeterminada) - Number(a.predeterminada) || a.nombre.localeCompare(b.nombre, 'es'));
  }

  private errorMessage(error: unknown, fallback: string): string {
    if (error instanceof HttpErrorResponse && typeof error.error?.message === 'string') {
      return error.error.message;
    }
    return fallback;
  }
}
