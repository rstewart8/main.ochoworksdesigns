// ============================================================================
// UPDATED EMAIL MARKETING SERVICE - WITH CAMPAIGN METHODS
// Added: duplicateCampaign, scheduleCampaign, updateCampaignStatus,
//        sendTestEmail, sendCampaign, getCampaignStats, getCampaignSends,
//        getCampaignRecipients, checkContactDuplicate
// ============================================================================

import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

// ============================================================================
// INTERFACES
// ============================================================================

export interface Contact {
  id: number;
  email: string;
  firstname?: string;
  lastname?: string;
  city?: string;
  state?: string;
  company?: string;
  website?: string;
  phone?: string;
  phone_secondary?: string;
  tags?: string[];
  source?: string;
  is_subscribed: boolean;
  is_active: boolean;
  subscribed_at?: string;
  unsubscribed_at?: string;
  last_contacted_at?: string;
  created_at: string;
  updated_at?: string;
  // Stats
  total_emails?: number;
  opened_emails?: number;
  total_calls?: number;
  total_notes?: number;
}

export interface ContactNote {
  id: number;
  contact_id: number;
  content: string;
  note_type: 'general' | 'call' | 'email' | 'meeting' | 'follow_up' | 'other';
  is_pinned: boolean;
  created_by?: number;
  created_at: string;
  updated_at?: string;
  // Joined fields
  email?: string;
  contact_name?: string;
  company?: string;
}

export interface ContactCall {
  id: number;
  contact_id: number;
  direction: 'inbound' | 'outbound';
  phone_number?: string;
  duration_seconds?: number;
  outcome: 'answered' | 'voicemail' | 'no_answer' | 'busy' | 'wrong_number' | 'callback_requested' | 'other';
  notes?: string;
  follow_up_date?: string;
  follow_up_notes?: string;
  called_at: string;
  created_by?: number;
  created_at: string;
  updated_at?: string;
  // Joined fields
  email?: string;
  contact_name?: string;
  company?: string;
  follow_up_complete?: number;
}

export interface ContactEmailSend {
  id: number;
  email_campaign_id: number;
  contact_id: number;
  tracking_id?: string | null;
  type?: 'manual' | 'automatic' | string;
  status: 'pending' | 'sent' | 'failed' | 'bounced' | 'complained' | string;
  error_message?: string | null;
  sent_at?: string | null;
  opened_at?: string | null;
  open_count?: number;
  clicked_at?: string | null;
  click_count?: number;
  user_agent?: string | null;
  ip_address?: string | null;
  created_at: string;
  email_campaign_name?: string;
  campaign_id?: number;
  campaign_name?: string;
}

export interface Campaign {
  id: number;
  campaign_id?: number;
  name: string;
  subject: string;
  preview_text?: string;
  content: string;
  from_name?: string;
  from_email?: string;
  reply_to?: string;
  use_tracking?: boolean;
  track?: boolean | number;
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'paused' | 'cancelled';
  scheduled_at?: string;
  started_at?: string;
  completed_at?: string;
  total_recipients: number;
  total_sent: number;
  total_opened: number;
  total_clicked: number;
  total_bounced: number;
  total_unsubscribed: number;
  open_rate?: number;
  click_rate?: number;
  bounce_rate?: number;
  created_by?: number;
  created_at: string;
  updated_at?: string;
  links?: Array<{
    link_name: string;
    link_url: string;
  }>;
}

export interface CampaignRecord {
  id: number;
  name: string;
  status: 'active' | 'inactive' | 'deleted';
  links?: Array<{
    id: number;
    name: string;
  }>;
  created_at: string;
  updated_at?: string;
}

export interface CampaignRecordsListResponse {
  campaigns: CampaignRecord[];
  total: number;
  limit: number;
  offset: number;
}

export interface CreateCampaignRecordRequest {
  name: string;
  status?: 'active' | 'inactive' | 'deleted';
}

export interface CreateEmailCampaignRequest {
  campaign_id: number;
  name: string;
  subject: string;
  preview_text?: string;
  content?: string;
  from_name?: string;
  from_email?: string;
  reply_to?: string;
  use_tracking?: boolean;
  status?: 'draft' | 'scheduled' | 'sending' | 'sent' | 'paused' | 'cancelled';
}

export interface CampaignSend {
  id: number;
  campaign_id: number;
  contact_id: number;
  tracking_id: string;
  status: 'pending' | 'sent' | 'failed' | 'bounced' | 'complained';
  error_message?: string;
  sent_at?: string;
  opened_at?: string;
  open_count: number;
  clicked_at?: string;
  click_count: number;
  user_agent?: string;
  ip_address?: string;
  created_at: string;
  // Joined fields
  email?: string;
  contact_name?: string;
}

