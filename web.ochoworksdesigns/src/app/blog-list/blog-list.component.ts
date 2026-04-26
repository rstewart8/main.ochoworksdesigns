import { Component, OnInit, OnDestroy, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { BlogService, BlogPost, BlogCategory, BlogListResponse } from '../_services/blog.service';
import { SEOService } from '../_services/seo.service';
import { Subscription } from 'rxjs';
import { AuthService } from '../_services/auth.service';

@Component({
  selector: 'app-blog-list',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './blog-list.component.html',
  styleUrl: './blog-list.component.css'
})
export class BlogListComponent implements OnInit, OnDestroy {
  posts: BlogPost[] = [];
  featuredPosts: BlogPost[] = [];
  categories: BlogCategory[] = [];
  
  // Pagination
  currentPage = 1;
  totalPages = 1;
  totalPosts = 0;
  postsPerPage = 9;
  
  // Filters
  selectedCategory = '';
  searchQuery = '';
  
  // State
  loading = true;
  error: string | null = null;
  
  private routeSubscription?: Subscription;
  private isBrowser: boolean;
  showStatusDropdown = false;

  selectedStatuses: string[] = ['published']; // Default to published
  availableStatuses = [
    { value: 'archived', label: 'Archived' },
    { value: 'published', label: 'Published' },
    { value: 'draft', label: 'Draft' }
  ];

  constructor(
    private blogService: BlogService,
    private seoService: SEOService,
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  ngOnInit(): void {
    this.updateSEO();
    this.loadCategories();
    this.loadFeaturedPosts();
    
    // Subscribe to route changes for pagination and filtering
    this.routeSubscription = this.route.queryParams.subscribe(params => {
      this.currentPage = parseInt(params['page']) || 1;
      this.selectedCategory = params['category'] || '';
      this.searchQuery = params['search'] || '';
      this.loadPosts();
    });
  }

   isAdmin(): boolean {
    return this.authService.isLoggedIn();
  }

  toggleStatusDropdown(): void {
    this.showStatusDropdown = !this.showStatusDropdown;
  }

  closeStatusDropdown(): void {
    this.showStatusDropdown = false;
  }

  isStatusSelected(status: string): boolean {
    return this.selectedStatuses.includes(status);
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
    this.loadPosts(); // Reset to first page
  }

  ngOnDestroy(): void {
    this.routeSubscription?.unsubscribe();
  }

  private updateSEO(): void {
    this.seoService.updateSEO({
      title: 'Custom Home Plans & Architectural Designs | OchoWorks Designs Blog',
      description: 'Discover expert insights on custom home plans, architectural designs, and building tips from OchoWorks Designs. Browse our collection of modern farmhouse, contemporary, and traditional home designs.',
      type: 'website',
      url: this.isBrowser ? window.location.href : undefined
    });
  }

  private loadCategories(): void {
    this.blogService.getCategories().subscribe({
      next: (categories) => {
        this.categories = Array.isArray(categories) ? categories : [];
      },
      error: (err) => {
        console.error('Error loading categories:', err);
        this.categories = [];
      }
    });
  }

  private loadFeaturedPosts(): void {
    this.blogService.getFeaturedPosts(3).subscribe({
      next: (posts) => {
        this.featuredPosts = posts || [];
      },
      error: (err) => {
        console.error('Error loading featured posts:', err);
        this.featuredPosts = [];
      }
    });
  }

  loadPosts(): void {
    this.loading = true;
    this.error = null;
    
    this.closeStatusDropdown();

    //// comma separated string of statuses for API
    const statusParam = this.selectedStatuses.join(',');

    this.blogService.getAllPosts(
      this.currentPage, 
      this.postsPerPage, 
      this.selectedCategory || undefined, 
      this.searchQuery || undefined,
      statusParam || undefined
    ).subscribe({
      next: (response: BlogListResponse) => {
        this.posts = response.posts || [];
        this.totalPages = Math.ceil(response.total / this.postsPerPage) || 1;
        this.totalPosts = response.total || 0;
        this.loading = false;
        
        // Update SEO for filtered results
        if (this.selectedCategory || this.searchQuery) {
          this.updateFilteredSEO();
        }
      },
      error: (err) => {
        console.error('Error loading posts:', err);
        this.error = 'Failed to load blog posts. Please try again later.';
        this.loading = false;
      }
    });
  }

  private updateFilteredSEO(): void {
    let title = 'Custom Home Plans';
    let description = 'Browse our collection of architectural designs and home plans';

    if (this.selectedCategory) {
      const category = this.categories.find(cat => cat.slug === this.selectedCategory);
      if (category) {
        title = `${category.name} Home Plans`;
        description = `Explore our ${category.name.toLowerCase()} architectural designs and home plans`;
      }
    }

    if (this.searchQuery) {
      title = `Search Results for "${this.searchQuery}"`;
      description = `Search results for ${this.searchQuery} in our home plans and architectural designs`;
    }

    this.seoService.updateSEO({
      title: `${title} | OchoWorks Designs Blog`,
      description: `${description}. Expert architectural design and ready-to-build home plans.`,
      type: 'website'
    });
  }

  // Navigation methods
  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.updateRoute({ page: page.toString() });
    }
  }

  onCategoryChange(category: string): void {
    this.updateRoute({ category, page: '1' });
  }

  onSearch(): void {
    this.updateRoute({ search: this.searchQuery, page: '1' });
  }

  clearFilters(): void {
    this.selectedCategory = '';
    this.searchQuery = '';
    this.currentPage = 1;
    this.updateRoute({ category: null, search: null, page: '1' });
  }

  private updateRoute(params: any): void {
    // Remove empty params
    Object.keys(params).forEach(key => {
      if (!params[key]) {
        delete params[key];
      }
    });
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: params
    });
  }

  // Utility methods
  getExcerpt(content: string, length: number = 150): string {
    if (!content) return '';
    const textContent = content.replace(/<[^>]*>/g, ''); // Strip HTML
    return textContent.length > length ? 
      textContent.substring(0, length) + '...' : 
      textContent;
  }

  getFeaturedImage(post: BlogPost): string {
    if (post.featured_image) {
      return post.featured_image;
    }
    
    if (post.images && post.images.length > 0) {
      const featured = post.images.find(img => img.isFeatured);
      if (featured) return featured.url;
      return post.images[0].url;
    }
    
    return '/assets/images/default-blog-image.jpg'; // Fallback image
  }

  getFeaturedImageAlt(post: BlogPost): string {
    if (post.images && post.images.length > 0) {
      const featured = post.images.find(img => img.isFeatured);
      if (featured && featured.alt) return featured.alt;
      if (post.images[0] && post.images[0].alt) return post.images[0].alt;
    }
    return post.title;
  }

  formatDate(dateString: string): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  incrementViews(post: BlogPost): void {
    if (this.isBrowser) {
      this.blogService.incrementViews(post.slug).subscribe({
        next: () => {
          // Views incremented successfully
        },
        error: (err) => {
          console.error('Error incrementing views:', err);
        }
      });
    }
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

  // Track by function for ngFor optimization
  trackByFn(index: number, post: BlogPost): string {
    return post.id;
  }

  trackByCategoryFn(index: number, category: BlogCategory): string {
    return category.id;
  }
}