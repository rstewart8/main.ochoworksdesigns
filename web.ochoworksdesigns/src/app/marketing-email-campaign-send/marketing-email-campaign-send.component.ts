import { Component, OnInit, OnDestroy, Inject, PLATFORM_ID, HostListener, ElementRef } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import {
  EmailMarketingService,
  Campaign,
  Contact,
  ContactsListResponse,
  CityItem,
  StateItem
} from '../_services/email-marketing.service';
import { Subscription, forkJoin } from 'rxjs';

@Component({
  selector: 'app-marketing-email-campaign-send',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './marketing-email-campaign-send.component.html',
  styleUrl: './marketing-email-campaign-send.component.css'
})
export class MarketingEmailCampaignSendComponent implements OnInit, OnDestroy {
  Math = Math;

  // Route IDs
  campaignId: number | null = null; // Parent campaign record id
  emailCampaignId: number | null = null; // Actual email_campaign id
  campaign: Campaign | null = null;

  // Contacts list
  contacts: Contact[] = [];
  contactsTotal = 0;
  currentPage = 1;
  pageSize = 50;
  totalPages = 1;

  // Selection
  selectedContactIds: Set<number> = new Set();
  selectAllOnPageChecked = false;

  // Filters
  searchQuery = '';
  filterTag = '';
  filterSource = '';
  subscribedOnly = true;
  hasPhone: boolean | null = null;

  // Multi-select filters for city and state
  selectedCities: string[] = [];
  selectedStates: string[] = [];

  // Dropdown state
  cityDropdownOpen = false;
  stateDropdownOpen = false;
  citySearchQuery = '';
  stateSearchQuery = '';

  // Filter options
  availableTags: string[] = [];
  availableSources: string[] = [];
  availableCities: CityItem[] = [];
  availableStates: StateItem[] = [];

  // State
  loading = true;
  loadingContacts = false;
  loadingFilters = true;
  sending = false;
  error: string | null = null;
  successMessage: string | null = null;

  // Confirmation modal
  showConfirmModal = false;

  private routeSubscription?: Subscription;
  private isBrowser: boolean;

