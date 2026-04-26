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
  selector: 'app-marketing-campaign-send',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './marketing-campaign-send.component.html',
  styleUrl: './marketing-campaign-send.component.css'
})
export class MarketingCampaignSendComponent implements OnInit, OnDestroy {
  // Math reference for template
  Math = Math;
  
  // Campaign info
  campaignId: number | null = null;
  parentCampaignId: number | null = null;
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
    console.log('Initializing MarketingCampaignSendComponent');
    this.routeSubscription = this.route.params.subscribe(params => {
      if (params['campaignId']) {
        this.parentCampaignId = parseInt(params['campaignId']);
      }

      if (params['id']) {
        this.campaignId = parseInt(params['id']);
        this.loadCampaign();
        this.loadContacts();
        this.loadFilterOptions();
        this.loadCityStateOptions();
      } else {
        this.error = 'Campaign ID is required';
        this.loading = false;
      }
    });
  }

  ngOnDestroy(): void {
    this.routeSubscription?.unsubscribe();
  }

  // Close dropdowns when clicking outside
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    
    // Check if click is outside city dropdown
    const cityDropdown = this.elementRef.nativeElement.querySelector('.city-filter-container');
    if (cityDropdown && !cityDropdown.contains(target)) {
      this.cityDropdownOpen = false;
    }
    
    // Check if click is outside state dropdown
    const stateDropdown = this.elementRef.nativeElement.querySelector('.state-filter-container');
    if (stateDropdown && !stateDropdown.contains(target)) {
      this.stateDropdownOpen = false;
    }
  }

  // ==========================================================================
  // LOAD DATA
  // ==========================================================================

  loadCampaign(): void {
    if (!this.campaignId) return;
    
    this.marketingService.getCampaign(this.campaignId).subscribe({
      next: (campaign) => {
        this.campaign = campaign;
        this.loading = false;
        
        // Check if campaign can be sent
        if (!['draft', 'scheduled', 'sent'].includes(campaign.status)) {
          this.error = `This campaign cannot be sent (status: ${campaign.status})`;
        }
      },
      error: (err) => {
        console.error('Error loading campaign:', err);
        this.error = err.message || 'Failed to load campaign.';
        this.loading = false;
      }
    });
  }

  loadContacts(): void {
    this.loadingContacts = true;
    this.selectAllOnPageChecked = false;

    // Convert arrays to comma-separated strings for API
    const cityParam = this.selectedCities.length > 0 ? this.selectedCities.join(',') : undefined;
    const stateParam = this.selectedStates.length > 0 ? this.selectedStates.join(',') : undefined;

    this.marketingService.getCampaignUnsentContacts(
      this.campaignId!,
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
      next: (response) => {
        this.contacts = response.contacts;
        this.contactsTotal = response.total;
        this.totalPages = Math.ceil(response.total / this.pageSize);
        this.loadingContacts = false;
        this.updateSelectAllCheckbox();
      },
      error: (err) => {
        console.error('Error loading contacts:', err);
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
      },
      error: (err) => {
        console.error('Error loading filter options:', err);
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
      error: (err) => {
        console.error('Error loading city/state options:', err);
        this.loadingFilters = false;
      }
    });
  }

  // ==========================================================================
  // CITY MULTI-SELECT METHODS
  // ==========================================================================

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

  // ==========================================================================
  // STATE MULTI-SELECT METHODS
  // ==========================================================================

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

  // ==========================================================================
  // SELECTION
  // ==========================================================================

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
      // Deselect all on page
      this.contacts.forEach(c => this.selectedContactIds.delete(c.id));
    } else {
      // Select all on page
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
    // Load all contacts matching current filters and select them
    this.loadingContacts = true;

    // Convert arrays to comma-separated strings for API
    const cityParam = this.selectedCities.length > 0 ? this.selectedCities.join(',') : undefined;
    const stateParam = this.selectedStates.length > 0 ? this.selectedStates.join(',') : undefined;
    
    this.marketingService.getContacts(
      1,
      10000, // Get all
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
      error: (err) => {
        console.error('Error selecting all:', err);
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

  // ==========================================================================
  // FILTERS & PAGINATION
  // ==========================================================================

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

  // ==========================================================================
  // SEND CAMPAIGN
  // ==========================================================================

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
    if (!this.campaignId || this.selectedCount === 0) return;
    
    this.sending = true;
    this.error = null;
    
    const contactIds = Array.from(this.selectedContactIds);
    
    this.marketingService.sendCampaign(this.campaignId, undefined, contactIds).subscribe({
      next: (result) => {
        this.sending = false;
        this.showConfirmModal = false;
        this.successMessage = `Campaign queued successfully! Job ID: ${result.job_id}. Sending to ${contactIds.length} recipients.`;
        
        // Redirect to campaign stats after a short delay
        setTimeout(() => {
          if (this.parentCampaignId) {
            this.router.navigate(['/admin/marketing/campaigns', this.parentCampaignId, 'email-campaigns', this.campaignId, 'stats']);
          } else {
            this.router.navigate(['/admin/marketing/campaigns', this.campaignId, 'stats']);
          }
        }, 2000);
      },
      error: (err) => {
        this.sending = false;
        this.error = err.message || 'Failed to send campaign.';
      }
    });
  }

  // ==========================================================================
  // UTILITY METHODS
  // ==========================================================================

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
    if (this.parentCampaignId) {
      this.router.navigate(['/admin/marketing/campaigns', this.parentCampaignId]);
    } else if (this.campaignId) {
      this.router.navigate(['/admin/marketing/campaigns', this.campaignId]);
    } else {
      this.router.navigate(['/admin/marketing/campaigns']);
    }
  }

  private clearMessageAfterDelay(): void {
    setTimeout(() => {
      this.successMessage = null;
    }, 5000);
  }
}
