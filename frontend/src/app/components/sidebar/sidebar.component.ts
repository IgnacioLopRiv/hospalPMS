import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { IonButton } from '@ionic/angular/standalone';

@Component({
  selector: 'app-sidebar',
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.scss'],
  imports: [IonButton, RouterLink, RouterLinkActive],
})
export class SidebarComponent {}
