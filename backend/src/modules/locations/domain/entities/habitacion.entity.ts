/**
 * Valor de dominio: Estado de Habitación
 *
 * Espeja el enum del schema de Prisma pero existe en la capa de dominio
 * para que la lógica de negocio no dependa de la infraestructura.
 */
export enum EstadoHabitacion {
  LIBRE = 'libre',
  OCUPADA = 'ocupada',
  EN_ASEO = 'en_aseo',
}

/**
 * Entidad de dominio: Habitacion
 */
export class Habitacion {
  constructor(
    public readonly id: number,
    public readonly sedeId: number,
    public tipologiaId: number | null,
    public numero: string,
    public tamanoM2: number | null,
    public disposicionMuebles: string | null,
    public descripcion: string | null,
    public estado: EstadoHabitacion,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}
}
