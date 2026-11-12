import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  Tarifa,
  TarifaPeriodo,
  TIPOS_PERIODO,
} from '../../domain/entities/tarifa.entity';
import { SedeRepository } from '../../domain/repositories/sede.repository';
import { TarifaAbonoRepository } from '../../domain/repositories/tarifa-abono.repository';
import { TarifaRepository } from '../../domain/repositories/tarifa.repository';
import { TipologiaRepository } from '../../domain/repositories/tipologia.repository';

interface TarifaInput {
  nombre?: string;
  activa?: boolean;
  precioBase?: number | null;
  periodos?: unknown;
  precios?: Record<string, number>;
}

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Controller REST para Tarifa (temporadas de precios de una sede).
 *
 * Rutas:
 *   GET    /sedes/:sedeId/tarifas   → listar tarifas de la sede
 *   POST   /sedes/:sedeId/tarifas   → crear (queda asociada al tarifa_abono de la sede)
 *   GET    /tarifas/:id             → obtener una
 *   PATCH  /tarifas/:id             → actualizar (precios reemplaza la lista completa)
 *   DELETE /tarifas/:id             → eliminar (borra también sus precios por tipología)
 */
@Controller()
export class TarifasController {
  constructor(
    private readonly tarifas: TarifaRepository,
    private readonly abonos: TarifaAbonoRepository,
    private readonly tipologias: TipologiaRepository,
    private readonly sedes: SedeRepository,
  ) {}

  @Get('sedes/:sedeId/tarifas')
  async list(@Param('sedeId', ParseIntPipe) sedeId: number) {
    const rows = await this.tarifas.findBySedeId(sedeId);
    return rows.map((row) => this.toFrontend(row));
  }

  @Post('sedes/:sedeId/tarifas')
  async create(
    @Param('sedeId', ParseIntPipe) sedeId: number,
    @Body() input: TarifaInput,
  ) {
    if (!(await this.sedes.findById(sedeId))) {
      throw new NotFoundException(`No existe la sede ${sedeId}.`);
    }
    const nombre = this.parseNombre(input.nombre);
    const periodos = this.parsePeriodos(input.periodos);
    const precios = await this.parsePrecios(sedeId, input.precios ?? {});
    const abono = await this.abonos.ensureForSede(sedeId);
    const row = await this.tarifas.create({
      sedeId,
      tarifaAbonoId: abono.id,
      nombre,
      precioBase: this.parsePrecioBase(input.precioBase) ?? null,
      ...Tarifa.calcularVigencia(periodos),
      activa: input.activa ?? true,
      periodos,
      precios,
    });
    return this.toFrontend(row);
  }

  @Get('tarifas/:id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.toFrontend(await this.findOrFail(id));
  }

  @Patch('tarifas/:id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() input: TarifaInput,
  ) {
    const current = await this.findOrFail(id);
    if (input.activa !== undefined && typeof input.activa !== 'boolean') {
      throw new BadRequestException('activa debe ser true o false.');
    }
    const periodos =
      input.periodos !== undefined
        ? this.parsePeriodos(input.periodos)
        : undefined;
    const row = await this.tarifas.update(id, {
      ...(input.nombre !== undefined
        ? { nombre: this.parseNombre(input.nombre) }
        : {}),
      ...(input.activa !== undefined ? { activa: input.activa } : {}),
      ...(input.precioBase !== undefined
        ? { precioBase: this.parsePrecioBase(input.precioBase) }
        : {}),
      ...(periodos ? { periodos, ...Tarifa.calcularVigencia(periodos) } : {}),
      ...(input.precios !== undefined
        ? { precios: await this.parsePrecios(current.sedeId, input.precios) }
        : {}),
    });
    return this.toFrontend(row);
  }

  @Delete('tarifas/:id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.findOrFail(id);
    await this.tarifas.delete(id);
    return { deleted: true };
  }

  private async findOrFail(id: number): Promise<Tarifa> {
    const row = await this.tarifas.findById(id);
    if (!row) throw new NotFoundException(`No existe la tarifa ${id}.`);
    return row;
  }

  private parseNombre(nombre: unknown): string {
    if (typeof nombre !== 'string' || !nombre.trim()) {
      throw new BadRequestException('El nombre de la tarifa es obligatorio.');
    }
    if (nombre.trim().length > 191) {
      throw new BadRequestException(
        'El nombre de la tarifa no puede superar 191 caracteres.',
      );
    }
    return nombre.trim();
  }

  private parsePrecioBase(precio: unknown): number | null | undefined {
    if (precio === undefined || precio === null) return precio;
    if (typeof precio !== 'number' || !Number.isFinite(precio) || precio < 0) {
      throw new BadRequestException(
        'precioBase debe ser un número mayor o igual a cero.',
      );
    }
    return Math.round(precio);
  }

