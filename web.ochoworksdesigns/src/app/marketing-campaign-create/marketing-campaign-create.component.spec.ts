import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { Router } from '@angular/router';
import { EmailMarketingService } from '../_services/email-marketing.service';

import { MarketingCampaignCreateComponent } from './marketing-campaign-create.component';

describe('MarketingCampaignCreateComponent', () => {
  let component: MarketingCampaignCreateComponent;
  let fixture: ComponentFixture<MarketingCampaignCreateComponent>;

  beforeEach(async () => {
    const marketingServiceMock = {
      isValidEmail: () => true,
      createCampaignRecord: () => of({ id: 1 }),
      createEmailCampaign: () => of({ id: 2 })
    };

    const routerMock = {
      navigate: jasmine.createSpy('navigate')
    };

    await TestBed.configureTestingModule({
      imports: [MarketingCampaignCreateComponent],
      providers: [
        { provide: EmailMarketingService, useValue: marketingServiceMock },
        { provide: Router, useValue: routerMock }
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MarketingCampaignCreateComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
