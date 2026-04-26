import { Component, OnInit, OnDestroy, HostListener, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil, filter } from 'rxjs';
import { AnalyticsService } from '../_services/google-analytics.service';
import { AuthService, User } from '../_services/auth.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './header.component.html',
  styleUrl: './header.component.css'
})
export class HeaderComponent implements OnInit, OnDestroy {
  isMobileMenuOpen = false;
  isUserMenuOpen = false;
  isLoggedIn = false;
  currentUser: User | null = null;

  private analytics = inject(AnalyticsService);
  private authService = inject(AuthService);
  private router = inject(Router);
  private destroy$ = new Subject<void>();

  ngOnInit(): void {
    // Subscribe to authentication state
    this.authService.currentUser$
      .pipe(takeUntil(this.destroy$))
      .subscribe(user => {
        this.currentUser = user;
        this.isLoggedIn = !!user;
      });

    // Close mobile menu when route changes
    this.router.events
      .pipe(
        filter(event => event instanceof NavigationEnd),
        takeUntil(this.destroy$)
      )
      .subscribe(() => {
        this.closeMobileMenu();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  isAdmin(): boolean {
    return this.authService.isLoggedIn();
  }

  onNavClick(destination: string): void {
    this.analytics.trackNavigation(destination);
    this.closeMobileMenu();
  }

  onLogoClick(): void {
    this.analytics.trackButtonClick('logo', 'header');
    this.closeMobileMenu();
  }

  toggleMobileMenu(): void {
    this.isMobileMenuOpen = !this.isMobileMenuOpen;
    this.isUserMenuOpen = false; // Close user menu if open

    if (this.isMobileMenuOpen) {
      this.analytics.trackButtonClick('mobile-menu-open', 'header');
    }
  }

  closeMobileMenu(): void {
    this.isMobileMenuOpen = false;
    this.isUserMenuOpen = false;
  }

  toggleUserMenu(): void {
    this.isUserMenuOpen = !this.isUserMenuOpen;

    if (this.isUserMenuOpen) {
      this.analytics.trackButtonClick('user-menu-open', 'header');
    }
  }

  onLogout(): void {
    this.analytics.trackButtonClick('logout', 'header');
    this.authService.logout();
    this.closeMobileMenu();
  }

  onProfileClick(event: Event): void {
    event.preventDefault();
    this.analytics.trackButtonClick('profile-click', 'header');
    this.closeMobileMenu();
    // TODO: Navigate to profile page when implemented
    // this.router.navigate(['/profile']);
    console.log('Profile clicked - implement navigation');
  }

  onSettingsClick(event: Event): void {
    event.preventDefault();
    this.analytics.trackButtonClick('settings-click', 'header');
    this.closeMobileMenu();
    // TODO: Navigate to settings page when implemented
    // this.router.navigate(['/settings']);
    console.log('Settings clicked - implement navigation');
  }

  getUserInitials(): string {
    if (!this.currentUser?.email) {
      return 'U';
    }

    const email = this.currentUser.email;
    const parts = email.split('@')[0].split('.');

    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    } else {
      return email.substring(0, 2).toUpperCase();
    }
  }

  // Close mobile menu when clicking outside
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    const target = event.target as HTMLElement;
    const navMenu = document.getElementById('nav-menu');
    const navToggle = document.querySelector('.nav-toggle');
    const userMenu = document.querySelector('.user-menu');

    // Close mobile menu if clicking outside
    if (this.isMobileMenuOpen &&
      navMenu &&
      navToggle &&
      !navMenu.contains(target) &&
      !navToggle.contains(target)) {
      this.isMobileMenuOpen = false;
    }

    // Close user menu if clicking outside
    if (this.isUserMenuOpen &&
      userMenu &&
      !userMenu.contains(target)) {
      this.isUserMenuOpen = false;
    }
  }

  // Close mobile menu on escape key
  @HostListener('document:keydown.escape', ['$event'])
  onEscapeKey(event: KeyboardEvent): void {
    if (this.isMobileMenuOpen || this.isUserMenuOpen) {
      this.closeMobileMenu();
    }
  }

  // Handle window resize
  @HostListener('window:resize', ['$event'])
  onResize(event: Event): void {
    if (window.innerWidth > 768) {
      this.closeMobileMenu();
    }
  }
}