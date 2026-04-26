import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MarketingDashboardComponent } from './marketing-dashboard.component';

describe('MarketingDashboardComponent', () => {
  let component: MarketingDashboardComponent;
  let fixture: ComponentFixture<MarketingDashboardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MarketingDashboardComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MarketingDashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
