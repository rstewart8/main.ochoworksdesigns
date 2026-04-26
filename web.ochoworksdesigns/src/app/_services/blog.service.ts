import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface BlogImage {
  id?: string;
  url: string;
  alt?: string;
  isFeatured: boolean;
}

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  featured_image?: string;
  meta_title?: string;
  meta_description?: string;
  meta_keywords?: string;
  author: string;
  status: 'draft' | 'published' | 'archived';
  published_at?: string;
  created_at: string;
  updated_at: string;
  tags?: string[];
  category?: string;
  read_time?: number;
  views?: number;
  images?: BlogImage[]; // Changed from string[] to BlogImage[]
  featured_image_index?: number;
  plan_no?: string; // New field added
}

export interface BlogCategoryResponse {
  success: boolean;
  data: BlogCategory[];
}

export interface BlogCategory {
  id: string;
  name: string;
  slug: string;
  description?: string;
  post_count?: number;
}

export interface BlogListResponse {
  posts: BlogPost[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
  count: number;
}

@Injectable({
  providedIn: 'root'
})
export class BlogService {
  private apiUrl = `${environment.apiUrl}`;

  constructor(private http: HttpClient) { }

  // Public methods - no auth required
  getPublishedPosts(page: number = 1, per_page: number = 10, category?: string, search?: string): Observable<BlogListResponse> {
    let params: any = { page: page.toString(), per_page: per_page.toString() };

    if (category) {
      params.category = category;
    }

    if (search) {
      params.search = search;
    }

    return this.http.get<BlogListResponse>(`${this.apiUrl}/posts`, { params })
      .pipe(catchError(this.handleError));
  }

  getPublishedPost(slug: string): Observable<BlogPost> {
    return this.http.get<BlogPost>(`${this.apiUrl}/api/blog/${slug}`)
      .pipe(catchError(this.handleError));
  }

  getFeaturedPosts(limit: number = 3): Observable<BlogPost[]> {
    return this.http.get<BlogPost[]>(`${this.apiUrl}/posts/featured?limit=${limit}`)
      .pipe(catchError(this.handleError));
  }

  getRecentPosts(limit: number = 5): Observable<BlogPost[]> {
    return this.http.get<BlogPost[]>(`${this.apiUrl}/posts/recent?limit=${limit}`)
      .pipe(catchError(this.handleError));
  }

  getCategories(): Observable<BlogCategory[]> {
    return this.http.get<BlogCategoryResponse>(`${this.apiUrl}/api/utilities/categories`)
      .pipe(
        map(response => response.data), // Extract the data array
        catchError(this.handleError)
      );
  }

  incrementViews(slug: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/posts/${slug}/view`, {})
      .pipe(catchError(this.handleError));
  }

  // Admin methods - require authentication
  getAllPosts(page: number = 1, per_page: number = 10, category?: string, search?: string, status?: string): Observable<BlogListResponse> {
    const headers = this.getAuthHeaders();
    let params: any = { page: page.toString(), per_page: per_page.toString() };

    if (status) {
      params.status = status;
    }

    if (category) {
      params.category = category;
    }

    if (search) {
      params.search = search;
    }

    return this.http.get<{ success: boolean, data: BlogListResponse }>(`${this.apiUrl}/api/blog`, { headers, params })
      .pipe(
        map(response => response.data), // Now extracts BlogListResponse instead of BlogPost
        catchError(this.handleError)
      );
  }

  getPost(id: string): Observable<BlogPost> {
    const headers = this.getAuthHeaders();
    return this.http.get<{ success: boolean, data: BlogPost }>(`${this.apiUrl}/api/blog/${id}`, { headers })
      .pipe(
        map(response => response.data), // Extract the data property
        catchError(this.handleError)
      );
  }

  createPost(post: Partial<BlogPost>): Observable<BlogPost> {
    const headers = this.getAuthHeaders();
    return this.http.post<BlogPost>(`${this.apiUrl}/api/blog`, { blogs: [post] }, { headers })
      .pipe(catchError(this.handleError));
  }

  updatePost(id: string, post: Partial<BlogPost>): Observable<BlogPost> {
    const headers = this.getAuthHeaders();
    return this.http.put<BlogPost>(`${this.apiUrl}/api/blog/${id}`, {blogs: [post]}, { headers })
      .pipe(catchError(this.handleError));
  }

  deletePost(id: string): Observable<any> {
    const headers = this.getAuthHeaders();
    return this.http.delete(`${this.apiUrl}/admin/posts/${id}`, { headers })
      .pipe(catchError(this.handleError));
  }

  uploadImage(file: File): Observable<any> {
    // Check if we're in a browser environment
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('auth_token') : null;
    
    // Only set Authorization header - let browser handle Content-Type for FormData
    const headers = new HttpHeaders({
      ...(token && { 'Authorization': `Bearer ${token}` })
    });

    const formData = new FormData();
    formData.append('image', file);

    return this.http.post(`${this.apiUrl}/api/image/blog`, formData, { headers })
      .pipe(catchError(this.handleError));
  }

  // Helper methods
  generateSlug(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9 -]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }

  calculateReadTime(content: string): number {
    const wordsPerMinute = 200;
    const wordCount = content.split(/\s+/).length;
    return Math.ceil(wordCount / wordsPerMinute);
  }

  private getAuthHeaders(): HttpHeaders {
    // Check if we're in a browser environment before accessing localStorage
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('auth_token') : null;
    
    return new HttpHeaders({
      ...(token && { 'Authorization': `Bearer ${token}` }),
      'Content-Type': 'application/json'
    });
  }

  private handleError(error: any): Observable<never> {
    console.error('Blog service error:', error);
    return throwError(() => error);
  }
}