  constructor(
    private marketingService: EmailMarketingService,
    private route: ActivatedRoute,
    private router: Router,
    private elementRef: ElementRef,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  ngOnInit(): void {
    this.routeSubscription = this.route.params.subscribe(params => {
      const campaignId = Number(params['campaignId']);
      const emailCampaignId = Number(params['id']);

      if (!Number.isFinite(campaignId) || campaignId <= 0 || !Number.isFinite(emailCampaignId) || emailCampaignId <= 0) {
        this.error = 'Campaign ID and Email Campaign ID are required';
        this.loading = false;
        return;
      }

      this.campaignId = campaignId;
      this.emailCampaignId = emailCampaignId;
      this.loadCampaign();
      this.loadContacts();
      this.loadFilterOptions();
      this.loadCityStateOptions();
    });
  }

  ngOnDestroy(): void {
    this.routeSubscription?.unsubscribe();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;

    const cityDropdown = this.elementRef.nativeElement.querySelector('.city-filter-container');
    if (cityDropdown && !cityDropdown.contains(target)) {
      this.cityDropdownOpen = false;
    }

    const stateDropdown = this.elementRef.nativeElement.querySelector('.state-filter-container');
    if (stateDropdown && !stateDropdown.contains(target)) {
      this.stateDropdownOpen = false;
    }
  }

  loadCampaign(): void {
    if (!this.campaignId || !this.emailCampaignId) return;

    this.marketingService.getEmailCampaign(this.campaignId, this.emailCampaignId).subscribe({
      next: (campaign) => {
        this.campaign = campaign;
        this.loading = false;

        if (!['draft', 'scheduled', 'sent'].includes(campaign.status)) {
          this.error = `This campaign cannot be sent (status: ${campaign.status})`;
        }
      },
      error: (err) => {
        this.error = err.message || 'Failed to load campaign.';
        this.loading = false;
      }
    });
  }

  loadContacts(): void {
    if (!this.campaignId || !this.emailCampaignId) return;

    this.loadingContacts = true;
    this.selectAllOnPageChecked = false;

    const cityParam = this.selectedCities.length > 0 ? this.selectedCities.join(',') : undefined;
    const stateParam = this.selectedStates.length > 0 ? this.selectedStates.join(',') : undefined;

    this.marketingService.getEmailCampaignUnsentContacts(
      this.campaignId,
      this.emailCampaignId,
      this.currentPage,
      this.pageSize,
      this.searchQuery || undefined,
      this.filterTag || undefined,
      this.filterSource || undefined,
      this.subscribedOnly ? true : undefined,
      this.hasPhone ?? undefined,
      cityParam,
      stateParam
    ).subscribe({
      next: (response: ContactsListResponse) => {
        this.contacts = response.contacts;
        this.contactsTotal = response.total;
        this.totalPages = Math.ceil(response.total / this.pageSize);
        this.loadingContacts = false;
        this.updateSelectAllCheckbox();
      },
      error: (err) => {
        this.error = err.message || 'Failed to load contacts.';
        this.loadingContacts = false;
      }
    });
  }

  loadFilterOptions(): void {
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
      }
    });
  }

  loadCityStateOptions(): void {
    this.loadingFilters = true;

    forkJoin({
      cities: this.marketingService.getCitiesList(),
      states: this.marketingService.getStatesList()
    }).subscribe({
      next: (result) => {
        this.availableCities = result.cities || [];
        this.availableStates = result.states || [];
        this.loadingFilters = false;
      },
      error: () => {
        this.loadingFilters = false;
      }
    });
  }

  toggleCityDropdown(): void {
    this.cityDropdownOpen = !this.cityDropdownOpen;
    this.stateDropdownOpen = false;
    if (this.cityDropdownOpen) {
      this.citySearchQuery = '';
    }
  }

  toggleCitySelection(city: string): void {
    const index = this.selectedCities.indexOf(city);
    if (index === -1) {
      this.selectedCities.push(city);
    } else {
      this.selectedCities.splice(index, 1);
    }
  }

  isCitySelected(city: string): boolean {
    return this.selectedCities.includes(city);
  }

  getFilteredCities(): CityItem[] {
    if (!this.citySearchQuery) {
      return this.availableCities;
    }
    const query = this.citySearchQuery.toLowerCase();
    return this.availableCities.filter(c => c.city.toLowerCase().includes(query));
  }

  applyCityFilter(): void {
    this.cityDropdownOpen = false;
    this.currentPage = 1;
    this.loadContacts();
  }

  clearCitySelection(): void {
    this.selectedCities = [];
    this.cityDropdownOpen = false;
    this.currentPage = 1;
    this.loadContacts();
  }

  getCityDisplayText(): string {
    if (this.selectedCities.length === 0) {
      return 'All Cities';
    }
    if (this.selectedCities.length === 1) {
      return this.selectedCities[0];
    }
    return `${this.selectedCities.length} cities`;
  }

  toggleStateDropdown(): void {
    this.stateDropdownOpen = !this.stateDropdownOpen;
    this.cityDropdownOpen = false;
    if (this.stateDropdownOpen) {
      this.stateSearchQuery = '';
    }
  }

  toggleStateSelection(state: string): void {
    const index = this.selectedStates.indexOf(state);
    if (index === -1) {
      this.selectedStates.push(state);
    } else {
      this.selectedStates.splice(index, 1);
    }
  }

  isStateSelected(state: string): boolean {
    return this.selectedStates.includes(state);
  }

  getFilteredStates(): StateItem[] {
    if (!this.stateSearchQuery) {
      return this.availableStates;
    }
    const query = this.stateSearchQuery.toLowerCase();
    return this.availableStates.filter(s => s.state.toLowerCase().includes(query));
  }

  applyStateFilter(): void {
    this.stateDropdownOpen = false;
    this.currentPage = 1;
    this.loadContacts();
  }

  clearStateSelection(): void {
    this.selectedStates = [];
    this.stateDropdownOpen = false;
    this.currentPage = 1;
    this.loadContacts();
  }

  getStateDisplayText(): string {
    if (this.selectedStates.length === 0) {
      return 'All States';
    }
    if (this.selectedStates.length === 1) {
      return this.selectedStates[0];
    }
    return `${this.selectedStates.length} states`;
  }

  toggleContactSelection(contactId: number): void {
    if (this.selectedContactIds.has(contactId)) {
      this.selectedContactIds.delete(contactId);
    } else {
      this.selectedContactIds.add(contactId);
    }
    this.updateSelectAllCheckbox();
  }

  isContactSelected(contactId: number): boolean {
    return this.selectedContactIds.has(contactId);
  }

  toggleSelectAllOnPage(): void {
    if (this.selectAllOnPageChecked) {
      this.contacts.forEach(c => this.selectedContactIds.delete(c.id));
    } else {
      this.contacts.forEach(c => this.selectedContactIds.add(c.id));
    }
    this.updateSelectAllCheckbox();
  }

  updateSelectAllCheckbox(): void {
    if (this.contacts.length === 0) {
      this.selectAllOnPageChecked = false;
      return;
    }
    this.selectAllOnPageChecked = this.contacts.every(c => this.selectedContactIds.has(c.id));
  }

  selectAllFiltered(): void {
    if (!this.campaignId || !this.emailCampaignId) return;

    this.loadingContacts = true;

    const cityParam = this.selectedCities.length > 0 ? this.selectedCities.join(',') : undefined;
    const stateParam = this.selectedStates.length > 0 ? this.selectedStates.join(',') : undefined;

    this.marketingService.getEmailCampaignUnsentContacts(
      this.campaignId,
      this.emailCampaignId,
      1,
      10000,
      this.searchQuery || undefined,
      this.filterTag || undefined,
      this.filterSource || undefined,
      this.subscribedOnly ? true : undefined,
      this.hasPhone ?? undefined,
      cityParam,
      stateParam
    ).subscribe({
      next: (response) => {
        response.contacts.forEach(c => this.selectedContactIds.add(c.id));
        this.loadingContacts = false;
        this.updateSelectAllCheckbox();
      },
      error: () => {
        this.loadingContacts = false;
      }
    });
  }

  clearSelection(): void {
    this.selectedContactIds.clear();
    this.selectAllOnPageChecked = false;
  }

  get selectedCount(): number {
    return this.selectedContactIds.size;
  }

  applyFilters(): void {
    this.currentPage = 1;
    this.loadContacts();
  }

  resetFilters(): void {
    this.searchQuery = '';
    this.filterTag = '';
    this.filterSource = '';
    this.subscribedOnly = true;
    this.hasPhone = null;
    this.selectedCities = [];
    this.selectedStates = [];
    this.currentPage = 1;
    this.loadContacts();
  }

  hasActiveFilters(): boolean {
    return !!(
      this.searchQuery ||
      this.filterTag ||
      this.filterSource ||
      !this.subscribedOnly ||
      this.hasPhone !== null ||
      this.selectedCities.length > 0 ||
      this.selectedStates.length > 0
    );
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    this.loadContacts();
  }

  get visiblePages(): number[] {
    const pages: number[] = [];
    const maxVisible = 5;
    let start = Math.max(1, this.currentPage - Math.floor(maxVisible / 2));
    let end = Math.min(this.totalPages, start + maxVisible - 1);

    if (end - start < maxVisible - 1) {
      start = Math.max(1, end - maxVisible + 1);
    }

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  }

  openConfirmModal(): void {
    if (this.selectedCount === 0) {
      this.error = 'Please select at least one contact.';
      return;
    }
    this.showConfirmModal = true;
  }

  closeConfirmModal(): void {
    this.showConfirmModal = false;
  }

  confirmSend(): void {
    if (!this.campaignId || !this.emailCampaignId || this.selectedCount === 0) return;

    this.sending = true;
    this.error = null;

    const contactIds = Array.from(this.selectedContactIds);

    this.marketingService.sendCampaign(this.campaignId, this.emailCampaignId, contactIds).subscribe({
      next: (result) => {
        this.sending = false;
        this.showConfirmModal = false;
        this.successMessage = `Campaign queued successfully! Job ID: ${result.job_id}. Sending to ${contactIds.length} recipients.`;

        setTimeout(() => {
          if (this.campaignId) {
            this.router.navigate(['/admin/marketing/campaigns', this.campaignId, 'email-campaigns', this.emailCampaignId, 'stats']);
          } else {
            this.router.navigate(['/admin/marketing/campaigns']);
          }
        }, 2000);
      },
      error: (err) => {
        this.sending = false;
        this.error = err.message || 'Failed to send campaign.';
      }
    });
  }

  formatDate(dateString: string): string {
    return this.marketingService.formatDate(dateString);
  }

  formatDateTime(dateString: string): string {
    return this.marketingService.formatDateTime(dateString);
  }

  getStatusLabel(status: string): string {
    return this.marketingService.getStatusLabel(status);
  }

  getStatusClass(status: string): string {
    return this.marketingService.getStatusClass(status);
  }

  canSend(): boolean {
    return this.campaign !== null &&
      ['draft', 'scheduled', 'sent'].includes(this.campaign.status);
  }

  trackByContactId(index: number, contact: Contact): number {
    return contact.id;
  }

  trackByCityFn(index: number, item: CityItem): string {
    return item.city;
  }

  trackByStateFn(index: number, item: StateItem): string {
    return item.state;
  }

  goBack(): void {
    if (this.campaignId) {
      this.router.navigate(['/admin/marketing/campaigns', this.campaignId]);
    } else {
      this.router.navigate(['/admin/marketing/campaigns']);
    }
  }
}
