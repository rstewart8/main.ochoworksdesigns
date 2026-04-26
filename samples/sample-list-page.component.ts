import { CommonModule, DatePipe } from '@angular/common';
import { Component, DestroyRef, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { formatPhoneDisplay } from '../services/contact-channel-utils';
import { CrmApiService } from '../services/crm-api.service';
import { ContactListResponse, MetadataResponse } from '../services/crm-types';

@Component({
  selector: 'app-contact-list-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, DatePipe],
  templateUrl: './contact-list-page.component.html',
  styleUrl: './contact-list-page.component.css'
})
export class ContactListPageComponent {
  private readonly api = inject(CrmApiService);
  private readonly destroyRef = inject(DestroyRef);

  data: ContactListResponse | null = null;
  metadata: MetadataResponse | null = null;
  errorMessage = '';
  search = '';
  selectedCity = '';
  selectedState = '';
  page = 1;
  pageSize = 10;
  isLoading = false;

  constructor() {
    this.loadMetadata();
    this.loadContacts();
  }

  private loadMetadata(): void {
    this.api
      .getMetadata()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (metadata) => {
          this.metadata = metadata;
        }
      });
  }

  loadContacts(): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.api
      .getContacts(this.search, this.page, this.pageSize, this.selectedCity, this.selectedState)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.data = response;
          this.isLoading = false;
        },
        error: (error) => {
          this.errorMessage = error?.error?.detail ?? 'Unable to load contacts right now.';
          this.isLoading = false;
        }
      });
  }

  applyFilters(): void {
    this.page = 1;
    this.loadContacts();
  }

  clearFilters(): void {
    this.search = '';
    this.selectedCity = '';
    this.selectedState = '';
    this.page = 1;
    this.pageSize = 10;
    this.loadContacts();
  }

  goToPage(page: number): void {
    if (!this.data) {
      return;
    }
    if (page < 1 || page > this.data.pagination.total_pages) {
      return;
    }
    this.page = page;
    this.loadContacts();
  }

  formatPhone(phone: string | null): string {
    return formatPhoneDisplay(phone) || '—';
  }
}
