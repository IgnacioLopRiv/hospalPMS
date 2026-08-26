import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Huesped, Habitacion, Tipologia, Reserva, GuestCardView } from '../models/hostal.model';

@Injectable({
  providedIn: 'root'
})
export class HostalService {
  private readonly PREFIX = 'hospal_db_';
  private guestsViewSubject = new BehaviorSubject<GuestCardView[]>([]);
  public guestsView$: Observable<GuestCardView[]> = this.guestsViewSubject.asObservable();

  private readonly TODAY = new Date('2026-06-16T00:00:00');

  constructor() {
    this.initDatabase();
  }

  private initDatabase(): void {
    if (!localStorage.getItem(this.PREFIX + 'huespedes')) {
      const tipologias: Tipologia[] = [
        { id_tipologia: 1, nombre_tipologia: 'Habitación Privada', capacidad: 2 },
        { id_tipologia: 2, nombre_tipologia: 'Dorm 4-camas', capacidad: 4 },
        { id_tipologia: 3, nombre_tipologia: 'Dorm 6-camas', capacidad: 6 },
        { id_tipologia: 4, nombre_tipologia: 'Dorm 8-camas', capacidad: 8 },
      ];

      const habitaciones: Habitacion[] = [
        { id_habitacion: 1, numero_habitacion: '101', id_hostal: 1, id_tipologia: 1 },
        { id_habitacion: 2, numero_habitacion: '102', id_hostal: 1, id_tipologia: 1 },
        { id_habitacion: 3, numero_habitacion: '104', id_hostal: 1, id_tipologia: 1 },
        { id_habitacion: 4, numero_habitacion: '204', id_hostal: 1, id_tipologia: 3 },
        { id_habitacion: 5, numero_habitacion: '205', id_hostal: 1, id_tipologia: 3 },
        { id_habitacion: 6, numero_habitacion: '207', id_hostal: 1, id_tipologia: 4 },
        { id_habitacion: 7, numero_habitacion: '306', id_hostal: 1, id_tipologia: 2 },
        { id_habitacion: 8, numero_habitacion: '308', id_hostal: 1, id_tipologia: 2 },
      ];

      const huespedes: Huesped[] = [
        { id_huesped: 1, nombre: 'Valentin', apellido: 'Torres', nacionalidad: 'Argentina', telefono: '+549110000', email: 'v@test.com', es_recurrente: true },
        { id_huesped: 2, nombre: 'Marco', apellido: 'Diaz', nacionalidad: 'Colombia', telefono: '+573000000', email: 'm@test.com' },
        { id_huesped: 3, nombre: 'Alejandro', apellido: 'Schmidt', nacionalidad: 'Alemania', telefono: '+491500000', email: 'a@test.com', es_recurrente: true },
        { id_huesped: 4, nombre: 'Luca', apellido: 'Ferrari', nacionalidad: 'Italia', telefono: '+393300000', email: 'l@test.com' },
        { id_huesped: 5, nombre: 'Priya', apellido: 'Nair', nacionalidad: 'India', telefono: '+919800000', email: 'p@test.com', es_recurrente: true, dias_ultimo_registro: 45 },
        { id_huesped: 6, nombre: 'James', apellido: 'Okonkwo', nacionalidad: 'Nigeria', telefono: '+234800000', email: 'j@test.com' },
        { id_huesped: 7, nombre: 'Sofia', apellido: 'Martínez', nacionalidad: 'México', telefono: '+525500000', email: 's@test.com' },
        { id_huesped: 8, nombre: 'Ethan', apellido: 'Brown', nacionalidad: 'EE.UU.', telefono: '+155500000', email: 'e@test.com', es_recurrente: true, dias_ultimo_registro: 120 },
      ];

      const reservas: Reserva[] = [
        { id_reserva: 1, id_huesped: 1, id_habitacion: 4, fecha_llegada: '2026-06-14', fecha_salida: '2026-06-19', estado_reserva: 'HOSPEDADO' },
        { id_reserva: 2, id_huesped: 2, id_habitacion: 1, fecha_llegada: '2026-06-16', fecha_salida: '2026-06-20', estado_reserva: 'CHECK-IN HOY' },
        { id_reserva: 3, id_huesped: 3, id_habitacion: 8, fecha_llegada: '2026-06-12', fecha_salida: '2026-06-16', estado_reserva: 'CHECK-OUT HOY' },
        { id_reserva: 4, id_huesped: 4, id_habitacion: 5, fecha_llegada: '2026-06-15', fecha_salida: '2026-06-22', estado_reserva: 'HOSPEDADO' },
        { id_reserva: 5, id_huesped: 5, id_habitacion: 2, fecha_llegada: '2026-06-16', fecha_salida: '2026-06-18', estado_reserva: 'CHECK-IN HOY' },
        { id_reserva: 6, id_huesped: 6, id_habitacion: 6, fecha_llegada: '2026-06-13', fecha_salida: '2026-06-16', estado_reserva: 'CHECK-OUT HOY' },
        { id_reserva: 7, id_huesped: 7, id_habitacion: 7, fecha_llegada: '2026-06-11', fecha_salida: '2026-06-18', estado_reserva: 'HOSPEDADO' },
        { id_reserva: 8, id_huesped: 8, id_habitacion: 3, fecha_llegada: '2026-06-16', fecha_salida: '2026-06-21', estado_reserva: 'CHECK-IN HOY' },
      ];

      localStorage.setItem(this.PREFIX + 'tipologias', JSON.stringify(tipologias));
      localStorage.setItem(this.PREFIX + 'habitaciones', JSON.stringify(habitaciones));
      localStorage.setItem(this.PREFIX + 'huespedes', JSON.stringify(huespedes));
      localStorage.setItem(this.PREFIX + 'reservas', JSON.stringify(reservas));
    }

    this.refreshView();
  }

