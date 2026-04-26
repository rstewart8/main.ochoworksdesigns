import { Component, OnInit, OnDestroy, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { 
  EmailMarketingService, 
  Campaign
} from '../_services/email-marketing.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-marketing-campaign-stats',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './marketing-campaign-stats.component.html',
  styleUrl: './marketing-campaign-stats.component.css'
})
export class MarketingCampaignStatsComponent implements OnInit, OnDestroy {
  campaign: Campaign | null = null;
  
  // Campaign ID
  emailCampaignId: number | null = null;
  campaignId: number | null = null;
  
  // State
  loading = true;
  error: string | null = null;
  
  // Active tab
  activeTab: 'overview' | 'links' = 'overview';
  
  private routeSubscription?: Subscription;
  private isBrowser: boolean;

  constructor(
    private marketingService: EmailMarketingService,
    private route: ActivatedRoute,
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  ngOnInit(): void {
    this.routeSubscription = this.route.params.subscribe(params => {
      if (params['campaignId']) {
        this.campaignId = parseInt(params['campaignId']);
      }

      if (params['id']) {
        this.emailCampaignId = parseInt(params['id']);
        this.loadCampaignData();
      }
    });
  }

  ngOnDestroy(): void {
    this.routeSubscription?.unsubscribe();
  }

  // ==========================================================================
  // LOAD DATA
  // ==========================================================================

  loadCampaignData(): void {
    if (!this.emailCampaignId || !this.campaignId) return;
    
    this.loading = true;
    this.error = null;
    
    // Load campaign details
    this.marketingService.getEmailCampaign(this.campaignId, this.emailCampaignId).subscribe({
      next: (campaign) => {
        this.campaign = campaign;
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading campaign:', err);
        this.error = err.message || 'Failed to load campaign.';
        this.loading = false;
      }
    });
  }

  // ==========================================================================
  // UTILITY METHODS
  // ==========================================================================

  setActiveTab(tab: 'overview' | 'links'): void {
    this.activeTab = tab;
  }

  formatNumber(num: number): string {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  }

  formatDate(dateString: string): string {
    return this.marketingService.formatDate(dateString);
  }

  formatDateTime(dateString: string): string {
    if (!dateString) return '—';
    // Handle MySQL format
    let date: Date;
    if (dateString.includes(' ') && !dateString.includes('T') && !dateString.includes('Z')) {
      date = new Date(dateString.replace(' ', 'T') + 'Z');
    } else {
      date = new Date(dateString);
    }
    return date.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  }

  getStatusClass(status: string): string {
    return this.marketingService.getStatusClass(status);
  }

  getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      'draft': 'Draft',
      'scheduled': 'Scheduled',
      'sending': 'Sending',
      'sent': 'Sent',
      'paused': 'Paused',
      'cancelled': 'Cancelled'
    };
    return labels[status] || status;
  }

  getSendStatusClass(status: string): string {
    const classes: Record<string, string> = {
      'sent': 'send-status-sent',
      'pending': 'send-status-pending',
      'failed': 'send-status-failed',
      'bounced': 'send-status-bounced',
      'complained': 'send-status-complained'
    };
    return classes[status] || 'send-status-default';
  }

  getSendStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      'sent': 'Sent',
      'pending': 'Pending',
      'failed': 'Failed',
      'bounced': 'Bounced',
      'complained': 'Complained'
    };
    return labels[status] || status;
  }

  getOpenRate(): number {
    if (!this.campaign || this.campaign.total_sent === 0) return 0;
    return Math.round((this.campaign.total_opened / this.campaign.total_sent) * 100 * 10) / 10;
  }

  getClickRate(): number {
    if (!this.campaign || this.campaign.total_sent === 0) return 0;
    return Math.round((this.campaign.total_clicked / this.campaign.total_sent) * 100 * 10) / 10;
  }

  getBounceRate(): number {
    if (!this.campaign || this.campaign.total_sent === 0) return 0;
    return Math.round((this.campaign.total_bounced / this.campaign.total_sent) * 100 * 10) / 10;
  }

  getClickToOpenRate(): number {
    if (!this.campaign || this.campaign.total_opened === 0) return 0;
    return Math.round((this.campaign.total_clicked / this.campaign.total_opened) * 100 * 10) / 10;
  }

  isTrackingEnabled(): boolean {
    if (!this.campaign) return false;
    const trackValue = (this.campaign as any).track;
    if (trackValue !== undefined && trackValue !== null) {
      return trackValue === true || trackValue === 1 || trackValue === '1';
    }
    return !!this.campaign.use_tracking;
  }

  goBack(): void {
    if (this.campaignId) {
      this.router.navigate(['/admin/marketing/campaigns', this.campaignId]);
      return;
    }
    this.router.navigate(['/admin/marketing/campaigns']);
  }

  getEditRoute(): any[] {
    if (!this.emailCampaignId) return ['/admin/marketing/campaigns'];
    if (this.campaignId) {
      return ['/admin/marketing/campaigns', this.campaignId, 'email-campaigns', this.emailCampaignId];
    }
    return ['/admin/marketing/campaigns', this.emailCampaignId];
  }

  trackByLinkFn(index: number, link: any): number {
    return link.id || index;
  }
}
