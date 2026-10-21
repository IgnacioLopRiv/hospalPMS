import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReportesPage } from './reportes.page';
import { LocationsRepository } from '../../../../locations/domain/locations.repository';
import { createLocationsRepositoryStub } from '../../../../locations/domain/testing/locations.repository.stub';

describe('ReportesPage', () => {
  let component: ReportesPage;
  let fixture: ComponentFixture<ReportesPage>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{ provide: LocationsRepository, useValue: createLocationsRepositoryStub() }],
    });
    fixture = TestBed.createComponent(ReportesPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
