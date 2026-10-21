import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MainPage } from './main.page';
import { LocationsRepository } from '../../../../locations/domain/locations.repository';
import { createLocationsRepositoryStub } from '../../../../locations/domain/testing/locations.repository.stub';

describe('MainPage', () => {
  let component: MainPage;
  let fixture: ComponentFixture<MainPage>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{ provide: LocationsRepository, useValue: createLocationsRepositoryStub() }],
    });
    fixture = TestBed.createComponent(MainPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
