import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MarketingCampaignSendComponent } from './marketing-campaign-send.component';

describe('MarketingCampaignSendComponent', () => {
  let component: MarketingCampaignSendComponent;
  let fixture: ComponentFixture<MarketingCampaignSendComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MarketingCampaignSendComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MarketingCampaignSendComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
