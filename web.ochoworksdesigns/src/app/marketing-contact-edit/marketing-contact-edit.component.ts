import { Component, OnInit, OnDestroy, Inject, PLATFORM_ID, HostListener } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import {
  EmailMarketingService,
  Contact,
  ContactNote,
  ContactNotesResponse,
  ContactCall,
  ContactCallsResponse,
  ContactEmailSend,
  Campaign,
  CampaignRecord
} from '../_services/email-marketing.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-marketing-contact-edit',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './marketing-contact-edit.component.html',
  styleUrl: './marketing-contact-edit.component.css'
})
export class MarketingContactEditComponent implements OnInit, OnDestroy {
  // Contact data
  contact: Partial<Contact> = {
    email: '',
    firstname: '',
    lastname: '',
    company: '',
    website: '',
    phone: '',
    tags: [],
    source: 'manual',
    is_subscribed: true
  };

  isEditMode = false;
  contactId: number | null = null;

  // Tags input
  newTag = '';

  // Notes
  notes: ContactNote[] = [];
  totalNotes = 0;
  notesPage = 1;
  notesPerPage = 20;
  loadingNotes = false;

  // New note form
  showNoteForm = false;
  newNote: Partial<ContactNote> = this.getEmptyNote();
  savingNote = false;

  // Edit note
  editingNoteId: number | null = null;
  editingNote: Partial<ContactNote> = {};

  // Note types
  noteTypeOptions = [
    { value: 'general', label: 'General', icon: '📝' },
    { value: 'call', label: 'Call', icon: '📞' },
    { value: 'email', label: 'Email', icon: '✉️' },
    { value: 'meeting', label: 'Meeting', icon: '🤝' },
    { value: 'follow_up', label: 'Follow-up', icon: '📅' },
    { value: 'other', label: 'Other', icon: '📌' }
  ];

  // Call history
  calls: ContactCall[] = [];
  totalCalls = 0;
  callsPage = 1;
  callsPerPage = 10;
  loadingCalls = false;

  // Campaign email sends history
  emailSends: ContactEmailSend[] = [];
  loadingEmailSends = false;
  availableCampaigns: CampaignRecord[] = [];
  availableEmailCampaigns: Campaign[] = [];
  selectedCampaignId: number | null = null;
  selectedEmailCampaignId: number | null = null;
  loadingCampaignOptions = false;
  loadingEmailCampaignOptions = false;
  creatingEmailSend = false;

  // New call form
  showCallForm = false;
  newCall: Partial<ContactCall> = this.getEmptyCall();
  savingCall = false;

  // Edit call
  editingCallId: number | null = null;
  editingCall: Partial<ContactCall> = {};

  // State
  loading = true;
  saving = false;
  error: string | null = null;
  successMessage: string | null = null;

  // Active tab
  activeTab: 'notes' | 'calls' | 'campaign' = 'notes';

  // Delete modals
  showDeleteNoteModal = false;
  noteToDelete: ContactNote | null = null;
  deletingNote = false;

  showDeleteCallModal = false;
  callToDelete: ContactCall | null = null;
  deletingCall = false;

  // Duplicate checking
  showDuplicateModal = false;
  duplicateContacts: Contact[] = [];
  checkingDuplicates = false;
  hasDuplicates = false;

  // Options
  outcomeOptions = [
    { value: 'answered', label: 'Answered' },
    { value: 'voicemail', label: 'Voicemail' },
    { value: 'no_answer', label: 'No Answer' },
    { value: 'busy', label: 'Busy' },
    { value: 'wrong_number', label: 'Wrong Number' },
    { value: 'callback_requested', label: 'Callback Requested' },
    { value: 'other', label: 'Other' }
  ];

  sourceOptions = ['manual', 'website', 'referral', 'import', 'api', 'contact_form'];

  private routeSubscription?: Subscription;
  private isBrowser: boolean;
  private initialContactSnapshot = '';
  private initialNewNoteSnapshot = '';
  private initialEditingNoteSnapshot = '';
  private initialNewCallSnapshot = '';
  private initialEditingCallSnapshot = '';
  private initialCampaignFormSnapshot = '';

