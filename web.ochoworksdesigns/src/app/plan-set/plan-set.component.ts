import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Subscription } from 'rxjs';
import { ActivatedRoute } from '@angular/router';
import { PlanService, HousePlan } from '../_services/plan.service';
import { Router } from '@angular/router';

interface PlanSetData {
  title?: string;
  description?: string;
  notes?: string;
  bedrooms?: number;
  bathrooms?: number;
  stories?: number;
  main_square_footage?: number;
  upper_square_footage?: number;
  basement_square_footage?: number;
  garage?: number;
  width_feet?: number;
  width_inches?: number;
  depth_feet?: number;
  depth_inches?: number;
  status: 'pending' | 'active' | 'inactive';
  rendering?: File[];
  floor_plan?: File[];
  generate_title?: boolean;
  generate_description?: boolean;
  generate_blog?: boolean;
  generate_instagram?: boolean;
  generate_facebook?: boolean;
}

interface ImagePreview {
  file: File;
  url: string;
  id: string;
  database_id?: number;
  alt_text?: string;
}

interface ImageValue {
  image_id: number;
  alt_text: string;
}

@Component({
  selector: 'app-plan-set',
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './plan-set.component.html',
  styleUrl: './plan-set.component.css'
})
export class PlanSetComponent implements OnInit, OnDestroy {
  planSetForm!: FormGroup;
  isLoading = false;
  submitMessage = '';
  private planId?: Subscription;
  plan: HousePlan | null = null;
  error: string | null = null;
  pageHeading = 'Create Plan Set';
  imageIdsToDelete: number[] = [];

  // Image preview arrays for galleries
  renderingPreviews: ImagePreview[] = [];
  floorPlanPreviews: ImagePreview[] = [];
  galleryPreviews: ImagePreview[] = [];
  imageValues: ImageValue[] = [];

  // Options for dropdowns
  bathroomOptions = [
    { value: 1, label: '1' },
    { value: 1.25, label: '1 1/4' },
    { value: 1.5, label: '1 1/2' },
    { value: 1.75, label: '1 3/4' },
    { value: 2, label: '2' },
    { value: 2.25, label: '2 1/4' },
    { value: 2.5, label: '2 1/2' },
    { value: 2.75, label: '2 3/4' },
    { value: 3, label: '3' },
    { value: 3.25, label: '3 1/4' },
    { value: 3.5, label: '3 1/2' },
    { value: 3.75, label: '3 3/4' },
    { value: 4, label: '4' },
    { value: 4.5, label: '4 1/2' },
    { value: 5, label: '5' },
    { value: 5.5, label: '5 1/2' },
    { value: 6, label: '6' },
    { value: 6.5, label: '6 1/2' },
    { value: 7, label: '7' },
    { value: 7.5, label: '7 1/2' },
    { value: 8, label: '8' },
    { value: 8.5, label: '8 1/2' },
    { value: 9, label: '9' },
    { value: 9.5, label: '9 1/2' },
    { value: 10, label: '10' },
    { value: 10.5, label: '10 1/2' },
    { value: 11, label: '11' },
    { value: 11.5, label: '11 1/2' },
    { value: 12, label: '12' }, 
    { value: 12.5, label: '12 1/2' },
    { value: 13, label: '13' },
    { value: 13.5, label: '13 1/2' },

  ];

  storyOptions = [
    { value: 1, label: '1' },
    { value: 1.5, label: '1 1/2' },
    { value: 2, label: '2' },
    { value: 2.5, label: '2 1/2' },
    { value: 3, label: '3' }
  ];

  garageOptions = [
    { value: 0, label: 'None' },
    { value: 1, label: '1' },
    { value: 1.5, label: '1 1/2' },
    { value: 2, label: '2' },
    { value: 2.5, label: '2 1/2' },
    { value: 3, label: '3' },
    { value: 3.5, label: '3 1/2' },
    { value: 4, label: '4' }
  ];

  statusOptions = [
    { value: 'pending', label: 'Pending' },
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' }
  ];

