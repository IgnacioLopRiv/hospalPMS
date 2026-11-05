import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { LocationsRepository } from '../../domain/locations.repository';
import { createLocationsRepositoryStub } from '../../domain/testing/locations.repository.stub';

import { ConfigOptionsComponent } from './config-options.component';

describe('ConfigOptionsComponent', () => {
  let component: ConfigOptionsComponent;
  let fixture: ComponentFixture<ConfigOptionsComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [ConfigOptionsComponent],
      providers: [
        provideHttpClient(),
        provideRouter([]),
        { provide: LocationsRepository, useValue: createLocationsRepositoryStub() },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ConfigOptionsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  afterEach(async () => {
    const modals = Array.from(document.querySelectorAll('ion-modal'));
    await Promise.all(
      modals.map((modal) =>
        (modal as HTMLElement & { dismiss?: () => Promise<boolean> }).dismiss?.()
      )
    );
    fixture.destroy();
    document.querySelectorAll('ion-modal').forEach((modal) => modal.remove());
    (document.activeElement as HTMLElement | null)?.blur();
    document.body.classList.remove('modal-open', 'entry-modal-open');
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
