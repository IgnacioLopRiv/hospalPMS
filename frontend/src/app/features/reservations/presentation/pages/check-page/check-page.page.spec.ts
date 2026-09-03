import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CheckPagePage } from './check-page.page';

describe('CheckPagePage', () => {
  let component: CheckPagePage;
  let fixture: ComponentFixture<CheckPagePage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(CheckPagePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
