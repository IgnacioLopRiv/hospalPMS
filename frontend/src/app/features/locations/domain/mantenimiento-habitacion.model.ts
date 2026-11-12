export interface MantenimientoHabitacion {
  id: number;
  habitacionId: number;
  habitacionNumero: string;
  motivo: string;
  descripcion?: string;
  fechaInicio: string;
  /** Vacío mientras la habitación sigue en mantenimiento. */
  fechaTermino?: string;
}

export interface IniciarMantenimientoInput {
  motivo: string;
  descripcion?: string;
}

/** Motivos frecuentes sugeridos en el formulario (el usuario puede escribir otro). */
export const MOTIVOS_MANTENIMIENTO = [
  'Reparación eléctrica',
  'Gasfitería',
  'Pintura',
  'Mobiliario dañado',
  'Climatización',
  'Fumigación',
  'Otro',
] as const;