  public refreshView(): void {
    const huespedes: Huesped[] = JSON.parse(localStorage.getItem(this.PREFIX + 'huespedes') || '[]');
    const habitaciones: Habitacion[] = JSON.parse(localStorage.getItem(this.PREFIX + 'habitaciones') || '[]');
    const tipologias: Tipologia[] = JSON.parse(localStorage.getItem(this.PREFIX + 'tipologias') || '[]');
    const reservas: Reserva[] = JSON.parse(localStorage.getItem(this.PREFIX + 'reservas') || '[]');

    const colors: ('blue' | 'green' | 'orange' | 'purple')[] = ['purple', 'orange', 'green', 'blue'];

    const joinedData: GuestCardView[] = reservas.map((res, index) => {
      const huesped = huespedes.find(h => h.id_huesped === res.id_huesped);
      const habitacion = habitaciones.find(hab => hab.id_habitacion === res.id_habitacion);
      const tipologia = tipologias.find(t => t.id_tipologia === habitacion?.id_tipologia);

      const fLlegada = new Date(res.fecha_llegada + 'T00:00:00');
      const fSalida = new Date(res.fecha_salida + 'T00:00:00');

      const totalNoches = Math.round((fSalida.getTime() - fLlegada.getTime()) / (1000 * 3600 * 24));
      const nochesTranscurridas = Math.max(0, Math.round((this.TODAY.getTime() - fLlegada.getTime()) / (1000 * 3600 * 24)));
      const nochesRestantes = Math.max(0, Math.round((fSalida.getTime() - this.TODAY.getTime()) / (1000 * 3600 * 24)));

      let statusType: 'hospedado' | 'checkin_hoy' | 'checkout_hoy' = 'hospedado';
      let m1Label = 'Lleva';
      let m1Value = `${nochesTranscurridas} ${nochesTranscurridas === 1 ? 'noche' : 'noches'}`;
      let m2Label = 'Sale en';
      let m2Value = `${nochesRestantes} ${nochesRestantes === 1 ? 'noche' : 'noches'}`;

      if (res.estado_reserva === 'CHECK-IN HOY') {
        statusType = 'checkin_hoy';
        m1Label = 'Duración';
        m1Value = `${totalNoches} noches`;
        m2Label = 'Sale el';
        m2Value = `${String(fSalida.getMonth() + 1).padStart(2, '0')}/${String(fSalida.getDate()).padStart(2, '0')}`;
      } else if (res.estado_reserva === 'CHECK-OUT HOY') {
        statusType = 'checkout_hoy';
        m1Label = 'Total estadía';
        m1Value = `${totalNoches} noches`;
        m2Label = 'Entró el';
        m2Value = `${String(fLlegada.getMonth() + 1).padStart(2, '0')}/${String(fLlegada.getDate()).padStart(2, '0')}`;
      }

      const recNote = huesped?.dias_ultimo_registro 
        ? `Recurrente · último hace ${huesped.dias_ultimo_registro} días`
        : (huesped?.es_recurrente && statusType === 'checkout_hoy' ? 'Huésped recurrente' : undefined);

      return {
        id_reserva: res.id_reserva,
        initials: huesped ? `${huesped.nombre[0]}${huesped.apellido[0]}`.toUpperCase() : 'NA',
        guestName: huesped ? `${huesped.nombre} ${huesped.apellido.slice(0, 3)}...` : 'Desconocido',
        country: huesped?.nacionalidad || '',
        roomNumber: habitacion?.numero_habitacion || '',
        roomType: tipologia?.nombre_tipologia || '',
        dateRange: `${String(fLlegada.getMonth() + 1).padStart(2, '0')}/${String(fLlegada.getDate()).padStart(2, '0')} → ${String(fSalida.getMonth() + 1).padStart(2, '0')}/${String(fSalida.getDate()).padStart(2, '0')}`,
        status: statusType,
        statusBadge: res.estado_reserva,
        cardColor: colors[index % colors.length],
        metric1Label: m1Label,
        metric1Value: m1Value,
        metric2Label: m2Label,
        metric2Value: m2Value,
        recurrentNote: recNote,
        isVip: huesped?.es_recurrente
      };
    });

    this.guestsViewSubject.next(joinedData);
  }
}