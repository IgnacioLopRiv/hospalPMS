import { Injectable, NotFoundException } from '@nestjs/common';
import { EstadoReserva } from '@prisma/client';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { PrismaService } from '../../../database/prisma.service';
import {
  calcularEstadisticas,
  montoNeto,
  Periodo,
  periodoAnterior,
} from './reporte-estadisticas';
import { construirReportePdf, DatosReportePdf } from './reporte-pdf.builder';

interface PdfMake {
  setFonts(fonts: Record<string, Record<string, string>>): void;
  setUrlAccessPolicy(cb: (url: string) => boolean): void;
  setLocalAccessPolicy(cb: (path: string) => boolean): void;
  createPdf(doc: object): { getBuffer(): Promise<Buffer> };
}

const requireCjs = createRequire(__filename);
const pdfmake = requireCjs('pdfmake') as PdfMake;
const FONT_DIR = join(
  dirname(requireCjs.resolve('pdfmake/package.json')),
  'fonts',
  'Roboto',
);
const FUENTES = {
  Roboto: {
    normal: join(FONT_DIR, 'Roboto-Regular.ttf'),
    bold: join(FONT_DIR, 'Roboto-Medium.ttf'),
    italics: join(FONT_DIR, 'Roboto-Italic.ttf'),
    bolditalics: join(FONT_DIR, 'Roboto-MediumItalic.ttf'),
  },
};
const ARCHIVOS_PERMITIDOS = new Set(Object.values(FUENTES.Roboto));
pdfmake.setFonts(FUENTES);
// El reporte no carga recursos externos: solo las fuentes empaquetadas.
pdfmake.setUrlAccessPolicy(() => false);
pdfmake.setLocalAccessPolicy((path) => ARCHIVOS_PERMITIDOS.has(path));

const METODO_PAGO: Record<string, string> = {
  TRANSFERENCIA: 'Transferencia',
  EFECTIVO: 'Efectivo',
  TARJETA_CREDITO: 'T. crédito',
  TARJETA_DEBITO: 'T. débito',
};
const TIPO_OPERACION: Record<string, string> = {
  ABONO: 'Abono',
  PAGO_FINAL: 'Pago final',
  PAGO_SERVICIO_ADICIONAL: 'Servicio adicional',
  REEMBOLSO: 'Reembolso',
};

export interface SolicitudReportePdf {
  /** `null` = todas las sedes. */
  sedeId: number | null;
  periodo: Periodo;
}

@Injectable()
export class ReportePdfService {
  constructor(private readonly prisma: PrismaService) {}

  async generar(solicitud: SolicitudReportePdf): Promise<Buffer> {
    const datos = await this.recopilarDatos(solicitud);
    return pdfmake.createPdf(construirReportePdf(datos)).getBuffer();
  }

