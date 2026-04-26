import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { isPlatformBrowser } from '@angular/common';
import { filter, take } from 'rxjs/operators';
import { EmailMarketingService } from './email-marketing.service';

@Injectable({
  providedIn: 'root'
})
export class ClickTrackingService {
  private router = inject(Router);
  private emailMarketingService = inject(EmailMarketingService);
  private platformId = inject(PLATFORM_ID);

  // Track which URLs have already been processed to prevent duplicates
  private trackedUrls = new Set<string>();
  private initialized = false;

  /**
   * Initialize click tracking. Call this once in app.component.ts.
   * Listens to all route navigations and checks for li (LinkId) and cid (ContactId) params.
   */
  initialize(): void {
    // Prevent multiple initializations
    if (this.initialized) {
      console.warn('[ClickTracking] Already initialized, skipping.');
      return;
    }

    // Only run in browser environment
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    this.initialized = true;

    // Only listen to NavigationEnd events - this covers both initial load and subsequent navigations
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: NavigationEnd) => {
      this.checkAndTrackClick(event.urlAfterRedirects || event.url);
    });

    // Also check immediately for the current URL (in case NavigationEnd already fired)
    // Use setTimeout to ensure we're after Angular's initial navigation
    setTimeout(() => {
      this.checkAndTrackClick(window.location.href);
    }, 0);
  }

  /**
   * Check URL for tracking parameters and send tracking request if found.
   */
  private checkAndTrackClick(fullUrl: string): void {
    // Extract just the query string for tracking purposes
    const url = new URL(fullUrl, window.location.origin);
    const linkIdParam = url.searchParams.get('li');
    const contactIdParam = url.searchParams.get('cid');

    // Both params must be present
    if (!linkIdParam || !contactIdParam) {
      return;
    }

    const linkId = parseInt(linkIdParam, 10);
    const contactId = parseInt(contactIdParam, 10);

    // Validate that both are valid numbers
    if (isNaN(linkId) || isNaN(contactId) || linkId <= 0 || contactId <= 0) {
      return;
    }

    // Create a unique key for this tracking combination
    const trackingKey = `${linkId}-${contactId}`;

    // Check if we've already tracked this combination
    if (this.trackedUrls.has(trackingKey)) {
      console.log(`[ClickTracking] Already tracked ${trackingKey}, skipping.`);
      return;
    }

    // Mark as tracked BEFORE sending to prevent race conditions
    this.trackedUrls.add(trackingKey);

    this.sendTrackClick(linkId, contactId);
  }

  /**
   * Send click tracking to the API.
   */
  private sendTrackClick(linkId: number, contactId: number): void {
    console.log(`[ClickTracking] Tracking click - LinkId: ${linkId}, ContactId: ${contactId}`);

    this.emailMarketingService.sendTrackClick(linkId, contactId).pipe(
      take(1)
    ).subscribe({
      next: (response) => {
        console.log('[ClickTracking] Click tracked successfully', response);
        this.removeTrackingParams();
      },
      error: (error) => {
        console.error('[ClickTracking] Failed to track click:', error);
        this.removeTrackingParams();
      }
    });
  }

  /**
   * Remove tracking parameters from URL to keep it clean.
   * Uses replaceState to avoid adding to browser history.
   */
  private removeTrackingParams(): void {
    const url = new URL(window.location.href);
    const hasTrackingParams = url.searchParams.has('li') || url.searchParams.has('cid');

    if (hasTrackingParams) {
      url.searchParams.delete('li');
      url.searchParams.delete('cid');

      const cleanUrl = url.pathname + 
        (url.searchParams.toString() ? '?' + url.searchParams.toString() : '') + 
        url.hash;

      window.history.replaceState({}, '', cleanUrl);
    }
  }
}