import { Injectable } from '@nestjs/common';
import { EstadoReserva } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import {
  DEFAULT_ARRIVAL_TIME,
  DEFAULT_DEPARTURE_TIME,
  toTimelineMinutes,
} from '../../reservations/domain/stay-schedule';

export type TipoAlerta =
  | 'LLEGADA_ATRASADA'
  | 'SALIDA_ATRASADA'
  | 'SALDO_PENDIENTE'
  | 'POSIBLE_DUPLICADO'
  | 'STOCK_BAJO';

export type SeveridadAlerta = 'alta' | 'media';

export interface Alerta {
  id: string;
  tipo: TipoAlerta;
  severidad: SeveridadAlerta;
  titulo: string;
  detalle: string;
  /** Fecha de referencia (YYYY-MM-DD) para ordenar y mostrar. */
  fecha: string;
  reservaId?: number;
  huespedIds?: number[];
}

/** Zona horaria del hostal para decidir "ahora" (el contenedor puede estar en UTC). */
const HOTEL_TIME_ZONE = process.env.HOTEL_TIMEZONE || 'America/Santiago';
const MINUTES_PER_DAY = 24 * 60;

/**
 * RF-20: reúne en una sola consulta las alertas operativas de una sede:
 *  - Llegadas atrasadas: reserva CONFIRMADA cuya hora de llegada ya pasó sin check-in.
 *  - Salidas atrasadas: reserva EN_CURSO cuya hora de salida ya pasó.
 *  - Saldo pendiente: reserva EN_CURSO o FINALIZADA que no está pagada por completo.
 *  - Posibles duplicados: huéspedes con el mismo nombre o teléfono y distinto documento.
 *  - Stock bajo: insumos activos con stock actual igual o menor al mínimo.
 */
@Injectable()
export class AlertasService {
  constructor(private readonly prisma: PrismaService) {}

  async forSede(sedeId: number, now = new Date()): Promise<Alerta[]> {
    const sede = await this.prisma.sede.findUnique({
      where: { id: sedeId },
      select: { horaCheckIn: true, horaCheckOut: true },
    });
    const defaults = {
      arrival: sede?.horaCheckIn || DEFAULT_ARRIVAL_TIME,
      departure: sede?.horaCheckOut || DEFAULT_DEPARTURE_TIME,
    };
    const nowMinutes = this.localNowMinutes(now);

    const [reservas, huespedes, insumos] = await Promise.all([
      this.prisma.reserva.findMany({
        where: {
          habitacion: { sedeId },
          estado: {
            in: [
              EstadoReserva.CONFIRMADA,
              EstadoReserva.EN_CURSO,
              EstadoReserva.FINALIZADA,
            ],
          },
        },
        include: {
          huesped: { select: { nombres: true, apellidos: true } },
          habitacion: { select: { numero: true } },
        },
      }),
      this.prisma.huesped.findMany({
        where: { sedeId, eliminadoEn: null },
        select: {
          id: true,
          nombres: true,
          apellidos: true,
          telefono: true,
          rutPasaporte: true,
        },
      }),
      this.prisma.insumoInventario.findMany({
        where: { sedeId, activo: true },
        select: {
          id: true,
          nombre: true,
          stockActual: true,
          stockMinimo: true,
        },
      }),
    ]);

    const alertas: Alerta[] = [];

    for (const r of reservas) {
      const huesped = `${r.huesped.nombres} ${r.huesped.apellidos}`.trim();
      const hab = `Hab. ${r.habitacion.numero}`;
      const llegada = this.toDateKey(r.fechaCheckIn);
      const salida = this.toDateKey(r.fechaCheckOut);
      const horaLlegada = r.horaLlegada || defaults.arrival;
      const horaSalida = r.horaSalida || defaults.departure;

      if (r.estado === EstadoReserva.CONFIRMADA) {
        const atraso = nowMinutes - toTimelineMinutes(llegada, horaLlegada);
        if (atraso > 0) {
          alertas.push({
            id: `llegada-${r.id}`,
            tipo: 'LLEGADA_ATRASADA',
            severidad: atraso >= MINUTES_PER_DAY ? 'alta' : 'media',
            titulo: `${huesped} no ha llegado`,
            detalle: `${hab} · llegada ${llegada} ${horaLlegada} · ${this.formatDelay(atraso)} de atraso`,
            fecha: llegada,
            reservaId: r.id,
          });
        }
      }

      if (r.estado === EstadoReserva.EN_CURSO) {
        const atraso = nowMinutes - toTimelineMinutes(salida, horaSalida);
        if (atraso > 0) {
          alertas.push({
            id: `salida-${r.id}`,
            tipo: 'SALIDA_ATRASADA',
            severidad: atraso >= MINUTES_PER_DAY ? 'alta' : 'media',
            titulo: `${huesped} no ha hecho check-out`,
            detalle: `${hab} · salida ${salida} ${horaSalida} · ${this.formatDelay(atraso)} de atraso`,
            fecha: salida,
            reservaId: r.id,
          });
        }
      }

      const total = r.precioTotal ?? 0;
      const pagado = r.montoPagado ?? 0;
      if (
        r.estado !== EstadoReserva.CONFIRMADA &&
        !r.pagoCompleto &&
        total > 0 &&
        pagado < total
      ) {
        alertas.push({
          id: `saldo-${r.id}`,
          tipo: 'SALDO_PENDIENTE',
          severidad: r.estado === EstadoReserva.FINALIZADA ? 'alta' : 'media',
          titulo: `Saldo pendiente de ${this.formatClp(total - pagado)}`,
          detalle: `${huesped} · ${hab} · ${r.estado === EstadoReserva.FINALIZADA ? `salió el ${salida}` : `check-in ${llegada}`} · pagado ${this.formatClp(pagado)} de ${this.formatClp(total)}`,
          fecha: llegada,
          reservaId: r.id,
        });
      }
    }

    alertas.push(...this.duplicates(huespedes));

    for (const i of insumos) {
      if (i.stockActual > i.stockMinimo) continue;
      alertas.push({
        id: `stock-${i.id}`,
        tipo: 'STOCK_BAJO',
        severidad: i.stockActual <= 0 ? 'alta' : 'media',
        titulo:
          i.stockActual <= 0
            ? `Sin stock: ${i.nombre}`
            : `Stock bajo: ${i.nombre}`,
        detalle: `Quedan ${i.stockActual} · mínimo ${i.stockMinimo}`,
        fecha: '',
      });
    }

    const rank: Record<SeveridadAlerta, number> = { alta: 0, media: 1 };
    return alertas.sort(
      (a, b) =>
        rank[a.severidad] - rank[b.severidad] || b.fecha.localeCompare(a.fecha),
    );
  }

