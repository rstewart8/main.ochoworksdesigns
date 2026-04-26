import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';

// Updated interfaces to match your API structure
export interface PlanImage {
  id: number;
  file_name: string;
  image_url: string;
  image_type: string;
  ordering: number;
  alt_text?: string;
}

export interface PlanNotes {
  id: number;
  note: string;
}

export interface HousePlan {
  id: number;
  database_id: number; // ID used in your database
  plan_id: string;
  title: string;
  description: string;
  specs: string[] | null;
  bedrooms: string;
  bathrooms: string;
  stories: string;
  garage?: string;
  basement_square_footage?: string; // Optional field for basement square footage
  main_square_footage?: string;
  upper_square_footage?: string;
  garage_square_footage?: string;
  total_square_footage?: string;
  width: string;
  depth: string;
  formatted_width: string;
  formatted_depth: string;
  status: string;
  created_at: string;
  updated_at: string;
  images: PlanImage[];
  notes: PlanNotes[];
  ordering?: number;
  plan_no?: string; // Added plan_no field
}

export interface ApiResponse {
  success: boolean;
  message: string;
  data: {
    count: number;
    total: number;
    pagination: {
      limit: number;
      page: number;
      total_pages: number;
      has_next: boolean;
      has_previous: boolean;
    };
    plans: HousePlan[];
  };
}

// Legacy interface for backward compatibility
export interface LegacyHousePlan {
  id: string;
  title: string;
  imageUrl: string;
  specs: string[];
  description: string;
  price?: number;
  squareFootage?: number;
  bedrooms?: number;
  bathrooms?: number;
  stories?: number;
  features?: string[];
  planType?: string;
  thumbnailUrl?: string;
  floorPlanImages?: string[];
  elevationImages?: string[];
}

@Injectable({
  providedIn: 'root'
})
export class PlanService {
  private apiUrl = `${environment.apiUrl}`;

  constructor(private http: HttpClient) { }

  // Get plans with pagination (new method)
  getPlansWithPagination(limit: number = 10, page: number = 1, status: string | null = null): Observable<ApiResponse> {
    var url = `${this.apiUrl}/api/plans?limit=${limit}&page=${page}`;
    if (status) {
      url += `&status=${status}`;
    }

    return this.http.get<ApiResponse>(url).pipe(
      catchError(error => {
        console.error('Error fetching plans:', error);
        // Return empty response structure on error
        return of({
          success: false,
          message: 'Failed to fetch plans',
          data: {
            count: 0,
            total: 0,
            pagination: {
              limit: limit,
              page: page,
              total_pages: 0,
              has_next: false,
              has_previous: false
            },
            plans: []
          }
        });
      })
    );
  }

  // Get single plan by ID
  getPlan(id: string): Observable<HousePlan | null> {
    const url = `${this.apiUrl}/api/plan/${id}`;
    return this.http.get<{success: boolean, data: HousePlan}>(url).pipe(
      map(response => {
        if (response.success && response.data) {
          return response.data;
        }
        return null;
      }),
      catchError(error => {
        console.error('Error fetching plan:', error);
        return of(null);
      })
    );
  }

  // Get single plan by ID for editing (if needed)
  getPlanSet(id: string): Observable<HousePlan | null> {
    const url = `${this.apiUrl}/api/plan/${id}/set`;
    return this.http.get<{success: boolean, data: HousePlan}>(url).pipe(
      map(response => {
        if (response.success && response.data) {
          return response.data;
        }
        return null;
      }),
      catchError(error => {
        console.error('Error fetching plan:', error);
        return of(null);
      })
    );
  }

  // Legacy method for backward compatibility - converts new API to old format
  getPlans(): Observable<LegacyHousePlan[]> {
    return this.getPlansWithPagination(100, 1).pipe(
      map(response => {
        if (response.success && response.data) {
          return response.data.plans.map(plan => this.convertToLegacyFormat(plan));
        }
        return [];
      })
    );
  }

