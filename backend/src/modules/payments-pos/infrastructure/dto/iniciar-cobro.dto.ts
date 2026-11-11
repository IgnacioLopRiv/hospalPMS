import { TipoOperacion } from '@prisma/client';
import { IsIn, IsInt, IsObject, IsOptional, Min } from 'class-validator';

const TIPOS_COBRO: TipoOperacion[] = [
  'ABONO',
  'PAGO_FINAL',
  'PAGO_SERVICIO_ADICIONAL',
];

export class IniciarCobroDto {
  @IsInt()
  @Min(1)
  reservaId!: number;

  @IsInt({ message: 'El monto debe ser un número entero.' })
  @Min(1, { message: 'El monto debe ser mayor que cero.' })
  monto!: number;

  @IsIn(TIPOS_COBRO, {
    message: `tipoOperacion inválido. Opciones: ${TIPOS_COBRO.join(', ')}.`,
  })
  tipoOperacion!: TipoOperacion;

  @IsOptional()
  @IsIn(['DEBITO', 'CREDITO'], {
    message: 'tipoTarjeta inválido. Opciones: DEBITO, CREDITO.',
  })
  tipoTarjeta?: 'DEBITO' | 'CREDITO';
}

export class ResultadoLocalDto {
  /** Respuesta del agente local, sin modificar; la normaliza el proveedor. */
  @IsObject()
  resultado!: Record<string, unknown>;
}
