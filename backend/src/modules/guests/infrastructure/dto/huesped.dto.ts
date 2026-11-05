import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class HuespedDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sedeId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  id_sede?: number;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  documento?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  rutPasaporte?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  nombre?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  nombres?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  apellido?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  apellidos?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  nacionalidad?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  paisResidencia?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  telefono?: string;

  @IsOptional()
  @IsString()
  @MaxLength(254)
  email?: string;

  @IsOptional()
  @IsBoolean()
  es_recurrente?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  dias_ultimo_registro?: number;
}

export class HuespedSedeQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sedeId!: number;
}
