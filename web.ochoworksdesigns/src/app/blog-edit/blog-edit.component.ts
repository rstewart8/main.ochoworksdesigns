import { Component, OnInit, OnDestroy, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { BlogService, BlogPost, BlogCategory } from '../_services/blog.service';
import { SEOService } from '../_services/seo.service';
import { AuthService } from '../_services/auth.service';
import { Subscription } from 'rxjs';
import { PlanComponent } from '../plan/plan.component';

interface ImageData {
  url: string;
  alt?: string;
  isFeatured: boolean;
  id: string;
  database_id?: string;
  isUploading?: boolean;
  uploadProgress?: number;
  file?: File; // For files that haven't been uploaded yet
  isUploaded?: boolean; // Track if file has been uploaded
}

@Component({
  selector: 'app-blog-edit',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, ReactiveFormsModule],
  templateUrl: './blog-edit.component.html',
  styleUrl: './blog-edit.component.css'
})
export class BlogEditComponent implements OnInit, OnDestroy {
  blogForm!: FormGroup;
  post: BlogPost | null = null;
  categories: BlogCategory[] = [];
  isEditMode = false;
  loading = true;
  saving = false;
  error: string | null = null;
  successMessage: string | null = null;

  // Image management
  imageUrls: ImageData[] = [];
  maxImages = 10;

  // New image URL input
  newImageUrl = '';
  newImageUrlError = '';

  // Form validation
  validationErrors: { [key: string]: string } = {};

  private routeSubscription?: Subscription;
  private isBrowser: boolean;

  constructor(
    private fb: FormBuilder,
    private blogService: BlogService,
    private seoService: SEOService,
    private authService: AuthService,
    private route: ActivatedRoute,
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
    this.initializeForm();
  }

  ngOnInit(): void {
    // Check if user is admin
    if (!this.authService.isLoggedIn()) {
      this.router.navigate(['/login']);
      return;
    }

    // Update SEO for admin page
    this.updateSEO();

    // Load categories
    this.loadCategories();

    // Check if this is edit mode
    this.routeSubscription = this.route.params.subscribe(params => {
      const postId = params['id'];
      if (postId && postId !== 'new') {
        this.isEditMode = true;
        this.loadPost(postId);
      } else {
        this.isEditMode = false;
        this.loading = false;
      }
    });
  }

  ngOnDestroy(): void {
    this.routeSubscription?.unsubscribe();
    // Clean up any blob URLs
    this.imageUrls.forEach(img => {
      if (img.url.startsWith('blob:')) {
        URL.revokeObjectURL(img.url);
      }
    });
  }