export interface CampaignStats {
  totals: {
    total_sent: number;
    total_opened: number;
    total_clicked: number;
    total_bounced: number;
    total_unsubscribed: number;
    open_rate: number;
    click_rate: number;
    bounce_rate: number;
    click_to_open_rate: number;
  };
  opens_over_time: { hour: string; opens: number; clicks: number }[];
  top_links: { id: number; url: string; click_count: number; unique_clicks?: number }[];
  status_breakdown: { status: string; count: number }[];
}

export interface CampaignRecipient {
  id: number;
  email: string;
  name?: string;
  company?: string;
}

export interface ContactsListResponse {
  contacts: Contact[];
  total: number;
  limit: number;
  offset: number;
}

export interface ContactNotesResponse {
  notes: ContactNote[];
  total: number;
  limit: number;
  offset: number;
}

export interface ContactCallsResponse {
  calls: ContactCall[];
  total: number;
  limit: number;
  offset: number;
}

export interface CampaignsListResponse {
  campaigns: Campaign[];
  total: number;
  limit: number;
  offset: number;
}

export interface CampaignSendsResponse {
  sends: CampaignSend[];
  total: number;
  limit: number;
  offset: number;
}

export interface CampaignRecipientsResponse {
  recipients: CampaignRecipient[];
  total: number;
}

/** Response when queuing a campaign send (worker processes queue). */
export interface SendCampaignResult {
  job_id: number;
}

/** Latest send job for a campaign (queue status; results stored here and in send logs). */
export interface CampaignSendJob {
  id: number;
  campaign_id: number;
  status: 'queued' | 'sending' | 'sent' | 'failed';
  total_recipients: number;
  total_sent: number;
  total_failed: number;
  error_summary?: { contact_id?: number; email?: string; error: string }[];
  created_at: string;
  started_at?: string;
  completed_at?: string;
}

export interface MarketingStats {
  contacts: {
    total: number;
    subscribed: number;
    unsubscribed: number;
    new_this_month: number;
  };
  campaigns: {
    total: number;
    draft: number;
    sent: number;
    scheduled: number;
  };
  emails: {
    total_sent: number;
    total_opened: number;
    total_opens: number;
    open_rate: number;
  };
  recent_activity: { date: string; sent: number; opened: number }[];
  top_campaigns: Campaign[];
  followups?: {
    total: number;
    completed: number;
    pending: number;
    overdue: number;
    upcoming: number;
    completed_this_month: number;
  };
  upcoming_followups?: FollowUpItem[];
  overdue_followups?: FollowUpItem[];
}

export interface FollowUpItem {
  id: number;
  contact_id: number;
  follow_up_date: string;
  follow_up_notes: string;
  outcome: string;
  call_notes: string;
  firstname: string;
  lastname: string;
  email: string;
  company: string;
  phone: string;
  days_until?: number;      // For upcoming follow-ups
  days_overdue?: number;    // For overdue follow-ups
}

export interface CallStats {
  totals: {
    total_calls: number;
    total_outbound: number;
    total_inbound: number;
    avg_duration: number;
    total_duration: number;
  };
  by_direction: { direction: string; count: number; avg_duration: number }[];
  by_outcome: { outcome: string; count: number }[];
  over_time: { date: string; outbound: number; inbound: number }[];
}

export interface DuplicateCheckResponse {
  success: boolean;
  data: Contact[];
}

// City and State list items with count
export interface CityItem {
  city: string;
  cnt: number;
}

export interface StateItem {
  state: string;
  cnt: number;
}

// ============================================================================
// SERVICE
// ============================================================================

@Injectable({
  providedIn: 'root'
})
export class EmailMarketingService {
  private apiUrl = `${environment.apiUrl}/api/marketing`;
  private trackingApiUrl = `${environment.apiUrl}/api/track`;
  private adminApiUrl = `${environment.apiUrl}/api/admin`;

  constructor(private http: HttpClient) { }

  // ==========================================================================
  // CONTACTS
  // ==========================================================================

  getContacts(
    page: number = 1,
    limit: number = 50,
    search?: string,
    tag?: string,
    source?: string,
    subscribed?: boolean,
    hasPhone?: boolean,
    city?: string,    // comma-separated list of cities
    state?: string,    // comma-separated list of states
    lastContacted?: string    // last contacted date
  ): Observable<ContactsListResponse> {
    const headers = this.getAuthHeaders();
    let params = new HttpParams()
      .set('limit', limit.toString())
      .set('offset', ((page - 1) * limit).toString());

    if (search) params = params.set('search', search);
    if (tag) params = params.set('tag', tag);
    if (source) params = params.set('source', source);
    if (subscribed !== undefined) params = params.set('subscribed', subscribed.toString());
    if (hasPhone) params = params.set('has_phone', 'true');
    if (city) params = params.set('city', city);
    if (state) params = params.set('state', state);
    if (lastContacted) params = params.set('last_contacted', lastContacted);
    
    return this.http.get<{ success: boolean; data: ContactsListResponse }>(
      `${this.apiUrl}/contacts`,
      { headers, params }
    ).pipe(
      map(response => response.data),
      catchError(this.handleError)
    );
  }

