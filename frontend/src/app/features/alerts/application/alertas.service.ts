import { DestroyRef, Injectable, computed, effect, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { AuthService } from '../../../core/auth/application/auth.service';
import { SedeService } from '../../locations/application/sede.service';
import { StorageService } from '../../../shared/infrastructure/storage.service';

export type TipoAlerta = 'LLEGADA_ATRASADA' | 'SALIDA_ATRASADA' | 'SALDO_PENDIENTE' | 'POSIBLE_DUPLICADO' | 'STOCK_BAJO';

export interface Alerta {
  id: string;
  tipo: TipoAlerta;
  severidad: 'alta' | 'media';
  titulo: string;
  detalle: string;
  fecha: string;
  reservaId?: number;
  huespedIds?: number[];
}

/** Cada cuánto se vuelven a consultar las alertas mientras hay sesión. */
const REFRESH_MS = 3 * 60 * 1000;
const VISTAS_KEY = 'hospal.alertas.vistas';

/**
 * RF-20: alertas de Recepción (GET /alertas). Se recargan al cambiar de sede y cada 3 minutos.
 * Solo para usuarios con permiso de Recepción (admin y staff).
 */
@Injectable({ providedIn: 'root' })
export class AlertasService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly sedeService = inject(SedeService);
  private readonly storage = inject(StorageService);

  /** Todas las alertas que devuelve el backend. */
  private readonly todas = signal<Alerta[]>([]);
  /** IDs de alertas marcadas como vistas (persistidas en este navegador). */
  private readonly vistas = signal<Set<string>>(new Set(this.storage.getJson<string[]>(VISTAS_KEY) ?? []));
  /** Alertas visibles: excluye las marcadas como vistas. */
  readonly alertas = computed(() => this.todas().filter((a) => !this.vistas().has(a.id)));
  readonly loading = signal(false);
  readonly error = signal('');
  readonly enabled = this.auth.canUseFrontDesk;
  readonly count = computed(() => this.alertas().length);
  readonly hasHigh = computed(() => this.alertas().some((a) => a.severidad === 'alta'));

  constructor() {
    effect(() => {
      const sedeId = this.sedeService.selectedSede()?.id;
      if (this.enabled() && sedeId) {
        void this.refresh(sedeId);
      } else {
        this.todas.set([]);
      }
    });

    const timer = setInterval(() => void this.refresh(), REFRESH_MS);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  async refresh(sedeId = this.sedeService.selectedSede()?.id): Promise<void> {
    if (!this.enabled() || !sedeId) return;
    this.loading.set(true);
    try {
      const rows = await firstValueFrom(
        this.http.get<Alerta[]>(`${environment.apiUrl}/alertas`, {
          params: { sedeId },
        }),
      );
      this.todas.set(rows);
      this.podarVistas(rows);
      this.error.set('');
    } catch {
      this.error.set('No se pudieron cargar las alertas.');
    } finally {
      this.loading.set(false);
    }
  }

  /** Marca una alerta como vista para que deje de mostrarse. */
  marcarVista(id: string): void {
    const next = new Set(this.vistas());
    next.add(id);
    this.vistas.set(next);
    this.guardarVistas(next);
  }

  /** Marca todas las alertas visibles como vistas. */
  marcarTodasVistas(): void {
    const next = new Set(this.vistas());
    this.alertas().forEach((a) => next.add(a.id));
    this.vistas.set(next);
    this.guardarVistas(next);
  }

  /** Olvida IDs vistos que ya no existen en el backend (la alerta se resolvió). */
  private podarVistas(rows: Alerta[]): void {
    const vigentes = new Set(rows.map((a) => a.id));
    const next = new Set([...this.vistas()].filter((id) => vigentes.has(id)));
    if (next.size !== this.vistas().size) {
      this.vistas.set(next);
      this.guardarVistas(next);
    }
  }

  private guardarVistas(ids: Set<string>): void {
    this.storage.setJson(VISTAS_KEY, [...ids]);
  }
}
