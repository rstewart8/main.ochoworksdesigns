import { Component, OnInit, OnDestroy, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { 
  EmailMarketingService, 
  CampaignRecord,
  CampaignRecordsListResponse
} from '../_services/email-marketing.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-marketing-campaigns',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './marketing-campaigns.component.html',
  styleUrl: './marketing-campaigns.component.css'
})
export class MarketingCampaignsComponent implements OnInit, OnDestroy {
  campaigns: CampaignRecord[] = [];
  
  // Pagination
  currentPage = 1;
  totalPages = 1;
  totalCampaigns = 0;
  campaignsPerPage = 20;
  
  // Filters
  searchQuery = '';
  selectedStatus = '';
  
  // State
  loading = true;
  error: string | null = null;
  successMessage: string | null = null;
  
  // Delete confirmation
  showDeleteModal = false;
  campaignToDelete: CampaignRecord | null = null;
  deleting = false;
  
  // Status options
  statusOptions = [
    { value: '', label: 'All Statuses' },
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
    { value: 'deleted', label: 'Deleted' }
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
    this.routeSubscription = this.route.queryParams.subscribe(params => {
      this.currentPage = parseInt(params['page']) || 1;
      this.searchQuery = params['search'] || '';
      this.selectedStatus = params['status'] || '';
      this.loadCampaigns();
    });
  }

  ngOnDestroy(): void {
    this.routeSubscription?.unsubscribe();
  }

  loadCampaigns(): void {
    this.loading = true;
    this.error = null;

    this.marketingService.getCampaignRecords(
      this.currentPage,
      this.campaignsPerPage,
      this.searchQuery || undefined,
      this.selectedStatus || undefined
    ).subscribe({
      next: (response: CampaignRecordsListResponse) => {
        this.campaigns = response.campaigns || [];
        this.totalCampaigns = response.total || 0;
        this.totalPages = Math.ceil(this.totalCampaigns / this.campaignsPerPage) || 1;
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading campaigns:', err);
        this.error = err.message || 'Failed to load campaigns. Please try again.';
        this.loading = false;
      }
    });
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

  onStatusChange(): void {
    this.updateRoute({ status: this.selectedStatus, page: '1' });
  }

  clearFilters(): void {
    this.searchQuery = '';
    this.selectedStatus = '';
    this.currentPage = 1;
    this.updateRoute({ search: null, status: null, page: '1' });
  }

  private updateRoute(params: any): void {
    const queryParams = { ...this.route.snapshot.queryParams, ...params };
    
    Object.keys(queryParams).forEach(key => {
      if (!queryParams[key]) {
        delete queryParams[key];
      }
    });
    
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams
    });
  }

  // Delete methods
  confirmDelete(campaign: CampaignRecord): void {
    this.campaignToDelete = campaign;
    this.showDeleteModal = true;
  }

  cancelDelete(): void {
    this.campaignToDelete = null;
    this.showDeleteModal = false;
  }

  deleteCampaign(): void {
    if (!this.campaignToDelete) return;
    
    this.deleting = true;
    
    this.marketingService.deleteCampaignRecord(this.campaignToDelete.id).subscribe({
      next: () => {
        this.showDeleteModal = false;
        this.campaignToDelete = null;
        this.deleting = false;
        this.successMessage = 'Campaign deleted successfully!';
        this.clearMessageAfterDelay();
        this.loadCampaigns();
      },
      error: (err) => {
        console.error('Error deleting campaign:', err);
        this.error = err.message || 'Failed to delete campaign.';
        this.deleting = false;
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
    const labels: Record<string, string> = {
      'active': 'Active',
      'inactive': 'Inactive',
      'deleted': 'Deleted'
    };
    return labels[status] || status;
  }

  getStatusIcon(status: string): string {
    const icons: Record<string, string> = {
      'active': '✅',
      'inactive': '⏸️',
      'deleted': '🗑️'
    };
    return icons[status] || '📁';
  }

  getStatusClass(status: string): string {
    return `status-${status}`;
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
    return !!(this.searchQuery || this.selectedStatus);
  }

  private clearMessageAfterDelay(): void {
    setTimeout(() => {
      this.successMessage = null;
      this.error = null;
    }, 3000);
  }

  trackByFn(index: number, campaign: CampaignRecord): number {
    return campaign.id;
  }
}
