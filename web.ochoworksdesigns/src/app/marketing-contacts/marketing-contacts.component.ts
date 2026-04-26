import { Component, OnInit, OnDestroy, Inject, PLATFORM_ID, HostListener, ElementRef } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { 
  EmailMarketingService, 
  Contact, 
  ContactsListResponse,
  CityItem,
  StateItem
} from '../_services/email-marketing.service';
import { Subscription, forkJoin, last } from 'rxjs';
import { PhoneFormatPipe } from '../_pipes/phone-format.pipe';

@Component({
  selector: 'app-marketing-contacts',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, PhoneFormatPipe],
  templateUrl: './marketing-contacts.component.html',
  styleUrl: './marketing-contacts.component.css'
})
export class MarketingContactsComponent implements OnInit, OnDestroy {
  contacts: Contact[] = [];
  
  // Pagination
  currentPage = 1;
  totalPages = 1;
  totalContacts = 0;
  contactsPerPage = 50;
  
  // Filters
  searchQuery = '';
  selectedTag = '';
  selectedSource = '';
  selectedSubscribed: string = '';
  
  // Multi-select filters for city and state
  selectedCities: string[] = [];
  selectedStates: string[] = [];
  
  // Dropdown state
  cityDropdownOpen = false;
  stateDropdownOpen = false;
  citySearchQuery = '';
  stateSearchQuery = '';
  
  // Available filter options
  availableTags: string[] = [];
  availableSources: string[] = [];
  availableCities: CityItem[] = [];
  availableStates: StateItem[] = [];
  
  // State
  loading = true;
  error: string | null = null;
  loadingFilters = true;
  
  // Selection for bulk actions
  selectedContacts: Set<number> = new Set();
  selectAll = false;
  
  // Delete confirmation
  showDeleteModal = false;
  contactToDelete: Contact | null = null;
  deleting = false;

  lastContacted: string = '';
  
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
    // Load cities and states for filter dropdowns
    this.loadFilterOptions();
    
