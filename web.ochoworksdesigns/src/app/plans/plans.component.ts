import { Component, OnInit, OnDestroy, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterModule } from '@angular/router';
import { PlanService, HousePlan, PlanImage, ApiResponse } from '../_services/plan.service';
import { AuthService } from '../_services/auth.service';
import { SEOService } from '../_services/seo.service';
import { AnalyticsService } from '../_services/google-analytics.service';

@Component({
  selector: 'app-plans',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './plans.component.html',
  styleUrl: './plans.component.css'
})
export class PlansComponent implements OnInit, OnDestroy {
  plans: HousePlan[] = [];
  loading = true;
  error: string | null = null;
  
  // Pagination properties
  currentPage = 1;
  itemsPerPage = 12;
  totalItems = 0;
  totalPages = 0;
  hasNext = false;
  hasPrevious = false;

  // New properties for image modal
  showImageModal = false;
  selectedImageUrl = '';

  // Status filter properties
  selectedStatuses: string[] = ['active']; // Default to active
  availableStatuses = [
    { value: 'pending', label: 'Pending' },
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' }
  ];
  showStatusDropdown = false;

  // Image navigation properties
  currentImageIndices: { [planId: number]: { rendering: number, floor_plan: number } } = {};

  // Private property to track if we're in browser
  private isBrowser: boolean;

