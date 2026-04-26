import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MarketingCampaignsComponent } from './marketing-campaigns.component';

describe('MarketingCampaignsComponent', () => {
  let component: MarketingCampaignsComponent;
  let fixture: ComponentFixture<MarketingCampaignsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MarketingCampaignsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MarketingCampaignsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
