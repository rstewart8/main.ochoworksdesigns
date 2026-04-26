import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import {
  Campaign,
  CampaignRecord,
  CampaignsListResponse,
  EmailMarketingService
} from '../_services/email-marketing.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-marketing-campaign-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './marketing-campaign-detail.component.html',
  styleUrl: './marketing-campaign-detail.component.css'
})
export class MarketingCampaignDetailComponent implements OnInit, OnDestroy {
  campaignId: number | null = null;
  campaign: CampaignRecord | null = null;

  emailCampaigns: Campaign[] = [];
  loading = true;
  loadingEmailCampaigns = true;
  error: string | null = null;
  successMessage: string | null = null;
  cumulativeTotals = {
    total_recipients: 0,
    total_sent: 0,
    total_opened: 0,
    total_clicked: 0,
    total_bounced: 0,
    total_unsubscribed: 0
  };

  searchQuery = '';
  selectedStatus = '';

  showDeleteModal = false;
  emailCampaignToDelete: Campaign | null = null;
  deleting = false;

  private routeSub?: Subscription;

  statusOptions = [
    { value: '', label: 'All Statuses' },
    { value: 'draft', label: 'Draft' },
    { value: 'scheduled', label: 'Scheduled' },
    { value: 'sending', label: 'Sending' },
    { value: 'sent', label: 'Sent' },
    { value: 'paused', label: 'Paused' },
    { value: 'cancelled', label: 'Cancelled' }
  ];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private marketingService: EmailMarketingService
  ) {}

  ngOnInit(): void {
    this.routeSub = this.route.params.subscribe(params => {
      const campaignId = Number(params['campaignId']);
      if (!Number.isFinite(campaignId) || campaignId <= 0) {
        this.error = 'Invalid campaign id.';
        this.loading = false;
        this.loadingEmailCampaigns = false;
        return;
      }

      this.campaignId = campaignId;
      this.loadCampaignRecord();
      this.loadEmailCampaigns();
    });
  }

  ngOnDestroy(): void {
    this.routeSub?.unsubscribe();
  }

  loadCampaignRecord(): void {
    if (!this.campaignId) return;

    this.loading = true;
    this.error = null;

    this.marketingService.getCampaignRecord(this.campaignId).subscribe({
      next: (campaign) => {
        this.campaign = campaign;
        this.loading = false;
      },
      error: (err) => {
        this.error = err.message || 'Failed to load campaign.';
        this.loading = false;
      }
    });
  }

  loadEmailCampaigns(): void {
    if (!this.campaignId) return;

    this.loadingEmailCampaigns = true;

    this.marketingService.getEmailCampaignsByCampaign(
      this.campaignId,
      1,
      100,
      this.searchQuery || undefined,
      this.selectedStatus || undefined
    ).subscribe({
      next: (response: CampaignsListResponse) => {
        console.log('Email campaigns response:', response);
        this.emailCampaigns = response.campaigns || [];
        this.calculateCumulativeTotals();
        this.loadingEmailCampaigns = false;
      },
      error: (err) => {
        this.error = err.message || 'Failed to load email campaigns.';
        this.loadingEmailCampaigns = false;
      }
    });
  }

  onSearch(): void {
    this.loadEmailCampaigns();
  }

  onStatusChange(): void {
    this.loadEmailCampaigns();
  }

  clearFilters(): void {
    this.searchQuery = '';
    this.selectedStatus = '';
    this.loadEmailCampaigns();
  }

  createEmailCampaign(): void {
    if (!this.campaignId) return;
    this.router.navigate(['/admin/marketing/campaigns', this.campaignId, 'email-campaigns', 'new']);
  }

  editEmailCampaign(emailCampaign: Campaign): void {
    if (!this.campaignId) return;
    this.router.navigate(['/admin/marketing/campaigns', this.campaignId, 'email-campaigns', emailCampaign.id]);
  }

  confirmDeleteEmailCampaign(emailCampaign: Campaign): void {
    this.emailCampaignToDelete = emailCampaign;
    this.showDeleteModal = true;
  }

  cancelDeleteEmailCampaign(): void {
    this.emailCampaignToDelete = null;
    this.showDeleteModal = false;
  }

  deleteEmailCampaign(): void {
    if (!this.emailCampaignToDelete) return;

    this.deleting = true;
    this.marketingService.deleteEmailCampaign(this.emailCampaignToDelete.id).subscribe({
      next: () => {
        this.deleting = false;
        this.showDeleteModal = false;
        this.emailCampaignToDelete = null;
        this.successMessage = 'Email campaign deleted successfully.';
        this.loadEmailCampaigns();
        this.clearMessageAfterDelay();
      },
      error: (err) => {
        this.deleting = false;
        this.error = err.message || 'Failed to delete email campaign.';
      }
    });
  }

  hasActiveFilters(): boolean {
    return !!(this.searchQuery || this.selectedStatus);
  }

  getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      draft: 'Draft',
      scheduled: 'Scheduled',
      sending: 'Sending',
      sent: 'Sent',
      paused: 'Paused',
      cancelled: 'Cancelled'
    };
    return labels[status] || status;
  }

  getStatusClass(status: string): string {
    return this.marketingService.getStatusClass(status);
  }

  calculateCumulativeTotals(): void {
    this.cumulativeTotals = this.emailCampaigns.reduce((acc, item) => {
      acc.total_recipients += this.toNumber(item.total_recipients);
      acc.total_sent += this.toNumber(item.total_sent);
      acc.total_opened += this.toNumber(item.total_opened);
      acc.total_clicked += this.toNumber(item.total_clicked);
      acc.total_bounced += this.toNumber(item.total_bounced);
      acc.total_unsubscribed += this.toNumber(item.total_unsubscribed);
      return acc;
    }, {
      total_recipients: 0,
      total_sent: 0,
      total_opened: 0,
      total_clicked: 0,
      total_bounced: 0,
      total_unsubscribed: 0
    });
  }

  toNumber(value: unknown): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : 0;
  }

  formatDate(dateString: string): string {
    return this.marketingService.formatDate(dateString);
  }

  formatDateTime(dateString: string): string {
    return this.marketingService.formatDateTime(dateString);
  }

  private clearMessageAfterDelay(): void {
    setTimeout(() => {
      this.successMessage = null;
      this.error = null;
    }, 3000);
  }
}
