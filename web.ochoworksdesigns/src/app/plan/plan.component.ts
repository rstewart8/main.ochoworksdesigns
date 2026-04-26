import { Component, OnInit, OnDestroy, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { PlanService, HousePlan } from '../_services/plan.service';
import { Subscription } from 'rxjs';
import { AuthService } from '../_services/auth.service';

@Component({
  selector: 'app-plan',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './plan.component.html',
  styleUrl: './plan.component.css'
})
export class PlanComponent implements OnInit, OnDestroy {
  plan: HousePlan | null = null;
  loading = true;
  error: string | null = null;
  selectedImageIndex = 0;
  private routeSubscription?: Subscription;
  private isBrowser: boolean;

  // Image modal properties
  showImageModal = false;
  selectedImageUrl = '';

  constructor(
    private planService: PlanService,
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  ngOnInit(): void {
    // Only setup keyboard listeners in browser environment
    if (this.isBrowser) {
      this.setupKeyboardListeners();
    }
    
    this.routeSubscription = this.route.params.subscribe(params => {
      const planId = params['planId'];
      console.log('Plan ID from route:', planId);
      if (planId) {
        this.loadPlan(planId);
      } else {
        this.error = 'Plan ID not provided';
        this.loading = false;
      }
    });
  }

  isAdmin(): boolean {
    return this.authService.isLoggedIn();
  }

  ngOnDestroy(): void {
    this.routeSubscription?.unsubscribe();
    
    // Only remove event listeners and manipulate DOM in browser environment
    if (this.isBrowser && typeof document !== 'undefined') {
      // Remove keyboard event listener
      document.removeEventListener('keydown', this.handleKeydown);
      
      // Restore body scrolling if modal was open
      if (this.showImageModal) {
        document.body.style.overflow = '';
      }
    }
  }

  loadPlan(id: string): void {
    this.loading = true;
    this.error = null;

    const isAdmin = this.isAdmin();

    //// if isAdmin === true the use plan.swervice.getPlanSet(id) else use plan.service.getPlan(id)
    if (isAdmin) {
      this.planService.getPlanSet(id).subscribe({
        next: (plan) => {
          console.log('Loaded plan for admin:', plan);
          if (plan) {
            this.plan = plan;
            this.selectedImageIndex = 0;
          } else {
            this.error = 'Plan not found';
          }
          this.loading = false;
        },
        error: (err) => {
          console.error('Error loading plan for admin:', err);
          this.error = 'Failed to load plan. Please try again later.';
          this.loading = false;
        }
      });
      return; // Exit early since we already handled loading for admin
    }
    
    this.planService.getPlan(id).subscribe({
      next: (plan) => {
        console.log('Loaded plan:', plan);
        if (plan) {
          this.plan = plan;
          this.selectedImageIndex = 0;
        } else {
          this.error = 'Plan not found';
        }
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading plan:', err);
        this.error = 'Failed to load plan. Please try again later.';
        this.loading = false;
      }
    });
  }

  // Image gallery methods
  selectImage(index: number): void {
    if (this.plan?.images && index >= 0 && index < this.plan.images.length) {
      this.selectedImageIndex = index;
    }
  }

  previousImage(): void {
    if (this.plan?.images && this.selectedImageIndex > 0) {
      this.selectedImageIndex--;
    }
  }

  nextImage(): void {
    if (this.plan?.images && this.selectedImageIndex < this.plan.images.length - 1) {
      this.selectedImageIndex++;
    }
  }

  // Image modal methods
  openImageModal(imageUrl?: string): void {
    // Use provided imageUrl or current selected image
    this.selectedImageUrl = imageUrl || this.getPrimaryImage();
    this.showImageModal = true;
    
    // Only prevent body scrolling in browser environment
    if (this.isBrowser && typeof document !== 'undefined') {
      document.body.style.overflow = 'hidden';
    }
  }

  closeImageModal(event?: MouseEvent): void {
    // If event is provided, check if click was on backdrop
    if (event && event.target !== event.currentTarget) {
      return;
    }

    this.showImageModal = false;
    this.selectedImageUrl = '';
    
    // Only restore body scrolling in browser environment
    if (this.isBrowser && typeof document !== 'undefined') {
      document.body.style.overflow = '';
    }
  }

  private setupKeyboardListeners(): void {
    if (this.isBrowser && typeof document !== 'undefined') {
      document.addEventListener('keydown', this.handleKeydown);
    }
  }

  private handleKeydown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape' && this.showImageModal) {
      this.closeImageModal();
    }
  };

  // Modal navigation methods
  previousModalImage(): void {
    if (this.plan?.images && this.selectedImageIndex > 0) {
      this.selectedImageIndex--;
      this.selectedImageUrl = this.plan.images[this.selectedImageIndex].image_url;
    }
  }

  nextModalImage(): void {
    if (this.plan?.images && this.selectedImageIndex < this.plan.images.length - 1) {
      this.selectedImageIndex++;
      this.selectedImageUrl = this.plan.images[this.selectedImageIndex].image_url;
    }
  }

  // Helper methods
  getPrimaryImage(): string {
    if (this.plan?.images && this.plan.images.length > 0) {
      return this.plan.images[this.selectedImageIndex].image_url;
    }
    return 'assets/images/plan-placeholder.jpg';
  }

  getImageAlt(): string {

    if (this.plan?.images && this.plan.images.length > 0) {
      return `${this.plan.images[this.selectedImageIndex].alt_text || 'House plan image'}`;
    }
    return this.plan?.title || 'House plan image';
  }

  getDetailedSpecs(): Array<{label: string, value: string}> {
    if (!this.plan) return [];
    
    const specs: Array<{label: string, value: string}> = [];
    
    if (this.plan.bedrooms) {
      specs.push({
        label: 'Bedrooms',
        value: `${this.plan.bedrooms} Bedroom${parseFloat(this.plan.bedrooms) !== 1 ? 's' : ''}`
      });
    }
    
    if (this.plan.bathrooms) {
      specs.push({
        label: 'Bathrooms',
        value: `${this.plan.bathrooms} Bathroom${parseFloat(this.plan.bathrooms) !== 1 ? 's' : ''}`
      });
    }
    
    if (this.plan.stories) {
      const stories = parseFloat(this.plan.stories);
      specs.push({
        label: 'Stories',
        value: stories === 1 ? 'Single Story' : `${stories} Stories`
      });
    }

    if (this.plan.garage && this.plan.garage !== '0') {
      specs.push({
        label: 'Garage',
        value: `${this.plan.garage} car`
      });
    }

    if (this.plan.basement_square_footage && this.plan.basement_square_footage !== '0') {
      specs.push({
        label: 'Basement',
        value: `${this.plan.basement_square_footage} sq ft`
      });
    }

    if (this.plan.main_square_footage && this.plan.main_square_footage !== '0') {
      specs.push({
        label: 'Main Floor',
        value: `${this.plan.main_square_footage} sq ft`
      });
    }

    if (this.plan.upper_square_footage && this.plan.upper_square_footage !== '0') {
      specs.push({
        label: 'Upper Floor',
        value: `${this.plan.upper_square_footage} sq ft`
      });
    }

    if (this.plan.garage_square_footage && this.plan.garage_square_footage !== '0') {
      specs.push({
        label: 'Garage',
        value: `${this.plan.garage_square_footage} sq ft`
      });
    }

    if (this.plan.total_square_footage && this.plan.total_square_footage !== '0') {
      specs.push({
        label: 'Total',
        value: `${this.plan.total_square_footage} sq ft`
      });
    }
    
    if (this.plan.formatted_width && this.plan.formatted_depth) {
      specs.push({
        label: 'Footprint',
        value: `${this.plan.formatted_width}" x ${this.plan.formatted_depth}"`
      });
    }
    
    return specs;
  }

  formatDate(dateString: string): string {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return dateString;
    }
  }

  // Navigation methods
  goBack(): void {
    this.router.navigate(['/plans']);
  }

  // Contact/quote methods
  getQuoteUrl(): string {
    return `/contact?plan=${this.plan?.plan_no || ''}`;
  }

  // Share functionality
  sharePlan(): void {
    // Only use native sharing in browser environment
    if (this.isBrowser && navigator.share && this.plan) {
      console.log('plan', this.plan);
      navigator.share({
        text: 'Check out this house plan from OchoWorks Designs!',
        url: window.location.href
      }).catch(err => {
        console.log('Error sharing:', err);
        this.copyToClipboard();
      });
    } else {
      this.copyToClipboard();
    }
  }

  private copyToClipboard(): void {
    // Only access clipboard in browser environment
    if (this.isBrowser && typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href).then(() => {
        // You could show a toast notification here
        console.log('Link copied to clipboard');
      }).catch(err => {
        console.error('Failed to copy link:', err);
      });
    } else {
      console.log('Clipboard API not available');
    }
  }
}