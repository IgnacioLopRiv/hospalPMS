import { Component, EventEmitter, Output, inject } from '@angular/core';
import { Router } from '@angular/router';
import { IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  alarmOutline,
  cashOutline,
  closeOutline,
  cubeOutline,
  exitOutline,
  peopleOutline,
  refreshOutline,
  checkmarkCircleOutline,
} from 'ionicons/icons';
import { Alerta, AlertasService, TipoAlerta } from '../../application/alertas.service';

interface MetaTipo {
  etiqueta: string;
  icono: string;
  ruta: string;
}

/** Cada tipo se distingue por color (ver SCSS `.tipo-*`), ícono y destino. */
const META: Record<TipoAlerta, MetaTipo> = {
  LLEGADA_ATRASADA: { etiqueta: 'Llegada atrasada', icono: 'alarm-outline', ruta: '/recepcion' },
  SALIDA_ATRASADA: { etiqueta: 'Salida atrasada', icono: 'exit-outline', ruta: '/recepcion' },
  SALDO_PENDIENTE: { etiqueta: 'Saldo pendiente', icono: 'cash-outline', ruta: '/reservas' },
  POSIBLE_DUPLICADO: { etiqueta: 'Posible duplicado', icono: 'people-outline', ruta: '/huespedes' },
  STOCK_BAJO: { etiqueta: 'Stock bajo', icono: 'cube-outline', ruta: '/inventario' },
};

/** RF-20: panel desplegable de la campana del header. */
@Component({
  selector: 'app-alertas-panel',
  standalone: true,
  imports: [IonIcon],
  templateUrl: './alertas-panel.component.html',
  styleUrls: ['./alertas-panel.component.scss'],
})
export class AlertasPanelComponent {
  @Output() closed = new EventEmitter<void>();

  private readonly router = inject(Router);
  readonly service = inject(AlertasService);
  readonly meta = META;

  constructor() {
    addIcons({
      alarmOutline,
      cashOutline,
      closeOutline,
      cubeOutline,
      exitOutline,
      peopleOutline,
      refreshOutline,
      checkmarkCircleOutline,
    });
  }

  open(alerta: Alerta): void {
    this.closed.emit();
    void this.router.navigateByUrl(META[alerta.tipo].ruta);
  }
}
