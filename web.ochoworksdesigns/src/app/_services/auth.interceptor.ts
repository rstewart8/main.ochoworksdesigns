import { Injectable, inject } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, BehaviorSubject } from 'rxjs';
import { catchError, filter, take, switchMap } from 'rxjs/operators';
import { AuthService } from './auth.service';
import { Router } from '@angular/router';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  private authService = inject(AuthService);
  private router = inject(Router);
  
  private isRefreshing = false;
  private refreshTokenSubject: BehaviorSubject<any> = new BehaviorSubject<any>(null);

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    // Don't add token to login requests
    if (req.url.includes('/api/login') || req.url.includes('/api/register')) {
      return next.handle(req);
    }

    const token = this.authService.getToken();
    
    // Add token to request if available
    if (token) {
      req = this.addTokenToRequest(req, token);
    }

    return next.handle(req).pipe(
      catchError(error => {
        if (error instanceof HttpErrorResponse) {
          switch (error.status) {
            case 401:
              return this.handle401Error(req, next);
            case 403:
              return this.handle403Error();
            default:
              return throwError(() => error);
          }
        }
        return throwError(() => error);
      })
    );
  }

  private addTokenToRequest(request: HttpRequest<any>, token: string): HttpRequest<any> {
    return request.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
  }

  private handle401Error(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    // Token is expired or invalid, logout user
    console.warn('401 Unauthorized - Token expired or invalid');
    this.authService.logout();
    return throwError(() => new Error('Authentication failed'));
  }

  private handle403Error(): Observable<HttpEvent<any>> {
    // User doesn't have permission for this resource
    console.warn('403 Forbidden - Access denied');
    return throwError(() => new Error('Access denied'));
  }
}

// Alternative functional interceptor (Angular 15+)
import { HttpInterceptorFn } from '@angular/common/http';

export const authInterceptorFn: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  
  // Don't add token to login requests
  if (req.url.includes('/api/login') || req.url.includes('/api/register')) {
    return next(req);
  }

  const token = authService.getToken();
  
  // Add token to request if available
  if (token) {
    req = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
  }

  return next(req).pipe(
    catchError(error => {
      if (error instanceof HttpErrorResponse) {
        switch (error.status) {
          case 401:
            console.warn('401 Unauthorized - Token expired or invalid');
            authService.logout();
            break;
          case 403:
            console.warn('403 Forbidden - Access denied');
            break;
        }
      }
      return throwError(() => error);
    })
  );
};