  private parsePeriodos(periodos: unknown): TarifaPeriodo[] {
    if (!Array.isArray(periodos) || periodos.length === 0) {
      throw new BadRequestException(
        'La tarifa debe tener al menos un periodo de aplicación.',
      );
    }
    return periodos.map((value, index) => {
      const periodo = value as Partial<TarifaPeriodo>;
      const error = (detalle: string) =>
        new BadRequestException(`Periodo ${index + 1}: ${detalle}`);
      if (
        !periodo ||
        typeof periodo !== 'object' ||
        !TIPOS_PERIODO.includes(periodo.tipo as TarifaPeriodo['tipo'])
      ) {
        throw error(`tipo inválido. Opciones: ${TIPOS_PERIODO.join(', ')}.`);
      }
      const normalized: TarifaPeriodo = {
        id:
          typeof periodo.id === 'string' && periodo.id
            ? periodo.id
            : `periodo-${index + 1}`,
        tipo: periodo.tipo!,
        meses: Array.isArray(periodo.meses) ? periodo.meses : [],
        diasSemana: Array.isArray(periodo.diasSemana) ? periodo.diasSemana : [],
        diasMes: Array.isArray(periodo.diasMes) ? periodo.diasMes : [],
        fechaInicio:
          typeof periodo.fechaInicio === 'string' ? periodo.fechaInicio : '',
        fechaFin: typeof periodo.fechaFin === 'string' ? periodo.fechaFin : '',
        fechas: Array.isArray(periodo.fechas) ? periodo.fechas : [],
        ...(Number.isInteger(periodo.anio) ? { anio: periodo.anio } : {}),
        ...(Number.isInteger(periodo.mes) ? { mes: periodo.mes } : {}),
      };
      switch (normalized.tipo) {
        case 'date-range':
          if (
            !FECHA.test(normalized.fechaInicio) ||
            !FECHA.test(normalized.fechaFin) ||
            normalized.fechaInicio > normalized.fechaFin
          ) {
            throw error('el rango de fechas no es válido.');
          }
          break;
        case 'specific-dates':
          if (
            normalized.fechas.length === 0 ||
            !normalized.fechas.every(
              (fecha) => typeof fecha === 'string' && FECHA.test(fecha),
            )
          ) {
            throw error('debe incluir fechas con formato YYYY-MM-DD.');
          }
          break;
        case 'specific-month-days':
          if (
            normalized.anio === undefined ||
            normalized.mes === undefined ||
            normalized.mes < 0 ||
            normalized.mes > 11 ||
            normalized.diasMes.length === 0
          ) {
            throw error('debe indicar año, mes y al menos un día.');
          }
          break;
        case 'months':
          if (normalized.meses.length === 0)
            throw error('debe seleccionar al menos un mes.');
          break;
        case 'weekdays':
          if (normalized.diasSemana.length === 0)
            throw error('debe seleccionar al menos un día de la semana.');
          break;
        case 'month-days':
          if (normalized.diasMes.length === 0)
            throw error('debe seleccionar al menos un día del mes.');
          break;
      }
      return normalized;
    });
  }

  private async parsePrecios(
    sedeId: number,
    precios: unknown,
  ): Promise<Record<number, number>> {
    if (!precios || typeof precios !== 'object' || Array.isArray(precios)) {
      throw new BadRequestException(
        'precios debe ser un objeto { tipologiaId: precio }.',
      );
    }
    const tipologiasSede = new Set(
      (await this.tipologias.findBySedeId(sedeId)).map(
        (tipologia) => tipologia.id,
      ),
    );
    return Object.fromEntries(
      Object.entries(precios).map(([key, precio]) => {
        const tipologiaId = Number(key);
        if (!tipologiasSede.has(tipologiaId)) {
          throw new BadRequestException(
            `La tipología ${key} no pertenece a la sede ${sedeId}.`,
          );
        }
        if (
          typeof precio !== 'number' ||
          !Number.isFinite(precio) ||
          precio < 0
        ) {
          throw new BadRequestException(
            `El precio de la tipología ${key} debe ser un número mayor o igual a cero.`,
          );
        }
        return [tipologiaId, Math.round(precio)];
      }),
    );
  }

  private toFrontend(tarifa: Tarifa) {
    return {
      id: tarifa.id,
      sedeId: tarifa.sedeId,
      tarifaAbonoId: tarifa.tarifaAbonoId,
      nombre: tarifa.nombre,
      activa: tarifa.activa,
      precioBase: tarifa.precioBase,
      fechaInicio: tarifa.fechaInicio?.toISOString().slice(0, 10) ?? null,
      fechaFin: tarifa.fechaFin?.toISOString().slice(0, 10) ?? null,
      periodos: tarifa.periodos,
      precios: tarifa.precios,
    };
  }
}