  constructor(
    private marketingService: EmailMarketingService,
    private route: ActivatedRoute,
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  ngOnInit(): void {
    this.routeSubscription = this.route.params.subscribe(params => {
      if (params['id']) {
        this.contactId = parseInt(params['id']);
        this.isEditMode = true;
        this.loadContact();
      } else {
        this.isEditMode = false;
        this.loading = false;
        this.setInitialContactSnapshot();
        this.setInitialTabFormSnapshots();
      }
    });
  }

  ngOnDestroy(): void {
    this.routeSubscription?.unsubscribe();
  }

  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.hasUnsavedChanges()) {
      event.preventDefault();
      event.returnValue = '';
    }
  }

  canDeactivate(): boolean {
    if (!this.hasUnsavedChanges()) {
      return true;
    }

    if (!this.isBrowser) {
      return true;
    }

    return window.confirm('You have unsaved changes. Are you sure you want to leave this page?');
  }

  // ==========================================================================
  // CONTACT METHODS
  // ==========================================================================

  loadContact(): void {
    if (!this.contactId) return;

    this.loading = true;
    this.error = null;

    this.marketingService.getContact(this.contactId).subscribe({
      next: (contact) => {
        this.contact = { ...contact };
        this.loading = false;
        this.loadNotes();
        this.loadCalls();
        this.loadEmailSends();
        this.loadCampaignOptions();

        if (this.contact.phone) {
          this.formatPhoneInput();
        }

        this.setInitialContactSnapshot();
        this.setInitialTabFormSnapshots();
      },
      error: (err) => {
        console.error('Error loading contact:', err);
        this.error = err.message || 'Failed to load contact.';
        this.loading = false;
      }
    });
  }

  saveContact(): void {
    if (!this.validateContact()) return;

    // Check for duplicates before saving
    this.checkForDuplicates();
  }

  private validateContact(): boolean {
    // if (!this.contact.email) {
    //   this.error = 'Email is required.';
    //   return false;
    // }

    if (this.contact.email && !this.marketingService.isValidEmail(this.contact.email)) {
      this.error = 'Please enter a valid email address.';
      return false;
    }

    // Validate phone number if provided
    if (this.contact.phone) {
      const cleanedPhone = this.cleanPhoneNumber(this.contact.phone);
      if (cleanedPhone.length !== 10) {
        this.error = 'Phone number must be exactly 10 digits.';
        return false;
      }
    }

    // Validate website URL if provided
    if (this.contact.website) {
      const urlPattern = /^(https?:\/\/)?([\w-]+(\.[\w-]+)+)(\/[\w-]*)*\/?$/;
      if (!urlPattern.test(this.contact.website)) {
        this.error = 'Please enter a valid website URL.';
        return false;
      }
    }

    return true;
  }

  /**
   * Remove all non-numeric characters from phone number
   */
  private cleanPhoneNumber(phone: string | undefined): string {
    if (!phone) return '';
    return phone.replace(/\D/g, '');
  }

  /**
   * Prepare contact data for API submission with cleaned phone number
   */
  private prepareContactForApi(): Partial<Contact> {
    return {
      ...this.contact,
      phone: this.cleanPhoneNumber(this.contact.phone)
    };
  }

  // ==========================================================================
  // DUPLICATE CHECKING
  // ==========================================================================

  /**
   * Check for duplicate contacts before saving
   */
  checkForDuplicates(): void {
    const email = this.contact.email?.trim() || '';
    const phone = this.cleanPhoneNumber(this.contact.phone);

    // Skip check if both email and phone are empty
    if (!email && !phone) {
      this.performSave();
      return;
    }

    this.checkingDuplicates = true;
    this.error = null;

    this.marketingService.checkContactDuplicate(email, phone, this.contactId).subscribe({
      next: (duplicates) => {
        this.checkingDuplicates = false;

        if (duplicates && duplicates.data && duplicates.data.length > 0) {
          // Duplicates found - show modal
          this.duplicateContacts = duplicates.data;
          this.hasDuplicates = true;
          this.showDuplicateModal = true;
        } else {
          // No duplicates - proceed with save
          this.hasDuplicates = false;
          this.performSave();
        }
      },
      error: (err) => {
        this.checkingDuplicates = false;
        this.error = err.message || 'Failed to check for duplicates.';
      }
    });
  }

  /**
   * Close duplicate modal
   */
  closeDuplicateModal(): void {
    this.showDuplicateModal = false;
    this.duplicateContacts = [];
  }

  /**
   * Navigate to duplicate contact
   */
  viewDuplicateContact(contactId: number): void {
    this.router.navigate(['/admin/marketing/contacts', contactId]);
  }

  /**
   * Perform the actual save operation (called after duplicate check passes)
   */
  private performSave(): void {
    this.saving = true;
    this.error = null;
    this.successMessage = null;

    // Prepare contact data with cleaned phone number
    const contactData = this.prepareContactForApi();

    if (this.isEditMode && this.contactId) {
      this.marketingService.updateContact(this.contactId, contactData).subscribe({
        next: () => {
          this.saving = false;
          this.successMessage = 'Contact updated successfully!';
          this.setInitialContactSnapshot();
          this.clearMessageAfterDelay();
          this.loadContact();
        },
        error: (err) => {
          this.saving = false;
          this.error = err.message || 'Failed to update contact.';
        }
      });
    } else {
      this.marketingService.createContact(contactData).subscribe({
        next: (result) => {
          this.saving = false;
          this.successMessage = 'Contact created successfully!';
          this.setInitialContactSnapshot();
          this.router.navigate(['/admin/marketing/contacts', result.id]);
        },
        error: (err) => {
          this.saving = false;
          this.error = err.message || 'Failed to create contact.';
        }
      });
    }
  }

  // ==========================================================================
  // TAGS
  // ==========================================================================

  addTag(): void {
    const tag = this.newTag.trim().toLowerCase();
    if (!tag) return;
    if (!this.contact.tags) this.contact.tags = [];
    if (!this.contact.tags.includes(tag)) {
      this.contact.tags.push(tag);
    }
    this.newTag = '';
  }

  removeTag(tag: string): void {
    if (this.contact.tags) {
      this.contact.tags = this.contact.tags.filter(t => t !== tag);
    }
  }

  onTagKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.addTag();
    }
  }

  // ==========================================================================
  // NOTES
  // ==========================================================================

  getEmptyNote(): Partial<ContactNote> {
    return {
      content: '',
      note_type: 'general',
      is_pinned: false
    };
  }

  loadNotes(): void {
    if (!this.contactId) return;

    this.loadingNotes = true;

    this.marketingService.getContactNotes(this.contactId, this.notesPage, this.notesPerPage).subscribe({
      next: (response: ContactNotesResponse) => {
        this.notes = response.notes || [];
        this.totalNotes = response.total || 0;
        this.loadingNotes = false;
      },
      error: (err) => {
        console.error('Error loading notes:', err);
        this.loadingNotes = false;
      }
    });
  }

  openNoteForm(): void {
    this.newNote = this.getEmptyNote();
    this.showNoteForm = true;
    this.setInitialNewNoteSnapshot();
  }

  cancelNoteForm(): void {
    this.showNoteForm = false;
    this.newNote = this.getEmptyNote();
    this.setInitialNewNoteSnapshot();
  }

  saveNewNote(): void {
    if (!this.contactId || !this.newNote.content?.trim()) {
      this.error = 'Note content is required.';
      return;
    }

    this.savingNote = true;
    this.error = null;

    this.marketingService.createNote(this.contactId, this.newNote).subscribe({
      next: () => {
        this.savingNote = false;
        this.showNoteForm = false;
        this.newNote = this.getEmptyNote();
        this.setInitialNewNoteSnapshot();
        this.successMessage = 'Note added successfully!';
        this.clearMessageAfterDelay();
        this.loadNotes();
        this.loadContact(); // Refresh contact in case notes count is displayed
      },
      error: (err) => {
        this.savingNote = false;
        this.error = err.message || 'Failed to add note.';
      }
    });
  }

  startEditNote(note: ContactNote): void {
    this.editingNoteId = note.id;
    this.editingNote = { ...note };
    this.setInitialEditingNoteSnapshot();
  }

  cancelEditNote(): void {
    this.editingNoteId = null;
    this.editingNote = {};
    this.initialEditingNoteSnapshot = '';
  }

  saveEditNote(): void {
    if (!this.contactId || !this.editingNoteId) return;

    this.savingNote = true;

    this.marketingService.updateNote(this.contactId, this.editingNoteId, this.editingNote).subscribe({
      next: () => {
        this.savingNote = false;
        this.editingNoteId = null;
        this.editingNote = {};
        this.initialEditingNoteSnapshot = '';
        this.successMessage = 'Note updated successfully!';
        this.clearMessageAfterDelay();
        this.loadNotes();
      },
      error: (err) => {
        this.savingNote = false;
        this.error = err.message || 'Failed to update note.';
      }
    });
  }

  toggleNotePin(note: ContactNote): void {
    if (!this.contactId) return;

    this.marketingService.toggleNotePin(this.contactId, note.id).subscribe({
      next: () => {
        this.loadNotes();
      },
      error: (err) => {
        this.error = err.message || 'Failed to update pin status.';
      }
    });
  }

  confirmDeleteNote(note: ContactNote): void {
    this.noteToDelete = note;
    this.showDeleteNoteModal = true;
  }

  cancelDeleteNote(): void {
    this.noteToDelete = null;
    this.showDeleteNoteModal = false;
  }

  deleteNote(): void {
    if (!this.contactId || !this.noteToDelete) return;

    this.deletingNote = true;

    this.marketingService.deleteNote(this.contactId, this.noteToDelete.id).subscribe({
      next: () => {
        this.deletingNote = false;
        this.showDeleteNoteModal = false;
        this.noteToDelete = null;
        this.successMessage = 'Note deleted successfully!';
        this.clearMessageAfterDelay();
        this.loadNotes();
        this.loadContact(); // Refresh contact in case notes count is displayed
      },
      error: (err) => {
        this.deletingNote = false;
        this.error = err.message || 'Failed to delete note.';
      }
    });
  }

  hasMoreNotes(): boolean {
    return this.notes.length < this.totalNotes;
  }

  loadMoreNotes(): void {
    this.notesPage++;
    this.loadNotes();
  }

  // ==========================================================================
  // CALL HISTORY
  // ==========================================================================

  getEmptyCall(): Partial<ContactCall> {
    return {
      direction: 'outbound',
      phone_number: '',
      duration_seconds: undefined,
      outcome: 'answered',
      notes: '',
      follow_up_date: undefined,
      follow_up_notes: '',
      follow_up_complete: 0,
      called_at: this.getCurrentDateTime()
    };
  }

  loadCalls(): void {
    if (!this.contactId) return;

    this.loadingCalls = true;

    this.marketingService.getContactCalls(this.contactId, this.callsPage, this.callsPerPage).subscribe({
      next: (response: ContactCallsResponse) => {
        this.calls = response.calls || [];
        this.totalCalls = response.total || 0;
        this.loadingCalls = false;
      },
      error: (err) => {
        console.error('Error loading calls:', err);
        this.loadingCalls = false;
      }
    });
  }

  loadEmailSends(): void {
    if (!this.contactId) return;

    this.loadingEmailSends = true;

    this.marketingService.getContactEmailSends(this.contactId).subscribe({
      next: (response: ContactEmailSend[]) => {
        this.emailSends = response || [];
        if (
          this.selectedEmailCampaignId &&
          this.isEmailCampaignAlreadySent(this.selectedEmailCampaignId, this.selectedCampaignId)
        ) {
          this.selectedEmailCampaignId = null;
        }
        this.setInitialCampaignFormSnapshot();
        this.loadingEmailSends = false;
      },
      error: (err) => {
        console.error('Error loading contact email sends:', err);
        this.loadingEmailSends = false;
      }
    });
  }

  loadCampaignOptions(): void {
    this.loadingCampaignOptions = true;

    this.marketingService.getCampaignRecords(1, 500).subscribe({
      next: (response) => {
        this.availableCampaigns = response.campaigns || [];
        this.loadingCampaignOptions = false;
      },
      error: (err) => {
        console.error('Error loading campaign options:', err);
        this.loadingCampaignOptions = false;
      }
    });
  }

  onCampaignSelectionChange(): void {
    this.selectedEmailCampaignId = null;
    this.availableEmailCampaigns = [];

    if (!this.selectedCampaignId) return;

    const selectedCampaign = this.availableCampaigns.find(campaign => campaign.id === this.selectedCampaignId);
    const linkedEmailCampaigns = this.extractEmailCampaignsFromCampaignPayload(selectedCampaign);
    if (linkedEmailCampaigns.length > 0) {
      this.availableEmailCampaigns = linkedEmailCampaigns;
      return;
    }

    this.loadEmailCampaignOptions(this.selectedCampaignId);
  }

  loadEmailCampaignOptions(campaignId: number): void {
    this.loadingEmailCampaignOptions = true;

    this.marketingService.getCampaign(campaignId).subscribe({
      next: (campaignData: any) => {
        const nestedEmailCampaigns = this.extractEmailCampaignsFromCampaignPayload(campaignData);

        if (nestedEmailCampaigns.length > 0) {
          this.availableEmailCampaigns = nestedEmailCampaigns;
          this.ensureSelectedEmailCampaignIsValid();
          this.loadingEmailCampaignOptions = false;
          return;
        }

        // Fallback for APIs that don't embed email campaigns on getCampaign.
        this.marketingService.getEmailCampaignsByCampaign(campaignId, 1, 500).subscribe({
          next: (response) => {
            this.availableEmailCampaigns = response.campaigns || [];
            this.ensureSelectedEmailCampaignIsValid();
            this.loadingEmailCampaignOptions = false;
          },
          error: (err) => {
            console.error('Error loading email campaign options:', err);
            this.loadingEmailCampaignOptions = false;
          }
        });
      },
      error: (err) => {
        console.error('Error loading campaign details:', err);
        this.loadingEmailCampaignOptions = false;
      }
    });
  }

  private extractEmailCampaignsFromCampaignPayload(payload: any): Campaign[] {
    if (!payload || typeof payload !== 'object') return [];

    const candidates = [
      payload.email_campaigns,
      payload.emailCampaigns,
      payload.emails,
      payload.campaigns
    ];

    const arrayCandidate = candidates.find(candidate => Array.isArray(candidate));
    if (!arrayCandidate) return [];

    return (arrayCandidate as any[])
      .filter(item => item && typeof item.id === 'number')
      .map(item => ({
        ...(item as Campaign),
        name: item.name || `Email Campaign #${item.id}`,
        subject: item.subject || '',
        content: item.content || '',
        status: item.status || 'draft',
        total_recipients: Number(item.total_recipients || 0),
        total_sent: Number(item.total_sent || 0),
        total_opened: Number(item.total_opened || 0),
        total_clicked: Number(item.total_clicked || 0),
        total_bounced: Number(item.total_bounced || 0),
        total_unsubscribed: Number(item.total_unsubscribed || 0),
        created_at: item.created_at || new Date().toISOString()
      }));
  }

  isEmailCampaignAlreadySent(emailCampaignId: number, campaignId: number | null = this.selectedCampaignId): boolean {
    return this.emailSends.some(send => {
      if (send.email_campaign_id !== emailCampaignId) return false;
      if (!campaignId) return true;
      return send.campaign_id === campaignId;
    });
  }

  private ensureSelectedEmailCampaignIsValid(): void {
    if (!this.selectedEmailCampaignId) return;
    const selectedOptionExists = this.availableEmailCampaigns.some(
      campaign => campaign.id === this.selectedEmailCampaignId
    );
    if (!selectedOptionExists) {
      this.selectedEmailCampaignId = null;
      return;
    }
    if (this.isEmailCampaignAlreadySent(this.selectedEmailCampaignId, this.selectedCampaignId)) {
      this.selectedEmailCampaignId = null;
    }
  }

  createManualEmailSendRecord(): void {
    if (!this.contactId || !this.selectedEmailCampaignId) {
      this.error = 'Select a campaign and email campaign first.';
      return;
    }

    this.creatingEmailSend = true;
    this.error = null;

    this.marketingService.createContactEmailSend(this.contactId, this.selectedEmailCampaignId).subscribe({
      next: () => {
        this.creatingEmailSend = false;
        this.successMessage = 'Email send record created successfully!';
        this.clearMessageAfterDelay();
        this.loadEmailSends();
      },
      error: (err) => {
        this.creatingEmailSend = false;
        this.error = err.message || 'Failed to create email send record.';
      }
    });
  }

  openCallForm(): void {
    this.newCall = this.getEmptyCall();
    if (this.contact.phone) {
      this.newCall.phone_number = this.contact.phone;
    }
    this.showCallForm = true;
    this.setInitialNewCallSnapshot();
  }

  cancelCallForm(): void {
    this.showCallForm = false;
    this.newCall = this.getEmptyCall();
    this.setInitialNewCallSnapshot();
  }

  saveNewCall(): void {
    if (!this.contactId) return;

    this.savingCall = true;
    this.error = null;

    // Convert local datetime to UTC MySQL format for API
    const callData = {
      ...this.newCall,
      called_at: this.newCall.called_at ? this.toUTCMySQLString(this.newCall.called_at) : undefined
    };

    this.marketingService.logCall(this.contactId, callData).subscribe({
      next: () => {
        this.savingCall = false;
        this.showCallForm = false;
        this.newCall = this.getEmptyCall();
        this.setInitialNewCallSnapshot();
        this.successMessage = 'Call logged successfully!';
        this.clearMessageAfterDelay();
        this.loadCalls();
        this.loadContact(); // Refresh contact in case phone number was updated
      },
      error: (err) => {
        this.savingCall = false;
        this.error = err.message || 'Failed to log call.';
      }
    });
  }

  startEditCall(call: ContactCall): void {
    this.editingCallId = call.id;
    // Convert UTC called_at to local datetime string for the form input
    this.editingCall = {
      ...call,
      follow_up_complete: call.follow_up_complete ?? 0, // Ensure it's 0 if undefined
      called_at: call.called_at ? this.toLocalDateTimeString(call.called_at) : undefined
    };
    this.setInitialEditingCallSnapshot();
  }

  cancelEditCall(): void {
    this.editingCallId = null;
    this.editingCall = {};
    this.initialEditingCallSnapshot = '';
  }

  saveEditCall(): void {
    if (!this.contactId || !this.editingCallId) return;

    this.savingCall = true;

    // Convert local datetime to UTC MySQL format for API
    const callData = {
      ...this.editingCall,
      called_at: this.editingCall.called_at ? this.toUTCMySQLString(this.editingCall.called_at) : undefined
    };

    this.marketingService.updateCall(this.contactId, this.editingCallId, callData).subscribe({
      next: () => {
        this.savingCall = false;
        this.editingCallId = null;
        this.editingCall = {};
        this.initialEditingCallSnapshot = '';
        this.successMessage = 'Call updated successfully!';
        this.clearMessageAfterDelay();
        this.loadCalls();
      },
      error: (err) => {
        this.savingCall = false;
        this.error = err.message || 'Failed to update call.';
      }
    });
  }

  confirmDeleteCall(call: ContactCall): void {
    this.callToDelete = call;
    this.showDeleteCallModal = true;
  }

  cancelDeleteCall(): void {
    this.callToDelete = null;
    this.showDeleteCallModal = false;
  }

  deleteCall(): void {
    if (!this.contactId || !this.callToDelete) return;

    this.deletingCall = true;

    this.marketingService.deleteCall(this.contactId, this.callToDelete.id).subscribe({
      next: () => {
        this.deletingCall = false;
        this.showDeleteCallModal = false;
        this.callToDelete = null;
        this.successMessage = 'Call deleted successfully!';
        this.clearMessageAfterDelay();
        this.loadCalls();
        this.loadContact(); // Refresh contact in case calls count is displayed
      },
      error: (err) => {
        this.deletingCall = false;
        this.error = err.message || 'Failed to delete call.';
      }
    });
  }

  hasMoreCalls(): boolean {
    return this.calls.length < this.totalCalls;
  }

  loadMoreCalls(): void {
    this.callsPage++;
    this.loadCalls();
  }

  /**
   * Toggle the follow-up complete status for a call
   */
  toggleFollowUpComplete(call: ContactCall): void {
    if (!this.contactId) return;

    const updatedStatus = call.follow_up_complete === 1 ? 0 : 1;

    this.marketingService.updateCall(this.contactId, call.id, {
      follow_up_complete: updatedStatus
    }).subscribe({
      next: () => {
        // Update the local call object
        call.follow_up_complete = updatedStatus;
        this.successMessage = updatedStatus === 1
          ? 'Follow-up marked as complete!'
          : 'Follow-up marked as incomplete!';
        this.clearMessageAfterDelay();
      },
      error: (err) => {
        this.error = err.message || 'Failed to update follow-up status.';
      }
    });
  }

  // ==========================================================================
  // UTILITY METHODS
  // ==========================================================================

  formatDate(dateString: string): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  formatDateTime(dateString: string): string {
    if (!dateString) return '';
    // Handle MySQL format (YYYY-MM-DD HH:mm:ss) which comes from API as UTC
    // JavaScript Date would interpret this as local time, so we need to treat it as UTC
    let date: Date;
    if (dateString.includes(' ') && !dateString.includes('T') && !dateString.includes('Z')) {
      // MySQL format without timezone - treat as UTC by replacing space with 'T' and adding 'Z'
      date = new Date(dateString.replace(' ', 'T') + 'Z');
    } else {
      date = new Date(dateString);
    }
    return date.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  }

  formatDuration(seconds: number | undefined): string {
    return this.marketingService.formatDuration(seconds);
  }

  formatPhoneNumber(phone: string | undefined): string {
    return this.marketingService.formatPhoneNumber(phone);
  }

  getOutcomeLabel(outcome: string): string {
    return this.marketingService.getOutcomeLabel(outcome);
  }

  getOutcomeClass(outcome: string): string {
    return this.marketingService.getOutcomeClass(outcome);
  }

  getDirectionIcon(direction: string): string {
    return this.marketingService.getDirectionIcon(direction);
  }

  getNoteTypeIcon(noteType: string): string {
    return this.marketingService.getNoteTypeIcon(noteType);
  }

  getNoteTypeLabel(noteType: string): string {
    return this.marketingService.getNoteTypeLabel(noteType);
  }

  /**
   * Get current local datetime formatted for datetime-local input (YYYY-MM-DDTHH:mm)
   */
  getCurrentDateTime(): string {
    return this.toLocalDateTimeString(new Date());
  }

  /**
   * Convert a Date object or UTC string to local datetime string for datetime-local input
   * Handles both ISO format and MySQL format (YYYY-MM-DD HH:mm:ss)
   * Format: YYYY-MM-DDTHH:mm (local time)
   */
  toLocalDateTimeString(date: Date | string): string {
    let d: Date;
    if (typeof date === 'string') {
      // Handle MySQL format (YYYY-MM-DD HH:mm:ss) which comes from API as UTC
      if (date.includes(' ') && !date.includes('T') && !date.includes('Z')) {
        d = new Date(date.replace(' ', 'T') + 'Z');
      } else {
        d = new Date(date);
      }
    } else {
      d = date;
    }
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }

  /**
   * Convert local datetime string from datetime-local input to UTC MySQL format for API
   * Input format: YYYY-MM-DDTHH:mm (local time)
   * Output format: YYYY-MM-DD HH:mm:ss (UTC)
   */
  toUTCMySQLString(localDateTimeString: string): string {
    const localDate = new Date(localDateTimeString);
    const year = localDate.getUTCFullYear();
    const month = String(localDate.getUTCMonth() + 1).padStart(2, '0');
    const day = String(localDate.getUTCDate()).padStart(2, '0');
    const hours = String(localDate.getUTCHours()).padStart(2, '0');
    const minutes = String(localDate.getUTCMinutes()).padStart(2, '0');
    const seconds = String(localDate.getUTCSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  }

  private clearMessageAfterDelay(): void {
    setTimeout(() => {
      this.successMessage = null;
    }, 3000);
  }

  setActiveTab(tab: 'notes' | 'calls' | 'campaign'): void {
    this.activeTab = tab;
  }

  goBack(): void {
    this.router.navigate(['/admin/marketing/contacts']);
  }

  trackByNoteFn(index: number, note: ContactNote): number {
    return note.id;
  }

  trackByCallFn(index: number, call: ContactCall): number {
    return call.id;
  }

  trackByEmailSendFn(index: number, send: ContactEmailSend): number {
    return send.id;
  }

  /**
   * Get the first duplicate contact (or null if none exist)
   */
  get firstDuplicate(): Contact | null {
    return this.duplicateContacts.length > 0 ? this.duplicateContacts[0] : null;
  }

  formatPhoneInput(): void {
    if (!this.contact.phone) return;

    // Strip non-digits
    const digits = this.contact.phone.replace(/\D/g, '');

    // Format if 10 digits
    if (digits.length === 10) {
      this.contact.phone = `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    } else {
      // Show partial formatting while typing
      let formatted = digits;

      if (digits.length > 3 && digits.length <= 6) {
        formatted = `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
      } else if (digits.length > 6) {
        formatted = `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
      }

      this.contact.phone = formatted;
    }

  }

  formatNewCallPhoneInput(): void { if (!this.newCall.phone_number) return; const digits = this.newCall.phone_number.replace(/\D/g, ''); if (digits.length === 10) { this.newCall.phone_number = `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`; } else { let formatted = digits; if (digits.length > 3 && digits.length <= 6) { formatted = `(${digits.slice(0, 3)}) ${digits.slice(3)}`; } else if (digits.length > 6) { formatted = `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`; } this.newCall.phone_number = formatted; } }

  private hasUnsavedChanges(): boolean {
    if (this.loading || this.saving) {
      return false;
    }
    if (this.showNoteForm || this.editingNoteId !== null || this.showCallForm || this.editingCallId !== null) {
      return true;
    }
    if (this.getContactSnapshot() !== this.initialContactSnapshot) {
      return true;
    }
    if (this.getCampaignFormSnapshot() !== this.initialCampaignFormSnapshot) {
      return true;
    }
    return false;
  }

  private setInitialContactSnapshot(): void {
    this.initialContactSnapshot = this.getContactSnapshot();
  }

  private setInitialTabFormSnapshots(): void {
    this.setInitialNewNoteSnapshot();
    this.setInitialNewCallSnapshot();
    this.setInitialCampaignFormSnapshot();
    this.initialEditingNoteSnapshot = '';
    this.initialEditingCallSnapshot = '';
  }

  private setInitialNewNoteSnapshot(): void {
    this.initialNewNoteSnapshot = this.getNoteSnapshot(this.newNote);
  }

  private setInitialEditingNoteSnapshot(): void {
    this.initialEditingNoteSnapshot = this.getNoteSnapshot(this.editingNote);
  }

  private setInitialNewCallSnapshot(): void {
    this.initialNewCallSnapshot = this.getCallSnapshot(this.newCall);
  }

  private setInitialEditingCallSnapshot(): void {
    this.initialEditingCallSnapshot = this.getCallSnapshot(this.editingCall);
  }

  private setInitialCampaignFormSnapshot(): void {
    this.initialCampaignFormSnapshot = this.getCampaignFormSnapshot();
  }

  private getContactSnapshot(): string {
    const normalized = {
      email: (this.contact.email || '').trim(),
      firstname: (this.contact.firstname || '').trim(),
      lastname: (this.contact.lastname || '').trim(),
      company: (this.contact.company || '').trim(),
      city: (this.contact.city || '').trim(),
      state: (this.contact.state || '').trim(),
      website: (this.contact.website || '').trim(),
      phone: this.cleanPhoneNumber(this.contact.phone),
      tags: (this.contact.tags || []).map(tag => (tag || '').trim().toLowerCase()).sort(),
      source: this.contact.source || 'manual',
      is_subscribed: !!this.contact.is_subscribed
    };

    return JSON.stringify(normalized);
  }

  private getNoteSnapshot(note: Partial<ContactNote>): string {
    const normalized = {
      note_type: note.note_type || 'general',
      content: (note.content || '').trim(),
      is_pinned: !!note.is_pinned
    };

    return JSON.stringify(normalized);
  }

  private getCallSnapshot(call: Partial<ContactCall>): string {
    const normalized = {
      direction: call.direction || 'outbound',
      phone_number: this.cleanPhoneNumber(call.phone_number),
      duration_seconds: Number(call.duration_seconds || 0),
      outcome: call.outcome || 'answered',
      notes: (call.notes || '').trim(),
      follow_up_date: call.follow_up_date || '',
      follow_up_notes: (call.follow_up_notes || '').trim(),
      follow_up_complete: call.follow_up_complete === 1 ? 1 : 0,
      called_at: call.called_at || ''
    };

    return JSON.stringify(normalized);
  }

  private getCampaignFormSnapshot(): string {
    return JSON.stringify({
      selectedCampaignId: this.selectedCampaignId,
      selectedEmailCampaignId: this.selectedEmailCampaignId
    });
  }
}