  getContact(id: number): Observable<Contact> {
    const headers = this.getAuthHeaders();
    return this.http.get<{ success: boolean; data: Contact }>(
      `${this.apiUrl}/contacts/${id}`,
      { headers }
    ).pipe(
      map(response => response.data),
      catchError(this.handleError)
    );
  }

  createContact(contact: Partial<Contact>): Observable<{ id: number }> {
    const headers = this.getAuthHeaders();
    return this.http.post<{ success: boolean; data: { id: number }; message: string }>(
      `${this.apiUrl}/contacts`,
      contact,
      { headers }
    ).pipe(
      map(response => response.data),
      catchError(this.handleError)
    );
  }

  updateContact(id: number, contact: Partial<Contact>): Observable<void> {
    const headers = this.getAuthHeaders();
    return this.http.put<{ success: boolean; message: string }>(
      `${this.apiUrl}/contacts/${id}`,
      contact,
      { headers }
    ).pipe(
      map(() => undefined),
      catchError(this.handleError)
    );
  }

  deleteContact(id: number): Observable<void> {
    const headers = this.getAuthHeaders();
    return this.http.delete<{ success: boolean; message: string }>(
      `${this.apiUrl}/contacts/${id}`,
      { headers }
    ).pipe(
      map(() => undefined),
      catchError(this.handleError)
    );
  }

  // ==========================================================================
  // NOTES
  // ==========================================================================

  getContactNotes(
    contactId: number,
    page: number = 1,
    limit: number = 50,
    pinnedFirst: boolean = true
  ): Observable<ContactNotesResponse> {
    const headers = this.getAuthHeaders();
    const params = new HttpParams()
      .set('limit', limit.toString())
      .set('offset', ((page - 1) * limit).toString())
      .set('pinned_first', pinnedFirst.toString());

    return this.http.get<{ success: boolean; data: ContactNotesResponse }>(
      `${this.apiUrl}/contacts/${contactId}/notes`,
      { headers, params }
    ).pipe(
      map(response => response.data),
      catchError(this.handleError)
    );
  }

  createNote(contactId: number, note: Partial<ContactNote>): Observable<{ id: number }> {
    const headers = this.getAuthHeaders();
    return this.http.post<{ success: boolean; data: { id: number }; message: string }>(
      `${this.apiUrl}/contacts/${contactId}/notes`,
      note,
      { headers }
    ).pipe(
      map(response => response.data),
      catchError(this.handleError)
    );
  }

  updateNote(contactId: number, noteId: number, note: Partial<ContactNote>): Observable<void> {
    const headers = this.getAuthHeaders();
    return this.http.put<{ success: boolean; message: string }>(
      `${this.apiUrl}/contacts/${contactId}/notes/${noteId}`,
      note,
      { headers }
    ).pipe(
      map(() => undefined),
      catchError(this.handleError)
    );
  }

  toggleNotePin(contactId: number, noteId: number): Observable<void> {
    const headers = this.getAuthHeaders();
    return this.http.patch<{ success: boolean; message: string }>(
      `${this.apiUrl}/contacts/${contactId}/notes/${noteId}/pin`,
      {},
      { headers }
    ).pipe(
      map(() => undefined),
      catchError(this.handleError)
    );
  }

  deleteNote(contactId: number, noteId: number): Observable<void> {
    const headers = this.getAuthHeaders();
    return this.http.delete<{ success: boolean; message: string }>(
      `${this.apiUrl}/contacts/${contactId}/notes/${noteId}`,
      { headers }
    ).pipe(
      map(() => undefined),
      catchError(this.handleError)
    );
  }

  getRecentNotes(limit: number = 10, noteType?: string): Observable<ContactNote[]> {
    const headers = this.getAuthHeaders();
    let params = new HttpParams().set('limit', limit.toString());
    if (noteType) params = params.set('note_type', noteType);

    return this.http.get<{ success: boolean; data: ContactNote[] }>(
      `${this.apiUrl}/notes/recent`,
      { headers, params }
    ).pipe(
      map(response => response.data),
      catchError(this.handleError)
    );
  }

  searchNotes(query: string, limit: number = 20): Observable<ContactNote[]> {
    const headers = this.getAuthHeaders();
    const params = new HttpParams()
      .set('q', query)
      .set('limit', limit.toString());

    return this.http.get<{ success: boolean; data: ContactNote[] }>(
      `${this.apiUrl}/notes/search`,
      { headers, params }
    ).pipe(
      map(response => response.data),
      catchError(this.handleError)
    );
  }

  // ==========================================================================
  // CALLS
  // ==========================================================================

