import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  Matches,
  Min,
} from 'class-validator';

export const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
export const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export type EstadoReservaFrontend =
  | 'CONFIRMADA'
  | 'HOSPEDADO'
  | 'CHECK-IN HOY'
  | 'CHECK-OUT HOY'
  | 'FINALIZADA'
  | 'CANCELADA';

export class ReservaDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  id_reserva?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  id_huesped?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  id_habitacion?: number;

  @IsOptional()
  @Matches(DATE_PATTERN)
  fecha_llegada?: string;

  @IsOptional()
  @Matches(DATE_PATTERN)
  fecha_salida?: string;

  @IsOptional()
  @Matches(TIME_PATTERN)
  hora_llegada?: string;

  @IsOptional()
  @Matches(TIME_PATTERN)
  hora_salida?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  cantidad_personas?: number;

  @IsOptional()
  @IsIn([
    'CONFIRMADA',
    'HOSPEDADO',
    'CHECK-IN HOY',
    'CHECK-OUT HOY',
    'FINALIZADA',
    'CANCELADA',
  ])
  estado_reserva?: EstadoReservaFrontend;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  precio_total?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  porcentaje_abono?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  monto_pagado?: number;

  @IsOptional()
  @IsIn(['transferencia', 'efectivo', 'debito', 'credito'])
  metodo_pago?: 'transferencia' | 'efectivo' | 'debito' | 'credito';

  @IsOptional()
  @IsBoolean()
  pago_completo?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sedeId?: number;
}

export class ReservaSedeQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sedeId!: number;
}
