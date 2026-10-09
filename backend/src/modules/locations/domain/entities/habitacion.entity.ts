/**
 * Valor de dominio: Estado de Habitación
 *
 * Espeja el enum del schema de Prisma pero existe en la capa de dominio
 * para que la lógica de negocio no dependa de la infraestructura.
 */
export enum EstadoHabitacion {
  DISPONIBLE = 'DISPONIBLE',
  RESERVADA = 'RESERVADA',
  OCUPADA = 'OCUPADA',
  EN_LIMPIEZA = 'EN_LIMPIEZA',
  MANTENIMIENTO = 'MANTENIMIENTO',
}

/**
 * Entidad de dominio: Habitacion
 */
export class Habitacion {
  constructor(
    public readonly id: number,
    public readonly sedeId: number,
    public tipologiaId: number,
    public numero: string,
    public cantidadPersonas: number,
    public estado: EstadoHabitacion,
  ) {}
}
