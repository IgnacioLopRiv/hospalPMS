import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HomePage } from './home.page';
import { LocationsRepository } from '../../../../../features/locations/domain/locations.repository';
import { createLocationsRepositoryStub } from '../../../../../features/locations/domain/testing/locations.repository.stub';

describe('HomePage', () => {
  let component: HomePage;
  let fixture: ComponentFixture<HomePage>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        { provide: LocationsRepository, useValue: createLocationsRepositoryStub() },
      ],
    });
    fixture = TestBed.createComponent(HomePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
