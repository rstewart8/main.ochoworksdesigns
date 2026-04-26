import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MarketingCampaignEditComponent } from './marketing-campaign-edit.component';

describe('MarketingCampaignEditComponent', () => {
  let component: MarketingCampaignEditComponent;
  let fixture: ComponentFixture<MarketingCampaignEditComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MarketingCampaignEditComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MarketingCampaignEditComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
