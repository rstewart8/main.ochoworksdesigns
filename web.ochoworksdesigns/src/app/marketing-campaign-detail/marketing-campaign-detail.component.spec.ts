import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of } from 'rxjs';
import { EmailMarketingService } from '../_services/email-marketing.service';

import { MarketingCampaignDetailComponent } from './marketing-campaign-detail.component';

describe('MarketingCampaignDetailComponent', () => {
  let component: MarketingCampaignDetailComponent;
  let fixture: ComponentFixture<MarketingCampaignDetailComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MarketingCampaignDetailComponent],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: { params: of({ campaignId: '1' }) }
        },
        {
          provide: Router,
          useValue: {
            navigate: jasmine.createSpy('navigate')
          }
        },
        {
          provide: EmailMarketingService,
          useValue: {
            getCampaignRecord: () => of({ id: 1, name: 'Test', status: 'active', created_at: '2026-01-01 00:00:00' }),
            getEmailCampaignsByCampaign: () => of({ campaigns: [], total: 0, limit: 100, offset: 0 }),
            deleteEmailCampaign: () => of(undefined),
            getStatusClass: () => 'status-draft',
            formatDate: () => 'Jan 1, 2026',
            formatDateTime: () => 'Jan 1, 2026, 09:00 AM'
          }
        }
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MarketingCampaignDetailComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
