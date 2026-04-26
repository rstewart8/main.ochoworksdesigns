import { Component, OnInit, OnDestroy, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterModule } from '@angular/router';
import { EmailMarketingService, MarketingStats } from '../_services/email-marketing.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-marketing-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './marketing-dashboard.component.html',
  styleUrl: './marketing-dashboard.component.css'
})
export class MarketingDashboardComponent implements OnInit, OnDestroy {
  stats: MarketingStats | null = null;
  loading = true;
  error: string | null = null;
  
  private isBrowser: boolean;
  private subscription?: Subscription;

  constructor(
    private marketingService: EmailMarketingService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  ngOnInit(): void {
    this.loadStats();
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  loadStats(): void {
    this.loading = true;
    this.error = null;

    this.subscription = this.marketingService.getStats().subscribe({
      next: (stats) => {
        this.stats = stats;
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading marketing stats:', err);
        this.error = err.message || 'Failed to load marketing statistics.';
        this.loading = false;
      }
    });
  }

  // Utility methods for template
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
    return this.marketingService.formatDateTime(dateString);
  }

  getOpenRate(): number {
    if (!this.stats) return 0;
    return this.stats.emails.open_rate;
  }

  getSubscriptionRate(): number {
    if (!this.stats || this.stats.contacts.total === 0) return 0;
    return Math.round((this.stats.contacts.subscribed / this.stats.contacts.total) * 100);
  }

  // Chart data helpers
  getActivityChartData(): { labels: string[]; sent: number[]; opened: number[] } {
    if (!this.stats || !this.stats.recent_activity) {
      return { labels: [], sent: [], opened: [] };
    }

    return {
      labels: this.stats.recent_activity.map(a => this.formatChartDate(a.date)),
      sent: this.stats.recent_activity.map(a => a.sent),
      opened: this.stats.recent_activity.map(a => a.opened)
    };
  }

  formatChartDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  getMaxActivityValue(): number {
    if (!this.stats || !this.stats.recent_activity) return 100;
    const maxSent = Math.max(...this.stats.recent_activity.map(a => a.sent), 1);
    const maxOpened = Math.max(...this.stats.recent_activity.map(a => a.opened), 1);
    return Math.max(maxSent, maxOpened);
  }

  getBarHeight(value: number): number {
    const max = this.getMaxActivityValue();
    return (value / max) * 100;
  }

  // Status helpers for top campaigns
  getStatusClass(status: string): string {
    return this.marketingService.getStatusClass(status);
  }

  trackByCampaignFn(index: number, campaign: any): number {
    return campaign.id;
  }

  trackByActivityFn(index: number, activity: any): string {
    return activity.date;
  }

  // Follow-up helpers
  getFollowUpCompletionRate(): number {
    if (!this.stats?.followups || this.stats.followups.total === 0) return 0;
    return Math.round((this.stats.followups.completed / this.stats.followups.total) * 100);
  }

  trackByFollowUpFn(index: number, followup: any): number {
    return followup.id;
  }

  getContactDisplayName(followup: any): string {
    if (followup.firstname || followup.lastname) {
      return `${followup.firstname || ''} ${followup.lastname || ''}`.trim();
    }
    return followup.email || 'Unknown';
  }

  isOverdue(followup: any): boolean {
    return followup.days_overdue !== undefined && followup.days_overdue > 0;
  }

  getUrgencyClass(daysUntil: number | undefined): string {
    if (daysUntil === undefined || daysUntil < 0) return 'urgent';
    if (daysUntil === 0) return 'today';
    if (daysUntil <= 2) return 'soon';
    return 'normal';
  }

  getDaysText(followup: any): string {
    if (followup.days_overdue !== undefined) {
      const days = followup.days_overdue;
      if (days === 0) return 'Today';
      if (days === 1) return '1 day overdue';
      return `${days} days overdue`;
    }
    
    if (followup.days_until !== undefined) {
      const days = followup.days_until;
      if (days === 0) return 'Today';
      if (days === 1) return 'Tomorrow';
      if (days === 2) return 'In 2 days';
      return `In ${days} days`;
    }
    
    return '';
  }
}