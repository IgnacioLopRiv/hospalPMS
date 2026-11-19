import { DestroyRef, Injectable, computed, effect, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { AuthService } from '../../../core/auth/application/auth.service';
import { SedeService } from '../../locations/application/sede.service';

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

/**
 * RF-20: alertas de Recepción (GET /alertas). Se recargan al cambiar de sede y cada 3 minutos.
 * Solo para usuarios con permiso de Recepción (admin y staff).
 */
@Injectable({ providedIn: 'root' })
export class AlertasService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly sedeService = inject(SedeService);

  readonly alertas = signal<Alerta[]>([]);
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
        this.alertas.set([]);
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
      this.alertas.set(rows);
      this.error.set('');
    } catch {
      this.error.set('No se pudieron cargar las alertas.');
    } finally {
      this.loading.set(false);
    }
  }
}