  // Convert new plan format to legacy format
  private convertToLegacyFormat(plan: HousePlan): LegacyHousePlan {
    const primaryImage = plan.images && plan.images.length > 0 
      ? plan.images.sort((a, b) => a.ordering - b.ordering)[0].image_url
      : 'assets/images/plan-placeholder.jpg';

    const specs: string[] = [];
    if (plan.bedrooms) specs.push(`${plan.bedrooms} Bedroom${parseFloat(plan.bedrooms) !== 1 ? 's' : ''}`);
    if (plan.bathrooms) specs.push(`${plan.bathrooms} Bathroom${parseFloat(plan.bathrooms) !== 1 ? 's' : ''}`);
    if (plan.stories) {
      const stories = parseFloat(plan.stories);
      specs.push(stories === 1 ? 'Single Story' : `${stories} Stories`);
    }
    if (plan.formatted_width && plan.formatted_depth) {
      specs.push(`${plan.formatted_width}" x ${plan.formatted_depth}"`);
    }

    return {
      id: plan.id.toString(),
      title: plan.title,
      imageUrl: primaryImage,
      specs: specs,
      description: plan.description,
      bedrooms: parseFloat(plan.bedrooms) || undefined,
      bathrooms: parseFloat(plan.bathrooms) || undefined,
      stories: parseFloat(plan.stories) || undefined,
      thumbnailUrl: primaryImage,
      floorPlanImages: plan.images?.map(img => img.image_url) || []
    };
  }

  // Helper methods for plan data processing
  extractSquareFootage(specs: string[]): number | undefined {
    const spec = specs.find(s => s.toLowerCase().includes('sq ft'));
    if (spec) {
      const match = spec.match(/(\d+(?:,\d+)?)/);
      return match ? parseInt(match[1].replace(/,/g, '')) : undefined;
    }
    return undefined;
  }

  // Search plans (if search functionality is needed later)
  searchPlans(query: string, limit: number = 10, page: number = 1): Observable<ApiResponse> {
    const url = `${this.apiUrl}/api/plans/search?q=${encodeURIComponent(query)}&limit=${limit}&page=${page}`;
    return this.http.get<ApiResponse>(url).pipe(
      catchError(error => {
        console.error('Error searching plans:', error);
        return of({
          success: false,
          message: 'Failed to search plans',
          data: {
            count: 0,
            total: 0,
            pagination: {
              limit: limit,
              page: page,
              total_pages: 0,
              has_next: false,
              has_previous: false
            },
            plans: []
          }
        });
      })
    );
  }

  // Filter plans by criteria (if filtering is needed later)
  filterPlans(filters: {
    bedrooms?: string;
    bathrooms?: string;
    stories?: string;
    minWidth?: number;
    maxWidth?: number;
  }, limit: number = 10, page: number = 1): Observable<ApiResponse> {
    let params = new URLSearchParams();
    params.append('limit', limit.toString());
    params.append('page', page.toString());
    
    if (filters.bedrooms) params.append('bedrooms', filters.bedrooms);
    if (filters.bathrooms) params.append('bathrooms', filters.bathrooms);
    if (filters.stories) params.append('stories', filters.stories);
    if (filters.minWidth) params.append('min_width', filters.minWidth.toString());
    if (filters.maxWidth) params.append('max_width', filters.maxWidth.toString());

    const url = `${this.apiUrl}/api/plans/filter?${params.toString()}`;
    return this.http.get<ApiResponse>(url).pipe(
      catchError(error => {
        console.error('Error filtering plans:', error);
        return of({
          success: false,
          message: 'Failed to filter plans',
          data: {
            count: 0,
            total: 0,
            pagination: {
              limit: limit,
              page: page,
              total_pages: 0,
              has_next: false,
              has_previous: false
            },
            plans: []
          }
        });
      })
    );
  }

  // Get plan images by plan ID
  getPlanImages(planId: number): Observable<PlanImage[]> {
    const url = `${this.apiUrl}/api/plans/${planId}/images`;
    return this.http.get<{success: boolean, data: PlanImage[]}>(url).pipe(
      map(response => {
        if (response.success && response.data) {
          return response.data.sort((a, b) => a.ordering - b.ordering);
        }
        return [];
      }),
      catchError(error => {
        console.error('Error fetching plan images:', error);
        return of([]);
      })
    );
  }
}