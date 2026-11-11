import { Injectable } from '@angular/core';
import type { TransbankPOSWebSocket } from 'transbank-pos-sdk-web';
import { PosLocalChargeRequest, PosLocalDriver } from '../../domain/pos-local-driver';
import { PosDevice, PosTestResult } from '../../domain/pos.repository';

/** El Agente POS de Transbank escucha siempre en este puerto (no es configurable). */
const AGENT_URL = 'https://localhost:8090';
const CONNECT_TIMEOUT_MS = 6_000;
const AGENT_ERROR =
  'No se pudo conectar con el Agente POS de Transbank en este equipo. Verifica que esté instalado y abierto, ' +
  'y abre https://localhost:8090 una vez en el navegador para aceptar su certificado.';

interface SerialPortInfo {
  path?: string;
  comName?: string;
  manufacturer?: string;
}

/**
 * Conector para Transbank POS Integrado usando el SDK oficial
 * `transbank-pos-sdk-web`, que habla por Socket.IO con el Agente POS
 * instalado en el PC donde está conectado el terminal.
 */
@Injectable()
export class TransbankLocalDriver implements PosLocalDriver {
  readonly code = 'TRANSBANK_POS_INTEGRADO';
  private sdk?: Promise<TransbankPOSWebSocket>;

  async testConnection(parametros: Record<string, unknown>): Promise<PosTestResult> {
    try {
      const pos = await this.conectar();
      const puerto = await this.abrirPuerto(pos, this.puerto(parametros));
      const responde = await pos.poll();
      return responde
        ? { ok: true, mensaje: 'Terminal Transbank conectado y respondiendo.', cuenta: { Puerto: puerto } }
        : {
            ok: false,
            mensaje: 'El agente está activo pero el terminal no responde. Verifica que esté en modo integrado.',
          };
    } catch (error) {
      return { ok: false, mensaje: this.mensaje(error) };
    }
  }

  async listDevices(): Promise<PosDevice[]> {
    const pos = await this.conectar();
    const ports = (await pos.getPorts()) as SerialPortInfo[];
    return ports
      .map((port) => {
        const path = port.path ?? port.comName ?? '';
        return {
          id: path,
          nombre: port.manufacturer ? `${path} (${port.manufacturer})` : path,
          disponible: true,
        };
      })
      .filter((device) => device.id);
  }

  async cobrar(request: PosLocalChargeRequest): Promise<unknown> {
    const pos = await this.conectar();
    await this.abrirPuerto(pos, this.puerto(request.parametros));
    return pos.doSale(request.monto, request.ticket, (status) => {
      if (status?.responseMessage) request.onEstado?.(status.responseMessage);
    });
  }

  /** Carga el SDK solo cuando se usa, para no sumar peso al resto de la app. */
  private loadSdk(): Promise<TransbankPOSWebSocket> {
    this.sdk ??= import('transbank-pos-sdk-web').then((module) => module.POS);
    return this.sdk;
  }

  private async conectar(): Promise<TransbankPOSWebSocket> {
    const pos = await this.loadSdk();
    if (pos.isConnected) return pos;
    const connected = await this.withTimeout(
      pos.connect(AGENT_URL, { reconnection: false }),
      CONNECT_TIMEOUT_MS,
    ).catch(() => false);
    if (!connected) {
      await pos.disconnect().catch(() => undefined);
      throw new Error(AGENT_ERROR);
    }
    return pos;
  }

  private async abrirPuerto(pos: TransbankPOSWebSocket, puerto?: string): Promise<string> {
    const status = await pos.getPortStatus();
    if (status.connected && (!puerto || status.activePort === puerto)) {
      return status.activePort ?? puerto ?? '';
    }
    if (status.connected) await pos.closePort();

    if (puerto) {
      if (!(await pos.openPort(puerto))) {
        throw new Error(`No se pudo abrir el puerto ${puerto}. Revisa que el terminal esté conectado.`);
      }
      return puerto;
    }
    const detectado = await pos.autoconnect();
    if (!detectado) {
      throw new Error('No se encontró un terminal Transbank conectado a este equipo.');
    }
    return typeof detectado === 'string' ? detectado : 'detectado automáticamente';
  }

  private puerto(parametros: Record<string, unknown>): string | undefined {
    const value = parametros['puerto'];
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
  }

  private withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('timeout')), ms);
      promise.then(
        (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        (error: unknown) => {
          clearTimeout(timer);
          reject(error);
        },
      );
    });
  }

  private mensaje(error: unknown): string {
    if (error instanceof Error && error.message && error.message !== 'timeout') return error.message;
    return AGENT_ERROR;
  }
}
