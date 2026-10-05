export interface FotoHabitacion {
  id: string | number;
  habitacionId: number | string;
  url: string;
  titulo?: string;
  descripcion?: string;
  fechaSubida: string;
}