  getContactCalls(
    contactId: number,
    page: number = 1,
    limit: number = 10
  ): Observable<ContactCallsResponse> {
    const headers = this.getAuthHeaders();
    const params = new HttpParams()
      .set('limit', limit.toString())
      .set('offset', ((page - 1) * limit).toString());

    return this.http.get<{ success: boolean; data: ContactCallsResponse }>(
      `${this.apiUrl}/contacts/${contactId}/calls`,
      { headers, params }
    ).pipe(
      map(response => response.data),
      catchError(this.handleError)
    );
  }

  getContactEmailSends(contactId: number): Observable<ContactEmailSend[]> {
    const headers = this.getAuthHeaders();
    return this.http.get<{ success: boolean; data: ContactEmailSend[] }>(
      `${this.apiUrl}/contacts/${contactId}/email-sends`,
      { headers }
    ).pipe(
      map(response => response.data || []),
      catchError(this.handleError)
    );
  }

  createContactEmailSend(contactId: number, emailCampaignId: number): Observable<void> {
    const headers = this.getAuthHeaders();
    return this.http.post<{ success: boolean; message: string }>(
      `${this.apiUrl}/contacts/${contactId}/email-sends/${emailCampaignId}`,
      {},
      { headers }
    ).pipe(
      map(() => undefined),
      catchError(this.handleError)
    );
  }

  logCall(contactId: number, call: Partial<ContactCall>): Observable<{ id: number }> {
    const headers = this.getAuthHeaders();
    return this.http.post<{ success: boolean; data: { id: number }; message: string }>(
      `${this.apiUrl}/contacts/${contactId}/calls`,
      call,
      { headers }
    ).pipe(
      map(response => response.data),
      catchError(this.handleError)
    );
  }

  updateCall(contactId: number, callId: number, call: Partial<ContactCall>): Observable<void> {
    const headers = this.getAuthHeaders();
    return this.http.put<{ success: boolean; message: string }>(
      `${this.apiUrl}/contacts/${contactId}/calls/${callId}`,
      call,
      { headers }
    ).pipe(
      map(() => undefined),
      catchError(this.handleError)
    );
  }

  deleteCall(contactId: number, callId: number): Observable<void> {
    const headers = this.getAuthHeaders();
    return this.http.delete<{ success: boolean; message: string }>(
      `${this.apiUrl}/contacts/${contactId}/calls/${callId}`,
      { headers }
    ).pipe(
      map(() => undefined),
      catchError(this.handleError)
    );
  }

  getRecentCalls(limit: number = 10, direction?: string): Observable<ContactCall[]> {
    const headers = this.getAuthHeaders();
    let params = new HttpParams().set('limit', limit.toString());
    if (direction) params = params.set('direction', direction);

    return this.http.get<{ success: boolean; data: ContactCall[] }>(
      `${this.apiUrl}/calls/recent`,
      { headers, params }
    ).pipe(
      map(response => response.data),
      catchError(this.handleError)
    );
  }

  getPendingFollowUps(): Observable<ContactCall[]> {
    const headers = this.getAuthHeaders();
    return this.http.get<{ success: boolean; data: ContactCall[] }>(
      `${this.apiUrl}/calls/follow-ups`,
      { headers }
    ).pipe(
      map(response => response.data),
      catchError(this.handleError)
    );
  }

  getCallStats(startDate?: string, endDate?: string): Observable<CallStats> {
    const headers = this.getAuthHeaders();
    let params = new HttpParams();
    if (startDate) params = params.set('start_date', startDate);
    if (endDate) params = params.set('end_date', endDate);

    return this.http.get<{ success: boolean; data: CallStats }>(
      `${this.apiUrl}/calls/stats`,
      { headers, params }
    ).pipe(
      map(response => response.data),
      catchError(this.handleError)
    );
  }

  // ==========================================================================
  // CAMPAIGNS
  // ==========================================================================

  getCampaigns(
    page: number = 1,
    limit: number = 50,
    search?: string,
    status?: string | string[],
    sortBy?: string,
    sortOrder?: 'asc' | 'desc'
  ): Observable<CampaignsListResponse> {
    const headers = this.getAuthHeaders();
    let params = new HttpParams()
      .set('limit', limit.toString())
      .set('offset', ((page - 1) * limit).toString());

    if (search) params = params.set('search', search);
    if (status) {
      const statusValue = Array.isArray(status) ? status.join(',') : status;
      params = params.set('status', statusValue);
    }
    if (sortBy) params = params.set('sort_by', sortBy);
    if (sortOrder) params = params.set('sort_order', sortOrder);

    return this.http.get<{ success: boolean; data: CampaignsListResponse }>(
      `${this.apiUrl}/campaigns`,
      { headers, params }
    ).pipe(
      map(response => response.data),
      catchError(this.handleError)
    );
  }

