import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { RecaptchaModule } from 'ng-recaptcha-2';
import { environment } from '../../environments/environment';
import { CommonModule } from '@angular/common';
import { ContactService, ContactFormData } from '../_services/contact.service';
import { AnalyticsService } from '../_services/google-analytics.service';
import { SEOService } from '../_services/seo.service';

@Component({
  selector: 'app-contact',
  imports: [ReactiveFormsModule, RecaptchaModule, CommonModule],
  templateUrl: './contact.component.html',
  styleUrl: './contact.component.css'
})
export class ContactComponent implements OnInit {
  contactForm: FormGroup;
  recaptchaResponse: string | null = null;
  characterCount: number = 0;
  maxCharacters: number = 250;
  isSubmitting: boolean = false;
  submitSuccess: boolean = false;
  submitError: string | null = null;
  private analytics = inject(AnalyticsService);
  private seoService = inject(SEOService);

  // Get reCAPTCHA site key from environment
  recaptchaSiteKey: string = environment.recaptchaSiteKey;

  constructor(
    private fb: FormBuilder,
    private contactService: ContactService
  ) {
    this.contactForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      message: ['', [Validators.required, Validators.maxLength(this.maxCharacters)]]
    });

    // Watch for changes in the message field to update character count
    this.contactForm.get('message')?.valueChanges.subscribe(value => {
      this.characterCount = value ? value.length : 0;
    });
  }

  ngOnInit(): void {
    this.seoService.updateSEO({
      title: 'Contact OchoWorks Designs',
      description: 'Contact OchoWorks Designs to start a custom home plan, request a quote, or discuss drafting services for homeowners, builders, and contractors.',
      image: '/assets/images/8-logo.png',
      url: 'https://ochoworksdesigns.com/contact',
      type: 'website',
      schema: {
        '@context': 'https://schema.org',
        '@type': 'LocalBusiness',
        name: 'OchoWorks Designs',
        url: 'https://ochoworksdesigns.com/contact',
        image: 'https://ochoworksdesigns.com/assets/images/8-logo.png',
        telephone: '+1-435-680-1097',
        email: 'randy@ochoworksdesigns.com',
        description: 'Custom home design and residential drafting services for homeowners, builders, and contractors.',
        sameAs: [
          'https://www.facebook.com/OchoWorksDesigns',
          'https://www.instagram.com/ochoworksdesigns/',
          'https://www.pinterest.com/OchoWorksDesignsandDrafting'
        ]
      }
    });
  }

  onRecaptchaResolved(captchaResponse: string | null): void {
    this.recaptchaResponse = captchaResponse;
    console.log('reCAPTCHA resolved:', captchaResponse);
  }

  onRecaptchaError(): void {
    this.recaptchaResponse = null;
    console.error('reCAPTCHA error occurred');
    this.submitError = 'reCAPTCHA verification failed. Please try again.';
  }

  onRecaptchaExpired(): void {
    this.recaptchaResponse = null;
    console.log('reCAPTCHA expired');
    this.submitError = 'reCAPTCHA verification expired. Please verify again.';
  }

  onSubmit(): void {
    // Clear previous status
    this.submitSuccess = false;
    this.submitError = null;

    if (this.contactForm.valid && this.recaptchaResponse) {
      this.isSubmitting = true;

      const formData: ContactFormData = {
        name: this.contactForm.value.name,
        email: this.contactForm.value.email,
        message: this.contactForm.value.message,
        recaptchaToken: this.recaptchaResponse
      };
      
      console.log('Submitting form data:', formData);
      
      this.contactService.submitContact(formData).subscribe({
        next: (response) => {
          console.log('Message sent successfully', response);
          this.analytics.trackGenerateLead('contact_form');
          this.analytics.trackFormSubmit('contact_form');
          this.submitSuccess = true;
          this.contactForm.reset();
          this.recaptchaResponse = null;
          this.characterCount = 0;
          this.isSubmitting = false;
        },
        error: (error) => {
          console.error('Error sending message', error);
          this.submitError = error.error?.message || 'Failed to send message. Please try again.';
          this.isSubmitting = false;
        }
      });
    } else {
      console.log('Form is invalid or reCAPTCHA not completed');
      this.markFormGroupTouched();
      if (!this.recaptchaResponse) {
        this.submitError = 'Please complete the reCAPTCHA verification.';
      }
    }
  }

  private markFormGroupTouched(): void {
    Object.keys(this.contactForm.controls).forEach(key => {
      const control = this.contactForm.get(key);
      control?.markAsTouched();
    });
  }

  // Helper methods for template
  isFieldInvalid(fieldName: string): boolean {
    const field = this.contactForm.get(fieldName);
    return field ? field.invalid && (field.dirty || field.touched) : false;
  }

  getFieldError(fieldName: string): string {
    const field = this.contactForm.get(fieldName);
    if (field?.errors) {
      if (field.errors['required']) return `${fieldName} is required`;
      if (field.errors['email']) return 'Please enter a valid email';
      if (field.errors['minlength']) return `${fieldName} must be at least ${field.errors['minlength'].requiredLength} characters`;
      if (field.errors['maxlength']) return `Message cannot exceed ${this.maxCharacters} characters`;
    }
    return '';
  }

  onPhoneClick(): void {
    this.analytics.trackContact('phone');
  }

  onEmailClick(): void {
    this.analytics.trackContact('email');
  }
}
