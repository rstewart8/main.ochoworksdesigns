import { Component, OnInit, OnDestroy, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import {
  EmailMarketingService,
  Campaign,
  Contact,
  CreateEmailCampaignRequest
} from '../_services/email-marketing.service';
import { Subscription } from 'rxjs';

// Interface for link pairs
export interface CampaignLink {
  link_name: string;
  link_url: string;
}

type CampaignFormModel = Partial<Campaign> & {
  track?: boolean;
};

@Component({
  selector: 'app-marketing-campaign-edit',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './marketing-campaign-edit.component.html',
  styleUrl: './marketing-campaign-edit.component.css'
})
export class MarketingCampaignEditComponent implements OnInit, OnDestroy {
  private readonly defaultFromEmail = 'randy@ochoworksdesigns.com';
  private readonly defaultFromName = 'OchoWorks Designs and Drafting';
  private readonly defaultUseTracking = false;

  // Campaign data
  campaign: CampaignFormModel = {
    name: '',
    subject: '',
    preview_text: '',
    content: '',
    from_name: this.defaultFromName,
    from_email: this.defaultFromEmail,
    reply_to: this.defaultFromEmail,
    track: this.defaultUseTracking,
    status: 'draft'
  };

  // Campaign links (multiple name/url pairs)
  campaignLinks: CampaignLink[] = [];

  isEditMode = false;
  campaignId: number | null = null;
  emailCampaignId: number | null = null;

  // Active tab
  activeTab: 'content' | 'settings' | 'preview' | 'send' = 'content';

  // State
  loading = true;
  saving = false;
  error: string | null = null;
  successMessage: string | null = null;

  // Send campaign
  showSendModal = false;
  sendMode: 'filters' | 'contacts' = 'filters';
  sendFilters = {
    tag: '',
    source: '',
    subscribedOnly: true
  };
  recipientCount = 0;
  loadingRecipients = false;
  sending = false;
  // Contact picker (when sendMode === 'contacts')
  selectedContactIds: number[] = [];
  contactsForPicker: Contact[] = [];
  loadingContacts = false;
  contactSearch = '';
  contactsTotal = 0;

  // Schedule campaign
  showScheduleModal = false;
  scheduleDateTime = '';
  scheduling = false;

  // Test email
  showTestModal = false;
  testEmail = '';
  sendingTest = false;

  // Available filter options
  availableTags: string[] = [];
  availableSources: string[] = [];

  // HTML Editor helpers
  showLinkModal = false;
  linkUrl = '';
  linkText = '';

  // Personalization tokens
  personalizationTokens = [
    { token: '{{name}}', label: 'Full Name' },
    { token: '{{first_name}}', label: 'First Name' },
    { token: '{{last_name}}', label: 'Last Name' },
    { token: '{{email}}', label: 'Email' },
    { token: '{{company}}', label: 'Company' },
    { token: '{{unsubscribe_url}}', label: 'Unsubscribe Link' }
  ];

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
      console.log('Initializing MarketingCampaignEditComponent with params: ', params);
      if (params['campaignId']) {
        this.campaignId = parseInt(params['campaignId']);
      }

      if (params['id'] && params['id'] !== 'new') {
        this.emailCampaignId = parseInt(params['id']);
        this.isEditMode = true;
        this.loadCampaign();
      } else {
        this.isEditMode = false;
        this.loading = false;
        this.setDefaultScheduleTime();
      }
    });

    this.loadFilterOptions();
  }

  ngOnDestroy(): void {
    this.routeSubscription?.unsubscribe();
  }

  // ==========================================================================
  // CAMPAIGN LINKS MANAGEMENT
  // ==========================================================================

  addLink(): void {
    this.campaignLinks.push({
      link_name: '',
      link_url: ''
    });
  }

  removeLink(index: number): void {
    this.campaignLinks.splice(index, 1);
  }

  trackByIndex(index: number): number {
    return index;
  }

  // ==========================================================================
  // LOAD DATA
  // ==========================================================================

  loadCampaign(): void {
    console.log('Loading campaign with emailCampaignId:', this.emailCampaignId, 'and campaignId:', this.campaignId);
    if (!this.emailCampaignId || !this.campaignId) return;

    this.loading = true;
    this.error = null;
    console.log('Loading email campaign with ID:', this.emailCampaignId, 'under campaign ID:', this.campaignId);
    this.marketingService.getEmailCampaign(this.campaignId, this.emailCampaignId).subscribe({
      next: (campaign) => {
        this.campaign = {
          ...campaign,
          from_name: campaign.from_name?.trim() || this.defaultFromName,
          from_email: campaign.from_email?.trim() || this.defaultFromEmail,
          reply_to: campaign.reply_to?.trim() || this.defaultFromEmail,
          track: campaign.track !== undefined
            ? campaign.track === 1 || campaign.track === true
            : (campaign.use_tracking ?? this.defaultUseTracking)
        };
        
        // Load links if they exist in the campaign data
        if (campaign.links && Array.isArray(campaign.links)) {
          this.campaignLinks = campaign.links.map((link: any) => ({
            link_name: link.link_name || '',
            link_url: link.link_url || ''
          }));
        } else {
          this.campaignLinks = [];
        }
        
        this.loading = false;
        this.setDefaultScheduleTime();
      },
      error: (err) => {
        console.error('Error loading campaign:', err);
        this.error = err.message || 'Failed to load campaign.';
        this.loading = false;
      }
    });
  }

  loadFilterOptions(): void {
    // Load contacts to get unique tags and sources
    this.marketingService.getContacts(1, 1000).subscribe({
      next: (response) => {
        const tags = new Set<string>();
        const sources = new Set<string>();

        response.contacts.forEach(contact => {
          if (contact.tags) {
            contact.tags.forEach(tag => tags.add(tag));
          }
          if (contact.source) {
            sources.add(contact.source);
          }
        });

        this.availableTags = Array.from(tags).sort();
        this.availableSources = Array.from(sources).sort();
      },
      error: (err) => {
        console.error('Error loading filter options:', err);
      }
    });
  }

  // ==========================================================================
  // SAVE CAMPAIGN
  // ==========================================================================

  saveCampaign(andContinue: boolean = false): void {
    if (!this.validateCampaign()) return;

    this.saving = true;
    this.error = null;
    this.successMessage = null;

    const campaignData = this.prepareCampaignForApi();

    if (this.isEditMode && this.emailCampaignId && this.campaignId) {
      this.marketingService.updateEmailCampaign(this.campaignId, this.emailCampaignId, campaignData).subscribe({
        next: () => {
          this.saving = false;
          this.successMessage = 'Campaign saved successfully!';
          this.clearMessageAfterDelay();
          if (!andContinue) this.goBack();
        },
        error: (err) => {
          this.saving = false;
          this.error = err.message || 'Failed to save campaign.';
        }
      });
    } else {
      if (!this.campaignId) {
        this.saving = false;
        this.error = 'Parent campaign is missing. Please create/select a campaign first.';
        return;
      }

      const createPayload: CreateEmailCampaignRequest = {
        campaign_id: this.campaignId,
        name: campaignData.name || '',
        subject: campaignData.subject || '',
        preview_text: campaignData.preview_text,
        content: campaignData.content || '',
        from_name: campaignData.from_name,
        from_email: campaignData.from_email,
        reply_to: campaignData.reply_to,
        use_tracking: campaignData.use_tracking,
        status: 'draft'
      };

      this.marketingService.createEmailCampaign(this.campaignId,createPayload).subscribe({
        next: (result) => {
          this.saving = false;
          this.emailCampaignId = result.id;
          this.isEditMode = true;
          this.successMessage = 'Email campaign created successfully!';
          this.clearMessageAfterDelay();

          // Update URL without reload
          this.router.navigate(
            ['/admin/marketing/campaigns', this.campaignId, 'email-campaigns', result.id],
            { replaceUrl: true }
          );
        },
        error: (err) => {
          this.saving = false;
          this.error = err.message || 'Failed to create email campaign.';
        }
      });
    }
  }

  private validateCampaign(): boolean {
    if (!this.campaign.name?.trim()) {
      this.error = 'Campaign name is required.';
      this.activeTab = 'content';
      return false;
    }

    if (!this.campaign.subject?.trim()) {
      this.error = 'Email subject is required.';
      this.activeTab = 'content';
      return false;
    }

    if (this.campaign.from_email && !this.marketingService.isValidEmail(this.campaign.from_email)) {
      this.error = 'Please enter a valid From email address.';
      this.activeTab = 'settings';
      return false;
    }

    if (this.campaign.reply_to && !this.marketingService.isValidEmail(this.campaign.reply_to)) {
      this.error = 'Please enter a valid Reply-To email address.';
      this.activeTab = 'settings';
      return false;
    }

    // Validate links - if link_name is provided, link_url should also be provided and vice versa
    for (let i = 0; i < this.campaignLinks.length; i++) {
      const link = this.campaignLinks[i];
      if (link.link_name?.trim() && !link.link_url?.trim()) {
        this.error = `Link #${i + 1}: URL is required when name is provided.`;
        this.activeTab = 'content';
        return false;
      }
      if (link.link_url?.trim() && !link.link_name?.trim()) {
        this.error = `Link #${i + 1}: Name is required when URL is provided.`;
        this.activeTab = 'content';
        return false;
      }
      if (link.link_url?.trim() && !this.isValidUrl(link.link_url)) {
        this.error = `Link #${i + 1}: Please enter a valid URL.`;
        this.activeTab = 'content';
        return false;
      }
    }

    return true;
  }

  private isValidUrl(url: string): boolean {
    return true;
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  private prepareCampaignForApi(): Partial<Campaign> & { links?: CampaignLink[] } {
    // Filter out empty links
    const validLinks = this.campaignLinks.filter(
      link => link.link_name?.trim() && link.link_url?.trim()
    ).map(link => ({
      link_name: link.link_name.trim(),
      link_url: link.link_url.trim()
    }));

    return {
      name: this.campaign.name?.trim(),
      subject: this.campaign.subject?.trim(),
      preview_text: this.campaign.preview_text?.trim() || undefined,
      content: this.campaign.content || '',
      from_name: this.campaign.from_name?.trim() || this.defaultFromName,
      from_email: this.campaign.from_email?.trim() || this.defaultFromEmail,
      reply_to: this.campaign.reply_to?.trim() || this.defaultFromEmail,
      use_tracking: this.campaign.track ?? this.defaultUseTracking,
      links: validLinks.length > 0 ? validLinks : undefined
    };
  }

  // ==========================================================================
  // SEND CAMPAIGN
  // ==========================================================================

  openSendModal(): void {
    if (!this.emailCampaignId) {
      this.error = 'Please save the email campaign first.';
      return;
    }
    if (this.campaignId) {
      this.router.navigate(['/admin/marketing/campaigns', this.campaignId, 'email-campaigns', this.emailCampaignId, 'send']);
    } else {
      this.router.navigate(['/admin/marketing/campaigns', this.emailCampaignId, 'send']);
    }
  }

  closeSendModal(): void {
    this.showSendModal = false;
    this.selectedContactIds = [];
  }

  setSendMode(mode: 'filters' | 'contacts'): void {
    this.sendMode = mode;
    if (mode === 'contacts') {
      this.loadContactsForPicker();
    }
  }

  loadContactsForPicker(): void {
    this.loadingContacts = true;
    this.marketingService.getContacts(
      1,
      200,
      this.contactSearch || undefined,
      undefined,
      undefined,
      true // subscribed only
    ).subscribe({
      next: (res) => {
        this.contactsForPicker = res.contacts;
        this.contactsTotal = res.total;
        this.loadingContacts = false;
      },
      error: () => {
        this.loadingContacts = false;
      }
    });
  }

  isContactSelected(id: number): boolean {
    return this.selectedContactIds.includes(id);
  }

  toggleContactSelection(id: number): void {
    const idx = this.selectedContactIds.indexOf(id);
    if (idx === -1) {
      this.selectedContactIds = [...this.selectedContactIds, id];
    } else {
      this.selectedContactIds = this.selectedContactIds.filter(x => x !== id);
    }
  }

  selectAllOnPage(): void {
    const ids = this.contactsForPicker.map(c => c.id);
    const combined = [...new Set([...this.selectedContactIds, ...ids])];
    this.selectedContactIds = combined;
  }

  clearContactSelection(): void {
    this.selectedContactIds = [];
  }

  get sendRecipientCount(): number {
    return this.sendMode === 'contacts'
      ? this.selectedContactIds.length
      : this.recipientCount;
  }

  loadRecipientCount(): void {
    if (!this.emailCampaignId) return;

    this.loadingRecipients = true;

    this.marketingService.getCampaignRecipients(this.emailCampaignId, this.sendFilters).subscribe({
      next: (response) => {
        this.recipientCount = response.total;
        this.loadingRecipients = false;
      },
      error: (err) => {
        console.error('Error loading recipients:', err);
        this.loadingRecipients = false;
      }
    });
  }

  onFilterChange(): void {
    this.loadRecipientCount();
  }

  sendCampaign(): void {
    const count = this.sendRecipientCount;
    if (!this.emailCampaignId || count === 0) return;

    this.sending = true;
    this.error = null;

    const contactIds = this.sendMode === 'contacts' ? this.selectedContactIds : undefined;
    const filters = this.sendMode === 'filters' ? this.sendFilters : undefined;

    this.marketingService.sendCampaign(this.campaignId!, this.emailCampaignId, contactIds, filters).subscribe({
      next: () => {
        this.sending = false;
        this.showSendModal = false;
        this.successMessage = 'Campaign queued for sending. Results will appear in send status and send logs.';
        this.clearMessageAfterDelay();

        // Reload campaign to get updated status
        this.loadCampaign();
      },
      error: (err) => {
        this.sending = false;
        this.error = err.message || 'Failed to send campaign.';
      }
    });
  }

  // ==========================================================================
  // SCHEDULE CAMPAIGN
  // ==========================================================================

  openScheduleModal(): void {
    if (!this.emailCampaignId) {
      this.error = 'Please save the email campaign first.';
      return;
    }

    this.setDefaultScheduleTime();
    this.showScheduleModal = true;
  }

  closeScheduleModal(): void {
    this.showScheduleModal = false;
  }

  setDefaultScheduleTime(): void {
    // Default to tomorrow at 9am
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);
    this.scheduleDateTime = this.toLocalDateTimeString(tomorrow);
  }

  scheduleCampaign(): void {
    if (!this.emailCampaignId || !this.scheduleDateTime) return;

    // Validate future date
    const scheduled = new Date(this.scheduleDateTime);
    if (scheduled <= new Date()) {
      this.error = 'Scheduled time must be in the future.';
      return;
    }

    this.scheduling = true;
    this.error = null;

    const scheduledAt = this.toUTCMySQLString(this.scheduleDateTime);

    this.marketingService.scheduleCampaign(this.emailCampaignId, scheduledAt).subscribe({
      next: () => {
        this.scheduling = false;
        this.showScheduleModal = false;
        this.successMessage = 'Campaign scheduled successfully!';
        this.clearMessageAfterDelay();
        this.loadCampaign();
      },
      error: (err) => {
        this.scheduling = false;
        this.error = err.message || 'Failed to schedule campaign.';
      }
    });
  }

  cancelSchedule(): void {
    if (!this.emailCampaignId) return;

    this.marketingService.updateCampaignStatus(this.emailCampaignId, 'draft').subscribe({
      next: () => {
        this.successMessage = 'Schedule cancelled. Campaign returned to draft.';
        this.clearMessageAfterDelay();
        this.loadCampaign();
      },
      error: (err) => {
        this.error = err.message || 'Failed to cancel schedule.';
      }
    });
  }

  // ==========================================================================
  // TEST EMAIL
  // ==========================================================================

  openTestModal(): void {
    if (!this.emailCampaignId) {
      this.error = 'Please save the campaign first.';
      return;
    }

    this.testEmail = '';
    this.showTestModal = true;
  }

  closeTestModal(): void {
    this.showTestModal = false;
  }

  sendTestEmail(): void {
    if (!this.emailCampaignId || !this.testEmail) return;

    if (!this.marketingService.isValidEmail(this.testEmail)) {
      this.error = 'Please enter a valid email address.';
      return;
    }

    this.sendingTest = true;
    this.error = null;

    this.marketingService.sendTestEmail(this.emailCampaignId, this.testEmail).subscribe({
      next: () => {
        this.sendingTest = false;
        this.showTestModal = false;
        this.successMessage = `Test email sent to ${this.testEmail}!`;
        this.clearMessageAfterDelay();
      },
      error: (err) => {
        this.sendingTest = false;
        this.error = err.message || 'Failed to send test email.';
      }
    });
  }

  // ==========================================================================
  // HTML EDITOR HELPERS
  // ==========================================================================

  insertPersonalization(token: string): void {
    // Simple insert at cursor position in textarea
    const textarea = document.querySelector('.content-editor') as HTMLTextAreaElement;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const content = this.campaign.content || '';
      this.campaign.content = content.substring(0, start) + token + content.substring(end);

      // Reset cursor position
      setTimeout(() => {
        textarea.focus();
        textarea.selectionStart = textarea.selectionEnd = start + token.length;
      }, 0);
    }
  }

  insertLink(): void {
    if (!this.linkUrl) return;

    const linkHtml = this.linkText
      ? `<a href="${this.linkUrl}">${this.linkText}</a>`
      : `<a href="${this.linkUrl}">${this.linkUrl}</a>`;

    const textarea = document.querySelector('.content-editor') as HTMLTextAreaElement;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const content = this.campaign.content || '';
      this.campaign.content = content.substring(0, start) + linkHtml + content.substring(end);
    }

    this.showLinkModal = false;
    this.linkUrl = '';
    this.linkText = '';
  }

  insertButton(color: 'primary' | 'secondary' = 'primary'): void {
    const buttonHtml = color === 'primary'
      ? `<a href="#" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px; font-weight: 500;">Button Text</a>`
      : `<a href="#" style="display: inline-block; padding: 12px 24px; background-color: #f3f4f6; color: #374151; text-decoration: none; border-radius: 6px; font-weight: 500; border: 1px solid #e5e7eb;">Button Text</a>`;

    const textarea = document.querySelector('.content-editor') as HTMLTextAreaElement;
    if (textarea) {
      const start = textarea.selectionStart;
      const content = this.campaign.content || '';
      this.campaign.content = content.substring(0, start) + buttonHtml + content.substring(start);
    }
  }

  insertDivider(): void {
    const dividerHtml = `<hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">`;

    const textarea = document.querySelector('.content-editor') as HTMLTextAreaElement;
    if (textarea) {
      const start = textarea.selectionStart;
      const content = this.campaign.content || '';
      this.campaign.content = content.substring(0, start) + dividerHtml + content.substring(start);
    }
  }

  // ==========================================================================
  // UTILITY METHODS
  // ==========================================================================

  setActiveTab(tab: 'content' | 'settings' | 'preview' | 'send'): void {
    this.activeTab = tab;
  }

  canEdit(): boolean {
    return !this.campaign.status || ['draft', 'scheduled', 'sent'].includes(this.campaign.status);
  }

  canSendEmail(): boolean {
    return this.isEditMode &&
      this.emailCampaignId !== null &&
      ['draft', 'scheduled', 'sent'].includes(this.campaign.status || 'draft');
  }

  canSend(): boolean {
    return this.isEditMode &&
      this.emailCampaignId !== null &&
      ['draft', 'scheduled'].includes(this.campaign.status || 'draft');
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

  getStatusClass(status: string): string {
    return this.marketingService.getStatusClass(status);
  }

  formatDateTime(dateString: string): string {
    return this.marketingService.formatDateTime(dateString);
  }

  toLocalDateTimeString(date: Date | string): string {
    let d: Date;
    if (typeof date === 'string') {
      if (date.includes(' ') && !date.includes('T') && !date.includes('Z')) {
        d = new Date(date.replace(' ', 'T') + 'Z');
      } else {
        d = new Date(date);
      }
    } else {
      d = date;
    }
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }

  toUTCMySQLString(localDateTimeString: string): string {
    const localDate = new Date(localDateTimeString);
    const year = localDate.getUTCFullYear();
    const month = String(localDate.getUTCMonth() + 1).padStart(2, '0');
    const day = String(localDate.getUTCDate()).padStart(2, '0');
    const hours = String(localDate.getUTCHours()).padStart(2, '0');
    const minutes = String(localDate.getUTCMinutes()).padStart(2, '0');
    const seconds = String(localDate.getUTCSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  }

  private clearMessageAfterDelay(): void {
    setTimeout(() => {
      this.successMessage = null;
    }, 3000);
  }

  goBack(): void {
    if (this.campaignId) {
      this.router.navigate(['/admin/marketing/campaigns', this.campaignId]);
      return;
    }
    this.router.navigate(['/admin/marketing/campaigns']);
  }
}