  getCampaignUnsentContacts(
    campaignId: number,
    page: number = 1,
    limit: number = 50,
    search?: string,
    tag?: string,
    source?: string,
    subscribed?: boolean,
    hasPhone?: boolean,
      city?: string,    // comma-separated list of cities
      state?: string    // comma-separated list of states
  ): Observable<ContactsListResponse> {
    const headers = this.getAuthHeaders();
    let params = new HttpParams()
      .set('limit', limit.toString())
      .set('offset', ((page - 1) * limit).toString());

    if (search) params = params.set('search', search);
    if (tag) params = params.set('tag', tag);
    if (source) params = params.set('source', source);
    if (subscribed !== undefined) params = params.set('subscribed', subscribed.toString());
    if (hasPhone) params = params.set('has_phone', 'true');
    if (city) params = params.set('city', city);
    if (state) params = params.set('state', state);

    return this.http.get<{ success: boolean; data: ContactsListResponse }>(
      `${this.apiUrl}/campaigns/${campaignId}/unsent-contacts`,
      { headers, params }
    ).pipe(
      map(response => response.data),
      catchError(this.handleError)
    );
  }

  getEmailCampaignUnsentContacts(
    campaignId: number,
    emailCampaignId: number,
    page: number = 1,
    limit: number = 50,
    search?: string,
    tag?: string,
    source?: string,
    subscribed?: boolean,
    hasPhone?: boolean,
    city?: string,
    state?: string
  ): Observable<ContactsListResponse> {
    const headers = this.getAuthHeaders();
    let params = new HttpParams()
      .set('limit', limit.toString())
      .set('offset', ((page - 1) * limit).toString());

    if (search) params = params.set('search', search);
    if (tag) params = params.set('tag', tag);
    if (source) params = params.set('source', source);
    if (subscribed !== undefined) params = params.set('subscribed_only', subscribed.toString());
    if (hasPhone) params = params.set('has_phone', 'true');
    if (city) params = params.set('city', city);
    if (state) params = params.set('state', state);

    return this.http.get<{ success: boolean; data: ContactsListResponse }>(
      `${this.apiUrl}/campaigns/${campaignId}/email-campaigns/${emailCampaignId}/unsent-contacts`,
      { headers, params }
    ).pipe(
      map(response => response.data),
      catchError(this.handleError)
    );
  }

  getCampaign(id: number): Observable<Campaign> {
    const headers = this.getAuthHeaders();
    return this.http.get<{ success: boolean; data: Campaign }>(
      `${this.apiUrl}/campaigns/${id}`,
      { headers }
    ).pipe(
      map(response => response.data),
      catchError(this.handleError)
    );
  }

  checkContactDuplicate(
    email: string = '',
    phone: string = '',
    contactId: number | null = null
  ): Observable<{ success: boolean; data: Contact[] }> {
    const headers = this.getAuthHeaders();
    let params = new HttpParams();

    if (email) params = params.set('email', email);
    if (phone) params = params.set('phone', phone);
    if (contactId !== null) params = params.set('contact_id', contactId.toString());

    return this.http.get<{ success: boolean; data: Contact[] }>(
      `${this.apiUrl}/dups`,
      { headers, params }
    ).pipe(
      catchError(this.handleError)
    );
  }

  createCampaign(campaign: Partial<Campaign>): Observable<{ id: number }> {
    const headers = this.getAuthHeaders();
    return this.http.post<{ success: boolean; data: { id: number }; message: string }>(
      `${this.apiUrl}/campaigns`,
      campaign,
      { headers }
    ).pipe(
      map(response => response.data),
      catchError(this.handleError)
    );
  }

  createCampaignRecord(campaign: CreateCampaignRecordRequest): Observable<{ id: number }> {
    const headers = this.getAuthHeaders();
    return this.http.post<{ success: boolean; data: { id: number }; message: string }>(
      `${this.apiUrl}/campaigns/new`,
      campaign,
      { headers }
    ).pipe(
      map(response => response.data),
      catchError(this.handleError)
    );
  }

  getCampaignRecords(
    page: number = 1,
    limit: number = 50,
    search?: string,
    status?: string | string[]
  ): Observable<CampaignRecordsListResponse> {
    const headers = this.getAuthHeaders();
    let params = new HttpParams()
      .set('limit', limit.toString())
      .set('offset', ((page - 1) * limit).toString());

    if (search) params = params.set('search', search);
    if (status) {
      const statusValue = Array.isArray(status) ? status.join(',') : status;
      params = params.set('status', statusValue);
    }

    return this.http.get<{ success: boolean; data: CampaignRecordsListResponse }>(
      `${this.apiUrl}/campaigns`,
      { headers, params }
    ).pipe(
      map(response => response.data),
      catchError(this.handleError)
    );
  }

  getCampaignRecord(id: number): Observable<CampaignRecord> {
    const headers = this.getAuthHeaders();
    return this.http.get<{ success: boolean; data: CampaignRecord }>(
      `${this.apiUrl}/campaigns/${id}`,
      { headers }
    ).pipe(
      map(response => response.data),
      catchError(this.handleError)
    );
  }

