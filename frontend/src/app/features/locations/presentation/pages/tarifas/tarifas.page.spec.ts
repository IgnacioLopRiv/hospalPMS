import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TarifasPage } from './tarifas.page';

describe('TarifasPage', () => {
  let component: TarifasPage;
  let fixture: ComponentFixture<TarifasPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(TarifasPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