  constructor(
    private planService: PlanService,
    private authService: AuthService,
    private seoService: SEOService,
    private analytics: AnalyticsService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  ngOnInit(): void {
    this.updateSEO();
    this.setupKeyboardListeners();
    this.setupClickOutsideListener();
    this.loadPlans();
  }

  private updateSEO(): void {
    this.seoService.updateSEO({
      title: 'Featured House Plans',
      description: 'Browse featured OchoWorks Designs house plans with renderings, floor plans, specifications, and quote requests for custom home design projects.',
      image: '/assets/images/plan-1.jpeg',
      url: 'https://ochoworksdesigns.com/plans',
      type: 'website',
      schema: {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: 'Featured House Plans',
        url: 'https://ochoworksdesigns.com/plans',
        description: 'Featured house plans and custom home design options from OchoWorks Designs.',
        isPartOf: {
          '@type': 'WebSite',
          name: 'OchoWorks Designs',
          url: 'https://ochoworksdesigns.com'
        }
      }
    });
  }

  isAdmin(): boolean {
    return this.authService.isLoggedIn();
  }

  loadPlans(page: number = 1): void {
    this.loading = true;
    this.error = null;
    var status = this.isAdmin() ? this.getStatusString() : null;
    this.planService.getPlansWithPagination(this.itemsPerPage, page, status).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.plans = response.data.plans;
          this.currentPage = response.data.pagination.page;
          this.totalItems = response.data.total;
          this.totalPages = response.data.pagination.total_pages;
          this.hasNext = response.data.pagination.has_next;
          this.hasPrevious = response.data.pagination.has_previous;
          
          // Initialize image indices for each plan
          this.initializeImageIndices();
        } else {
          this.error = 'Failed to load plans';
          this.plans = [];
        }
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading plans:', err);
        this.error = 'Failed to load plans. Please try again later.';
        this.plans = [];
        this.loading = false;
      }
    });
  }

  // Initialize image indices for all plans
  initializeImageIndices(): void {
    this.currentImageIndices = {};
    this.plans.forEach(plan => {
      this.currentImageIndices[plan.id] = {
        rendering: 0,
        floor_plan: 0
      };
    });
  }

  // Get images by type for a specific plan
  getImagesByType(plan: HousePlan, imageType: 'rendering' | 'floor_plan'): PlanImage[] {
    if (!plan.images) return [];
    return plan.images
      .filter(img => img.image_type === imageType)
      .sort((a, b) => a.ordering - b.ordering);
  }

  // Get current image for a specific type
  getCurrentImage(plan: HousePlan, imageType: 'rendering' | 'floor_plan'): PlanImage | null {
    const images = this.getImagesByType(plan, imageType);
    if (images.length === 0) return null;
    
    const currentIndex = this.currentImageIndices[plan.id]?.[imageType] || 0;
    return images[currentIndex] || null;
  }

  // Navigate to next image
  nextImage(plan: HousePlan, imageType: 'rendering' | 'floor_plan'): void {
    const images = this.getImagesByType(plan, imageType);
    if (images.length <= 1) return;
    
    const currentIndex = this.currentImageIndices[plan.id]?.[imageType] || 0;
    const nextIndex = (currentIndex + 1) % images.length;
    this.currentImageIndices[plan.id][imageType] = nextIndex;
  }

  // Navigate to previous image
  previousImage(plan: HousePlan, imageType: 'rendering' | 'floor_plan'): void {
    const images = this.getImagesByType(plan, imageType);
    if (images.length <= 1) return;
    
    const currentIndex = this.currentImageIndices[plan.id]?.[imageType] || 0;
    const previousIndex = currentIndex === 0 ? images.length - 1 : currentIndex - 1;
    this.currentImageIndices[plan.id][imageType] = previousIndex;
  }

  // Check if navigation arrows should be shown
  shouldShowNavigation(plan: HousePlan, imageType: 'rendering' | 'floor_plan'): boolean {
    return this.getImagesByType(plan, imageType).length > 1;
  }

  // Check if we're at the first image
  isFirstImage(plan: HousePlan, imageType: 'rendering' | 'floor_plan'): boolean {
    const currentIndex = this.currentImageIndices[plan.id]?.[imageType] || 0;
    console.log('isFirstImage check:', currentIndex === 0);
    return currentIndex === 0;
  }

  // Check if we're at the last image
  isLastImage(plan: HousePlan, imageType: 'rendering' | 'floor_plan'): boolean {
    const images = this.getImagesByType(plan, imageType);
    const currentIndex = this.currentImageIndices[plan.id]?.[imageType] || 0;
    return currentIndex === images.length - 1;
  }

  // Get current image index display (e.g., "1 of 3")
  getImageIndexDisplay(plan: HousePlan, imageType: 'rendering' | 'floor_plan'): string {
    const images = this.getImagesByType(plan, imageType);
    if (images.length === 0) return '';
    
    const currentIndex = this.currentImageIndices[plan.id]?.[imageType] || 0;
    return `${currentIndex + 1} of ${images.length}`;
  }

  // Check if plan has images of a specific type
  hasImagesOfType(plan: HousePlan, imageType: 'rendering' | 'floor_plan'): boolean {
    return this.getImagesByType(plan, imageType).length > 0;
  }

  // Pagination methods
  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages && page !== this.currentPage) {
      this.loadPlans(page);
    }
  }

  nextPage(): void {
    if (this.hasNext) {
      this.goToPage(this.currentPage + 1);
    }
  }

  previousPage(): void {
    if (this.hasPrevious) {
      this.goToPage(this.currentPage - 1);
    }
  }

  // Helper methods
  getPrimaryImage(plan: HousePlan): string {
    // First try to get a rendering image
    const renderingImages = this.getImagesByType(plan, 'rendering');
    if (renderingImages.length > 0) {
      return renderingImages[0].image_url;
    }
    
    // Fallback to floor plan
    const floorPlanImages = this.getImagesByType(plan, 'floor_plan');
    if (floorPlanImages.length > 0) {
      return floorPlanImages[0].image_url;
    }
    
    return 'assets/images/plan-placeholder.jpg'; // Fallback image
  }

  // Status filter methods
  getStatusString(): string {
    return this.selectedStatuses.length > 0 ? this.selectedStatuses.join(',') : 'active';
  }

  getStatusDisplayText(status: string): string {
    switch(status) {
      case 'active': return 'Active';
      case 'pending': return 'Pending';
      case 'inactive': return 'Inactive';
      default: return status;
    }
  }

  getStatusClass(status: string): string {
    return `status-${status}`;
  }

  toggleStatus(status: string): void {
    const index = this.selectedStatuses.indexOf(status);
    if (index > -1) {
      this.selectedStatuses.splice(index, 1);
    } else {
      this.selectedStatuses.push(status);
    }
    
    // If no statuses selected, default to active
    if (this.selectedStatuses.length === 0) {
      this.selectedStatuses = ['active'];
    }
    
    // Reload plans with new status filter
    this.loadPlans(1); // Reset to first page
  }

  isStatusSelected(status: string): boolean {
    return this.selectedStatuses.includes(status);
  }

  toggleStatusDropdown(): void {
    this.showStatusDropdown = !this.showStatusDropdown;
  }

  closeStatusDropdown(): void {
    this.showStatusDropdown = false;
  }

  getDisplaySpecs(plan: HousePlan): string[] {
    const specs: string[] = [];
    
    if (plan.bedrooms) {
      specs.push(`${plan.bedrooms} Bedroom${parseFloat(plan.bedrooms) !== 1 ? 's' : ''}`);
    }
    
    if (plan.bathrooms) {
      specs.push(`${plan.bathrooms} Bathroom${parseFloat(plan.bathrooms) !== 1 ? 's' : ''}`);
    }
    
    if (plan.stories) {
      const stories = parseFloat(plan.stories);
      specs.push(stories === 1 ? 'Single Story' : `${stories} Stories`);
    }

    if (plan.garage && plan.garage !== '0') {
      specs.push(`Garage: ${plan.garage} car`);
    }

    if (plan.basement_square_footage && plan.basement_square_footage !== '0') {
      specs.push(`Basement: ${plan.basement_square_footage} sq ft`);
    }

    if (plan.main_square_footage && plan.main_square_footage !== '0') {
      specs.push(`Main Floor: ${plan.main_square_footage} sq ft`);
    }

    if (plan.upper_square_footage && plan.upper_square_footage !== '0') {
      specs.push(`Upper Floor: ${plan.upper_square_footage} sq ft`);
    }

    if (plan.garage_square_footage && plan.garage_square_footage !== '0') {
      specs.push(`Garage: ${plan.garage_square_footage} sq ft`);
    }

    if (plan.total_square_footage && plan.total_square_footage !== '0') {
      specs.push(`Total: ${plan.total_square_footage} sq ft`);
    }

    if (plan.formatted_width && plan.formatted_depth) {
      specs.push(`Footprint:  ${plan.formatted_width}" x ${plan.formatted_depth}"`);
    }
    
    return specs;
  }

  // Generate array for pagination display
  getPageNumbers(): number[] {
    const pages: number[] = [];
    const maxPagesToShow = 5;
    
    if (this.totalPages <= maxPagesToShow) {
      // Show all pages if total is small
      for (let i = 1; i <= this.totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Show pages around current page
      const halfRange = Math.floor(maxPagesToShow / 2);
      let start = Math.max(1, this.currentPage - halfRange);
      let end = Math.min(this.totalPages, this.currentPage + halfRange);
      
      // Adjust if we're near the beginning or end
      if (start === 1) {
        end = Math.min(this.totalPages, maxPagesToShow);
      } else if (end === this.totalPages) {
        start = Math.max(1, this.totalPages - maxPagesToShow + 1);
      }
      
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
    }
    
    return pages;
  }

  /**
   * Opens the image modal with the specified image URL
   * @param imageUrl - The URL of the image to display in the modal
   */
  openImageModal(imageUrl: string): void {
    this.selectedImageUrl = imageUrl;
    this.showImageModal = true;
    
    // Prevent body scrolling when modal is open (only in browser)
    if (this.isBrowser) {
      document.body.style.overflow = 'hidden';
    }
  }

  trackPlanInterest(plan: HousePlan): void {
    this.analytics.trackPlanSelect(plan.plan_no || plan.title);
  }

  /**
   * Closes the image modal
   * @param event - Optional click event (for backdrop clicks)
   */
  closeImageModal(event?: MouseEvent): void {
    // If event is provided, check if click was on backdrop
    if (event && event.target !== event.currentTarget) {
      return;
    }

    this.showImageModal = false;
    this.selectedImageUrl = '';
    
    // Restore body scrolling (only in browser)
    if (this.isBrowser) {
      document.body.style.overflow = '';
    }
  }

  /**
   * Handle keyboard events for modal (ESC to close)
   * Add this to ngOnInit() or constructor to set up the listener
   */
  private setupKeyboardListeners(): void {
    // Only set up keyboard listeners if we're in the browser
    if (this.isBrowser) {
      document.addEventListener('keydown', this.handleKeydown);
    }
  }

  /**
   * Set up click outside listener for status dropdown
   */
  private setupClickOutsideListener(): void {
    if (this.isBrowser) {
      document.addEventListener('click', this.handleClickOutside);
    }
  }

  // Clean up event listeners in ngOnDestroy
  ngOnDestroy(): void {
    // Remove keyboard event listener (only in browser)
    if (this.isBrowser) {
      document.removeEventListener('keydown', this.handleKeydown);
      document.removeEventListener('click', this.handleClickOutside);
      
      // Restore body scrolling if modal was open
      if (this.showImageModal) {
        document.body.style.overflow = '';
      }
    }
  }

  // Keyboard handler method (bind this properly)
  private handleKeydown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape' && this.showImageModal) {
      this.closeImageModal();
    }
  };

  // Click outside handler method
  private handleClickOutside = (event: MouseEvent): void => {
    const target = event.target as HTMLElement;
    const statusDropdown = target.closest('.status-multiselect');
    
    if (!statusDropdown && this.showStatusDropdown) {
      this.showStatusDropdown = false;
    }
  };
}
