import { Component, CUSTOM_ELEMENTS_SCHEMA, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ModalPortalDirective } from './modal-portal.directive';
import { MODAL_LEAVING_CLASS } from '../animations/modal-leave';

@Component({
  standalone: true,
  imports: [ModalPortalDirective],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <ion-router-outlet>
      <div class="ion-page" [class.ion-page-hidden]="pageHidden()">
        @if (open()) {
        <div class="test-modal-backdrop" appModalPortal></div>
        }
      </div>
    </ion-router-outlet>
  `,
})
class HostInIonicPage {
  open = signal(true);
  pageHidden = signal(false);
}

@Component({
  standalone: true,
  imports: [ModalPortalDirective],
  template: `<div class="test-modal-backdrop" appModalPortal></div>`,
})
class HostOutsideIonicPage {}

describe('ModalPortalDirective', () => {
  afterEach(() => document.querySelectorAll('body > .test-modal-backdrop').forEach((el) => el.remove()));

  it('moves the modal to <body> while open and removes it after the leave animation', async () => {
    const fixture = TestBed.createComponent(HostInIonicPage);
    fixture.detectChanges();

    const modal = document.querySelector('.test-modal-backdrop') as HTMLElement;
    expect(modal.parentElement).toBe(document.body);
    expect(fixture.nativeElement.querySelector('.test-modal-backdrop')).toBeNull();

    fixture.componentInstance.open.set(false);
    fixture.detectChanges();
    expect(modal.classList).toContain(MODAL_LEAVING_CLASS);

    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(modal.isConnected).toBeFalse();
  });

  it('removes the modal immediately when its Ionic page is hidden', () => {
    const fixture = TestBed.createComponent(HostInIonicPage);
    fixture.detectChanges();
    const modal = document.querySelector('.test-modal-backdrop') as HTMLElement;
    modal.style.display = 'none';

    fixture.componentInstance.open.set(false);
    fixture.detectChanges();
    expect(modal.isConnected).toBeFalse();
  });

  it('hides the modal while its Ionic page is hidden', async () => {
    const fixture = TestBed.createComponent(HostInIonicPage);
    fixture.detectChanges();
    const modal = document.querySelector('.test-modal-backdrop') as HTMLElement;

    fixture.componentInstance.pageHidden.set(true);
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve));
    expect(modal.style.display).toBe('none');

    fixture.componentInstance.pageHidden.set(false);
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve));
    expect(modal.style.display).toBe('');
    fixture.destroy();
  });

  it('leaves the modal in place outside an Ionic page', () => {
    const fixture = TestBed.createComponent(HostOutsideIonicPage);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.test-modal-backdrop')).toBeTruthy();
  });
});
