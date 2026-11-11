import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { POS_LOCAL_DRIVERS } from '../domain/pos-local-driver';
import {
  IniciarCobroInput,
  PosConfig,
  PosProviderInfo,
  PosRepository,
  TransaccionPos,
} from '../domain/pos.repository';

export type EtapaCobroPos = 'inactivo' | 'enviando' | 'esperando' | 'aprobado' | 'fallido';

/** POS de la sede listo para cobrar con tarjeta. */
export interface PosDisponible {
  proveedor: PosProviderInfo;
  config: PosConfig;
}

const POLL_MS = 2_500;
/** La orden en el terminal expira a los 10 min; se deja margen. */
const POLL_MAX_MS = 11 * 60_000;

const MENSAJE_ESTADO: Record<string, string> = {
  RECHAZADA: 'El terminal rechazó la tarjeta.',
  CANCELADA: 'El cobro fue cancelado.',
  EXPIRADA: 'El cobro expiró sin que se pasara la tarjeta.',
  ERROR: 'No se pudo completar el cobro en el terminal.',
};

/**
 * Envía un cobro con tarjeta al terminal POS de la sede y espera el resultado.
 *
 * - Proveedores en la nube (Mercado Pago): el backend crea la orden y aquí se
 *   consulta su estado hasta que termina.
 * - Proveedores locales (Transbank): este navegador ejecuta la venta con el
 *   agente instalado en el PC y envía la respuesta al backend.
 *
 * En ambos casos el Pago lo registra el backend al aprobarse el cobro.
 */
@Injectable({ providedIn: 'root' })
export class PosCobroService {
  private readonly repository = inject(PosRepository);
  private readonly drivers = inject(POS_LOCAL_DRIVERS, { optional: true }) ?? [];

  readonly etapa = signal<EtapaCobroPos>('inactivo');
  readonly mensaje = signal('');
  readonly transaccion = signal<TransaccionPos | null>(null);
  readonly enCurso = computed(() => this.etapa() === 'enviando' || this.etapa() === 'esperando');
  /** Los cobros locales se cancelan desde el terminal, no desde HosPal. */
  readonly puedeCancelar = computed(
    () => this.etapa() === 'esperando' && this.transaccion()?.modo === 'nube',
  );

  private cancelSolicitado = false;
  private providersCache?: Promise<PosProviderInfo[]>;

  /** Devuelve el POS activo de la sede si puede cobrar con tarjeta, o null. */
  async posDisponible(sedeId: number): Promise<PosDisponible | null> {
    try {
      this.providersCache ??= firstValueFrom(this.repository.listProviders());
      const [providers, config] = await Promise.all([
        this.providersCache,
        firstValueFrom(this.repository.getConfig(sedeId)),
      ]);
      const proveedor = providers.find((item) => item.code === config.proveedor);
      if (!config.activo || !proveedor?.disponible || !proveedor.soportaCobros) return null;
      if (proveedor.modo === 'local' && !this.drivers.some((driver) => driver.code === proveedor.code)) {
        return null;
      }
      return { proveedor, config };
    } catch {
      this.providersCache = undefined;
      return null;
    }
  }

  reset(): void {
    if (this.enCurso()) return;
    this.etapa.set('inactivo');
    this.mensaje.set('');
    this.transaccion.set(null);
  }