  updateCampaignRecord(id: number, campaign: Partial<CampaignRecord>): Observable<void> {
    const headers = this.getAuthHeaders();
    return this.http.put<{ success: boolean; message: string }>(
      `${this.apiUrl}/campaign-records/${id}`,
      campaign,
      { headers }
    ).pipe(
      map(() => undefined),
      catchError(this.handleError)
    );
  }

  deleteCampaignRecord(id: number): Observable<void> {
    const headers = this.getAuthHeaders();
    return this.http.delete<{ success: boolean; message: string }>(
      `${this.apiUrl}/campaign-records/${id}`,
      { headers }
    ).pipe(
      map(() => undefined),
      catchError(this.handleError)
    );
  }

  createEmailCampaign(campaignId: number, campaign: CreateEmailCampaignRequest): Observable<{ id: number }> {
    const headers = this.getAuthHeaders();
    return this.http.post<{ success: boolean; data: { id: number }; message: string }>(
      `${this.apiUrl}/campaigns/${campaignId}/email`,
      campaign,
      { headers }
    ).pipe(
      map(response => response.data),
      catchError(this.handleError)
    );
  }

  getEmailCampaignsByCampaign(
    campaignId: number,
    page: number = 1,
    limit: number = 50,
    search?: string,
    status?: string | string[]
  ): Observable<CampaignsListResponse> {
    const headers = this.getAuthHeaders();
    let params = new HttpParams()
      .set('limit', limit.toString())
      .set('offset', ((page - 1) * limit).toString());

    if (search) params = params.set('search', search);
    if (status) {
      const statusValue = Array.isArray(status) ? status.join(',') : status;
      params = params.set('status', statusValue);
    }

    return this.http.get<{ success: boolean; data: CampaignsListResponse }>(
      `${this.apiUrl}/campaigns/${campaignId}/emails`,
      { headers, params }
    ).pipe(
      map(response => response.data),
      catchError(this.handleError)
    );
  }

  getEmailCampaign(campaignId: number, id: number): Observable<Campaign> {
    const headers = this.getAuthHeaders();
    return this.http.get<{ success: boolean; data: Campaign }>(
      `${this.apiUrl}/campaigns/${campaignId}/emails/${id}`,
      { headers }
    ).pipe(
      map(response => response.data),
      catchError(this.handleError)
    );
  }

  updateEmailCampaign(campaignId: number, id: number, campaign: Partial<Campaign>): Observable<void> {
    const headers = this.getAuthHeaders();
    return this.http.put<{ success: boolean; message: string }>(
      `${this.apiUrl}/campaigns/${campaignId}/emails/${id}`,
      campaign,
      { headers }
    ).pipe(
      map(() => undefined),
      catchError(this.handleError)
    );
  }

  deleteEmailCampaign(id: number): Observable<void> {
    const headers = this.getAuthHeaders();
    return this.http.delete<{ success: boolean; message: string }>(
      `${this.apiUrl}/email-campaigns/${id}`,
      { headers }
    ).pipe(
      map(() => undefined),
      catchError(this.handleError)
    );
  }

  updateCampaign(id: number, campaign: Partial<Campaign>): Observable<void> {
    const headers = this.getAuthHeaders();
    return this.http.put<{ success: boolean; message: string }>(
      `${this.apiUrl}/campaigns/${id}`,
      campaign,
      { headers }
    ).pipe(
      map(() => undefined),
      catchError(this.handleError)
    );
  }

  deleteCampaign(id: number): Observable<void> {
    const headers = this.getAuthHeaders();
    return this.http.delete<{ success: boolean; message: string }>(
      `${this.apiUrl}/campaigns/${id}`,
      { headers }
    ).pipe(
      map(() => undefined),
      catchError(this.handleError)
    );
  }

  // NEW: Duplicate campaign
  duplicateCampaign(id: number): Observable<{ id: number }> {
    const headers = this.getAuthHeaders();
    return this.http.post<{ success: boolean; data: { id: number }; message: string }>(
      `${this.apiUrl}/campaigns/${id}/duplicate`,
      {},
      { headers }
    ).pipe(
      map(response => response.data),
      catchError(this.handleError)
    );
  }

  // NEW: Schedule campaign
  scheduleCampaign(id: number, scheduledAt: string): Observable<void> {
    const headers = this.getAuthHeaders();
    return this.http.post<{ success: boolean; message: string }>(
      `${this.apiUrl}/campaigns/${id}/schedule`,
      { scheduled_at: scheduledAt },
      { headers }
    ).pipe(
      map(() => undefined),
      catchError(this.handleError)
    );
  }

  // NEW: Update campaign status only
  updateCampaignStatus(id: number, status: string): Observable<void> {
    const headers = this.getAuthHeaders();
    return this.http.patch<{ success: boolean; message: string }>(
      `${this.apiUrl}/campaigns/${id}/status`,
      { status },
      { headers }
    ).pipe(
      map(() => undefined),
      catchError(this.handleError)
    );
  }