  private initializeForm(): void {
    this.blogForm = this.fb.group({
      title: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(200)]],
      slug: ['', [Validators.required, Validators.pattern(/^[a-z0-9-]+$/)]],
      excerpt: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(500)]],
      content: ['', [Validators.required, Validators.minLength(50)]],
      meta_title: ['', [Validators.maxLength(60)]],
      meta_description: ['', [Validators.maxLength(160)]],
      meta_keywords: ['', [Validators.maxLength(200)]],
      author: ['', [Validators.required]],
      status: ['draft', [Validators.required]],
      category: [''],
      tags: [''],
      plan_no: [''] // New field added here
    });

    // Auto-generate slug from title
    this.blogForm.get('title')?.valueChanges.subscribe(title => {
      if (title && !this.isEditMode) {
        const slug = this.generateSlug(title);
        this.blogForm.patchValue({ slug }, { emitEvent: false });
      }
    });

    // Auto-generate meta title from title
    this.blogForm.get('title')?.valueChanges.subscribe(title => {
      if (title && !this.blogForm.get('meta_title')?.value) {
        this.blogForm.patchValue({ meta_title: title }, { emitEvent: false });
      }
    });

    // Auto-generate meta description from excerpt
    this.blogForm.get('excerpt')?.valueChanges.subscribe(excerpt => {
      if (excerpt && !this.blogForm.get('meta_description')?.value) {
        const metaDesc = excerpt.length > 155 ? excerpt.substring(0, 155) + '...' : excerpt;
        this.blogForm.patchValue({ meta_description: metaDesc }, { emitEvent: false });
      }
    });
  }

  private updateSEO(): void {
    const title = this.isEditMode ? 'Edit Blog Post' : 'Create New Blog Post';
    this.seoService.updateSEO({
      title: `${title} - Admin`,
      description: 'Admin interface for creating and editing blog posts',
      type: 'website'
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

  private loadPost(id: string): void {
    this.loading = true;
    this.error = null;

    this.blogService.getPost(id).subscribe({
      next: (post) => {
        console.log('Loaded post for editing:', post);
        this.post = post;
        this.populateForm(post);
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading post:', err);
        this.error = 'Failed to load blog post. Please try again.';
        this.loading = false;
      }
    });
  }

  private populateForm(post: BlogPost): void {
    this.blogForm.patchValue({
      title: post.title,
      slug: post.slug,
      excerpt: post.excerpt,
      content: post.content,
      meta_title: post.meta_title || '',
      meta_description: post.meta_description || '',
      meta_keywords: post.meta_keywords || '',
      author: post.author,
      status: post.status,
      category: post.category || '',
      tags: post.tags ? post.tags.join(', ') : '',
      plan_no: post.plan_no || '' // Populate new field
    });

    // Load existing images
    this.loadExistingImages(post);
  }

  private loadExistingImages(post: BlogPost): void {
    this.imageUrls = [];

    // Handle featured image (legacy support)
    // if (post.featured_image) {
    //   this.imageUrls.push({
    //     url: post.featured_image,
    //     isFeatured: true,
    //     alt: post.title,
    //     id: this.generateImageId(),
    //     isUploaded: true
    //   });
    // }

    // Handle multiple images if they exist
    if (post.images && Array.isArray(post.images)) {
      post.images.forEach((img: any) => {
        if (typeof img === 'string') {
          this.imageUrls.push({
            url: img,
            isFeatured: false,
            id: this.generateImageId(),
            isUploaded: true
          });
        } else {
          this.imageUrls.push({
            url: img.image_url,
            alt: img.alt_text || '',
            isFeatured: img.is_featured || false,
            id: this.generateImageId(),
            database_id: img.id,
            isUploaded: true
          });
        }
      });
    }

    // Ensure at least one image is featured if we have images
    if (this.imageUrls.length > 0 && !this.imageUrls.some(img => img.isFeatured)) {
      this.imageUrls[0].isFeatured = true;
    }
  }

  // Image management methods
  private generateImageId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  onFilesSelected(event: any): void {
    const files = event.target.files;
    if (files && files.length > 0) {
      // Validate files
      const validFiles = Array.from(files as FileList).filter((file: File) => {
        return this.isValidImageFile(file);
      });

      if (validFiles.length !== files.length) {
        this.error = 'Some files were invalid. Please select valid image files (JPG, PNG, WebP, max 5MB each)';
        return;
      }

      if (this.imageUrls.length + validFiles.length > this.maxImages) {
        this.error = `Maximum ${this.maxImages} images allowed. You can add ${this.maxImages - this.imageUrls.length} more images.`;
        return;
      }

      // Create previews for selected files (but don't upload yet)
      this.createFilePreviews(validFiles);
    }

    // Clear the input so the same files can be selected again if needed
    (event.target as HTMLInputElement).value = '';
  }

  private createFilePreviews(files: File[]): void {
    if (!this.isBrowser) return;

    files.forEach((file, index) => {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        const newImage: ImageData = {
          url: e.target.result, // Blob URL for preview
          isFeatured: this.imageUrls.length === 0 && index === 0, // First image is featured if no images exist
          alt: '',
          id: this.generateImageId(),
          file: file, // Store the file for later upload
          isUploaded: false
        };
        this.imageUrls.push(newImage);
      };
      reader.readAsDataURL(file);
    });
  }

  // Upload a specific image
  uploadImage(imageId: string): void {
    const image = this.imageUrls.find(img => img.id === imageId);
    if (!image || !image.file || image.isUploaded || image.isUploading) {
      return;
    }

    image.isUploading = true;
    this.error = null;

    this.blogService.uploadImage(image.file).subscribe({
      next: (response) => {
        
        // Clean up the blob URL
        if (image.url.startsWith('blob:')) {
          URL.revokeObjectURL(image.url);
        }
        
        // Update with the server URL
        image.url = response.data.url;
        image.isUploading = false;
        image.isUploaded = true;
        image.file = undefined; // Clear the file reference
      },
      error: (err) => {
        console.error('Error uploading image:', err);
        image.isUploading = false;
        this.error = 'Failed to upload image. Please try again.';
      }
    });
  }

  // Upload all pending images
  uploadAllImages(): void {
    const pendingImages = this.imageUrls.filter(img => img.file && !img.isUploaded && !img.isUploading);
    
    if (pendingImages.length === 0) {
      return;
    }

    pendingImages.forEach(image => {
      this.uploadImage(image.id);
    });
  }

  // Add image by URL
  addImageByUrl(): void {
    if (!this.newImageUrl.trim()) {
      this.newImageUrlError = 'Please enter a valid image URL';
      return;
    }

    if (!this.isValidUrl(this.newImageUrl)) {
      this.newImageUrlError = 'Please enter a valid URL';
      return;
    }

    if (this.imageUrls.length >= this.maxImages) {
      this.newImageUrlError = `Maximum ${this.maxImages} images allowed`;
      return;
    }

    const newImage: ImageData = {
      url: this.newImageUrl.trim(),
      isFeatured: this.imageUrls.length === 0, // First image is featured
      alt: '',
      id: this.generateImageId(),
      isUploaded: true // URL images are considered "uploaded"
    };

    this.imageUrls.push(newImage);

    // Clear input
    this.newImageUrl = '';
    this.newImageUrlError = '';
  }

  // Remove image
  removeImage(imageId: string): void {
    const index = this.imageUrls.findIndex(img => img.id === imageId);
    if (index > -1) {
      const image = this.imageUrls[index];
      
      // Clean up blob URL if it exists
      if (image.url.startsWith('blob:')) {
        URL.revokeObjectURL(image.url);
      }
      
      const removedImage = this.imageUrls[index];
      this.imageUrls.splice(index, 1);

      // If removed image was featured, make the first remaining image featured
      if (removedImage.isFeatured && this.imageUrls.length > 0) {
        this.imageUrls[0].isFeatured = true;
      }
    }
  }

  // Set featured image
  setFeaturedImage(imageId: string): void {
    // Remove featured status from all images
    this.imageUrls.forEach(img => img.isFeatured = false);

    // Set selected image as featured
    const targetImage = this.imageUrls.find(img => img.id === imageId);
    if (targetImage) {
      targetImage.isFeatured = true;
    }
  }

  // Move image up in order
  moveImageUp(imageId: string): void {
    const index = this.imageUrls.findIndex(img => img.id === imageId);
    if (index <= 0) return;

    const temp = this.imageUrls[index];
    this.imageUrls[index] = this.imageUrls[index - 1];
    this.imageUrls[index - 1] = temp;
  }

  // Move image down in order
  moveImageDown(imageId: string): void {
    const index = this.imageUrls.findIndex(img => img.id === imageId);
    if (index < 0 || index >= this.imageUrls.length - 1) return;

    const temp = this.imageUrls[index];
    this.imageUrls[index] = this.imageUrls[index + 1];
    this.imageUrls[index + 1] = temp;
  }

  private isValidImageFile(file: File): boolean {
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const maxSize = 5 * 1024 * 1024; // 5MB

    return validTypes.includes(file.type) && file.size <= maxSize;
  }

  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  // Get featured image for display
  getFeaturedImage(): ImageData | null {
    return this.imageUrls.find(img => img.isFeatured) || (this.imageUrls.length > 0 ? this.imageUrls[0] : null);
  }

  // Update image URL
  updateImageUrl(imageId: string, event: Event): void {
    const target = event.target as HTMLInputElement;
    const image = this.imageUrls.find(img => img.id === imageId);
    if (target && image) {
      image.url = target.value;
    }
  }

  // Update image alt text
  updateImageAlt(imageId: string, event: Event): void {
    const target = event.target as HTMLInputElement;
    const image = this.imageUrls.find(img => img.id === imageId);
    if (target && image) {
      image.alt = target.value;
    }
  }

  // Check if any images are uploading
  hasUploadingImages(): boolean {
    return this.imageUrls.some(img => img.isUploading === true);
  }

  // Check if there are pending uploads
  hasPendingUploads(): boolean {
    return this.imageUrls.some(img => img.file && !img.isUploaded && !img.isUploading);
  }

  // Get count of pending uploads
  getPendingUploadsCount(): number {
    return this.imageUrls.filter(img => img.file && !img.isUploaded && !img.isUploading).length;
  }

  // Get count of uploading images
  getUploadingImagesCount(): number {
    return this.imageUrls.filter(img => img.isUploading === true).length;
  }

  // Form submission
  onSubmit(): void {
    if (this.blogForm.invalid) {
      this.markFormGroupTouched();
      this.validateForm();
      return;
    }

    if (this.hasUploadingImages()) {
      this.error = 'Please wait for all images to finish uploading';
      return;
    }

    if (this.hasPendingUploads()) {
      this.error = 'Please upload all selected images before submitting';
      return;
    }

    this.saving = true;
    this.error = null;
    this.successMessage = null;

    const formData = this.prepareFormData();
    

    if (this.isEditMode && this.post) {
      this.updatePost(formData);
    } else {
      this.createPost(formData);
    }

    console.log('Form submission response:', this.post);

    /// router navigate to post page after creation
    if (this.post && this.post.slug) {
      this.router.navigate(['/blog/list', this.post.slug]);
    }
  }

  private prepareFormData(): Partial<BlogPost> {
    const formValue = this.blogForm.value;
    const featuredImage = this.getFeaturedImage();

    return {
      title: formValue.title.trim(),
      slug: formValue.slug.trim(),
      excerpt: formValue.excerpt.trim(),
      content: formValue.content.trim(),
      meta_title: formValue.meta_title?.trim() || undefined,
      meta_description: formValue.meta_description?.trim() || undefined,
      meta_keywords: formValue.meta_keywords?.trim() || undefined,
      author: formValue.author.trim(),
      status: formValue.status,
      category: formValue.category || undefined,
      tags: formValue.tags ? formValue.tags.split(',').map((tag: string) => tag.trim()).filter((tag: string) => tag) : undefined,
      plan_no: formValue.plan_no?.trim() || undefined,
      featured_image: featuredImage?.url || undefined,
      images: this.imageUrls
        .filter(img => img.isUploaded) // Only include uploaded images
        .map(img => ({
          id: img.database_id,
          url: img.url,
          alt: img.alt || '',
          isFeatured: img.isFeatured
        })),
      read_time: this.calculateReadTime(formValue.content)
    };
  }

  private createPost(postData: Partial<BlogPost>): void {
    this.blogService.createPost(postData).subscribe({
      next: (createdPost) => {
        this.successMessage = 'Blog post created successfully!';
        this.saving = false;

        setTimeout(() => {
          this.router.navigate(['/admin/blog/edit', createdPost.id]);
        }, 1500);
      },
      error: (err) => {
        console.error('Error creating post:', err);
        this.error = this.getErrorMessage(err);
        this.saving = false;
      }
    });
  }

  private updatePost(postData: Partial<BlogPost>): void {
    if (!this.post) return;

    this.blogService.updatePost(this.post.id, postData).subscribe({
      next: (updatedPost) => {
        console.log('Post updated successfully:', updatedPost);
        this.post = updatedPost;
        this.successMessage = 'Blog post updated successfully!';
        this.saving = false;

        setTimeout(() => {
          this.successMessage = null;
        }, 3000);
      },
      error: (err) => {
        console.error('Error updating post:', err);
        this.error = this.getErrorMessage(err);
        this.saving = false;
      }
    });
  }

  // Form validation methods
  private markFormGroupTouched(): void {
    Object.keys(this.blogForm.controls).forEach(key => {
      const control = this.blogForm.get(key);
      control?.markAsTouched();
    });
  }

  private validateForm(): void {
    this.validationErrors = {};

    Object.keys(this.blogForm.controls).forEach(key => {
      const control = this.blogForm.get(key);
      if (control && control.invalid && control.touched) {
        this.validationErrors[key] = this.generateFieldErrorMessage(key, control.errors);
      }
    });
  }

  private generateFieldErrorMessage(fieldName: string, errors: any): string {
    if (errors['required']) {
      return `${this.getFieldDisplayName(fieldName)} is required`;
    }
    if (errors['minlength']) {
      return `${this.getFieldDisplayName(fieldName)} must be at least ${errors['minlength'].requiredLength} characters`;
    }
    if (errors['maxlength']) {
      return `${this.getFieldDisplayName(fieldName)} must not exceed ${errors['maxlength'].requiredLength} characters`;
    }
    if (errors['pattern']) {
      return `${this.getFieldDisplayName(fieldName)} contains invalid characters`;
    }
    return `${this.getFieldDisplayName(fieldName)} is invalid`;
  }

  private getFieldDisplayName(fieldName: string): string {
    const displayNames: { [key: string]: string } = {
      title: 'Title',
      slug: 'URL slug',
      excerpt: 'Excerpt',
      content: 'Content',
      meta_title: 'Meta title',
      meta_description: 'Meta description',
      meta_keywords: 'Meta keywords',
      author: 'Author',
      status: 'Status',
      category: 'Category',
      tags: 'Tags',
      plan_no: 'Plan Number'
    };
    return displayNames[fieldName] || fieldName;
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.blogForm.get(fieldName);
    return !!(field && field.invalid && field.touched);
  }

  getFieldError(fieldName: string): string {
    return this.validationErrors[fieldName] || '';
  }

  // Utility methods
  private generateSlug(title: string): string {
    return this.blogService.generateSlug(title);
  }

  calculateReadTime(content: string): number {
    return this.blogService.calculateReadTime(content);
  }

  private getErrorMessage(error: any): string {
    if (error.status === 400) {
      return 'Invalid data provided. Please check your inputs.';
    }
    if (error.status === 409) {
      return 'A post with this URL slug already exists.';
    }
    if (error.status === 403) {
      return 'You do not have permission to perform this action.';
    }
    return 'An error occurred. Please try again later.';
  }

  // Preview functionality
  previewPost(): void {
    if (this.blogForm.invalid) {
      this.markFormGroupTouched();
      this.validateForm();
      return;
    }

    console.log('Preview post:', this.prepareFormData());
  }

  // Navigation
  goBack(): void {
    if (this.isEditMode) {
      this.router.navigate(['/blog', this.post?.slug]);
    } else {
      this.router.navigate(['/admin/blog']);
    }
  }

  cancel(): void {
    this.router.navigate(['/admin/blog']);
  }

  // Character count helpers
  getCharacterCount(fieldName: string): number {
    const value = this.blogForm.get(fieldName)?.value || '';
    return value.length;
  }

  getWordsCount(fieldName: string): number {
    const value = this.blogForm.get(fieldName)?.value || '';
    return value.trim() ? value.trim().split(/\s+/).length : 0;
  }

  // SEO score calculation
  getSEOScore(): number {
    let score = 0;
    const maxScore = 100;

    // Title (15 points)
    const title = this.blogForm.get('title')?.value || '';
    if (title.length >= 30 && title.length <= 60) score += 15;
    else if (title.length > 0) score += 8;

    // Meta description (15 points)
    const metaDesc = this.blogForm.get('meta_description')?.value || '';
    if (metaDesc.length >= 120 && metaDesc.length <= 155) score += 15;
    else if (metaDesc.length > 0) score += 8;

    // Content length (20 points)
    const content = this.blogForm.get('content')?.value || '';
    const wordCount = this.getWordsCount('content');
    if (wordCount >= 300) score += 20;
    else if (wordCount >= 150) score += 10;

    // Tags (10 points)
    const tags = this.blogForm.get('tags')?.value || '';
    if (tags.split(',').filter((tag: string) => tag.trim()).length >= 3) score += 10;

    // Images (20 points)
    const uploadedImages = this.imageUrls.filter(img => img.isUploaded);
    if (uploadedImages.length > 0) score += 10;
    if (uploadedImages.length >= 3) score += 20;

    // Category (10 points)
    const category = this.blogForm.get('category')?.value || '';
    if (category) score += 10;

    // Featured image (10 points)
    const featuredImage = this.getFeaturedImage();
    if (featuredImage && featuredImage.isUploaded) score += 10;

    return Math.round((score / maxScore) * 100);
  }

  getSEOScoreColor(): string {
    const score = this.getSEOScore();
    if (score >= 80) return '#4CAF50';
    if (score >= 60) return '#FF9800';
    return '#F44336';
  }

  // Track by function for ngFor optimization
  trackByFn(index: number, item: any): any {
    return item.id || item.url || index;
  }

  // Helper method to ensure categories is always an array
  getCategoriesArray(): BlogCategory[] {
    return Array.isArray(this.categories) ? this.categories : [];
  }

  // Helper methods for template
  hasImages(): boolean {
    return this.imageUrls.length > 0;
  }

  getImageCount(): number {
    return this.imageUrls.length;
  }
}