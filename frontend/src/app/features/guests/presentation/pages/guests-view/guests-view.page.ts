import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  peopleOutline,
  bedOutline,
  calendarOutline,
  enterOutline,
  exitOutline,
  searchOutline,
  funnelOutline,
  star,
  ellipsisVerticalOutline,
  mailOutline,
  callOutline
} from 'ionicons/icons';

import { HostalService } from '../../../application/hostal.service';
import { GuestCardView } from '../../../../../shared/domain/hostal.model';

@Component({
  selector: 'app-guests-view',
  templateUrl: './guests-view.page.html',
  styleUrls: ['./guests-view.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonIcon
  ]
})
export class GuestsViewPage implements OnInit {
  guests: GuestCardView[] = [];
  filteredGuests: GuestCardView[] = [];
  selectedFilter: string = 'todos';
  searchTerm: string = '';

  constructor(private hostalService: HostalService) {
    addIcons({
      peopleOutline,
      bedOutline,
      calendarOutline,
      enterOutline,
      exitOutline,
      searchOutline,
      funnelOutline,
      star,
      ellipsisVerticalOutline,
      mailOutline,
      callOutline
    });
  }

  ngOnInit() {
    this.hostalService.guestsView$.subscribe((data) => {
      this.guests = data;
      this.applyFilters();
    });
  }

  setFilter(filter: string) {
    this.selectedFilter = filter;
    this.applyFilters();
  }

  applyFilters() {
    this.filteredGuests = this.guests.filter((guest) => {
      const matchesFilter =
        this.selectedFilter === 'todos' ? true :
        this.selectedFilter === 'hospedados' ? guest.status === 'hospedado' :
        this.selectedFilter === 'checkin' ? guest.status === 'checkin_hoy' :
        this.selectedFilter === 'checkout' ? guest.status === 'checkout_hoy' : true;

      const matchesSearch =
        guest.guestName.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        guest.roomNumber.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        guest.country.toLowerCase().includes(this.searchTerm.toLowerCase());

      return matchesFilter && matchesSearch;
    });
  }

  getCount(status?: string): number {
    if (!status) return this.guests.length;
    return this.guests.filter((g) => g.status === status).length;
  }
}