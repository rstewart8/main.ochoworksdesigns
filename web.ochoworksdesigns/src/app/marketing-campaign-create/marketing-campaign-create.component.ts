import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import {
  EmailMarketingService,
  CreateCampaignRecordRequest
} from '../_services/email-marketing.service';

@Component({
  selector: 'app-marketing-campaign-create',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './marketing-campaign-create.component.html',
  styleUrl: './marketing-campaign-create.component.css'
})
export class MarketingCampaignCreateComponent {
  campaignName = '';

  saving = false;
  error: string | null = null;
  successMessage: string | null = null;
  createdCampaignId: number | null = null;

  constructor(
    private marketingService: EmailMarketingService,
    private router: Router
  ) {}

  createCampaign(): void {
    if (!this.validate()) return;

    this.saving = true;
    this.error = null;
    this.successMessage = null;
    this.createdCampaignId = null;

    const campaignPayload: CreateCampaignRecordRequest = {
      name: this.campaignName.trim(),
      status: 'active'
    };

    this.marketingService.createCampaignRecord(campaignPayload).subscribe({
      next: ({ id: campaignId }) => {
        this.saving = false;
        this.createdCampaignId = campaignId;
        this.successMessage = 'Campaign created successfully.';
      },
      error: (err) => {
        this.saving = false;
        this.error = err.message || 'Failed to create campaign.';
      }
    });
  }

  goToCampaignDetail(): void {
    if (!this.createdCampaignId) return;
    this.router.navigate(['/admin/marketing/campaigns', this.createdCampaignId]);
  }

  private validate(): boolean {
    this.error = null;

    if (!this.campaignName.trim()) {
      this.error = 'Campaign name is required.';
      return false;
    }

    return true;
  }
}