  async recopilarDatos({
    sedeId,
    periodo,
  }: SolicitudReportePdf): Promise<DatosReportePdf> {
    const sedes = await this.prisma.sede.findMany({
      where: sedeId === null ? undefined : { id: sedeId },
      select: {
        id: true,
        nombreSede: true,
        hostal: {
          select: { nombreFantasia: true, razonSocial: true, rutEmpresa: true },
        },
      },
      orderBy: { id: 'asc' },
    });
    if (sedes.length === 0) {
      throw new NotFoundException(
        sedeId === null
          ? 'No hay sedes registradas.'
          : `No existe la sede ${sedeId}.`,
      );
    }
    const sedeIds = sedes.map((s) => s.id);
    const anterior = periodoAnterior(periodo);
    const porSede = { habitacion: { sedeId: { in: sedeIds } } };

    const [habitaciones, reservas, pagos, reservasAbiertas, insumos] =
      await Promise.all([
        this.prisma.habitacion.count({
          where: { sedeId: { in: sedeIds }, activa: true },
        }),
        this.prisma.reserva.findMany({
          where: {
            ...porSede,
            fechaCheckIn: { lt: periodo.hasta },
            fechaCheckOut: { gt: anterior.desde },
          },
          select: {
            habitacionId: true,
            fechaCheckIn: true,
            fechaCheckOut: true,
            precioTotal: true,
            estado: true,
          },
        }),
        this.prisma.pago.findMany({
          where: {
            reserva: porSede,
            fechaPago: { gte: anterior.desde, lt: periodo.hasta },
          },
          select: {
            monto: true,
            metodoPago: true,
            tipoOperacion: true,
            fechaPago: true,
            reserva: {
              select: {
                id: true,
                codigo: true,
                huesped: { select: { nombres: true, apellidos: true } },
                habitacion: {
                  select: {
                    numero: true,
                    sede: { select: { nombreSede: true } },
                  },
                },
              },
            },
          },
          orderBy: [{ fechaPago: 'asc' }, { id: 'asc' }],
        }),
        this.prisma.reserva.findMany({
          where: {
            ...porSede,
            estado: { in: [EstadoReserva.CONFIRMADA, EstadoReserva.EN_CURSO] },
          },
          select: {
            precioTotal: true,
            pagos: { select: { monto: true, tipoOperacion: true } },
          },
        }),
        this.prisma.insumoInventario.findMany({
          where: { sedeId: { in: sedeIds }, activo: true },
          select: {
            nombre: true,
            stockActual: true,
            stockMinimo: true,
            sede: { select: { nombreSede: true } },
          },
          orderBy: [{ sedeId: 'asc' }, { nombre: 'asc' }],
        }),
      ]);

    // Saldo por cobrar: precio de reservas activas menos lo efectivamente pagado (tabla pago).
    let saldoPorCobrar = 0;
    let reservasConSaldo = 0;
    for (const reserva of reservasAbiertas) {
      const pagado = reserva.pagos.reduce(
        (total, pago) => total + montoNeto(pago),
        0,
      );
      const saldo = Math.max(0, (reserva.precioTotal ?? 0) - pagado);
      if (saldo > 0) {
        saldoPorCobrar += saldo;
        reservasConSaldo++;
      }
    }

    const hostal = sedes[0].hostal;
    return {
      empresa: {
        nombre: hostal.nombreFantasia,
        razonSocial: hostal.razonSocial,
        rut: hostal.rutEmpresa,
      },
      alcance: sedeId === null ? 'Todas las sedes' : sedes[0].nombreSede,
      esGlobal: sedeId === null,
      periodo,
      periodoAnterior: anterior,
      actual: calcularEstadisticas(periodo, { habitaciones, reservas, pagos }),
      anterior: calcularEstadisticas(anterior, {
        habitaciones,
        reservas,
        pagos,
      }),
      saldoPorCobrar,
      reservasConSaldo,
      transacciones: pagos
        .filter(
          (p) => p.fechaPago >= periodo.desde && p.fechaPago < periodo.hasta,
        )
        .map((p) => ({
          fecha: p.fechaPago,
          reserva: p.reserva.codigo ?? `#${p.reserva.id}`,
          huesped:
            `${p.reserva.huesped.nombres} ${p.reserva.huesped.apellidos}`.trim(),
          habitacion: p.reserva.habitacion.numero,
          sede: p.reserva.habitacion.sede.nombreSede,
          metodoPago: METODO_PAGO[p.metodoPago] ?? p.metodoPago,
          tipoOperacion: TIPO_OPERACION[p.tipoOperacion] ?? p.tipoOperacion,
          monto: montoNeto(p),
        })),
      inventarioBajoMinimo: insumos
        .filter((i) => i.stockActual <= i.stockMinimo)
        .map((i) => ({
          sede: i.sede.nombreSede,
          nombre: i.nombre,
          stockActual: i.stockActual,
          stockMinimo: i.stockMinimo,
        })),
      generadoEn: new Date(),
    };
  }
}
