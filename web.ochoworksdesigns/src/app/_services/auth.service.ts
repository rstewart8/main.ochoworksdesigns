import { Injectable, inject, PLATFORM_ID, Inject } from '@angular/core';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { Router } from '@angular/router';
import { environment } from '../../environments/environment';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  data: {
    token: string;
  };
  message: string;
}

export interface User {
  id: number;
  email: string;
  role_id: number;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  private tokenSubject = new BehaviorSubject<string | null>(null);
  
  public currentUser$ = this.currentUserSubject.asObservable();
  public token$ = this.tokenSubject.asObservable();

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    @Inject(DOCUMENT) private document: Document
  ) {
    // Check for stored token on service initialization
    if (this.isBrowser()) {
      const storedToken = this.getStoredToken();
      if (storedToken) {
        this.tokenSubject.next(storedToken);
        this.loadUserFromToken(storedToken);
      }
    }
  }

  login(credentials: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${environment.apiUrl}/api/login`, credentials)
      .pipe(
        map(response => {
          if (response.success && response.data.token) {
            this.setToken(response.data.token);
            this.loadUserFromToken(response.data.token);
          }
          return response;
        }),
        catchError(error => {
          console.error('Login error:', error);
          return throwError(() => error);
        })
      );
  }

  logout(): void {
    if (this.isBrowser()) {
      this.removeStoredToken();
    }
    this.tokenSubject.next(null);
    this.currentUserSubject.next(null);
    this.router.navigate(['/home']);
  }

  getToken(): string | null {
    return this.tokenSubject.value;
  }

  isLoggedIn(): boolean {
    return !!this.getToken();
  }

  getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }

  // Get HTTP headers with authorization
  getAuthHeaders(): HttpHeaders {
    const token = this.getToken();
    if (token) {
      return new HttpHeaders({
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      });
    }
    return new HttpHeaders({
      'Content-Type': 'application/json'
    });
  }

  // Make authenticated HTTP requests
  authenticatedGet(url: string): Observable<any> {
    return this.http.get(url, { headers: this.getAuthHeaders() });
  }

  authenticatedPost(url: string, data: any): Observable<any> {
    return this.http.post(url, data, { headers: this.getAuthHeaders() });
  }

  authenticatedPut(url: string, data: any): Observable<any> {
    return this.http.put(url, data, { headers: this.getAuthHeaders() });
  }

  authenticatedDelete(url: string): Observable<any> {
    return this.http.delete(url, { headers: this.getAuthHeaders() });
  }

  // Private helper methods
  private isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }

  private getStoredToken(): string | null {
    if (!this.isBrowser()) {
      return null;
    }
    try {
      return this.document.defaultView?.localStorage.getItem('auth_token') || null;
    } catch (error) {
      console.error('Error accessing localStorage:', error);
      return null;
    }
  }

  private setToken(token: string): void {
    if (this.isBrowser()) {
      try {
        this.document.defaultView?.localStorage.setItem('auth_token', token);
      } catch (error) {
        console.error('Error saving token to localStorage:', error);
      }
    }
    this.tokenSubject.next(token);
  }

  private removeStoredToken(): void {
    if (!this.isBrowser()) {
      return;
    }
    try {
      this.document.defaultView?.localStorage.removeItem('auth_token');
    } catch (error) {
      console.error('Error removing token from localStorage:', error);
    }
  }

  private loadUserFromToken(token: string): void {
    try {
      // Decode JWT token to get user info
      const payload = JSON.parse(atob(token.split('.')[1]));
      if (payload.data) {
        this.currentUserSubject.next({
          id: payload.data.id,
          email: '', // You might need to make an API call to get full user details
          role_id: payload.data.role_id
        });
      }
    } catch (error) {
      console.error('Error decoding token:', error);
      this.logout();
    }
  }
}