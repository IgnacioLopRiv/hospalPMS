import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { CreateHuesped, Huesped, HuespedRepository } from '../domain/huesped.repository';

interface HuespedApiDto {
  id_huesped: number;
  id_sede: number;
  documento: string;
  nombre: string;
  apellido: string;
  nacionalidad: string;
  telefono: string;
  email: string;
  es_recurrente?: boolean;
  dias_ultimo_registro?: number;
}

@Injectable()
export class HuespedHttpRepository extends HuespedRepository {
  private readonly http = inject(HttpClient);
  private readonly endpoint = `${environment.apiUrl}/huespedes`;

  list(sedeId?: number): Observable<Huesped[]> {
    return this.http.get<HuespedApiDto[]>(this.endpoint, {
      params: sedeId ? { sedeId } : undefined,
    }).pipe(map((rows) => rows.map((row) => this.toDomain(row))));
  }

  create(data: CreateHuesped): Observable<Huesped> {
    return this.http.post<HuespedApiDto>(this.endpoint, this.toApi(data))
      .pipe(map((row) => this.toDomain(row)));
  }

  update(id: number, data: Partial<CreateHuesped>, sedeId?: number): Observable<Huesped> {
    return this.http.patch<HuespedApiDto>(`${this.endpoint}/${id}`, this.toApi(data), {
      params: sedeId ? { sedeId } : undefined,
    }).pipe(map((row) => this.toDomain(row)));
  }

  remove(id: number, sedeId?: number): Observable<void> {
    return this.http.delete<{ deleted: boolean }>(`${this.endpoint}/${id}`, {
      params: sedeId ? { sedeId } : undefined,
    }).pipe(map(() => undefined));
  }

  private toDomain(row: HuespedApiDto): Huesped {
    return {
      id: row.id_huesped,
      sedeId: row.id_sede,
      rutPasaporte: row.documento,
      nombres: row.nombre,
      apellidos: row.apellido,
      paisResidencia: row.nacionalidad,
      telefono: row.telefono,
      email: row.email,
      esRecurrente: row.es_recurrente,
      diasUltimoRegistro: row.dias_ultimo_registro,
    };
  }

  private toApi(data: Partial<CreateHuesped>) {
    return {
      ...(data.sedeId !== undefined ? { id_sede: data.sedeId, sedeId: data.sedeId } : {}),
      ...(data.rutPasaporte !== undefined ? { documento: data.rutPasaporte } : {}),
      ...(data.nombres !== undefined ? { nombre: data.nombres } : {}),
      ...(data.apellidos !== undefined ? { apellido: data.apellidos } : {}),
      ...(data.paisResidencia !== undefined ? { nacionalidad: data.paisResidencia } : {}),
      ...(data.telefono !== undefined ? { telefono: data.telefono } : {}),
      ...(data.email !== undefined ? { email: data.email } : {}),
      ...(data.esRecurrente !== undefined ? { es_recurrente: data.esRecurrente } : {}),
      ...(data.diasUltimoRegistro !== undefined ? { dias_ultimo_registro: data.diasUltimoRegistro } : {}),
    };
  }
}