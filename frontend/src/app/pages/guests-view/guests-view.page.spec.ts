import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GuestsViewPage } from './guests-view.page';

describe('GuestsViewPage', () => {
  let component: GuestsViewPage;
  let fixture: ComponentFixture<GuestsViewPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(GuestsViewPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
