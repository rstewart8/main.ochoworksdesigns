import { Component, OnInit, OnDestroy, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { BlogService, BlogPost } from '../_services/blog.service';
import { SEOService } from '../_services/seo.service';
import { Subscription } from 'rxjs';
import { AuthService } from '../_services/auth.service';

@Component({
  selector: 'app-blog-detail',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './blog-detail.component.html',
  styleUrl: './blog-detail.component.css'
})
export class BlogDetailComponent implements OnInit, OnDestroy {
  post: BlogPost | null = null;
  relatedPosts: BlogPost[] = [];
  recentPosts: BlogPost[] = [];
  
  loading = true;
  error: string | null = null;

  slug: string = '';
  
  // Image gallery
  selectedImageIndex = 0;
  showImageGallery = false;
  
  private routeSubscription?: Subscription;
  private isBrowser: boolean;

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
    this.routeSubscription = this.route.params.subscribe(params => {
      this.slug = params['slug'];
      if (this.slug) {
        this.loadPost(this.slug);
      }
    });
    
    this.loadRecentPosts();
  }

  ngOnDestroy(): void {
    this.routeSubscription?.unsubscribe();
  }

  isAdmin(): boolean {
    return this.authService.isLoggedIn();
  }

  private loadPost(slug: string): void {
    this.loading = true;
    this.error = null;

    this.blogService.getPost(slug).subscribe({
      next: (post) => {
        this.post = post;
        this.updateSEO(post);
        this.incrementViews(post);
        this.loading = false;
        
        // Load related posts after we have the main post
        this.loadRelatedPosts(post);
      },
      error: (err) => {
        console.error('Error loading post:', err);
        if (err.status === 404) {
          this.error = 'Blog post not found.';
        } else {
          this.error = 'Failed to load blog post. Please try again later.';
        }
        this.loading = false;
      }
    });
  }

  private loadRelatedPosts(currentPost: BlogPost): void {
    // Get posts from the same category or recent posts
    const category = currentPost.category;
    if (category) {
      this.blogService.getPublishedPosts(1, 4, category).subscribe({
        next: (response) => {
          // Filter out the current post and limit to 3
          this.relatedPosts = (response.posts || [])
            .filter(post => post.id !== currentPost.id)
            .slice(0, 3);
        },
        error: (err) => {
          console.error('Error loading related posts:', err);
          this.relatedPosts = [];
        }
      });
    }
  }

  private loadRecentPosts(): void {
    this.blogService.getRecentPosts(5).subscribe({
      next: (posts) => {
        this.recentPosts = posts || [];
      },
      error: (err) => {
        console.error('Error loading recent posts:', err);
        this.recentPosts = [];
      }
    });
  }

  private updateSEO(post: BlogPost): void {
    const featuredImage = this.getFeaturedImage(post);
    
    this.seoService.updateSEO({
      title: post.meta_title || post.title,
      description: post.meta_description || post.excerpt,
      keywords: post.meta_keywords,
      type: 'article',
      url: this.isBrowser ? window.location.href : undefined,
      image: featuredImage,
      publishedTime: post.published_at || post.created_at,
      modifiedTime: post.updated_at,
      author: post.author,
      section: post.category,
      tags: post.tags
    });
  }

  private incrementViews(post: BlogPost): void {
    if (this.isBrowser) {
      this.blogService.incrementViews(post.slug).subscribe({
        next: () => {
          // Views incremented successfully
          if (this.post) {
            this.post.views = (this.post.views || 0) + 1;
          }
        },
        error: (err) => {
          console.error('Error incrementing views:', err);
        }
      });
    }
  }

  // Image handling methods
  getFeaturedImage(post: BlogPost): string {
    if (post.featured_image) {
      return post.featured_image;
    }
    
    if (post.images && post.images.length > 0) {
      const featured = post.images.find(img => img.isFeatured);
      if (featured) return featured.url;
      return post.images[0].url;
    }
    
    return '/assets/images/default-blog-image.jpg';
  }

  getFeaturedImageAlt(post: BlogPost): string {
    if (post.images && post.images.length > 0) {
      const featured = post.images.find(img => img.isFeatured);
      if (featured && featured.alt) return featured.alt;
      if (post.images[0] && post.images[0].alt) return post.images[0].alt;
    }
    return post.title;
  }

  getPostImages(post: BlogPost): any[] {
    if (!post.images || post.images.length === 0) {
      return post.featured_image ? [{ url: post.featured_image, alt: post.title, isFeatured: true }] : [];
    }
    return post.images;
  }

  openImageGallery(index: number): void {
    this.selectedImageIndex = index;
    this.showImageGallery = true;
    
    if (this.isBrowser) {
      document.body.style.overflow = 'hidden';
    }
  }

  closeImageGallery(): void {
    this.showImageGallery = false;
    
    if (this.isBrowser) {
      document.body.style.overflow = 'auto';
    }
  }

  nextImage(): void {
    if (!this.post) return;
    const images = this.getPostImages(this.post);
    this.selectedImageIndex = (this.selectedImageIndex + 1) % images.length;
  }

  previousImage(): void {
    if (!this.post) return;
    const images = this.getPostImages(this.post);
    this.selectedImageIndex = this.selectedImageIndex === 0 ? images.length - 1 : this.selectedImageIndex - 1;
  }

  // Utility methods
  formatDate(dateString: string): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  formatDateWithTime(dateString: string): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  getReadingTime(content: string): number {
    if (!content) return 0;
    const wordsPerMinute = 200;
    const wordCount = content.replace(/<[^>]*>/g, '').split(/\s+/).length;
    return Math.ceil(wordCount / wordsPerMinute);
  }

  scrollToTop(): void {
    if (this.isBrowser) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  sharePost(platform: string): void {
    if (!this.post || !this.isBrowser) return;

    const url = encodeURIComponent(window.location.href);
    const title = encodeURIComponent(this.post.title);
    const text = encodeURIComponent(this.post.excerpt || this.post.title);

    let shareUrl = '';

    switch (platform) {
      case 'twitter':
        shareUrl = `https://twitter.com/intent/tweet?url=${url}&text=${title}`;
        break;
      case 'facebook':
        shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${url}`;
        break;
      case 'linkedin':
        shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${url}`;
        break;
      case 'email':
        shareUrl = `mailto:?subject=${title}&body=${text}%0A%0A${url}`;
        break;
    }

    if (shareUrl) {
      if (platform === 'email') {
        window.location.href = shareUrl;
      } else {
        window.open(shareUrl, '_blank', 'width=600,height=400');
      }
    }
  }

  copyLink(): void {
    if (!this.isBrowser) return;

    navigator.clipboard.writeText(window.location.href).then(() => {
      // Could show a toast notification here
      console.log('Link copied to clipboard');
    }).catch(err => {
      console.error('Failed to copy link:', err);
    });
  }

  // Navigation
  goBack(): void {
    this.router.navigate(['/blog']);
  }

  navigateToCategory(category: string): void {
    this.router.navigate(['/blog'], { queryParams: { category } });
  }

  navigateToTag(tag: string): void {
    this.router.navigate(['/blog/list'], { queryParams: { search: tag } });
  }

  // Keyboard navigation for image gallery
  onKeydown(event: KeyboardEvent): void {
    if (!this.showImageGallery) return;

    switch (event.key) {
      case 'Escape':
        this.closeImageGallery();
        break;
      case 'ArrowLeft':
        this.previousImage();
        break;
      case 'ArrowRight':
        this.nextImage();
        break;
    }
  }

  // Track by function for ngFor optimization
  trackByFn(index: number, item: any): any {
    return item.id || item.url || index;
  }
}
