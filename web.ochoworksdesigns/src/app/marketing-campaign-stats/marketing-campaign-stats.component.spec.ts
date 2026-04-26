import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MarketingCampaignStatsComponent } from './marketing-campaign-stats.component';

describe('MarketingCampaignStatsComponent', () => {
  let component: MarketingCampaignStatsComponent;
  let fixture: ComponentFixture<MarketingCampaignStatsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MarketingCampaignStatsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MarketingCampaignStatsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
