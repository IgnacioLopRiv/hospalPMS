import {
  IsBoolean,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class PosConfigInputDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  proveedor!: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  /** Valores de campos `secret`. Vacío o ausente = mantener el guardado. */
  @IsOptional()
  @IsObject()
  credenciales?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  parametros?: Record<string, unknown>;
}