  /** Grupos de huéspedes con igual nombre o teléfono y más de un documento distinto. */
  private duplicates(
    huespedes: {
      id: number;
      nombres: string;
      apellidos: string;
      telefono: string;
      rutPasaporte: string;
    }[],
  ): Alerta[] {
    const groups = new Map<string, { motivo: string; ids: Set<number> }>();
    const add = (key: string, motivo: string, id: number) => {
      const g = groups.get(key) ?? { motivo, ids: new Set<number>() };
      g.ids.add(id);
      groups.set(key, g);
    };
    for (const h of huespedes) {
      const nombre = this.normalizeName(`${h.nombres} ${h.apellidos}`);
      if (nombre) add(`n:${nombre}`, 'mismo nombre', h.id);
      const telefono = h.telefono.replace(/\D/g, '').slice(-8);
      if (telefono.length >= 6) add(`t:${telefono}`, 'mismo teléfono', h.id);
    }

    const byId = new Map(huespedes.map((h) => [h.id, h]));
    const seen = new Set<string>();
    const alertas: Alerta[] = [];
    for (const { motivo, ids } of groups.values()) {
      const miembros = [...ids].map((id) => byId.get(id)!);
      const documentos = new Set(
        miembros.map((h) =>
          h.rutPasaporte.replace(/[.\s-]/g, '').toUpperCase(),
        ),
      );
      if (documentos.size < 2) continue;
      const key = [...ids].sort((a, b) => a - b).join(',');
      if (seen.has(key)) continue;
      seen.add(key);
      alertas.push({
        id: `duplicado-${key}`,
        tipo: 'POSIBLE_DUPLICADO',
        severidad: 'media',
        titulo: `Posible huésped duplicado (${motivo})`,
        detalle: miembros
          .map((h) => `${h.nombres} ${h.apellidos} (${h.rutPasaporte})`)
          .join(' · '),
        fecha: '',
        huespedIds: [...ids],
      });
    }
    return alertas;
  }

  private normalizeName(name: string): string {
    return name
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  /** "Ahora" en minutos de la línea de tiempo local del hostal (ver stay-schedule). */
  private localNowMinutes(now: Date): number {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat('en-CA', {
        timeZone: HOTEL_TIME_ZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      })
        .formatToParts(now)
        .map((p) => [p.type, p.value]),
    );
    return toTimelineMinutes(
      `${parts.year}-${parts.month}-${parts.day}`,
      `${parts.hour}:${parts.minute}`,
    );
  }

  /** Las fechas de estadía se guardan a medianoche UTC. */
  private toDateKey(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  private formatDelay(minutes: number): string {
    if (minutes >= MINUTES_PER_DAY) {
      const days = Math.floor(minutes / MINUTES_PER_DAY);
      return `${days} día${days === 1 ? '' : 's'}`;
    }
    if (minutes >= 60) return `${Math.floor(minutes / 60)} h`;
    return `${minutes} min`;
  }

  private formatClp(value: number): string {
    return `$${value.toLocaleString('es-CL')}`;
  }
}
