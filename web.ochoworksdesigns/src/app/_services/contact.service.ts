import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface ContactFormData {
  name: string;
  email: string;
  message: string;
  recaptchaToken: string;
}

export interface ContactResponse {
  success: boolean;
  message?: string;
  error?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ContactService {
  private apiUrl = `${environment.apiUrl}`;

  constructor(private http: HttpClient) { }

  submitContact(formData: ContactFormData): Observable<ContactResponse> {
    const url = `${this.apiUrl}/api/contact`;
    return this.http.post<ContactResponse>(url, formData);
  }
}