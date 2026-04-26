import { Injectable } from '@angular/core';

declare let gtag: Function;

@Injectable({
  providedIn: 'root'
})
export class AnalyticsService {

  constructor() { }

  // Track custom events
  trackEvent(eventName: string, parameters?: any): void {
    if (typeof gtag !== 'undefined') {
      gtag('event', eventName, parameters);
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
    this.trackEvent('plan_select', {
      plan_name: planName
    });
  }
}