    // Subscribe to route changes for pagination and filtering
    this.routeSubscription = this.route.queryParams.subscribe(params => {
      this.currentPage = parseInt(params['page']) || 1;
      this.searchQuery = params['search'] || '';
      this.selectedTag = params['tag'] || '';
      this.selectedSource = params['source'] || '';
      this.selectedSubscribed = params['subscribed'] || '';
      this.lastContacted = params['lastContacted'] || '';
      
      // Parse comma-separated city and state params
      this.selectedCities = params['city'] ? params['city'].split(',').map((c: string) => c.trim()) : [];
      this.selectedStates = params['state'] ? params['state'].split(',').map((s: string) => s.trim()) : [];
      
      this.loadContacts();
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

  loadFilterOptions(): void {
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
        console.error('Error loading filter options:', err);
        this.loadingFilters = false;
      }
    });
  }

  loadContacts(): void {
    this.loading = true;
    this.error = null;
    this.clearSelection();

    const subscribed = this.selectedSubscribed === '' 
      ? undefined 
      : this.selectedSubscribed === 'true';

    // Convert arrays to comma-separated strings for API
    const cityParam = this.selectedCities.length > 0 ? this.selectedCities.join(',') : undefined;
    const stateParam = this.selectedStates.length > 0 ? this.selectedStates.join(',') : undefined;

    this.marketingService.getContacts(
      this.currentPage,
      this.contactsPerPage,
      this.searchQuery || undefined,
      this.selectedTag || undefined,
      this.selectedSource || undefined,
      subscribed,
      undefined, // hasPhone
      cityParam,
      stateParam,
      this.lastContacted || undefined
    ).subscribe({
      next: (response: ContactsListResponse) => {
        this.contacts = response.contacts || [];
        this.totalContacts = response.total || 0;
        this.totalPages = Math.ceil(this.totalContacts / this.contactsPerPage) || 1;
        this.loading = false;
        
        // Extract unique tags and sources for filter dropdowns
        this.extractFilterOptions();
      },
      error: (err) => {
        console.error('Error loading contacts:', err);
        this.error = err.message || 'Failed to load contacts. Please try again.';
        this.loading = false;
      }
    });
  }

  private extractFilterOptions(): void {
    // Collect unique tags
    const tags = new Set<string>();
    const sources = new Set<string>();
    
    this.contacts.forEach(contact => {
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

  // City multi-select methods
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
    this.updateRoute({ 
      city: this.selectedCities.length > 0 ? this.selectedCities.join(',') : null, 
      page: '1' 
    });
  }

  clearCitySelection(): void {
    this.selectedCities = [];
    this.cityDropdownOpen = false;
    this.updateRoute({ city: null, page: '1' });
  }

  getCityDisplayText(): string {
    if (this.selectedCities.length === 0) {
      return 'All Cities';
    }
    if (this.selectedCities.length === 1) {
      return this.selectedCities[0];
    }
    return `${this.selectedCities.length} cities selected`;
  }

  // State multi-select methods
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
    this.updateRoute({ 
      state: this.selectedStates.length > 0 ? this.selectedStates.join(',') : null, 
      page: '1' 
    });
  }

  clearStateSelection(): void {
    this.selectedStates = [];
    this.stateDropdownOpen = false;
    this.updateRoute({ state: null, page: '1' });
  }

  getStateDisplayText(): string {
    if (this.selectedStates.length === 0) {
      return 'All States';
    }
    if (this.selectedStates.length === 1) {
      return this.selectedStates[0];
    }
    return `${this.selectedStates.length} states selected`;
  }

  // Navigation methods
  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.updateRoute({ page: page.toString() });
    }
  }

  onSearch(): void {
    this.updateRoute({ search: this.searchQuery, page: '1' });
  }

  onTagChange(): void {
    this.updateRoute({ tag: this.selectedTag, page: '1' });
  }

  onSourceChange(): void {
    this.updateRoute({ source: this.selectedSource, page: '1' });
  }

  onSubscribedChange(): void {
    this.updateRoute({ subscribed: this.selectedSubscribed, page: '1' });
  }

  onLastContactedChange(): void {
    this.updateRoute({ lastContacted: this.lastContacted, page: '1' });
  }

  clearFilters(): void {
    this.searchQuery = '';
    this.selectedTag = '';
    this.selectedSource = '';
    this.selectedSubscribed = '';
    this.selectedCities = [];
    this.selectedStates = [];
    this.currentPage = 1;
    this.updateRoute({ 
      search: null, 
      tag: null, 
      source: null, 
      subscribed: null, 
      city: null, 
      state: null, 
      lastContacted: null,
      page: '1' 
    });
  }

  private updateRoute(params: any): void {
    const queryParams = { ...this.route.snapshot.queryParams, ...params };
    
    // Remove empty/null params
    Object.keys(queryParams).forEach(key => {
      if (!queryParams[key]) {
        delete queryParams[key];
      }
    });

    console.log('Navigating with query params:', queryParams);
    
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams
    });
  }

  // Selection methods
  toggleSelectAll(): void {
    if (this.selectAll) {
      this.contacts.forEach(c => this.selectedContacts.add(c.id));
    } else {
      this.selectedContacts.clear();
    }
  }

  toggleContactSelection(contactId: number): void {
    if (this.selectedContacts.has(contactId)) {
      this.selectedContacts.delete(contactId);
    } else {
      this.selectedContacts.add(contactId);
    }
    
    // Update selectAll checkbox state
    this.selectAll = this.contacts.length > 0 && 
      this.contacts.every(c => this.selectedContacts.has(c.id));
  }

  isSelected(contactId: number): boolean {
    return this.selectedContacts.has(contactId);
  }

  clearSelection(): void {
    this.selectedContacts.clear();
    this.selectAll = false;
  }

  getSelectedCount(): number {
    return this.selectedContacts.size;
  }

  // Delete methods
  confirmDelete(contact: Contact): void {
    this.contactToDelete = contact;
    this.showDeleteModal = true;
  }

  cancelDelete(): void {
    this.contactToDelete = null;
    this.showDeleteModal = false;
  }

  deleteContact(): void {
    if (!this.contactToDelete) return;
    
    this.deleting = true;
    
    this.marketingService.deleteContact(this.contactToDelete.id).subscribe({
      next: () => {
        this.showDeleteModal = false;
        this.contactToDelete = null;
        this.deleting = false;
        this.loadContacts();
      },
      error: (err) => {
        console.error('Error deleting contact:', err);
        this.error = err.message || 'Failed to delete contact.';
        this.deleting = false;
      }
    });
  }

  // Utility methods
  formatDate(dateString: string): string {
    return this.marketingService.formatDate(dateString);
  }

  formatDateTime(dateString: string): string {
    if (!dateString) return '';
    // Handle MySQL format (YYYY-MM-DD HH:mm:ss) which comes from API as UTC
    // JavaScript Date would interpret this as local time, so we need to treat it as UTC
    let date: Date;
    if (dateString.includes(' ') && !dateString.includes('T') && !dateString.includes('Z')) {
      // MySQL format without timezone - treat as UTC by replacing space with 'T' and adding 'Z'
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

  getTagsDisplay(tags: string[] | undefined): string {
    if (!tags || tags.length === 0) return '—';
    if (tags.length <= 2) return tags.join(', ');
    return `${tags.slice(0, 2).join(', ')} +${tags.length - 2}`;
  }

  getOpenRate(contact: Contact): string {
    if (!contact.total_emails || contact.total_emails === 0) return '—';
    const rate = ((contact.opened_emails || 0) / contact.total_emails) * 100;
    return `${Math.round(rate)}%`;
  }

  // Pagination helpers
  getPaginationNumbers(): number[] {
    const pages: number[] = [];
    const maxVisible = 5;
    
    let start = Math.max(1, this.currentPage - Math.floor(maxVisible / 2));
    let end = Math.min(this.totalPages, start + maxVisible - 1);
    
    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }
    
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    
    return pages;
  }

  hasActiveFilters(): boolean {
    return !!(
      this.searchQuery || 
      this.selectedTag || 
      this.selectedSource || 
      this.selectedSubscribed ||
      this.selectedCities.length > 0 ||
      this.selectedStates.length > 0
    );
  }

  // Track by function for ngFor optimization
  trackByFn(index: number, contact: Contact): number {
    return contact.id;
  }

  trackByCityFn(index: number, item: CityItem): string {
    return item.city;
  }

  trackByStateFn(index: number, item: StateItem): string {
    return item.state;
  }
}