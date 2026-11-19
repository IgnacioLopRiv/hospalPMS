import { Component, inject } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { alertCircleOutline, checkmarkCircleOutline } from 'ionicons/icons';
import { PosCobroService } from '../../application/pos-cobro.service';

/** Estado en vivo del cobro con tarjeta que se envió al terminal POS. */
@Component({
  selector: 'app-pos-cobro-estado',
  standalone: true,
  imports: [IonIcon, CurrencyPipe],
  template: `
    @if (cobro.etapa() !== 'inactivo') {
      <div class="pos-status" [class]="'pos-status ' + cobro.etapa()" role="status" aria-live="polite">
        @switch (cobro.etapa()) {
          @case ('aprobado') {
            <ion-icon name="checkmark-circle-outline" aria-hidden="true"></ion-icon>
          }
          @case ('fallido') {
            <ion-icon name="alert-circle-outline" aria-hidden="true"></ion-icon>
          }
          @default {
            <span class="spinner" aria-hidden="true"></span>
          }
        }
        <div class="pos-status-text">
          <strong>
            @switch (cobro.etapa()) {
              @case ('aprobado') { Pago aprobado }
              @case ('fallido') { El cobro no se completó }
              @default { Cobro en el terminal POS }
            }
            @if (cobro.transaccion(); as tx) {
              · {{ tx.monto | currency:'CLP':'symbol-narrow':'1.0-0' }}
            }
          </strong>
          <span>{{ cobro.mensaje() }}</span>
        </div>
        @if (cobro.puedeCancelar()) {
          <button type="button" class="pos-status-cancel" (click)="cobro.cancelar()">Cancelar cobro</button>
        }
      </div>
    }
  `,
  styles: [`
    .pos-status {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.85rem 1rem;
      border: 1px solid #bfdbfe;
      border-radius: 12px;
      background: #eff6ff;
      color: #1e3a8a;
    }
    .pos-status.aprobado { border-color: #bbf7d0; background: #f0fdf4; color: #166534; }
    .pos-status.fallido { border-color: #fecaca; background: #fef2f2; color: #991b1b; }
    .pos-status ion-icon { flex-shrink: 0; font-size: 1.4rem; }
    .pos-status-text { display: flex; flex: 1; flex-direction: column; gap: 0.15rem; min-width: 0; font-size: 0.82rem; line-height: 1.4; }
    .pos-status-text strong { font-size: 0.88rem; }
    .spinner {
      flex-shrink: 0;
      width: 20px;
      height: 20px;
      border: 2.5px solid #bfdbfe;
      border-top-color: #1e50d8;
      border-radius: 50%;
      animation: pos-spin 0.8s linear infinite;
    }
    .pos-status-cancel {
      flex-shrink: 0;
      padding: 0.45rem 0.8rem;
      border: 1px solid #fecaca;
      border-radius: 8px;
      background: #ffffff;
      color: #b91c1c;
      font: inherit;
      font-size: 0.78rem;
      font-weight: 600;
      cursor: pointer;
    }
    .pos-status-cancel:hover { background: #fef2f2; }
    @keyframes pos-spin { to { transform: rotate(360deg); } }
    @media (prefers-reduced-motion: reduce) { .spinner { animation-duration: 2s; } }
  `],
})
export class PosCobroEstadoComponent {
  readonly cobro = inject(PosCobroService);

  constructor() {
    addIcons({ alertCircleOutline, checkmarkCircleOutline });
  }
}