  // NEW: Send test email
  sendTestEmail(campaignId: number, testEmail: string): Observable<void> {
    const headers = this.getAuthHeaders();
    return this.http.post<{ success: boolean; message: string }>(
      `${this.apiUrl}/campaigns/${campaignId}/test`,
      { email: testEmail },
      { headers }
    ).pipe(
      map(() => undefined),
      catchError(this.handleError)
    );
  }

  // NEW: Send test email
  sendTrackClick(linkId: number, contactId: number): Observable<void> {
    const headers = this.getAuthHeaders();
    return this.http.post<{ success: boolean; message: string }>(
      `${this.trackingApiUrl}/click/${linkId}/${contactId}`,
      {},
      { headers }
    ).pipe(
      map(() => undefined),
      catchError(this.handleError)
    );
  }

  // NEW: Send campaign
  sendCampaign(
    campaignId: number,
    emailCampaignId?: number,
    contactIds?: number[],
    filters?: { tag?: string; source?: string; subscribedOnly?: boolean }
  ): Observable<SendCampaignResult> {
    const headers = this.getAuthHeaders();
    const body: any = {};

    if (contactIds && contactIds.length > 0) {
      body.contact_ids = contactIds;
    }
    if (filters) {
      body.filters = {};
      if (filters.tag) body.filters.tag = filters.tag;
      if (filters.source) body.filters.source = filters.source;
      if (filters.subscribedOnly !== undefined) body.filters.subscribed_only = filters.subscribedOnly;
    }

    console.log('campaignId:', campaignId);
    console.log('emailCampaignId:', emailCampaignId);

    return this.http.post<{ success: boolean; data: SendCampaignResult; message: string }>(
      `${this.apiUrl}/campaigns/${campaignId}/send/${emailCampaignId ?? ''}`,
      body,
      { headers }
    ).pipe(
      map(response => response.data),
      catchError(this.handleError)
    );
  }

  /** Get latest send job status for a campaign (queue results). */
  getCampaignSendStatus(campaignId: number): Observable<CampaignSendJob | null> {
    const headers = this.getAuthHeaders();
    return this.http.get<{ success: boolean; data: CampaignSendJob | null; message?: string }>(
      `${this.apiUrl}/campaigns/${campaignId}/send-status`,
      { headers }
    ).pipe(
      map(response => response.data ?? null),
      catchError(this.handleError)
    );
  }

  // NEW: Get campaign stats
  getCampaignStats(campaignId: number, emailCampaignId?: number): Observable<CampaignStats> {
    const headers = this.getAuthHeaders();
    return this.http.get<{ success: boolean; data: CampaignStats }>(
      `${this.apiUrl}/campaigns/${campaignId}/email-campaigns/${emailCampaignId}/stats`,
      { headers }
    ).pipe(
      map(response => response.data),
      catchError(this.handleError)
    );
  }

  // NEW: Get campaign sends
  getCampaignSends(
    campaignId: number,
    page: number = 1,
    limit: number = 50,
    status?: string,
    opened?: boolean,
    clicked?: boolean,
    search?: string
  ): Observable<CampaignSendsResponse> {
    const headers = this.getAuthHeaders();
    let params = new HttpParams()
      .set('limit', limit.toString())
      .set('offset', ((page - 1) * limit).toString());

    if (status) params = params.set('status', status);
    if (opened !== undefined) params = params.set('opened', opened.toString());
    if (clicked !== undefined) params = params.set('clicked', clicked.toString());
    if (search) params = params.set('search', search);

    return this.http.get<{ success: boolean; data: CampaignSendsResponse }>(
      `${this.apiUrl}/campaigns/${campaignId}/sends`,
      { headers, params }
    ).pipe(
      map(response => response.data),
      catchError(this.handleError)
    );
  }

  // NEW: Get campaign recipients preview
  getCampaignRecipients(
    campaignId: number,
    filters?: { tag?: string; source?: string; subscribedOnly?: boolean; search?: string }
  ): Observable<CampaignRecipientsResponse> {
    const headers = this.getAuthHeaders();
    let params = new HttpParams();

    if (filters) {
      if (filters.tag) params = params.set('tag', filters.tag);
      if (filters.source) params = params.set('source', filters.source);
      if (filters.subscribedOnly !== undefined) params = params.set('subscribed_only', filters.subscribedOnly.toString());
      if (filters.search) params = params.set('search', filters.search);
    }

    return this.http.get<{ success: boolean; data: CampaignRecipientsResponse }>(
      `${this.apiUrl}/campaigns/${campaignId}/recipients`,
      { headers, params }
    ).pipe(
      map(response => response.data),
      catchError(this.handleError)
    );
  }

  // ==========================================================================
  // STATISTICS
  // ==========================================================================

