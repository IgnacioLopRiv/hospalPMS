import { Observable } from 'rxjs';

export interface ResumenReportes {
  sedeId: number;
  fecha: string;
  habitaciones: {
    total: number;
    ocupadas: number;
    disponibles: number;
    tasaOcupacion: number;
  };
  reservas: {
    total: number;
    mes: number;
    canceladasMes: number;
    pendientes: number;
    enCurso: number;
    finalizadas: number;
    canceladas: number;
    estadiaPromedioNoches: number;
  };
  ingresos: {
    mes: number;
    mesAnterior: number;
    anio: number;
    anioAnterior: number;
    pendiente: number;
  };
  inventario: {
    totalInsumos: number;
    bajoMinimo: number;
  };
}

export abstract class ReportesRepository {
  abstract getResumen(sedeId: number): Observable<ResumenReportes>;
  /** Descarga el reporte de gestión en PDF. `sedeId: null` = todas las sedes. Fechas en YYYY-MM-DD (inclusivas). */
  abstract descargarPdf(filtros: FiltrosReportePdf): Observable<Blob>;
}

export interface FiltrosReportePdf {
  sedeId: number | null;
  desde: string;
  hasta: string;
}
