import { Injectable } from '@angular/core';
import { AuthService } from './auth.service';

declare let gtag: Function;

@Injectable({
  providedIn: 'root'
})
export class AnalyticsService {
  constructor(private authService: AuthService) { }

  // Track custom events
  trackEvent(eventName: string, parameters?: any): void {
    if (this.shouldTrack()) {
      gtag('event', eventName, parameters);
    }
  }

  trackPageView(pageTitle: string, pageLocation: string): void {
    if (this.shouldTrack()) {
      gtag('event', 'page_view', {
        page_title: pageTitle,
        page_location: pageLocation
      });
    }
  }

  // Track button clicks
  trackButtonClick(buttonName: string, location?: string): void {
    this.trackEvent('button_click', {
      button_name: buttonName,
      location: location
    });
  }

  // Track form submissions
  trackFormSubmit(formName: string): void {
    this.trackEvent('form_submit', {
      form_name: formName
    });
  }

  trackGenerateLead(method: string): void {
    this.trackEvent('generate_lead', {
      method
    });
  }

  // Track navigation clicks
  trackNavigation(destination: string): void {
    this.trackEvent('navigation_click', {
      destination: destination
    });
  }

  // Track contact interactions
  trackContact(method: string): void {
    this.trackEvent('contact_interaction', {
      contact_method: method
    });
  }

  // Track plan selections
  trackPlanSelect(planName: string): void {
    this.trackEvent('select_content', {
      content_type: 'house_plan',
      item_id: planName
    });
  }

  private shouldTrack(): boolean {
    return typeof gtag !== 'undefined' && !this.authService.isLoggedIn();
  }
}