  getStats(): Observable<MarketingStats> {
    const headers = this.getAuthHeaders();
    return this.http.get<{ success: boolean; data: MarketingStats }>(
      `${this.apiUrl}/stats`,
      { headers }
    ).pipe(
      map(response => response.data),
      catchError(this.handleError)
    );
  }

  getCitiesList(): Observable<CityItem[]> {
    const headers = this.getAuthHeaders();
    return this.http.get<{ success: boolean; data: CityItem[] }>(
      `${this.adminApiUrl}/cities`,
      { headers }
    ).pipe(
      map(response => response.data),
      catchError(this.handleError)
    );
  }

  getStatesList(): Observable<StateItem[]> {
    const headers = this.getAuthHeaders();
    return this.http.get<{ success: boolean; data: StateItem[] }>(
      `${this.adminApiUrl}/states`,
      { headers }
    ).pipe(
      map(response => response.data),
      catchError(this.handleError)
    );
  }

  // ==========================================================================
  // UTILITY METHODS
  // ==========================================================================

  isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  formatDate(dateString: string): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  formatDateTime(dateString: string): string {
    if (!dateString) return '';
    // Handle MySQL format (YYYY-MM-DD HH:mm:ss) which comes from API as UTC
    let date: Date;
    if (dateString.includes(' ') && !dateString.includes('T') && !dateString.includes('Z')) {
      date = new Date(dateString.replace(' ', 'T') + 'Z');
    } else {
      date = new Date(dateString);
    }
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  formatDuration(seconds: number | undefined): string {
    if (!seconds) return '—';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins === 0) return `${secs}s`;
    if (secs === 0) return `${mins}m`;
    return `${mins}m ${secs}s`;
  }

  formatPhoneNumber(phone: string | undefined): string {
    if (!phone) return '—';
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return phone;
  }

  getOutcomeLabel(outcome: string): string {
    const labels: Record<string, string> = {
      'answered': 'Answered',
      'voicemail': 'Voicemail',
      'no_answer': 'No Answer',
      'busy': 'Busy',
      'wrong_number': 'Wrong Number',
      'callback_requested': 'Callback Requested',
      'other': 'Other'
    };
    return labels[outcome] || outcome;
  }

  getOutcomeClass(outcome: string): string {
    const classes: Record<string, string> = {
      'answered': 'outcome-answered',
      'voicemail': 'outcome-voicemail',
      'no_answer': 'outcome-no-answer',
      'busy': 'outcome-busy',
      'wrong_number': 'outcome-wrong-number',
      'callback_requested': 'outcome-callback',
      'other': 'outcome-other'
    };
    return classes[outcome] || 'outcome-default';
  }

  getDirectionIcon(direction: string): string {
    return direction === 'outbound' ? '📤' : '📥';
  }

  getNoteTypeIcon(noteType: string): string {
    const icons: Record<string, string> = {
      'general': '📝',
      'call': '📞',
      'email': '✉️',
      'meeting': '🤝',
      'follow_up': '📅',
      'other': '📌'
    };
    return icons[noteType] || '📝';
  }

  getNoteTypeLabel(noteType: string): string {
    const labels: Record<string, string> = {
      'general': 'General',
      'call': 'Call',
      'email': 'Email',
      'meeting': 'Meeting',
      'follow_up': 'Follow-up',
      'other': 'Other'
    };
    return labels[noteType] || noteType;
  }

  getStatusClass(status: string): string {
    const classes: Record<string, string> = {
      'draft': 'status-draft',
      'scheduled': 'status-scheduled',
      'sending': 'status-sending',
      'sent': 'status-sent',
      'paused': 'status-paused',
      'cancelled': 'status-cancelled'
    };
    return classes[status] || 'status-default';
  }

  getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      'draft': 'Draft',
      'scheduled': 'Scheduled',
      'sending': 'Sending',
      'sent': 'Sent',
      'paused': 'Paused',
      'cancelled': 'Cancelled'
    };
    return labels[status] || status;
  }



  // ==========================================================================
  // PRIVATE METHODS
  // ==========================================================================

  private getAuthHeaders(): HttpHeaders {
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('auth_token') : null;
    return new HttpHeaders({
      ...(token && { 'Authorization': `Bearer ${token}` }),
      'Content-Type': 'application/json'
    });
  }

  private handleError(error: any): Observable<never> {
    console.error('EmailMarketing service error:', error);
    let errorMessage = 'An error occurred';
    if (error.error?.message) {
      errorMessage = error.error.message;
    } else if (error.error?.error) {
      errorMessage = error.error.error;
    } else if (error.message) {
      errorMessage = error.message;
    } else if (error.status === 401) {
      errorMessage = 'Authentication required. Please log in.';
    } else if (error.status === 403) {
      errorMessage = 'You do not have permission to perform this action.';
    } else if (error.status === 404) {
      errorMessage = 'The requested resource was not found.';
    }
    return throwError(() => new Error(errorMessage));
  }

}