  /**
   * Ejecuta el cobro y resuelve con la transacción final. Nunca lanza por un
   * rechazo del terminal: el resultado queda en `etapa` y en la transacción.
   */
  async cobrar(input: IniciarCobroInput, pos: PosDisponible): Promise<TransaccionPos | null> {
    this.cancelSolicitado = false;
    this.transaccion.set(null);
    this.etapa.set('enviando');
    this.mensaje.set('Enviando el cobro al terminal…');

    let tx: TransaccionPos;
    try {
      tx = await firstValueFrom(this.repository.iniciarCobro(input));
      this.transaccion.set(tx);
    } catch (error) {
      return this.fallar(this.errorText(error, 'No se pudo enviar el cobro al terminal.'));
    }

    try {
      tx = tx.modo === 'local'
        ? await this.cobrarLocal(tx, pos)
        : await this.esperarNube(tx);
    } catch (error) {
      return this.fallar(this.errorText(error, 'Se perdió la conexión con el terminal.'));
    }

    this.transaccion.set(tx);
    if (tx.estado === 'APROBADA' && tx.pagoId) {
      this.etapa.set('aprobado');
      this.mensaje.set('Pago aprobado en el terminal.');
    } else if (tx.estado === 'APROBADA') {
      // Cobrado en la tarjeta pero sin Pago registrado (p. ej. monto distinto).
      this.fallar(tx.mensaje ?? 'El cobro se aprobó pero no se pudo registrar. Regístralo manualmente.');
    } else {
      this.fallar(tx.mensaje ?? MENSAJE_ESTADO[tx.estado] ?? 'El cobro no se completó.');
    }
    return tx;
  }

  /** Solicita cancelar un cobro en la nube que espera la tarjeta. */
  async cancelar(): Promise<void> {
    const tx = this.transaccion();
    if (!tx || !this.puedeCancelar()) return;
    this.cancelSolicitado = true;
    this.mensaje.set('Cancelando el cobro…');
    try {
      this.transaccion.set(await firstValueFrom(this.repository.cancelarCobro(tx.id)));
    } catch (error) {
      this.cancelSolicitado = false;
      this.mensaje.set(this.errorText(error, 'No se pudo cancelar. Cancélalo desde el terminal.'));
    }
  }

  private async esperarNube(inicial: TransaccionPos): Promise<TransaccionPos> {
    this.etapa.set('esperando');
    this.mensaje.set('Pide al huésped que pase o acerque su tarjeta en el terminal.');
    let tx = inicial;
    const limite = Date.now() + POLL_MAX_MS;
    while (!tx.final && Date.now() < limite) {
      await new Promise((resolve) => setTimeout(resolve, POLL_MS));
      const cancelada = this.transaccion();
      if (this.cancelSolicitado && cancelada?.final) return cancelada;
      tx = await firstValueFrom(this.repository.obtenerCobro(tx.id));
      this.transaccion.set(tx);
      if (tx.estado === 'EN_TERMINAL' && !this.cancelSolicitado) {
        this.mensaje.set('El terminal recibió el cobro. Esperando la tarjeta…');
      }
    }
    return tx;
  }

  private async cobrarLocal(tx: TransaccionPos, pos: PosDisponible): Promise<TransaccionPos> {
    const driver = this.drivers.find((item) => item.code === tx.proveedor);
    if (!driver) throw new Error('Esta versión de HosPal no tiene conector para este terminal.');
    this.etapa.set('esperando');
    this.mensaje.set('Sigue las instrucciones en el terminal…');

    let resultado: unknown;
    try {
      resultado = await driver.cobrar({
        monto: tx.monto,
        ticket: String(tx.id),
        parametros: pos.config.parametros,
        onEstado: (mensaje) => this.mensaje.set(mensaje),
      });
    } catch (error) {
      // No se llegó a cobrar (agente apagado, puerto ocupado…): se cierra el cobro.
      await firstValueFrom(this.repository.cancelarCobro(tx.id)).catch(() => undefined);
      throw error;
    }
    return firstValueFrom(this.repository.reportarResultado(tx.id, resultado));
  }

  private fallar(mensaje: string): null {
    this.etapa.set('fallido');
    this.mensaje.set(mensaje);
    return null;
  }

  private errorText(error: unknown, fallback: string): string {
    if (error instanceof HttpErrorResponse) {
      const message = (error.error as { message?: unknown } | null)?.message;
      if (Array.isArray(message)) return message.join(' ');
      if (typeof message === 'string') return message;
      if (error.status === 0) return 'No se pudo conectar con el servidor.';
      return fallback;
    }
    return error instanceof Error && error.message ? error.message : fallback;
  }
}