  // For inches dropdown (0-11)
  inchesOptions = Array.from({ length: 12 }, (_, i) => ({ value: i, label: i.toString() }));

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private route: ActivatedRoute,
    private planService: PlanService,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.initializeForm();
    this.planId = this.route.params.subscribe(params => {
      const planId = params['planId'];
      
      if (planId) {
        this.pageHeading = `Edit Plan Set`;
        this.loadPlan(planId);
        
      } else {
        // this.error = 'Plan ID not provided';
        // this.loading = false;
      }
    });
  }

  isViewOrder(): boolean {
    // Return true if planSetForm has status active
    return this.planSetForm.get('status')?.value === 'active';
  }

  loadPlan(id: string): void {
    this.isLoading = true;
    this.error = null;

    this.planService.getPlanSet(id).subscribe({
      next: (plan) => {
        if (plan) {
          this.plan = plan;
          this.pageHeading = `Edit Plan Set - ${this.plan?.plan_no}`;
          this.setPlanFormValues(plan);
        } else {
          this.error = 'Plan not found';
        }
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading plan:', err);
        this.error = 'Failed to load plan. Please try again later.';
        this.isLoading = false;
      }
    });
  }

  setPlanFormValues(plan: HousePlan) {
    const { feet: widthFeet, inches: widthInches } = this.parseDimension(plan.formatted_width || '');
    const { feet: depthFeet, inches: depthInches } = this.parseDimension(plan.formatted_depth || '');

    this.planSetForm.patchValue({
      title: plan.title || '',
      description: plan.description || '',
      notes: plan.notes.length > 0 ? plan.notes[0].note : '',
      bedrooms: plan.bedrooms || '',
      bathrooms: plan.bathrooms || '',
      stories: plan.stories || '',
      main_square_footage: Number(plan.main_square_footage) === 0 ? '' : plan.main_square_footage || '',
      upper_square_footage: Number(plan.upper_square_footage) === 0 ? '' : plan.upper_square_footage || '',
      basement_square_footage: Number(plan.basement_square_footage) === 0 ? '' : plan.basement_square_footage || '',
      garage: plan.garage || '',
      width_feet: widthFeet,
      width_inches: widthInches,
      depth_feet: depthFeet,
      depth_inches: depthInches,
      status: plan.status || 'pending',
      ordering: plan.ordering || null
    });

    // Clear existing previews
    this.clearImagePreviews();
    
    // Load existing images from plan
    plan.images.forEach(image => {
      
      if (image.image_type === 'rendering') {
        this.renderingPreviews.push({
          file: null as any, // Existing images don't have file objects
          url: image.image_url,
          id: this.generateImageId(),
          database_id: image.id, // Store the database ID for deletion tracking
          alt_text: image.alt_text || '' // Load existing alt text or empty string
        });
      } else if (image.image_type === 'floor_plan') {
        this.floorPlanPreviews.push({
          file: null as any, // Existing images don't have file objects
          url: image.image_url,
          id: this.generateImageId(),
          database_id: image.id, // Store the database ID for deletion tracking
          alt_text: image.alt_text || '' // Load existing alt text or empty string
        });
      } else if (image.image_type === 'gallery') {
        this.galleryPreviews.push({
          file: null as any, // Existing images don't have file objects
          url: image.image_url,
          id: this.generateImageId(),
          database_id: image.id, // Store the database ID for deletion tracking
          alt_text: image.alt_text || '' // Load existing alt text or empty string
        });
      }
    });
  }

  resetFormAndPreviews() {
    // Clear form
    this.planSetForm.reset();
    this.initializeForm();

    // Clear file inputs
    this.clearAllFileInputs();

    // Clear previews
    this.clearImagePreviews();

    if (this.plan) {
      this.loadPlan(this.plan.id.toString());
    }
  }

  ngOnDestroy() {
    // Clean up preview URLs to prevent memory leaks
    this.clearImagePreviews();
  }

  initializeForm() {
    this.planSetForm = this.fb.group({
      title: ['', [Validators.maxLength(128)]],
      description: ['', [Validators.maxLength(256)]],
      notes: ['', [Validators.maxLength(1000)]],
      bedrooms: ['', [Validators.min(1), Validators.max(10)]],
      bathrooms: [''],
      stories: [''],
      main_square_footage: ['', [Validators.min(1)]],
      upper_square_footage: ['', [Validators.min(0)]],
      basement_square_footage: ['', [Validators.min(0)]],
      garage: [''],
      width_feet: ['', [Validators.min(1)]],
      width_inches: [0],
      depth_feet: ['', [Validators.min(1)]],
      depth_inches: [0],
      status: ['pending', Validators.required],
      ordering: [null, [Validators.min(0), Validators.max(20)]],
    });
  }

  // Generate unique ID for image previews
  private generateImageId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  // Clear all image previews and revoke URLs
  private clearImagePreviews() {
    this.renderingPreviews.forEach(preview => {
      if (preview.url.startsWith('blob:')) {
        URL.revokeObjectURL(preview.url);
      }
    });
    this.floorPlanPreviews.forEach(preview => {
      if (preview.url.startsWith('blob:')) {
        URL.revokeObjectURL(preview.url);
      }
    });
    this.galleryPreviews.forEach(preview => {
      if (preview.url.startsWith('blob:')) {
        URL.revokeObjectURL(preview.url);
      }
    });
    this.galleryPreviews = [];
    this.renderingPreviews = [];
    this.floorPlanPreviews = [];
  }

  // Clear all file inputs
  private clearAllFileInputs() {
    const inputs = document.querySelectorAll('input[type="file"]') as NodeListOf<HTMLInputElement>;
    inputs.forEach(input => input.value = '');
  }

  onFileSelect(event: Event, fieldName: 'rendering' | 'floor_plan' | 'gallery') {
    const target = event.target as HTMLInputElement;
    const files = target.files;

    if (files && files.length > 0) {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        this.addImageToGallery(file, fieldName);
      }
    }

    // Clear the input so the same files can be selected again if needed
    target.value = '';
  }

  addImageToGallery(file: File, fieldName: 'rendering' | 'floor_plan' | 'gallery') {
    // Validate file type (images only)
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      this.submitMessage = `Please select a valid image file for ${fieldName}`;
      return;
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB in bytes
    if (file.size > maxSize) {
      this.submitMessage = `File size for ${fieldName} must be less than 10MB`;
      return;
    }

    // Create image preview
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      const imagePreview: ImagePreview = {
        file: file,
        url: result,
        id: this.generateImageId(),
        alt_text: '' // Initialize with empty alt text
      };

      if (fieldName === 'rendering') {
        this.renderingPreviews.push(imagePreview);
      } else if (fieldName === 'floor_plan') {
        this.floorPlanPreviews.push(imagePreview);
      } else if (fieldName === 'gallery') {
        this.galleryPreviews.push(imagePreview);
      }
    };
    reader.readAsDataURL(file);

    this.submitMessage = '';
  }

  removeImageFromGallery(imageId: string, fieldName: 'rendering' | 'floor_plan' | 'gallery') {
    var databaseId: number | null = null;
    if (fieldName === 'rendering') {
      
      const index = this.renderingPreviews.findIndex(preview => preview.id === imageId);
      if (index > -1) {
        const preview = this.renderingPreviews[index];
        if (preview.url.startsWith('blob:')) {
          URL.revokeObjectURL(preview.url);
        }
        databaseId = preview.database_id || null;
        this.renderingPreviews.splice(index, 1);
      }
    } else if (fieldName === 'floor_plan') {
      const index = this.floorPlanPreviews.findIndex(preview => preview.id === imageId);
      if (index > -1) {
        const preview = this.floorPlanPreviews[index];
        if (preview.url.startsWith('blob:')) {
          URL.revokeObjectURL(preview.url);
        }
        databaseId = preview.database_id || null;
        this.floorPlanPreviews.splice(index, 1);
      }
    } else if (fieldName === 'gallery') {
      const index = this.galleryPreviews.findIndex(preview => preview.id === imageId);
      if (index > -1) {
        const preview = this.galleryPreviews[index];
        if (preview.url.startsWith('blob:')) {
          URL.revokeObjectURL(preview.url);
        }
        databaseId = preview.database_id || null;
        this.galleryPreviews.splice(index, 1);
      }
    }

    if (databaseId !== null && !isNaN(parseInt(databaseId.toString()))) {
      this.imageIdsToDelete.push(databaseId);
    }

    this.submitMessage = '';
  }

  // Helper method to format dimensions as "feet' inches""
  private formatDimension(feet: number | string, inches: number | string): string {
    const feetValue = feet ? parseInt(feet.toString()) : 0;
    const inchesValue = inches ? parseInt(inches.toString()) : 0;
    return `${feetValue}' ${inchesValue}"`;
  }

  // Helper method to convert feet inch eg "20' 6"" to feet = 20, inches = 6
  private parseDimension(dimension: string): { feet: string; inches: string } {
    const regex = /(\d+)'(?:\s*(\d+)"?)?/;
    const match = dimension.match(regex);
    if (match) {
      const feet = parseInt(match[1], 10);
      const inches = match[2] ? parseInt(match[2], 10) : 0;
      return { feet: feet.toString(), inches: inches.toString() };
    }
    return { feet: '', inches: '0' };
  }

  onSubmit() {
    if (this.planSetForm.invalid) {
      this.markFormGroupTouched();
      this.submitMessage = 'Please fill in all required fields correctly.';
      return;
    }

    this.isLoading = true;
    this.submitMessage = '';

    const formData = new FormData();
    const formValues = this.planSetForm.value;

    // Add all form fields to FormData
    Object.keys(formValues).forEach(key => {
      const value = formValues[key];

      if (value !== null && value !== '' && value !== undefined) {
        if (typeof value === 'boolean') {
          // Convert boolean to string for PHP
          formData.append(key, value ? '1' : '0');
        } else {
          formData.append(key, value.toString());
        }
      }
    });

    // Add rendering images with numbered names and alt text
    this.renderingPreviews.forEach((preview, index) => {
      
      if (preview.file) {
        const fieldName = `rendering-${index + 1}`;
        formData.append(fieldName, preview.file);
        
      } else if (preview.database_id) {
        
      }
    });

    // Add floor plan images with numbered names and alt text
    this.floorPlanPreviews.forEach((preview, index) => {
      if (preview.file) {
        const fieldName = `floor_plan-${index + 1}`;
        formData.append(fieldName, preview.file);
      } else if (preview.database_id) {
        
      }
    });

    // Add gallery images with numbered names and alt text
    this.galleryPreviews.forEach((preview, index) => {
      if (preview.file) {
        const fieldName = `gallery-${index + 1}`;
        formData.append(fieldName, preview.file);
      } else if (preview.database_id) {
      }
    });

    // Add alt text values for all images
    formData.append('image_values', JSON.stringify(this.imageValues));

    // Format and add width dimension if both feet and inches are provided
    if (formValues.width_feet !== null && formValues.width_feet !== '' && formValues.width_feet !== undefined) {
      const formattedWidth = this.formatDimension(formValues.width_feet, formValues.width_inches || 0);
      formData.append('width', formattedWidth);
    }

    // Format and add depth dimension if both feet and inches are provided
    if (formValues.depth_feet !== null && formValues.depth_feet !== '' && formValues.depth_feet !== undefined) {
      const formattedDepth = this.formatDimension(formValues.depth_feet, formValues.depth_inches || 0);
      formData.append('depth', formattedDepth);
    }

    // Remove the individual dimension components since we're sending formatted versions
    formData.delete('width_feet');
    formData.delete('width_inches');
    formData.delete('depth_feet');
    formData.delete('depth_inches');

    if (this.plan && this.plan.plan_no) {
      formData.append('plan_no', this.plan.plan_no.toString());
    }

    //// remove null entries from imageIdsToDelete
    var filteredImageIdsToDelete = [];
    for (let i = 0; i < this.imageIdsToDelete.length; i++) {
      if (this.imageIdsToDelete[i] != null && !isNaN(this.imageIdsToDelete[i])) {
        filteredImageIdsToDelete.push(this.imageIdsToDelete[i]);
      }
    }

    formData.append('image_ids_to_delete', JSON.stringify(filteredImageIdsToDelete));

    // Make API call to PHP backend
    this.http.post(`${environment.apiUrl}/api/plans`, formData).subscribe({
      next: (response: any) => {
        this.isLoading = false;
        this.submitMessage = 'Plan set saved successfully!';
        const planId = response.data?.database_id || (this.plan ? this.plan.database_id : null);
        this.resetFormAndPreviews();
        if (planId) {
          this.router.navigate([`/plan-set/${planId}`]);
        }
      },
      error: (error) => {
        this.isLoading = false;
        console.error('Error saving plan set:', error);
        this.submitMessage = 'Error saving plan set. Please try again.';
      }
    });
  }

  private markFormGroupTouched() {
    Object.keys(this.planSetForm.controls).forEach(key => {
      const control = this.planSetForm.get(key);
      control?.markAsTouched();
    });
  }

  // Helper methods for template
  isFieldInvalid(fieldName: string): boolean {
    const field = this.planSetForm.get(fieldName);
    return field ? field.invalid && field.touched : false;
  }

  getFieldError(fieldName: string): string {
    const field = this.planSetForm.get(fieldName);
    if (field?.errors && field.touched) {
      if (field.errors['required']) return `${fieldName} is required`;
      if (field.errors['maxlength']) return `${fieldName} is too long`;
      if (field.errors['min']) return `${fieldName} must be greater than 0`;
      if (field.errors['max']) return `${fieldName} exceeds maximum value`;
    }
    return '';
  }

  // Character count helpers
  getTitleCharCount(): number {
    return this.planSetForm.get('title')?.value?.length || 0;
  }

  getDescriptionCharCount(): number {
    return this.planSetForm.get('description')?.value?.length || 0;
  }

  getNotesCharCount(): number {
    return this.planSetForm.get('notes')?.value?.length || 0;
  }

  // Alt text character count helper
  getAltTextCharCount(altText: string | undefined): number {
    return altText?.length || 0;
  }

  // Update alt text for image preview
  updateAltText(event: Event, preview: ImagePreview): void {
    const imageId = preview.database_id;
    const value = (event.target as HTMLTextAreaElement).value;
    if (imageId && !this.imageValues.find(iv => iv.image_id === imageId)) {
      this.imageValues.push({ image_id: imageId, alt_text: value || '' });
    } else if (imageId) {
      const existing = this.imageValues.find(iv => iv.image_id === imageId);
      if (existing) {
        existing.alt_text = value || '';
      }
    }
    console.log('imageValues:', this.imageValues);
    const target = event.target as HTMLTextAreaElement;
    preview.alt_text = target.value;
  }

  // Gallery helper methods
  hasImages(fieldName: 'rendering' | 'floor_plan' | 'gallery'): boolean {
    return fieldName === 'rendering' ? this.renderingPreviews.length > 0 : fieldName === 'gallery' ? this.galleryPreviews.length > 0 : this.floorPlanPreviews.length > 0;
  }

  getImageCount(fieldName: 'rendering' | 'floor_plan' | 'gallery'): number {
    return fieldName === 'rendering' ? this.renderingPreviews.length : fieldName === 'gallery' ? this.galleryPreviews.length : this.floorPlanPreviews.length;
  }

  getImagePreviews(fieldName: 'rendering' | 'floor_plan' | 'gallery'): ImagePreview[] {
    return fieldName === 'rendering' ? this.renderingPreviews : fieldName === 'gallery' ? this.galleryPreviews : this.floorPlanPreviews;
  }
}