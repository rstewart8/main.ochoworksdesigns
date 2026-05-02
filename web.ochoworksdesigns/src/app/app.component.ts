import { Component, OnInit, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { filter } from 'rxjs';
import { HeaderComponent } from "./header/header.component";
import { FooterComponent } from "./footer/footer.component";
import { ClickTrackingService } from './_services/click-tracking.service';
import { AnalyticsService } from './_services/google-analytics.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, HeaderComponent, FooterComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit {
  title = 'web.ochoworksdesigns';
  private clickTrackingService = inject(ClickTrackingService);
  private analytics = inject(AnalyticsService);
  private router = inject(Router);
  private titleService = inject(Title);
  private platformId = inject(PLATFORM_ID);

  ngOnInit(): void {
    // Initialize click tracking on app startup
    this.clickTrackingService.initialize();

    if (isPlatformBrowser(this.platformId)) {
      this.router.events
        .pipe(filter(event => event instanceof NavigationEnd))
        .subscribe((event: NavigationEnd) => {
          this.analytics.trackPageView(this.titleService.getTitle(), window.location.origin + event.urlAfterRedirects);
        });
    }
  }
}
