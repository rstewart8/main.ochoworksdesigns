<?php

/**
 * EmailMarketing.php
 * 
 * Email marketing service that extends SendGrid functionality
 * Handles campaigns, contacts, bulk sending, and tracking
 */

require_once 'SendGrid.php';

class EmailMarketing extends SendGrid
{
    private $db;
    private $trackingUrl;
    private $defaultFromEmail;
    private $defaultFromName;
    private $defaultReplyToEmail;
    var $logger;

    public function __construct($database, $logger = null)
    {
        parent::__construct($database);
        $this->db = $database;
        $this->trackingUrl = $_ENV['TRACKING_URL'] ?? $_ENV['API_BASE_URL'] ?? 'http://localhost:8222';
        $this->defaultFromEmail = $_ENV['FROM_EMAIL'] ?? $_ENV['CONTACT_EMAIL'] ?? 'noreply@example.com';
        $this->defaultFromName = $_ENV['FROM_NAME'] ?? 'OchoWorks Designs and Drafting';
        $this->defaultReplyToEmail = $_ENV['REPLY_TO_EMAIL'] ?? $this->defaultFromEmail;
        $this->logger = $logger;
    }
    
    // =========================================================================
    // CONTACTS MANAGEMENT
    // =========================================================================


    /**
     * Get contact by email
     */
    public function getContactByEmail($email)
    {
        return $this->db->fetchOne(
            "SELECT * FROM contacts WHERE email = ? AND is_active = 1",
            [$email]
        );
    }

    /**
     * Import contacts from array
     */
    public function importContacts($contacts, $source = 'import')
    {
        $results = [
            'imported' => 0,
            'skipped' => 0,
            'errors' => []
        ];

        foreach ($contacts as $index => $contact) {
            try {
                if (empty($contact['email']) || !filter_var($contact['email'], FILTER_VALIDATE_EMAIL)) {
                    $results['errors'][] = "Row $index: Invalid email";
                    $results['skipped']++;
                    continue;
                }

                $contact['source'] = $source;
                $this->createContact($contact);
                $results['imported']++;
            } catch (Exception $e) {
                if (strpos($e->getMessage(), 'already exists') !== false) {
                    $results['skipped']++;
                } else {
                    $results['errors'][] = "Row $index: " . $e->getMessage();
                    $results['skipped']++;
                }
            }
        }

        return $results;
    }
    
    // =========================================================================
    // CAMPAIGNS MANAGEMENT
    // =========================================================================

    /**
     * Get all campaigns with stats
     */
    public function getCampaigns($filters = [])
    {
        $where = ['1=1'];
        $params = [];

        if (!empty($filters['status'])) {
            if (is_array($filters['status'])) {
                $placeholders = str_repeat('?,', count($filters['status']) - 1) . '?';
                $where[] = "status IN ($placeholders)";
                $params = array_merge($params, $filters['status']);
            } else {
                $where[] = 'status = ?';
                $params[] = $filters['status'];
            }
        }

        if (!empty($filters['search'])) {
            $search = '%' . $filters['search'] . '%';
            $where[] = '(name LIKE ?)';
            $params[] = $search;
        }

        // Date range filters
        if (!empty($filters['from_date'])) {
            $where[] = 'created_at >= ?';
            $params[] = $filters['from_date'];
        }

        if (!empty($filters['to_date'])) {
            $where[] = 'created_at <= ?';
            $params[] = $filters['to_date'] . ' 23:59:59';
        }

        $whereClause = implode(' AND ', $where);

        // Sorting
        $allowedSortFields = ['created_at', 'name', 'status'];
        $sortBy = in_array($filters['sort_by'] ?? 'created_at', $allowedSortFields)
            ? $filters['sort_by']
            : 'created_at';
        $sortOrder = strtoupper($filters['sort_order'] ?? 'DESC') === 'ASC' ? 'ASC' : 'DESC';

        $limit = isset($filters['limit']) ? min((int)$filters['limit'], 100) : 50;
        $offset = isset($filters['offset']) ? (int)$filters['offset'] : 0;

        $sql = "SELECT c.*
                from campaigns c
                WHERE $whereClause
                ORDER BY c.$sortBy $sortOrder
                LIMIT $limit OFFSET $offset";

        $campaigns = $this->db->fetchAll($sql, $params);

        /// Add email_campaigns to campaigns
        foreach ($campaigns as &$campaign) {
            $campaign['links'] = $this->db->fetchAll(
                "SELECT id, name FROM email_campaigns WHERE campaign_id = ? ORDER BY created_at DESC",
                [$campaign['id']]
            );
        }

        $countSql = "SELECT COUNT(*) as total FROM campaigns WHERE $whereClause";
        $total = $this->db->fetchOne($countSql, $params);

        return [
            'campaigns' => $campaigns,
            'total' => (int)$total['total'],
            'limit' => $limit,
            'offset' => $offset
        ];
    }

    /**
     * Get single campaign by ID
     */
    public function getCampaign($id)
    {
        $campaign = $this->db->fetchOne(
            "SELECT c.*
            FROM campaigns c
             WHERE c.id = ?",
            [$id]
        );

        if ($campaign) {
            $campaign['links'] = $this->db->fetchAll(
                "SELECT id, name FROM email_campaigns WHERE campaign_id = ? ORDER BY created_at DESC",
                [$id]
            );
        }

        return $campaign ?: null;
    }

    /**
     * Create a new campaign
     */
    public function createCampaign($data)
    {
        $campaignData = [
            'name' => $data['name']
        ];

        if (!empty($data['status']) && in_array($data['status'], ['active', 'inactive', 'deleted'], true)) {
            $campaignData['status'] = $data['status'];
        }

        $insertId = $this->db->insert('campaigns', $campaignData);

        return $insertId;
    }

    public function updateCampaignRecord(int $id, array $data): bool
    {
        $campaign = $this->getCampaign($id);
        if (!$campaign) {
            throw new Exception('Campaign not found');
        }

        $updateData = [];
        foreach (['name', 'status'] as $field) {
            if (!array_key_exists($field, $data)) {
                continue;
            }

            if ($field === 'status' && !in_array($data[$field], ['active', 'inactive', 'deleted'], true)) {
                throw new Exception('Invalid campaign status');
            }

            $updateData[$field] = $data[$field];
        }

        if (empty($updateData)) {
            return false;
        }

        $this->db->update('campaigns', $updateData, 'id = :id', ['id' => $id]);
        return true;
    }

    public function deleteCampaignRecord(int $id): bool
    {
        $campaign = $this->getCampaign($id);
        if (!$campaign) {
            throw new Exception('Campaign not found');
        }

        $this->db->update('campaigns', ['status' => 'deleted'], 'id = :id', ['id' => $id]);
        return true;
    }

    /**
     * Update an existing campaign
     */
    public function updateCampaign($id, $data)
    {
        $campaign = $this->getCampaign($id);
        if (!$campaign) {
            throw new Exception('Campaign not found');
        }

        $updateData = [];
        $allowedFields = ['name', 'status'];

        foreach ($allowedFields as $field) {
            if (array_key_exists($field, $data)) {
                if ($field === 'status' && !in_array($data[$field], ['active', 'inactive', 'deleted'], true)) {
                    throw new Exception('Invalid campaign status');
                }
                $updateData[$field] = $data[$field];
            }
        }

        if (empty($updateData)) {
            return false;
        }

        $this->db->update('campaigns', $updateData, 'id = :id', ['id' => $id]);
        return true;
    }

    /**
     * Delete a campaign (only drafts)
     */
    public function deleteCampaign($id)
    {
        return $this->deleteCampaignRecord((int) $id);
    }

    /**
     * Duplicate an existing campaign
     * 
     * @param int $id Original campaign ID
     * @param int|null $createdBy User ID creating the duplicate
     * @return int New campaign ID
     * @throws Exception if original campaign not found
     */
    public function duplicateCampaign(int $id, ?int $createdBy = null): int
    {
        $original = $this->getCampaign($id);
        if (!$original) {
            throw new Exception('Campaign not found');
        }

        $newData = [
            'name' => $original['name'] . ' (Copy)',
            'status' => $original['status'] ?? 'active'
        ];

        return $this->createCampaign($newData);
    }

    /**
     * Schedule a campaign for future sending
     * 
     * @param int $id Campaign ID
     * @param string $scheduledAt DateTime string (Y-m-d H:i:s or ISO format)
     * @throws Exception if campaign cannot be scheduled
     */
    public function scheduleCampaign(int $id, string $scheduledAt): void
    {
        $campaign = $this->db->fetchOne(
            "SELECT id, status FROM email_campaigns WHERE id = ?",
            [$id]
        );
        if (!$campaign) {
            throw new Exception('Email campaign not found');
        }

        if (!in_array($campaign['status'], ['draft', 'scheduled'])) {
            throw new Exception('Campaign cannot be scheduled. Current status: ' . $campaign['status']);
        }

        // Validate and parse datetime
        try {
            $dt = new DateTime($scheduledAt);
        } catch (Exception $e) {
            throw new Exception('Invalid date/time format');
        }

        if ($dt <= new DateTime()) {
            throw new Exception('Scheduled time must be in the future');
        }

        $this->db->update('email_campaigns', [
            'status' => 'scheduled',
            'scheduled_at' => $dt->format('Y-m-d H:i:s')
        ], 'id = :id', ['id' => $id]);
    }

    /**
     * Update campaign status only
     * 
     * @param int $id Campaign ID
     * @param string $status New status
     * @throws Exception on invalid status
     */
    public function updateCampaignStatus(int $id, string $status): void
    {
        $validStatuses = ['draft', 'scheduled', 'sending', 'sent', 'paused', 'cancelled'];
        if (!in_array($status, $validStatuses)) {
            throw new Exception('Invalid status. Must be one of: ' . implode(', ', $validStatuses));
        }

        $campaign = $this->db->fetchOne(
            "SELECT id, status FROM email_campaigns WHERE id = ?",
            [$id]
        );
        if (!$campaign) {
            throw new Exception('Email campaign not found');
        }

        $this->db->update('email_campaigns', [
            'status' => $status
        ], 'id = :id', ['id' => $id]);
    }

    /**
     * Send a test email for campaign preview
     * 
     * @param int $campaignId Campaign ID
     * @param string $testEmail Email address to send test to
     * @return array Result with email and sent status
     * @throws Exception on failure
     */
    public function sendTestEmail(int $emailCampaignId, string $testEmail): array
    {
        $campaign = $this->getEmailCampaignById($emailCampaignId);
        if (!$campaign) {
            throw new Exception('Email Campaign not found');
        }

        if (!filter_var($testEmail, FILTER_VALIDATE_EMAIL)) {
            throw new Exception('Invalid email format');
        }

        // Personalize content with test placeholders
        $content = $campaign['email_campaign_content'];

        // Replace common personalization tokens with test values
        $replacements = [
            '{{name}}' => 'Test Recipient',
            '{{first_name}}' => 'Test',
            '{{last_name}}' => 'Recipient',
            '{{email}}' => $testEmail,
            '{{company}}' => 'Test Company',
            '[UNSUBSCRIBE_URL]' => '#test-unsubscribe',
            '{{unsubscribe_url}}' => '#test-unsubscribe',
            '{{salutation}}' => 'Hi Test,'
        ];

        $this->logger->info("campaign " . print_r($campaign, true));

        foreach ($campaign['links'] as $index => $link) {
            $host = $_ENV['APP_BASE_URL'];
            $linkId = $link['id'] . 'test';

            $url = "$host$link[link_url]";

            $replacements["{{link_url_" . ($index + 1) . "}}"] = $url;
        }

        $this->logger->info("Sending test email for email campaign ID $emailCampaignId to $testEmail with replacements: " . print_r($replacements, true));

        $content = str_replace(
            array_keys($replacements),
            array_values($replacements),
            $content
        );

        // Add [TEST] prefix to subject
        $subject = '[TEST] ' . $campaign['email_campaign_subject'];

        $fromEmail = $campaign['email_campaign_from_email'] ?: $this->defaultFromEmail;
        $fromName = $campaign['email_campaign_from_name'] ?: $this->defaultFromName;
        $replayToEmail = $campaign['email_campaign_reply_to'] ?: $this->defaultReplyToEmail;

        $this->logger->info("Test From: " . $fromEmail . " (" . $fromName . ")");
        $this->logger->info("Test Reply-To: " . $replayToEmail);

        // Send via parent SendGrid class
        $this->sendEmail([
            'to_email' => $testEmail,
            'to_name' => 'Test Recipient',
            'from_email' => $fromEmail,
            'from_name' => $fromName,
            'reply_to_email' => $replayToEmail,
            'subject' => $subject,
            'content' => $content,
            'content_type' => 'text/html',
            'send_plain_text' => true,
        ]);

        return [
            'email' => $testEmail,
            'sent' => true,
            'subject' => $subject
        ];
    }

    /**
     * Preview recipients for a campaign based on filters
     * 
     * @param int $campaignId Campaign ID (for context, not currently used)
     * @param array $filters Recipient filters (tag, source, limit, offset)
     * @return array ['recipients' => array, 'total' => int]
     */
    public function getCampaignRecipients(int $campaignId, array $filters = []): array
    {
        $where = ['is_subscribed = 1', 'is_active = 1', 'deleted_at IS NULL'];
        $params = [];

        // Tag filter
        if (!empty($filters['tag'])) {
            $where[] = "JSON_CONTAINS(tags, ?)";
            $params[] = json_encode($filters['tag']);
        }

        // Source filter
        if (!empty($filters['source'])) {
            $where[] = "source = ?";
            $params[] = $filters['source'];
        }

        // Search filter
        if (!empty($filters['search'])) {
            $search = '%' . $filters['search'] . '%';
            $where[] = "(email LIKE ? OR firstname LIKE ? OR lastname LIKE ? OR company LIKE ?)";
            $params[] = $search;
            $params[] = $search;
            $params[] = $search;
            $params[] = $search;
        }

        $whereClause = 'WHERE ' . implode(' AND ', $where);

        // Get total count
        $countSql = "SELECT COUNT(*) as total FROM contacts $whereClause";
        $countResult = $this->db->fetchOne($countSql, $params);
        $total = (int)$countResult['total'];

        // Get recipients with pagination
        $limit = (int)($filters['limit'] ?? 100);
        $offset = (int)($filters['offset'] ?? 0);

        $sql = "SELECT id, email, firstname, lastname,
                       CONCAT_WS(' ', firstname, lastname) AS name,
                       company, tags, source, created_at
                FROM contacts
                $whereClause
                ORDER BY company ASC
                LIMIT $limit OFFSET $offset";

        $recipients = $this->db->fetchAll($sql, $params);

        // Decode tags JSON
        foreach ($recipients as &$recipient) {
            $recipient['tags'] = $recipient['tags'] ? json_decode($recipient['tags'], true) : [];
        }

        return [
            'recipients' => $recipients,
            'total' => $total,
            'limit' => $limit,
            'offset' => $offset
        ];
    }
    
    // =========================================================================
    // CAMPAIGN SENDING
    // =========================================================================

    /**
     * Send campaign to selected contacts
     */
    public function sendCampaign($emailCampaignId, $contactIds = [], $filters = [])
    {
        $campaign = $this->getEmailCampaignById($emailCampaignId);

        $this->logger->info("Sending campaign: " . print_r($campaign, true));
        if (!$campaign) {
            throw new Exception('Campaign not found');
        }

        $useCampaignTracking = $campaign['email_campaign_track'] == 1 ? true : false;

        if (!in_array($campaign['email_campaign_status'], ['draft', 'scheduled', 'sending', 'sent'])) {
            throw new Exception('Campaign has already been sent or is in progress');
        }

        $sendPlainText = $campaign['send_plain_text'] == 1 ? true : false;

        // Get contacts to send to
        if (!empty($contactIds)) {
            $placeholders = str_repeat('?,', count($contactIds) - 1) . '?';
            $contacts = $this->db->fetchAll(
                "SELECT * FROM contacts WHERE id IN ($placeholders) AND is_active = 1 AND is_subscribed = 1",
                $contactIds
            );
        } else {
            // Send to all subscribed contacts matching filters
            $filters['subscribed'] = isset($filters['subscribed_only']) ? (bool)$filters['subscribed_only'] : true;
            $filters['limit'] = 10000; // Max recipients
            $result = $this->getContacts($filters);
            $contacts = $result['contacts'];
        }

        if (empty($contacts)) {
            throw new Exception('No valid contacts to send to');
        }

        // Update campaign status

        $this->db->query(
            "UPDATE email_campaigns 
            SET status = :status, 
            started_at = :started_at
            WHERE id = :id",
            [
                'status' => 'sending',
                'started_at' => date('Y-m-d H:i:s'),
                'id' => $emailCampaignId
            ]
        );

        // $this->db->update('email_campaigns', [
        //     'status' => 'sending',
        //     'started_at' => date('Y-m-d H:i:s'),
        //     'total_recipients' => count($contacts)
        // ], 'id = :id', ['id' => $campaignId]);

        $results = [
            'total' => count($contacts),
            'sent' => 0,
            'failed' => 0,
            'errors' => []
        ];

        $fromEmail = $campaign['email_campaign_from_email'] ?: $this->defaultFromEmail;
        $fromName  = $campaign['email_campaign_from_name']  ?: $this->defaultFromName;
        $replayToEmail = $campaign['email_campaign_reply_to'] ?: $this->defaultReplyToEmail;
        $links = $campaign['links'] ?? [];
        $cntr = 0;
        foreach ($contacts as $contact) {
            $cntr++;
            //// Add sleep random delay from 60 seconds to 90 seconds.
            if ($cntr > 1) {
                $ran = rand(60, 90);

                $this->logger->info("Sleeping for $ran seconds");
                sleep($ran);
            }

            try {
                // Generate tracking ID
                $trackingId = bin2hex(random_bytes(16));

                // Prepare content with tracking

                $content = $this->addTrackingToContent(
                    $campaign['email_campaign_content'],
                    $trackingId,
                    $contact['id'],
                    $links,
                    $useCampaignTracking
                );


                $content = $this->addReplacementContent($content, $contact);

                // Send email
                $emailResult = $this->sendEmail([
                    'to_email' => $contact['email'],
                    'to_name' => $contact['firstname'] ?? '',
                    'from_email' => $fromEmail,
                    'from_name' => $fromName,
                    'reply_to_email' => $replayToEmail,
                    'subject' => $campaign['email_campaign_subject'],
                    'content' => $content,
                    'content_type' => 'text/html',
                    'send_plain_text' => $sendPlainText,
                ]);

                // Log the send
                $this->db->insert('email_sends', [
                    'email_campaign_id' => $emailCampaignId,
                    'contact_id' => $contact['id'],
                    'tracking_id' => $trackingId,
                    'status' => 'sent',
                    'sent_at' => date('Y-m-d H:i:s')
                ]);

                $results['sent']++;
            } catch (Exception $e) {
                // Log failed send
                $this->db->insert('email_sends', [
                    'email_campaign_id' => $emailCampaignId,
                    'contact_id' => $contact['id'],
                    'tracking_id' => bin2hex(random_bytes(16)),
                    'status' => 'failed',
                    'error_message' => $e->getMessage(),
                    'sent_at' => date('Y-m-d H:i:s')
                ]);

                $results['failed']++;
                $results['errors'][] = [
                    'contact_id' => $contact['id'],
                    'email' => $contact['email'],
                    'error' => $e->getMessage()
                ];
            }
        }

        // Update campaign with final stats

        $this->db->query(
            "UPDATE email_campaigns 
            SET status = :status, 
                created_at = :created_at, 
                total_sent = total_sent + :count 
            WHERE id = :id",
            [
                'status' => 'sent',
                'created_at' => date('Y-m-d H:i:s'),
                'count' => $results['sent'],
                'id' => $emailCampaignId
            ]
        );
        // $this->db->update('email_campaigns', [
        //     'status' => 'sent',
        //     'completed_at' => date('Y-m-d H:i:s'),
        //     'total_sent' => $results['sent']
        // ], 'id = :id', ['id' => $campaignId]);

        return $results;
    }

    // =========================================================================
    // CAMPAIGN SEND QUEUE (cron worker processes these)
    // =========================================================================

    /**
     * Queue a campaign send. Does not send immediately; worker processes the queue.
     * Returns job id. Results are stored in campaign_send_queue and email_sends.
     */
    public function queueCampaignSend($campaignId, $contactIds = [], $emailCampaignId = null, $filters = [])
    {
        $emailCampaign = $this->getEmailCampaign($campaignId, $emailCampaignId);
        if (!$emailCampaign) {
            throw new Exception('Campaign not found');
        }
        if (!in_array($emailCampaign['status'], ['draft', 'scheduled', 'sent'])) {
            throw new Exception('Campaign cannot be sent. Current status: ' . $emailCampaign['status']);
        }

        // Resolve contacts to get count and validate
        if (!empty($contactIds)) {
            $placeholders = str_repeat('?,', count($contactIds) - 1) . '?';
            $contacts = $this->db->fetchAll(
                "SELECT id FROM contacts WHERE id IN ($placeholders) AND is_active = 1 AND is_subscribed = 1",
                $contactIds
            );
        } else {
            $filters['subscribed'] = isset($filters['subscribed_only']) ? (bool)$filters['subscribed_only'] : true;
            $filters['limit'] = 10000;
            $result = $this->getContacts($filters);
            $contacts = $result['contacts'];
        }
        if (empty($contacts)) {
            throw new Exception('No valid contacts to send to');
        }

        $contactIdsJson = !empty($contactIds) ? json_encode($contactIds) : null;
        $filtersJson = !empty($filters) ? json_encode($filters) : null;

        $resolvedEmailCampaignId = (int) ($emailCampaign['email_campaign_id'] ?? $emailCampaign['id'] ?? 0);
        if ($resolvedEmailCampaignId <= 0) {
            throw new Exception('Email campaign not found');
        }

        $jobId = (int) $this->db->insert('campaign_send_queue', [
            'email_campaign_id' => $resolvedEmailCampaignId,
            'contact_ids' => $contactIdsJson,
            'filters' => $filtersJson,
            'status' => 'queued',
            'total_recipients' => count($contacts),
            'total_sent' => 0,
            'total_failed' => 0
        ]);

        $this->db->query(
            "UPDATE email_campaigns 
            SET status = :status, 
                total_recipients = total_recipients + :count 
            WHERE id = :id",
            [
                'status' => 'sending',
                'count' => count($contacts),
                'id' => $resolvedEmailCampaignId
            ]
        );

        // $this->db->update('email_campaigns', [
        //     'status' => 'sending',
        //     'total_recipients' => count($contacts)
        // ], 'id = :id', ['id' => $campaignId]);

        return $jobId;
    }

    /**
     * Get the latest send job for a campaign (for in-app status/results).
     */
    public function getLatestCampaignSendJob($campaignId)
    {
        $row = $this->db->fetchOne(
            "SELECT csq.*, ec.campaign_id
             FROM campaign_send_queue csq
             JOIN email_campaigns ec ON csq.email_campaign_id = ec.id
             WHERE ec.campaign_id = ?
             ORDER BY csq.created_at DESC
             LIMIT 1",
            [$campaignId]
        );
        if (!$row) {
            return null;
        }
        $row['contact_ids'] = $row['contact_ids'] ? json_decode($row['contact_ids'], true) : null;
        $row['filters'] = $row['filters'] ? json_decode($row['filters'], true) : null;
        $row['error_summary'] = $row['error_summary'] ? json_decode($row['error_summary'], true) : null;
        return $row;
    }

    /**
     * Get next queued job (for worker).
     */
    public function getNextQueuedJob()
    {
        return $this->db->fetchOne(
            "SELECT * FROM campaign_send_queue WHERE status = 'queued' ORDER BY created_at ASC LIMIT 1"
        );
    }

    /**
     * Process one queued send job. Called by cron worker.
     * Returns true if a job was processed, false if queue was empty.
     */
    public function processNextQueuedJob()
    {
        $job = $this->getNextQueuedJob();
        if (!$job) {
            return false;
        }

        $jobId = (int) $job['id'];
        $emailCampaignId = (int) $job['email_campaign_id'];
        $contactIds = $job['contact_ids'] ? json_decode($job['contact_ids'], true) : [];
        $filters = $job['filters'] ? json_decode($job['filters'], true) : [];

        $this->db->update('campaign_send_queue', [
            'status' => 'sending',
            'started_at' => date('Y-m-d H:i:s')
        ], 'id = :id', ['id' => $jobId]);

        try {
            $results = $this->sendCampaign($emailCampaignId, $contactIds, $filters);
            $this->db->update('campaign_send_queue', [
                'status' => 'sent',
                'total_sent' => $results['sent'],
                'total_failed' => $results['failed'],
                'error_summary' => !empty($results['errors']) ? json_encode($results['errors']) : null,
                'completed_at' => date('Y-m-d H:i:s')
            ], 'id = :id', ['id' => $jobId]);
        } catch (Exception $e) {
            $this->db->update('campaign_send_queue', [
                'status' => 'failed',
                'error_summary' => json_encode([['error' => $e->getMessage()]]),
                'completed_at' => date('Y-m-d H:i:s')
            ], 'id = :id', ['id' => $jobId]);
            $this->db->update('email_campaigns', [
                'status' => 'draft'
            ], 'id = :id', ['id' => $emailCampaignId]);
            throw $e;
        }
        return true;
    }

    /**
     * add replacement content
     */

    private function addReplacementContent($content, $contact)
    {
        $contactFirstName = $contact['firstname'] ?? null;
        $replacements = [
            '{{name}}' => $contactFirstName,
            '{{firstname}}' => $contactFirstName,
            '{{lastname}}' => $contact['lastname'] ?? '',
            '{{email}}' => $contact['email'] ?? '',
            '{{company}}' => $contact['company'] ?? '',
            '{{salutation}}' => $contactFirstName ? "Hi $contactFirstName," : 'Hi,',
        ];

        return str_replace(
            array_keys($replacements),
            array_values($replacements),
            $content
        );
    }

    /**
     * Add tracking pixel and wrapped links to email content
     */
    private function addTrackingToContent($content, $trackingId, $contactId, $links = [], $useCampaignTracking = false)
    {

        // Add link urls
        foreach ($links as $index => $link) {
            $host = $_ENV['APP_BASE_URL'];
            $linkId = $link['id'];
            $url = "$host$link[link_url]?li=$linkId&cid=$contactId";

            // Replace {{link_url_1}}, {{link_url_2}}, etc. in content
            $content = str_replace("{{link_url_" . ($index + 1) . "}}", $url, $content);
        }

        if ($useCampaignTracking) {

            $trackingId = "$trackingId|$contactId";

            // Add tracking pixel before closing body tag (or at end)
            $trackingPixel = sprintf(
                '<img src="%s/api/track/open/%s" width="1" height="1" style="display:block;width:1px;height:1px;border:0;margin:0;padding:0;" alt="" />',
                rtrim($this->trackingUrl, '/'),
                $trackingId
            );
            // Add tracking pixel
            if (stripos($content, '</body>') !== false) {
                $content = str_ireplace('</body>', $trackingPixel . '</body>', $content);
            } else {
                $content .= $trackingPixel;
            }
        }

        // Add unsubscribe link
        $unsubscribeLink = sprintf(
            '%s/api/track/unsubscribe/%s',
            rtrim($this->trackingUrl, '/'),
            $trackingId
        );

        // Replace [UNSUBSCRIBE_URL] placeholder if present
        $content = str_replace('[UNSUBSCRIBE_URL]', $unsubscribeLink, $content);



        return $content;
    }

    
    // =========================================================================
    // TRACKING
    // =========================================================================

    /**
     * Record email open
     */
    public function trackOpen($trackingId)
    {
        //// decode tracking ID to get send record and contact
        $trackingId = urldecode($trackingId);
        $trackingIdParts = explode('|', $trackingId);
        $trackingId = $trackingIdParts[0];
        $contactId = null;
        if (count($trackingIdParts) === 2) {
            $contactId = (int)$trackingIdParts[1];
        }
        $send = $this->db->fetchOne(
            "SELECT id, email_campaign_id, opened_at FROM email_sends WHERE tracking_id = ?",
            [$trackingId]
        );

        if (!$send) {
            return false;
        }

        $campaignId = $send['email_campaign_id'];

        // Update send record
        $this->db->query(
            "UPDATE email_sends SET 
                opened_at = COALESCE(opened_at, NOW()),
                open_count = open_count + 1,
                user_agent = ?,
                ip_address = ?
             WHERE tracking_id = ?",
            [
                $_SERVER['HTTP_USER_AGENT'] ?? null,
                $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? null,
                $trackingId
            ]
        );

        // Update campaign stats if first open
        if (!$send['opened_at']) {
            $this->db->query(
                "UPDATE email_campaigns SET total_opened = total_opened + 1 WHERE id = ?",
                [$campaignId]
            );
        }

        // insert into campaign_contact_opens
        if ($contactId !== null) {
            $this->db->query(
                "INSERT INTO campaign_contact_opens (email_campaign_id, contact_id, opened_at) VALUES (?, ?, NOW())",
                [$campaignId, $contactId]
            );
        }

        $this->sendNotificationEmail($campaignId, $contactId, 'email_opened');

        return true;
    }

    /**
     * Handle unsubscribe request
     */
    public function trackUnsubscribe($trackingId, $reason = null, $feedback = null)
    {
        $trackingId = urldecode($trackingId);
        $trackingIdParts = explode('|', $trackingId);
        $trackingId = $trackingIdParts[0];

        $send = $this->db->fetchOne(
            "SELECT es.*, ec.email, ec.id as contact_id 
             FROM email_sends es
             JOIN contacts ec ON es.contact_id = ec.id
             WHERE es.tracking_id = ?",
            [$trackingId]
        );

        if (!$send) {
            return false;
        }

        $emailCampaignId = $send['email_campaign_id'];
        $contactId = $send['contact_id'];

        // Update contact
        $this->db->update('contacts', [
            'is_subscribed' => 0,
            'unsubscribed_at' => date('Y-m-d H:i:s')
        ], 'id = :id', ['id' => $contactId]);



        // Log unsubscribe
        $this->db->insert('email_unsubscribes', [
            'contact_id' => $contactId,
            'email_campaign_id' => $emailCampaignId,
            'reason' => $reason,
            'feedback' => $feedback,
            'ip_address' => $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? null
        ]);

        // Update campaign stats
        $this->db->query(
            "UPDATE email_campaigns SET total_unsubscribed = total_unsubscribed + 1 WHERE id = ?",
            [$emailCampaignId]
        );

        $this->sendNotificationEmail($emailCampaignId, $contactId, 'email_unsubscribed');

        return [
            'email' => $send['email'],
            'unsubscribed' => true
        ];
    }
    
    // =========================================================================
    // STATISTICS
    // =========================================================================

    /**
     * Get comprehensive marketing statistics
     */
    public function getMarketingStats()
    {
        $stats = [];

        // Contact stats
        $stats['contacts'] = [
            'total' => (int)$this->db->fetchOne("SELECT COUNT(*) as c FROM contacts WHERE is_active = 1")['c'],
            'subscribed' => (int)$this->db->fetchOne("SELECT COUNT(*) as c FROM contacts WHERE is_active = 1 AND is_subscribed = 1")['c'],
            'unsubscribed' => (int)$this->db->fetchOne("SELECT COUNT(*) as c FROM contacts WHERE is_active = 1 AND is_subscribed = 0")['c'],
            'new_this_month' => (int)$this->db->fetchOne("SELECT COUNT(*) as c FROM contacts WHERE is_active = 1 AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)")['c']
        ];

        // Campaign stats
        $stats['campaigns'] = [
            'total' => (int)$this->db->fetchOne("SELECT COUNT(*) as c FROM email_campaigns")['c'],
            'draft' => (int)$this->db->fetchOne("SELECT COUNT(*) as c FROM email_campaigns WHERE status = 'draft'")['c'],
            'sent' => (int)$this->db->fetchOne("SELECT COUNT(*) as c FROM email_campaigns WHERE status = 'sent'")['c'],
            'scheduled' => (int)$this->db->fetchOne("SELECT COUNT(*) as c FROM email_campaigns WHERE status = 'scheduled'")['c']
        ];

        // Email stats
        $emailStats = $this->db->fetchOne("
            SELECT 
                COUNT(*) as total_sent,
                SUM(CASE WHEN opened_at IS NOT NULL THEN 1 ELSE 0 END) as total_opened,
                SUM(open_count) as total_opens
            FROM email_sends
            WHERE status = 'sent'
        ");

        $stats['emails'] = [
            'total_sent' => (int)($emailStats['total_sent'] ?? 0),
            'total_opened' => (int)($emailStats['total_opened'] ?? 0),
            'total_opens' => (int)($emailStats['total_opens'] ?? 0),
            'open_rate' => $emailStats['total_sent'] > 0
                ? round(($emailStats['total_opened'] / $emailStats['total_sent']) * 100, 2)
                : 0
        ];

        // Recent activity (last 30 days)
        $stats['recent_activity'] = $this->db->fetchAll("
            SELECT 
                DATE(sent_at) as date,
                COUNT(*) as sent,
                SUM(CASE WHEN opened_at IS NOT NULL THEN 1 ELSE 0 END) as opened
            FROM email_sends
            WHERE sent_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
            GROUP BY DATE(sent_at)
            ORDER BY date ASC
        ");

        // Top campaigns by open rate
        $stats['top_campaigns'] = $this->db->fetchAll("
            SELECT 
                id, name, subject, total_sent, total_opened,
                CASE WHEN total_sent > 0 
                     THEN ROUND((total_opened / total_sent) * 100, 2) 
                     ELSE 0 END as open_rate
            FROM email_campaigns
            WHERE status = 'sent' AND total_sent > 0
            ORDER BY open_rate DESC
            LIMIT 5
        ");

        // Follow-up stats
        $stats['followups'] = [
            'total' => (int)$this->db->fetchOne("
                SELECT COUNT(*) as c 
                FROM contact_calls 
                WHERE follow_up_date IS NOT NULL AND is_active = 1
            ")['c'],
            'completed' => (int)$this->db->fetchOne("
                SELECT COUNT(*) as c 
                FROM contact_calls 
                WHERE follow_up_date IS NOT NULL 
                    AND follow_up_complete = 1 
                    AND is_active = 1
            ")['c'],
            'pending' => (int)$this->db->fetchOne("
                SELECT COUNT(*) as c 
                FROM contact_calls 
                WHERE follow_up_date IS NOT NULL 
                    AND follow_up_complete = 0 
                    AND is_active = 1
            ")['c'],
            'overdue' => (int)$this->db->fetchOne("
                SELECT COUNT(*) as c 
                FROM contact_calls 
                WHERE follow_up_date < CURDATE()
                    AND follow_up_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
                    AND follow_up_complete = 0 
                    AND is_active = 1
            ")['c'],
            'upcoming' => (int)$this->db->fetchOne("
                SELECT COUNT(*) as c 
                FROM contact_calls 
                WHERE follow_up_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY)
                    AND follow_up_complete = 0 
                    AND is_active = 1
            ")['c'],
            'completed_this_month' => (int)$this->db->fetchOne("
                SELECT COUNT(*) as c 
                FROM contact_calls 
                WHERE follow_up_date IS NOT NULL 
                    AND follow_up_complete = 1 
                    AND updated_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
                    AND is_active = 1
            ")['c']
        ];

        // Upcoming follow-ups (next 14 days) with contact details
        $stats['upcoming_followups'] = $this->db->fetchAll("
            SELECT 
                cc.id,
                cc.contact_id,
                cc.follow_up_date,
                cc.follow_up_notes,
                cc.outcome,
                cc.notes as call_notes,
                c.firstname,
                c.lastname,
                c.email,
                c.company,
                c.phone,
                DATEDIFF(cc.follow_up_date, CURDATE()) as days_until
            FROM contact_calls cc
            JOIN contacts c ON cc.contact_id = c.id
            WHERE cc.follow_up_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 14 DAY)
                AND cc.follow_up_complete = 0
                AND cc.is_active = 1
                AND c.is_active = 1
            ORDER BY cc.follow_up_date ASC, c.firstname ASC
            LIMIT 20
        ");

        // Overdue follow-ups with contact details (last 30 days only)
        $stats['overdue_followups'] = $this->db->fetchAll("
            SELECT 
                cc.id,
                cc.contact_id,
                cc.follow_up_date,
                cc.follow_up_notes,
                cc.outcome,
                cc.notes as call_notes,
                c.firstname,
                c.lastname,
                c.email,
                c.company,
                c.phone,
                ABS(DATEDIFF(CURDATE(), cc.follow_up_date)) as days_overdue
            FROM contact_calls cc
            JOIN contacts c ON cc.contact_id = c.id
            WHERE cc.follow_up_date < CURDATE()
                AND cc.follow_up_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
                AND cc.follow_up_complete = 0
                AND cc.is_active = 1
                AND c.is_active = 1
            ORDER BY cc.follow_up_date ASC, c.firstname ASC
            LIMIT 20
        ");

        return $stats;
    }

    /**
     * Get campaign-specific stats
     */
    public function getCampaignStats($campaignId)
    {
        $campaign = $this->getCampaign($campaignId);
        if (!$campaign) {
            throw new Exception('Campaign not found');
        }

        // Get send breakdown
        $sendStats = $this->db->fetchOne("
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
                SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
                SUM(CASE WHEN status = 'bounced' THEN 1 ELSE 0 END) as bounced,
                SUM(CASE WHEN opened_at IS NOT NULL THEN 1 ELSE 0 END) as opened,
                SUM(CASE WHEN clicked_at IS NOT NULL THEN 1 ELSE 0 END) as clicked,
                SUM(open_count) as total_opens,
                SUM(click_count) as total_clicks,
                MIN(sent_at) as first_sent,
                MAX(sent_at) as last_sent,
                MIN(opened_at) as first_open,
                MAX(opened_at) as last_open
            FROM email_sends es
            JOIN email_campaigns ec ON es.email_campaign_id = ec.id
            WHERE ec.campaign_id = ?
        ", [$campaignId]);

        // Calculate rates
        $totalSent = (int)($sendStats['sent'] ?? 0);
        $rates = [
            'open_rate' => $totalSent > 0
                ? round(((int)$sendStats['opened'] / $totalSent) * 100, 2)
                : 0,
            'click_rate' => $totalSent > 0
                ? round(((int)$sendStats['clicked'] / $totalSent) * 100, 2)
                : 0,
            'bounce_rate' => $totalSent > 0
                ? round(((int)$sendStats['bounced'] / $totalSent) * 100, 2)
                : 0,
            'click_to_open_rate' => (int)$sendStats['opened'] > 0
                ? round(((int)$sendStats['clicked'] / (int)$sendStats['opened']) * 100, 2)
                : 0
        ];

        // Get opens over time (hourly for recent, daily for older)
        $opensOverTime = $this->db->fetchAll("
            SELECT 
                DATE(opened_at) as date,
                HOUR(opened_at) as hour,
                COUNT(*) as opens
            FROM email_sends es
            JOIN email_campaigns ec ON es.email_campaign_id = ec.id
            WHERE ec.campaign_id = ? AND opened_at IS NOT NULL
            GROUP BY DATE(opened_at), HOUR(opened_at)
            ORDER BY date ASC, hour ASC
        ", [$campaignId]);

        // Get clicks over time
        $clicksOverTime = $this->db->fetchAll("
            SELECT 
                DATE(clicked_at) as date,
                COUNT(*) as clicks
            FROM email_sends es
            JOIN email_campaigns ec ON es.email_campaign_id = ec.id
            WHERE ec.campaign_id = ? AND clicked_at IS NOT NULL
            GROUP BY DATE(clicked_at)
            ORDER BY date ASC
        ", [$campaignId]);

        // Get top openers (contacts who opened multiple times)
        $topOpeners = $this->db->fetchAll("
            SELECT 
                c.id as contact_id, c.email, c.firstname, c.lastname, c.company,
                es.open_count, es.click_count, es.opened_at, es.clicked_at
            FROM email_sends es
            JOIN contacts c ON es.contact_id = c.id
            JOIN email_campaigns ec ON es.email_campaign_id = ec.id
            WHERE ec.campaign_id = ? AND es.opened_at IS NOT NULL
            ORDER BY es.open_count DESC, es.opened_at ASC
            LIMIT 10
        ", [$campaignId]);

        // Get top clicked links (if link tracking exists)
        $topLinks = [];
        // try {
        //     $topLinks = $this->db->fetchAll("
        //         SELECT 
        //             original_url,
        //             click_count
        //         FROM email_campaign_links
        //         WHERE campaign_id = ?
        //         ORDER BY click_count DESC
        //         LIMIT 10
        //     ", [$campaignId]);
        // } catch (Exception $e) {
        //     // Table may not exist yet
        // }

        // Get status breakdown
        $statusBreakdown = $this->db->fetchAll("
            SELECT status, COUNT(*) as count
            FROM email_sends es
            JOIN email_campaigns ec ON es.email_campaign_id = ec.id
            WHERE ec.campaign_id = ?
            GROUP BY status
        ", [$campaignId]);

        $statuses = [];
        foreach ($statusBreakdown as $row) {
            $statuses[$row['status']] = (int)$row['count'];
        }

        return [
            'campaign' => $campaign,
            'stats' => $sendStats,
            'rates' => $rates,
            'send_statuses' => $statuses,
            'opens_over_time' => $opensOverTime,
            'clicks_over_time' => $clicksOverTime,
            'top_openers' => $topOpeners,
            'top_links' => $topLinks
        ];
    }

    /**
     * Get sends for a specific campaign
     */
    public function getCampaignSends($campaignId, $filters = [])
    {
        $where = ['emc.campaign_id = ?'];
        $params = [$campaignId];

        // Status filter
        if (!empty($filters['status'])) {
            $where[] = 'es.status = ?';
            $params[] = $filters['status'];
        }

        // Opened filter
        if (isset($filters['opened'])) {
            if ($filters['opened']) {
                $where[] = 'es.opened_at IS NOT NULL';
            } else {
                $where[] = 'es.opened_at IS NULL';
            }
        }

        // Clicked filter
        if (isset($filters['clicked'])) {
            if ($filters['clicked']) {
                $where[] = 'es.clicked_at IS NOT NULL';
            } else {
                $where[] = 'es.clicked_at IS NULL';
            }
        }

        // Search filter (email or name)
        if (!empty($filters['search'])) {
            $where[] = '(ct.email LIKE ? OR ct.firstname LIKE ? OR ct.lastname LIKE ? OR emc.name LIKE ?)';
            $search = '%' . $filters['search'] . '%';
            $params[] = $search;
            $params[] = $search;
            $params[] = $search;
            $params[] = $search;
        }

        $whereClause = implode(' AND ', $where);

        // Get total count
        $countSql = "SELECT COUNT(*) as total 
                     FROM email_sends es
                     JOIN contacts ct ON es.contact_id = ct.id
                     JOIN email_campaigns emc ON es.email_campaign_id = emc.id
                     WHERE $whereClause";
        $countResult = $this->db->fetchOne($countSql, $params);
        $total = (int)$countResult['total'];

        $limit = isset($filters['limit']) ? min((int)$filters['limit'], 100) : 50;
        $offset = isset($filters['offset']) ? (int)$filters['offset'] : 0;

        $sql = "SELECT es.id, es.tracking_id, es.status, es.error_message,
                       es.sent_at, es.opened_at, es.open_count,
                       es.clicked_at, es.click_count,
                       es.user_agent, es.ip_address,
                       emc.id as email_campaign_id, emc.name as email_campaign_name,
                       ct.id as contact_id, ct.email, concat(ct.firstname, ' ', ct.lastname) as contact_name, ct.company
                FROM email_sends es
                JOIN contacts ct ON es.contact_id = ct.id
                JOIN email_campaigns emc ON es.email_campaign_id = emc.id
                WHERE $whereClause
                ORDER BY es.sent_at DESC
                LIMIT $limit OFFSET $offset";

        $sends = $this->db->fetchAll($sql, $params);

        return [
            'sends' => $sends,
            'total' => $total,
            'limit' => $limit,
            'offset' => $offset
        ];
    }

    /**
     * Get calls for a contact
     */
    public function getContactCalls(int $contactId, int $limit = 50, int $offset = 0): array
    {
        $sql = "SELECT * FROM contact_calls 
            WHERE contact_id = ? 
            AND is_active = 1
            ORDER BY called_at DESC 
            LIMIT $limit OFFSET $offset";

        $calls = $this->db->fetchAll($sql, [$contactId]);

        // Get total count
        $countSql = "SELECT COUNT(*) as total FROM contact_calls  WHERE contact_id = ? AND is_active = 1";
        $countResult = $this->db->fetchOne($countSql, [$contactId]);

        return [
            'calls' => $calls,
            'total' => (int)$countResult['total'],
            'limit' => $limit,
            'offset' => $offset
        ];
    }

    /**
     * Get a single call by ID
     */
    public function getCall(int $callId): ?array
    {
        $sql = "SELECT c.*, ec.email, concat(ec.firstname, ' ', ec.lastname) as contact_name 
            FROM contact_calls c
            JOIN contacts ec ON c.contact_id = ec.id
            WHERE c.id = ?
            AND c.is_active = 1
            ";
        return $this->db->fetchOne($sql, [$callId]);
    }

    /**
     * Log a new call
     */
    public function logCall(array $data): int
    {
        $required = ['contact_id', 'direction'];
        foreach ($required as $field) {
            if (empty($data[$field])) {
                throw new Exception("Missing required field: {$field}");
            }
        }

        // Validate direction
        if (!in_array($data['direction'], ['inbound', 'outbound'])) {
            throw new Exception("Invalid direction. Must be 'inbound' or 'outbound'");
        }

        // Validate outcome if provided
        $validOutcomes = ['answered', 'voicemail', 'no_answer', 'busy', 'wrong_number', 'callback_requested', 'other'];
        if (!empty($data['outcome']) && !in_array($data['outcome'], $validOutcomes)) {
            throw new Exception("Invalid outcome value");
        }

        //// remove all non numeric characters from phone number
        if (!empty($data['phone_number'])) {
            $data['phone_number'] = preg_replace('/\D+/', '', $data['phone_number']);
        }

        $insertData = [
            'contact_id' => (int)$data['contact_id'],
            'direction' => $data['direction'],
            'phone_number' => $data['phone_number'] ?? null,
            'duration_seconds' => isset($data['duration_seconds']) ? (int)$data['duration_seconds'] : null,
            'outcome' => $data['outcome'] ?? 'answered',
            'notes' => $data['notes'] ?? null,
            'follow_up_date' => $data['follow_up_date'] ?? null,
            'follow_up_notes' => $data['follow_up_notes'] ?? null,
            'follow_up_complete' => $data['follow_up_complete'] ?? 0,
            'called_at' => $data['called_at'] ?? date('Y-m-d H:i:s'),
            'created_by' => $data['created_by'] ?? null
        ];

        $callId = $this->db->insert('contact_calls', $insertData);

        // Update contact's last_contacted_at
        $this->db->update(
            'contacts',
            ['last_contacted_at' => $insertData['called_at']],
            'id = :id',
            ['id' => $data['contact_id']]
        );

        return $callId;
    }

    /**
     * Update a call record
     */
    public function updateCall(int $callId, array $data): bool
    {
        $allowedFields = [
            'direction',
            'phone_number',
            'duration_seconds',
            'outcome',
            'notes',
            'follow_up_date',
            'follow_up_notes',
            'follow_up_complete',
            'called_at'
        ];

        $updateData = [];
        foreach ($allowedFields as $field) {
            if (array_key_exists($field, $data)) {
                $updateData[$field] = $data[$field];
            }
        }

        if (empty($updateData)) {
            return false;
        }

        // Validate direction if provided
        if (isset($updateData['direction']) && !in_array($updateData['direction'], ['inbound', 'outbound'])) {
            throw new Exception("Invalid direction");
        }

        // Validate outcome if provided
        $validOutcomes = ['answered', 'voicemail', 'no_answer', 'busy', 'wrong_number', 'callback_requested', 'other'];
        if (isset($updateData['outcome']) && !in_array($updateData['outcome'], $validOutcomes)) {
            throw new Exception("Invalid outcome value");
        }

        return $this->db->update('contact_calls', $updateData, 'id = :id', ['id' => $callId]);
    }

    /**
     * Delete a call record
     */
    public function deleteCall(int $callId): bool
    {
        return $this->db->update('contact_calls', ['is_active' => 0, 'deleted_at' => date('Y-m-d H:i:s')], 'id = :id', ['id' => $callId]);
    }

    /**
     * Get recent calls across all contacts
     */
    public function getRecentCalls(int $limit = 20, ?string $direction = null): array
    {
        $sql = "SELECT c.*, ec.email, concat(ec.firstname, ' ', ec.lastname) as contact_name, ec.company
            FROM contact_calls c
            JOIN contacts ec ON c.contact_id = ec.id
            WHERE ec.is_active = 1
            AND c.is_active = 1";

        $params = [];

        if ($direction) {
            $sql .= " AND c.direction = ?";
            $params[] = $direction;
        }

        $sql .= " ORDER BY c.called_at DESC LIMIT ?";
        $params[] = $limit;

        return $this->db->fetchAll($sql, $params);
    }

    /**
     * Get calls with pending follow-ups
     */
    public function getPendingFollowUps(): array
    {
        $sql = "SELECT c.*, ec.email, concat(ec.firstname, ' ', ec.lastname) as contact_name, ec.company, ec.phone
            FROM contact_calls c
            JOIN contacts ec ON c.contact_id = ec.id
            WHERE c.follow_up_date IS NOT NULL 
            AND c.follow_up_date <= CURDATE()
            AND ec.is_active = 1
            AND c.is_active = 1
            ORDER BY c.follow_up_date ASC";

        return $this->db->fetchAll($sql);
    }

    /**
     * Get call statistics
     */
    public function getCallStats(?string $startDate = null, ?string $endDate = null): array
    {
        $params = [];
        $dateFilter = "";

        if ($startDate) {
            $dateFilter .= " AND called_at >= ?";
            $params[] = $startDate;
        }
        if ($endDate) {
            $dateFilter .= " AND called_at <= ?";
            $params[] = $endDate;
        }

        // Total calls by direction
        $sql = "SELECT 
                direction,
                COUNT(*) as count,
                AVG(duration_seconds) as avg_duration
            FROM contact_calls 
            WHERE is_active = 1 {$dateFilter}
            GROUP BY direction";
        $byDirection = $this->db->fetchAll($sql, $params);

        // Calls by outcome
        $sql = "SELECT 
                outcome,
                COUNT(*) as count
            FROM contact_calls 
            WHERE is_active = 1 {$dateFilter}
            GROUP BY outcome
            ORDER BY count DESC";
        $byOutcome = $this->db->fetchAll($sql, $params);

        // Calls over time (last 30 days)
        $sql = "SELECT 
                DATE(called_at) as date,
                SUM(CASE WHEN direction = 'outbound' THEN 1 ELSE 0 END) as outbound,
                SUM(CASE WHEN direction = 'inbound' THEN 1 ELSE 0 END) as inbound
            FROM contact_calls
            WHERE called_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
            AND is_active = 1
            GROUP BY DATE(called_at)
            ORDER BY date ASC";
        $overTime = $this->db->fetchAll($sql);

        // Total stats
        $sql = "SELECT 
                COUNT(*) as total_calls,
                SUM(CASE WHEN direction = 'outbound' THEN 1 ELSE 0 END) as total_outbound,
                SUM(CASE WHEN direction = 'inbound' THEN 1 ELSE 0 END) as total_inbound,
                AVG(duration_seconds) as avg_duration,
                SUM(duration_seconds) as total_duration
            FROM contact_calls
            WHERE is_active = 1 {$dateFilter}";
        $totals = $this->db->fetchOne($sql, $params);

        return [
            'totals' => $totals,
            'by_direction' => $byDirection,
            'by_outcome' => $byOutcome,
            'over_time' => $overTime
        ];
    }

    /**
     * Update contact with phone info
     */
    public function updateContactPhone(int $contactId, array $data): bool
    {
        $allowedFields = ['phone', 'phone_secondary', 'notes'];

        $updateData = [];
        foreach ($allowedFields as $field) {
            if (array_key_exists($field, $data)) {
                $updateData[$field] = $data[$field];
            }
        }

        if (empty($updateData)) {
            return false;
        }

        return $this->db->update('contacts', $updateData, 'id = ?', [$contactId]);
    }

    /**
     * Get notes for a contact
     */
    public function getContactNotes(int $contactId, int $limit = 50, int $offset = 0, bool $pinnedFirst = false): array
    {
        $orderBy = $pinnedFirst
            ? "is_pinned DESC, created_at DESC"
            : "created_at DESC";

        $sql = "SELECT *";
        $sql .= " FROM contact_notes";
        $sql .= " WHERE contact_id = ?";
        $sql .= " AND is_active = 1";
        $sql .= " ORDER BY {$orderBy}";
        $sql .= " LIMIT $limit OFFSET $offset";

        $notes = $this->db->fetchAll($sql, [$contactId]);

        // Get total count
        $countSql = "SELECT COUNT(*) as total FROM contact_notes WHERE contact_id = ? AND is_active = 1";
        $countResult = $this->db->fetchOne($countSql, [$contactId]);

        return [
            'notes' => $notes,
            'total' => (int)$countResult['total'],
            'limit' => $limit,
            'offset' => $offset
        ];
    }

    /**
     * Get a single note by ID
     */
    public function getNote(int $noteId): ?array
    {
        $sql = "SELECT n.*, c.email, concat(c.firstname, ' ', c.lastname) as contact_name 
            FROM contact_notes n
            JOIN contacts c ON n.contact_id = c.id
            WHERE n.id = ?
            AND n.is_active = 1
            ";

        return $this->db->fetchOne($sql, [$noteId]);
    }

    /**
     * Create a new note
     */
    public function createNote(array $data): int
    {
        if (empty($data['contact_id'])) {
            throw new Exception("contact_id is required");
        }

        if (empty($data['content'])) {
            throw new Exception("Note content is required");
        }

        // Validate note_type if provided
        $validTypes = ['general', 'call', 'email', 'meeting', 'follow_up', 'other'];
        if (!empty($data['note_type']) && !in_array($data['note_type'], $validTypes)) {
            throw new Exception("Invalid note_type");
        }

        $insertData = [
            'contact_id' => (int)$data['contact_id'],
            'content' => trim($data['content']),
            'note_type' => $data['note_type'] ?? 'general',
            'is_pinned' => !empty($data['is_pinned']) ? 1 : 0,
            'created_by' => $data['created_by'] ?? null
        ];

        return $this->db->insert('contact_notes', $insertData);
    }

    /**
     * Update a note
     */
    public function updateNote(int $noteId, array $data): bool
    {
        $allowedFields = ['content', 'note_type', 'is_pinned'];

        $updateData = [];
        foreach ($allowedFields as $field) {
            if (array_key_exists($field, $data)) {
                if ($field === 'is_pinned') {
                    $updateData[$field] = !empty($data[$field]) ? 1 : 0;
                } else {
                    $updateData[$field] = $data[$field];
                }
            }
        }

        if (empty($updateData)) {
            return false;
        }

        // Validate note_type if provided
        $validTypes = ['general', 'call', 'email', 'meeting', 'follow_up', 'other'];
        if (isset($updateData['note_type']) && !in_array($updateData['note_type'], $validTypes)) {
            throw new Exception("Invalid note_type");
        }

        $updateData['id'] = $noteId;

        return $this->db->update('contact_notes', $updateData, 'id = :id', []);
    }

    /**
     * Delete a note
     */
    public function deleteNote(int $id): bool
    {
        return $this->db->update('contact_notes', [
            'id' => $id,
            'is_active' => 0,
            'deleted_at' => date('Y-m-d H:i:s')
        ], 'id = :id', []);
    }

    /**
     * Toggle pin status for a note
     */
    public function toggleNotePin(int $noteId): bool
    {
        $note = $this->getNote($noteId);
        if (!$note) {
            throw new Exception("Note not found");
        }

        $newPinStatus = $note['is_pinned'] ? 0 : 1;
        return $this->db->update('contact_notes', ['id' => $noteId, 'is_pinned' => $newPinStatus], 'id = :id', []);
    }

    /**
     * Get recent notes across all contacts
     */
    public function getRecentNotes(int $limit = 20, ?string $noteType = null): array
    {
        $sql = "SELECT n.*, c.email, concat(c.firstname, ' ', c.lastname) as contact_name, c.company
            FROM contact_notes n
            JOIN contacts c ON n.contact_id = c.id
            WHERE c.is_active = 1
            AND n.is_active = 1";

        $params = [];

        if ($noteType) {
            $sql .= " AND n.note_type = ?";
            $params[] = $noteType;
        }

        $sql .= " ORDER BY n.created_at DESC LIMIT ?";
        $params[] = $limit;

        return $this->db->fetchAll($sql, $params);
    }

    /**
     * Search notes by content
     */
    public function searchNotes(string $query, int $limit = 50): array
    {
        $sql = "SELECT n.*, c.email, concat(c.firstname, ' ', c.lastname) as contact_name, c.company
            FROM contact_notes n
            JOIN contacts c ON n.contact_id = c.id
            WHERE c.is_active = 1
            AND n.is_active = 1
            AND n.content LIKE ?
            ORDER BY n.created_at DESC
            LIMIT ?";

        return $this->db->fetchAll($sql, ["%{$query}%", $limit]);
    }

// ============================================================================
// UPDATED CONTACT METHODS (rename email_contacts → contacts)
// Replace your existing contact methods with these
// ============================================================================

    /**
     * Get contacts with optional filtering
     */
    public function getContacts(array $filters = []): array
    {
        $limit = $filters['limit'] ?? 50;
        $offset = $filters['offset'] ?? 0;
        $orderBy = "ORDER BY c.created_at DESC";

        $sqlCnt = "SELECT count(*) as cnt";
        $sqlRes = "SELECT c.*,(SELECT COUNT(*) FROM email_sends WHERE contact_id = c.id) as total_emails";
        $sqlRes .= ",(SELECT COUNT(*) FROM email_sends WHERE contact_id = c.id AND opened_at IS NOT NULL) as opened_emails";
        $sqlRes .= ",(SELECT COUNT(*) FROM contact_calls WHERE contact_id = c.id AND is_active = 1) as total_calls";
        $sqlRes .= ",(SELECT COUNT(*) FROM contact_notes WHERE contact_id = c.id AND is_active = 1) as total_notes";

        $sql = " FROM contacts c";
        $sql .= " WHERE c.is_active = 1 AND c.deleted_at IS NULL";
        $params = [];

        // Search filter
        if (!empty($filters['search'])) {
            $search = '%' . $filters['search'] . '%';
            $sql .= " AND (c.email LIKE ? OR c.firstname LIKE ? OR c.lastname LIKE ? OR c.company LIKE ? OR c.phone LIKE ?)";
            $params = array_merge($params, [$search, $search, $search, $search, $search]);
        }

        // Tag filter
        if (!empty($filters['tag'])) {
            $sql .= " AND JSON_CONTAINS(c.tags, ?)";
            $params[] = json_encode($filters['tag']);
        }

        // Source filter
        if (!empty($filters['source'])) {
            $sql .= " AND c.source = ?";
            $params[] = $filters['source'];
        }

        // Subscribed filter
        if (isset($filters['subscribed'])) {
            $sql .= " AND c.is_subscribed = ?";
            $params[] = $filters['subscribed'] ? 1 : 0;
        }

        // Has phone filter
        if (!empty($filters['has_phone'])) {
            $sql .= " AND c.phone IS NOT NULL AND c.phone != ''";
        }

        // City filter
        if (!empty($filters['city'])) {
            $cityList = array_map('trim', explode(',', $filters['city']));
            //// create a comma-separated with sigle quotes for each city for SQL IN clause
            $cityList = array_map(function ($city) {
                return "'$city'";
            }, $cityList);
            $sql .= " AND c.city IN (" . implode(',', $cityList) . ")";
        }

        // State filter
        if (!empty($filters['state'])) {
            $stateList = array_map('trim', explode(',', $filters['state']));
            //// create a comma-separated with sigle quotes for each state for SQL IN clause
            $stateList = array_map(function ($state) {
                return "'$state'";
            }, $stateList);
            $sql .= " AND c.state IN (" . implode(',', $stateList) . ")";
        }

        // Last contacted filter (e.g., '2026-02-10')
        if (!empty($filters['lastContacted'])) {
            ///change this to use placeholder and param binding instead of direct variable insertion for security
            $lastContactedOnOrBefore = date('Y-m-d', strtotime($filters['lastContacted']));
            $sql .= " AND (c.last_contacted_at IS NULL OR c.last_contacted_at <= ?)";
            $params[] = $lastContactedOnOrBefore;
            $orderBy = "ORDER BY c.last_contacted_at IS NULL DESC, c.last_contacted_at DESC, c.created_at DESC";
        }

        // Get total count
        $countSql = $sqlCnt . $sql;

        $countResult = $this->db->fetchOne($countSql, $params);

        $total = (int) $countResult['cnt'];

        // Add ordering and pagination
        $sql .= " $orderBy LIMIT $limit OFFSET $offset";
        // $params[] = $limit;
        // $params[] = $offset;

        $resSql = $sqlRes . $sql;

        $contacts = $this->db->fetchAll($resSql, $params);

        // Parse tags JSON
        foreach ($contacts as &$contact) {
            $contact['tags'] = $contact['tags'] ? json_decode($contact['tags'], true) : [];
        }

        return [
            'contacts' => $contacts,
            'total' => $total,
            'limit' => $limit,
            'offset' => $offset
        ];
    }

    /**
     * Get a single contact by ID with related stats
     */
    public function getContact(int $id): ?array
    {
        $sql = "SELECT c.*,
                   (SELECT COUNT(*) FROM email_sends WHERE contact_id = c.id) as total_emails,
                   (SELECT COUNT(*) FROM email_sends WHERE contact_id = c.id AND opened_at IS NOT NULL) as opened_emails,
                   (SELECT COUNT(*) FROM contact_calls WHERE contact_id = c.id AND is_active = 1) as total_calls,
                   (SELECT COUNT(*) FROM contact_notes WHERE contact_id = c.id AND is_active = 1) as total_notes
            FROM contacts c
            WHERE c.id = ? AND c.deleted_at IS NULL";

        $contact = $this->db->fetchOne($sql, [$id]);

        if ($contact) {
            $contact['tags'] = $contact['tags'] ? json_decode($contact['tags'], true) : [];
        }

        return $contact;
    }

    /**
     * Create a new contact
     */
    public function createContact(array $data): int
    {
        // if (empty($data['email'])) {
        //     throw new Exception("Email is required");
        // }

        $email = (!empty($data['email']) && strtolower(trim($data['email'])) != '') ? strtolower(trim($data['email'])) : null;
        $phone = !empty($data['phone']) ? trim($data['phone']) : null;

        //// remove all non numeric characters from phone number
        if ($phone != null) {
            $phone = preg_replace('/\D+/', '', $phone);
        }

        // Validate email format
        if ($email != null && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            throw new Exception("Invalid email format");
        }

        // Check if email already exists (including soft-deleted)
        if ($email != null) {
            $existing = $this->db->fetchOne(
                "SELECT id, deleted_at FROM contacts WHERE email = ?",
                [$email]
            );

            if ($existing) {
                throw new Exception("A contact with this email already exists");
            }
        }

        $isSubscribed = isset($data['is_subscribed']) ? ($data['is_subscribed'] ? 1 : 0) : 1;

        if ($email == null) {
            $isSubscribed = 0; // Cannot subscribe without email
        }

        /// check if phone already exists
        if ($phone != null) {
            $existingPhone = $this->db->fetchOne(
                "SELECT id FROM contacts WHERE phone = ?",
                [$phone]
            );
            if ($existingPhone) {
                throw new Exception("A contact with this phone number already exists");
            }
        }

        $insertData = [
            'email' => $email,
            'firstname' => $data['firstname'] ?? null,
            'lastname' => $data['lastname'] ?? null,
            'city' => $data['city'] ?? null,
            'state' => $data['state'] ?? null,
            'company' => $data['company'] ?? null,
            'website' => $data['website'] ?? null,
            'phone' => $phone,
            'tags' => !empty($data['tags']) ? json_encode($data['tags']) : null,
            'source' => $data['source'] ?? 'manual',
            'is_subscribed' => $isSubscribed,
            'subscribed_at' => date('Y-m-d H:i:s')
        ];

        return $this->db->insert('contacts', $insertData);
    }

    /**
     * Update a contact
     */
    public function updateContact(int $id, array $data): bool
    {
        $allowedFields = [
            'email',
            'firstname',
            'lastname',
            'city',
            'state',
            'company',
            'website',
            'phone',
            'tags',
            'source',
            'is_subscribed'
        ];

        $updateData = [];
        $email = null;
        foreach ($allowedFields as $field) {
            if (array_key_exists($field, $data)) {
                if ($field === 'tags') {
                    $updateData[$field] = is_array($data[$field]) ? json_encode($data[$field]) : $data[$field];
                } elseif ($field === 'email') {
                    $email = ($data[$field] !== null && strtolower(trim($data[$field])) != '') ? strtolower(trim($data[$field])) : null;

                    //// check if email already exists
                    if ($email != null) {
                        $existing = $this->db->fetchOne(
                            "SELECT id FROM contacts WHERE email = ? AND id != ? AND deleted_at IS NULL",
                            [$email, $id]
                        );
                        if ($existing) {
                            throw new Exception("A contact with this email already exists");
                        }
                    }
                    $updateData[$field] = $email;
                } elseif ($field === 'is_subscribed') {
                    $updateData[$field] = ($data[$field] && $email != null) ? 1 : 0;
                    if (!$data[$field]) {
                        $updateData['unsubscribed_at'] = date('Y-m-d H:i:s');
                    }
                } else if ($field === 'phone') {
                    $phone = ($data[$field] !== null && trim($data[$field]) != '') ? trim($data[$field]) : null;

                    //// check if phone already exists
                    if ($phone != null) {
                        $existing = $this->db->fetchOne(
                            "SELECT id FROM contacts WHERE phone = ? AND id != ? AND deleted_at IS NULL",
                            [$phone, $id]
                        );
                        if ($existing) {
                            throw new Exception("A contact with this phone number already exists");
                        }
                    }
                    $updateData[$field] = $phone;
                } else {
                    $updateData[$field] = $data[$field];
                }
            }
        }

        if (empty($updateData)) {
            return false;
        }

        // If email is being changed, check it doesn't already exist
        if (isset($updateData['email'])) {
            $existing = $this->db->fetchOne(
                "SELECT id FROM contacts WHERE email = ? AND id != ? AND deleted_at IS NULL",
                [$updateData['email'], $id]
            );
            if ($existing) {
                throw new Exception("A contact with this email already exists");
            }
        }

        return $this->db->update('contacts', $updateData, 'id = :id', ['id' => $id]);
    }

    /**
     * Soft delete a contact
     */
    public function deleteContact(int $id): bool
    {
        return $this->db->update('contacts', [
            'id' => $id,
            'is_active' => 0,
            'deleted_at' => date('Y-m-d H:i:s')
        ], 'id = :id', []);
    }

    /**
     * Get contacts who have NOT been sent an email for a specific campaign
     * 
     * @param int $campaignId The campaign ID
     * @param array $filters Optional filters
     * @return array
     */
    public function getContactsNotSentForCampaign(int $campaignId, array $filters = []): array
    {
        // Verify campaign exists
        $campaignSql = "SELECT id, name, status
                    FROM campaigns
                    WHERE id = :campaign_id";

        $campaign = $this->db->fetchOne($campaignSql, ['campaign_id' => $campaignId]);

        if (!$campaign) {
            throw new Exception("Campaign not found");
        }

        // Extract filters with defaults
        $subscribedOnly = $filters['subscribed_only'] ?? true;
        $tag = $filters['tag'] ?? null;
        $source = $filters['source'] ?? null;
        $search = $filters['search'] ?? null;
        $hasPhone = $filters['has_phone'] ?? null;
        $limit = (int)($filters['limit'] ?? 50);
        $offset = (int)($filters['offset'] ?? 0);
        $city = $filters['city'] ?? null;
        $state = $filters['state'] ?? null;

        // Build WHERE clauses
        $whereClauses = [
            "c.is_active = 1",
            "c.deleted_at IS NULL",
            "NOT EXISTS (
                SELECT 1
                FROM email_sends es
                JOIN email_campaigns ec ON es.email_campaign_id = ec.id
                WHERE es.contact_id = c.id
                  AND ec.campaign_id = :campaign_id
            )"
        ];
        $params = ['campaign_id' => $campaignId];

        if ($subscribedOnly) {
            $whereClauses[] = "c.is_subscribed = 1";
        }

        if ($tag) {
            $whereClauses[] = "JSON_CONTAINS(c.tags, :tag)";
            $params['tag'] = json_encode($tag);
        }

        if ($source) {
            $whereClauses[] = "c.source = :source";
            $params['source'] = $source;
        }

        if ($hasPhone !== null) {
            $whereClauses[] = $hasPhone
                ? "(c.phone IS NOT NULL AND c.phone != '')"
                : "(c.phone IS NULL OR c.phone = '')";
        }

        if ($search) {
            $whereClauses[] = "(c.firstname LIKE :search OR c.lastname LIKE :search OR c.email LIKE :search OR c.company LIKE :search)";
            $params['search'] = "%{$search}%";
        }

        if ($city) {
            $cityList = array_map('trim', explode(',', $city));
            /// convert cityList to coma separated string with quotes for SQL IN clause
            $cityString = "'" . implode("','", $cityList) . "'";
            $whereClauses[] = "c.city IN ($cityString)";
        }

        if ($state) {
            $stateList = array_map('trim', explode(',', $state));
            $stateString = "'" . implode("','", $stateList) . "'";
            $whereClauses[] = "c.state IN ($stateString)";
        }

        $whereString = implode(' AND ', $whereClauses);

        // Count total
        $countSql = "
        SELECT COUNT(*) as total
        FROM contacts c
        WHERE {$whereString}
    ";
        $countResult = $this->db->fetchOne($countSql, $params);
        $total = (int)($countResult['total'] ?? 0);

        // Fetch contacts
        $sql = "
        SELECT 
            c.id,
            c.email,
            c.firstname,
            c.lastname,
            c.company,
            c.city,
            c.state,
            c.phone,
            c.tags,
            c.source,
            c.is_subscribed,
            c.last_contacted_at,
            c.created_at
        FROM contacts c
        WHERE {$whereString}
        ORDER BY c.last_contacted_at DESC, c.created_at ASC
        LIMIT $limit OFFSET $offset
    ";

        // $params['limit'] = $limit;
        // $params['offset'] = $offset;

        $contacts = $this->db->fetchAll($sql, $params);

        // Parse JSON tags
        foreach ($contacts as &$contact) {
            $contact['tags'] = !empty($contact['tags'])
                ? json_decode($contact['tags'], true)
                : [];
        }

        return [
            'contacts' => $contacts,
            'total' => $total,
            'limit' => $limit,
            'offset' => $offset,
            'campaign' => $campaign,
            'filters_applied' => array_filter([
                'subscribed_only' => $subscribedOnly,
                'tag' => $tag,
                'source' => $source,
                'search' => $search,
                'has_phone' => $hasPhone
            ], fn($v) => $v !== null)
        ];
    }

    public function trackClick($linkId, $contactId)
    {
        //// Insert into campaign_contract_link_clicks
        $this->db->insert('campaign_contact_link_clicks', [
            'contact_id' => $contactId,
            'email_campaign_link_id' => $linkId,
            'clicked_at' => date('Y-m-d H:i:s')
        ]);

        //// get campaign id
        $sql = "SELECT email_campaign_id FROM email_campaign_links WHERE id = ?";
        $result = $this->db->fetchOne($sql, [$linkId]);
        if (!$result) {
            throw new Exception("Link not found");
        }
        $campaignId = $result['email_campaign_id'];

        $this->db->query(
            "UPDATE email_campaigns SET total_clicked = total_clicked + 1 WHERE id = ?",
            [$campaignId]
        );

        /// get link_name
        $sql = "SELECT link_name FROM email_campaign_links WHERE id = ?";
        $result = $this->db->fetchOne($sql, [$linkId]);
        $linkName = $result['link_name'] ?? 'Unknown Link';

        $this->sendNotificationEmail($campaignId, $contactId, 'clicked - ' . $linkName);

        return true;
    }

    function sendNotificationEmail($campaignId, $contactId, $type)
    {
        // Send email notification to admin about open
        $this->logger->info("Sending notification email for contact_id: {$contactId}, campaign_id: {$campaignId}, type: {$type}");
        $contact = $this->getContact($contactId);
        $this->logger->info("Contact details: " . print_r($contact, true));
        $campaignSql = "SELECT id, name FROM email_campaigns WHERE id = ?";
        $campaign = $this->db->fetchOne($campaignSql, [$campaignId]);

        $subject = "Notification: Type {$type} campaign '{$campaign['name']}'";

        $message = "
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset='UTF-8'>
    </head>
    <body style='font-family: Arial, sans-serif; line-height: 1.6; color: #333;'>
        <div style='max-width: 600px; margin: 0 auto; padding: 20px;'>
            <h2 style='color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px;'>
                Contact Activity Notification
            </h2>
            
            <p><strong>Contact Details:</strong></p>
            
            <table style='width: 100%; border-collapse: collapse;'>
                <tr>
                    <td style='padding: 8px; background-color: #f8f9fa;'><strong>Contact ID:</strong></td>
                    <td style='padding: 8px;'>{$contact['id']}</td>
                </tr>
                <tr>
                    <td style='padding: 8px; background-color: #f8f9fa;'><strong>Email:</strong></td>
                    <td style='padding: 8px;'>{$contact['email']}</td>
                </tr>
                <tr>
                    <td style='padding: 8px; background-color: #f8f9fa;'><strong>Company:</strong></td>
                    <td style='padding: 8px;'>{$contact['company']}</td>
                </tr>
                <tr>
                    <td style='padding: 8px; background-color: #f8f9fa;'><strong>Action:</strong></td>
                    <td style='padding: 8px;'><span style='color: #e74c3c; font-weight: bold;'>{$type}</span></td>
                </tr>
                <tr>
                    <td style='padding: 8px; background-color: #f8f9fa;'><strong>Campaign ID:</strong></td>
                    <td style='padding: 8px;'>{$campaign['id']}</td>
                </tr>
                <tr>
                    <td style='padding: 8px; background-color: #f8f9fa;'><strong>Campaign:</strong></td>
                    <td style='padding: 8px;'>{$campaign['name']}</td>
                </tr>
                <tr>
                    <td style='padding: 8px; background-color: #f8f9fa;'><strong>Time:</strong></td>
                    <td style='padding: 8px;'>" . date('Y-m-d H:i:s') . "</td>
                </tr>
            </table>
        </div>
    </body>
    </html>
    ";


        $emailResult = $this->sendEmail([
            'to_email' => $_ENV['CONTACT_EMAIL'],
            'from_email' => $_ENV['FROM_EMAIL'],
            'from_name' => $_ENV['FROM_NAME'],
            'to_name' => 'Admin',
            'subject' => $subject,
            'content' => $message,
            'content_type' => 'text/html'
        ]);

        $this->logger->info("Notification email sent: " . print_r($emailResult, true));

        return;
    }

    function getDuplicateContacts($contact_id = null, $email = null, $phone = null)
    {
        $dups = [];

        if ($email && $phone) {
            $sql = "SELECT id, email, phone, firstname, lastname, company, is_subscribed, last_contacted_at FROM contacts WHERE (email = ? OR phone = ?)";
            if ($contact_id) {
                $sql .= " AND id != ?";
                $dups = $this->db->fetchAll($sql, [trim($email), trim($phone), trim($contact_id)]);
            } else {
                $dups = $this->db->fetchAll($sql, [trim($email), trim($phone)]);
            }
        } else if ($email) {
            $sql = "SELECT id, email, phone, firstname, lastname, company, is_subscribed, last_contacted_at FROM contacts WHERE email = ?";

            if ($contact_id) {
                $sql .= " AND id != ?";
                $dups = $this->db->fetchAll($sql, [trim($email), trim($contact_id)]);
            } else {
                $dups = $this->db->fetchAll($sql, [trim($email)]);
            }
        } else if ($phone) {
            $sql = "SELECT id, email, phone, firstname, lastname, company, is_subscribed, last_contacted_at FROM contacts WHERE phone = ?";
            if ($contact_id) {
                $sql .= " AND id != ?";
                $dups = $this->db->fetchAll($sql, [trim($phone), trim($contact_id)]);
            } else {
                $dups = $this->db->fetchAll($sql, [trim($phone)]);
            }
        }
        return $dups;
    }

    function getCampaignEmails($campaignId)
    {
        $sql = "SELECT * FROM email_campaigns WHERE campaign_id = ? ORDER BY created_at DESC";
        $campaigns = $this->db->fetchAll($sql, [trim($campaignId)]);

        foreach ($campaigns as &$campaign) {
            $campaign['use_tracking'] = !empty($campaign['track']);
        }

        return ['campaigns' => $campaigns];
    }

    function createEmailCampaign($campaignId, array $data)
    {
        if (empty($data['name'])) {
            throw new Exception("Campaign name is required");
        }

        if (empty($data['subject'])) {
            throw new Exception("Campaign subject is required");
        }

        $campaign = $this->getCampaign((int) $campaignId);
        if (!$campaign) {
            throw new Exception("Campaign not found");
        }

        $validStatuses = ['draft', 'scheduled', 'sending', 'sent', 'paused', 'cancelled'];
        $status = $data['status'] ?? 'draft';
        if (!in_array($status, $validStatuses, true)) {
            throw new Exception("Invalid email campaign status");
        }

        $insertData = [
            'campaign_id' => $campaignId,
            'name' => trim($data['name']),
            'subject' => trim($data['subject']),
            'preview_text' => $data['preview_text'] ?? null,
            'content' => $data['content'] ?? null,
            'send_plain_text' => array_key_exists('send_plain_text', $data)
                ? (!empty($data['send_plain_text']) ? 1 : 0)
                : 1,
            'from_name' => $data['from_name'] ?? null,
            'from_email' => $data['from_email'] ?? null,
            'reply_to' => $data['reply_to'] ?? null,
            'track' => !empty($data['use_tracking']) ? 1 : 0,
            'status' => $status,
            'scheduled_at' => $data['scheduled_at'] ?? null,
            'created_by' => $data['created_by'] ?? null
        ];



        $emailCampainId = $this->db->insert('email_campaigns', $insertData);

        foreach ($data['links'] ?? [] as $link) {
            $linkUrl = trim((string) ($link['link_url'] ?? ''));
            if ($linkUrl === '') {
                continue;
            }

            $this->db->insert('email_campaign_links', [
                'email_campaign_id' => $emailCampainId,
                'link_name' => isset($link['link_name']) ? trim((string) $link['link_name']) : null,
                'link_url' => $linkUrl
            ]);
        }

        return $emailCampainId;
    }

    function getCampaignEmailById($id)
    {
        $sql = "SELECT * FROM email_campaigns WHERE id = ?";
        $campaign = $this->db->fetchOne($sql, [trim($id)]);
        if ($campaign) {
            $campaign['use_tracking'] = !empty($campaign['track']);
            $linksSql = "SELECT id, link_name, link_url FROM email_campaign_links WHERE email_campaign_id = ?";
            $campaign['links'] = $this->db->fetchAll($linksSql, [trim($id)]);
        }
        return $campaign;
    }

    function updateEmailCampaign($id, array $data)
    {
        $allowedFields = ['name', 'subject', 'content', 'status', 'preview_text', 'from_name', 'from_email', 'reply_to', 'use_tracking', 'send_plain_text', 'scheduled_at'];
        $validStatuses = ['draft', 'scheduled', 'sending', 'sent', 'paused', 'cancelled'];

        $updateData = [];
        foreach ($allowedFields as $field) {
            if (array_key_exists($field, $data)) {
                if ($field === 'use_tracking') {
                    $updateData['track'] = !empty($data[$field]) ? 1 : 0;
                } elseif ($field === 'send_plain_text') {
                    $updateData[$field] = !empty($data[$field]) ? 1 : 0;
                } elseif ($field === 'status') {
                    if (!in_array($data[$field], $validStatuses, true)) {
                        throw new Exception("Invalid email campaign status");
                    }
                    $updateData[$field] = $data[$field];
                } else {
                    $updateData[$field] = is_string($data[$field])
                        ? trim($data[$field])
                        : $data[$field];
                }
            }
        }

        if (empty($updateData)) {
            return false;
        }

        $result = $this->db->update('email_campaigns', $updateData, 'id = :id', ['id' => $id]);

        if (isset($data['links'])) {
            // For simplicity, delete existing links and re-insert
            $this->db->query("DELETE FROM email_campaign_links WHERE email_campaign_id = ?", [trim($id)]);

            foreach ($data['links'] as $link) {
                $linkUrl = trim((string) ($link['link_url'] ?? ''));
                if ($linkUrl === '') {
                    continue;
                }

                $this->db->insert('email_campaign_links', [
                    'email_campaign_id' => $id,
                    'link_name' => isset($link['link_name']) ? trim((string) $link['link_name']) : null,
                    'link_url' => $linkUrl
                ]);
            }
        }

        return $result;
    }

    function deleteEmailCampaign(int $id): bool
    {
        $campaign = $this->getCampaignEmailById($id);
        if (!$campaign) {
            throw new Exception("Email campaign not found");
        }

        if (($campaign['status'] ?? 'draft') !== 'draft') {
            throw new Exception("Only draft email campaigns can be deleted");
        }

        return (bool) $this->db->delete('email_campaigns', 'id = ?', [$id]);
    }

    function contactEmailSends(int $contactId, int $limit = 50, int $offset = 0): array
    {
        $sql = "SELECT es.*, ec.id as email_campaign_id, ec.name as email_campaign_name, c.id as campaign_id, c.name as campaign_name
            FROM email_sends es
            JOIN email_campaigns ec ON es.email_campaign_id = ec.id
            JOIN campaigns c ON ec.campaign_id = c.id
            WHERE es.contact_id = ?
            ORDER BY es.sent_at DESC
            LIMIT $limit OFFSET $offset";

        return $this->db->fetchAll($sql, [$contactId]);
    }

    function getContactsNotSentForEmailCampaign(int $emailCampaignId, array $filters = []): array
    {
        // Verify campaign exists
        $campaignSql = "SELECT id, name, subject, status, total_sent, total_recipients 
                    FROM email_campaigns 
                    WHERE id = :email_campaign_id";

        $emailCampaign = $this->db->fetchOne($campaignSql, ['email_campaign_id' => $emailCampaignId]);

        if (!$emailCampaign) {
            throw new Exception("Email campaign not found");
        }

        // Extract filters with defaults
        $subscribedOnly = $filters['subscribed_only'] ?? true;
        $tag = $filters['tag'] ?? null;
        $source = $filters['source'] ?? null;
        $search = $filters['search'] ?? null;
        $hasPhone = $filters['has_phone'] ?? null;
        $limit = (int)($filters['limit'] ?? 50);
        $offset = (int)($filters['offset'] ?? 0);
        $city = $filters['city'] ?? null;
        $state = $filters['state'] ?? null;

        // Build WHERE clauses
        $whereClauses = [
            "c.is_active = 1",
            "c.deleted_at IS NULL",
            "es.id IS NULL"  // No send record for this campaign
        ];
        $params = ['email_campaign_id' => $emailCampaignId];

        if ($subscribedOnly) {
            $whereClauses[] = "c.is_subscribed = 1";
        }

        if ($tag) {
            $whereClauses[] = "JSON_CONTAINS(c.tags, :tag)";
            $params['tag'] = json_encode($tag);
        }

        if ($source) {
            $whereClauses[] = "c.source = :source";
            $params['source'] = $source;
        }

        if ($hasPhone !== null) {
            $whereClauses[] = $hasPhone
                ? "(c.phone IS NOT NULL AND c.phone != '')"
                : "(c.phone IS NULL OR c.phone = '')";
        }

        if ($search) {
            $whereClauses[] = "(c.firstname LIKE :search OR c.lastname LIKE :search OR c.email LIKE :search OR c.company LIKE :search)";
            $params['search'] = "%{$search}%";
        }

        if ($city) {
            $cityList = array_map('trim', explode(',', $city));
            /// convert cityList to coma separated string with quotes for SQL IN clause
            $cityString = "'" . implode("','", $cityList) . "'";
            $whereClauses[] = "c.city IN ($cityString)";
        }

        if ($state) {
            $stateList = array_map('trim', explode(',', $state));
            $stateString = "'" . implode("','", $stateList) . "'";
            $whereClauses[] = "c.state IN ($stateString)";
        }

        $whereString = implode(' AND ', $whereClauses);

        // Count total
        $countSql = "
        SELECT COUNT(*) as total
        FROM contacts c
        LEFT JOIN email_sends es ON c.id = es.contact_id AND es.email_campaign_id = :email_campaign_id
        WHERE {$whereString}
    ";
        $countResult = $this->db->fetchOne($countSql, $params);
        $total = (int)($countResult['total'] ?? 0);

        // Fetch contacts
        $sql = "
        SELECT 
            c.id,
            c.email,
            c.firstname,
            c.lastname,
            c.company,
            c.city,
            c.state,
            c.phone,
            c.tags,
            c.source,
            c.is_subscribed,
            c.last_contacted_at,
            c.created_at
        FROM contacts c
        LEFT JOIN email_sends es ON c.id = es.contact_id AND es.email_campaign_id = :email_campaign_id
        WHERE {$whereString}
        ORDER BY c.last_contacted_at DESC, c.created_at ASC
        LIMIT $limit OFFSET $offset
    ";

        // $params['limit'] = $limit;
        // $params['offset'] = $offset;

        $contacts = $this->db->fetchAll($sql, $params);

        // Parse JSON tags
        foreach ($contacts as &$contact) {
            $contact['tags'] = !empty($contact['tags'])
                ? json_decode($contact['tags'], true)
                : [];
        }

        return [
            'contacts' => $contacts,
            'total' => $total,
            'limit' => $limit,
            'offset' => $offset,
            'email_campaign' => $emailCampaign,
            'filters_applied' => array_filter([
                'subscribed_only' => $subscribedOnly,
                'tag' => $tag,
                'source' => $source,
                'search' => $search,
                'has_phone' => $hasPhone
            ], fn($v) => $v !== null)
        ];
    }

    function getEmailCampaign($campaignId, $emailCampaignId)
    {
        if ($emailCampaignId === null) {
            $legacyCampaign = $this->getCampaignEmailById((int) $campaignId);
            if ($legacyCampaign) {
                return $legacyCampaign;
            }

            return null;
        }

        $emailCampaign = $this->db->fetchOne(
            "SELECT ec.*
            FROM email_campaigns ec
            JOIN campaigns c ON ec.campaign_id = c.id and c.id = ?
             WHERE ec.id = ?",
            [$campaignId, $emailCampaignId]
        );

        if ($emailCampaign) {
            $emailCampaign['use_tracking'] = !empty($emailCampaign['track']);
            $linksSql = "SELECT id, link_name, link_url FROM email_campaign_links WHERE email_campaign_id = ?";
            $emailCampaign['links'] = $this->db->fetchAll($linksSql, [trim($emailCampaign['id'])]);
        }

        return $emailCampaign ?: null;
    }

    function getEmailCampaignById($emailCampaignId)
    {
        $emailCampaign = $this->db->fetchOne(
            "SELECT ec.id as email_campaign_id,
                    ec.name as email_campaign_name,
                    ec.subject as email_campaign_subject,
                    ec.preview_text as email_campaign_preview_text,
                    ec.content as email_campaign_content,
                    ec.send_plain_text,
                    ec.from_name as email_campaign_from_name,
                    ec.from_email as email_campaign_from_email,
                    ec.reply_to as email_campaign_reply_to,
                    ec.track as email_campaign_track,
                    ec.status as email_campaign_status,
                    ec.scheduled_at,
                    ec.started_at,
                    ec.completed_at,
                    ec.total_recipients,
                    ec.total_sent,
                    ec.total_opened,
                    ec.total_clicked,
                    ec.total_bounced,
                    ec.total_unsubscribed,
                    ec.created_at,
                    ec.updated_at,
                    c.id as campaign_id,
                    c.name as campaign_name
            FROM email_campaigns ec 
            JOIN campaigns c ON ec.campaign_id = c.id
            WHERE ec.id = ?",
            [$emailCampaignId]
        );

        $emailCampaignId = $emailCampaign['email_campaign_id'] ?? null;

        /// Add links to campaign
        if ($emailCampaignId) {
            $linksSql = "SELECT id, link_name, link_url FROM email_campaign_links WHERE email_campaign_id = ?";
            $emailCampaign['links'] = $this->db->fetchAll($linksSql, [trim($emailCampaignId)]);
            $emailCampaign['use_tracking'] = !empty($emailCampaign['email_campaign_track']);
        }

        return $emailCampaign ?: null;
    }

    /**
     * Get campaign-specific stats
     */
    public function getEmailCampaignStats($emailCampaignId)
    {
        $emailCampaign = $this->getEmailCampaignById($emailCampaignId);
        if (!$emailCampaign) {
            throw new Exception('Email campaign not found');
        }

        // Get send breakdown
        $sendStats = $this->db->fetchOne("
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
                SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
                SUM(CASE WHEN status = 'bounced' THEN 1 ELSE 0 END) as bounced,
                SUM(CASE WHEN opened_at IS NOT NULL THEN 1 ELSE 0 END) as opened,
                SUM(CASE WHEN clicked_at IS NOT NULL THEN 1 ELSE 0 END) as clicked,
                SUM(open_count) as total_opens,
                SUM(click_count) as total_clicks,
                MIN(sent_at) as first_sent,
                MAX(sent_at) as last_sent,
                MIN(opened_at) as first_open,
                MAX(opened_at) as last_open
            FROM email_sends
            WHERE email_campaign_id = ?
        ", [$emailCampaignId]);

        // Calculate rates
        $totalSent = (int)($sendStats['sent'] ?? 0);
        $rates = [
            'open_rate' => $totalSent > 0
                ? round(((int)$sendStats['opened'] / $totalSent) * 100, 2)
                : 0,
            'click_rate' => $totalSent > 0
                ? round(((int)$sendStats['clicked'] / $totalSent) * 100, 2)
                : 0,
            'bounce_rate' => $totalSent > 0
                ? round(((int)$sendStats['bounced'] / $totalSent) * 100, 2)
                : 0,
            'click_to_open_rate' => (int)$sendStats['opened'] > 0
                ? round(((int)$sendStats['clicked'] / (int)$sendStats['opened']) * 100, 2)
                : 0
        ];

        // Get opens over time (hourly for recent, daily for older)
        $opensOverTime = $this->db->fetchAll("
            SELECT 
                DATE(opened_at) as date,
                HOUR(opened_at) as hour,
                COUNT(*) as opens
            FROM email_sends
            WHERE email_campaign_id = ? AND opened_at IS NOT NULL
            GROUP BY DATE(opened_at), HOUR(opened_at)
            ORDER BY date ASC, hour ASC
        ", [$emailCampaignId]);

        // Get clicks over time
        $clicksOverTime = $this->db->fetchAll("
            SELECT 
                DATE(clicked_at) as date,
                COUNT(*) as clicks
            FROM email_sends
            WHERE email_campaign_id = ? AND clicked_at IS NOT NULL
            GROUP BY DATE(clicked_at)
            ORDER BY date ASC
        ", [$emailCampaignId]);

        // Get top openers (contacts who opened multiple times)
        $topOpeners = $this->db->fetchAll("
            SELECT 
                ec.id as contact_id, ec.email, ec.firstname, ec.lastname, ec.company,
                es.open_count, es.click_count, es.opened_at, es.clicked_at
            FROM email_sends es
            JOIN contacts ec ON es.contact_id = ec.id
            WHERE es.email_campaign_id = ? AND es.opened_at IS NOT NULL
            ORDER BY es.open_count DESC, es.opened_at ASC
            LIMIT 10
        ", [$emailCampaignId]);

        // Get top clicked links (if link tracking exists)
        $topLinks = [];
        // try {
        //     $topLinks = $this->db->fetchAll("
        //         SELECT 
        //             original_url,
        //             click_count
        //         FROM email_campaign_links
        //         WHERE campaign_id = ?
        //         ORDER BY click_count DESC
        //         LIMIT 10
        //     ", [$campaignId]);
        // } catch (Exception $e) {
        //     // Table may not exist yet
        // }

        // Get status breakdown
        $statusBreakdown = $this->db->fetchAll("
            SELECT status, COUNT(*) as count
            FROM email_sends
            WHERE email_campaign_id = ?
            GROUP BY status
        ", [$emailCampaignId]);

        $statuses = [];
        foreach ($statusBreakdown as $row) {
            $statuses[$row['status']] = (int)$row['count'];
        }

        return [
            'email_campaign' => $emailCampaign,
            'stats' => $sendStats,
            'rates' => $rates,
            'send_statuses' => $statuses,
            'opens_over_time' => $opensOverTime,
            'clicks_over_time' => $clicksOverTime,
            'top_openers' => $topOpeners,
            'top_links' => $topLinks
        ];
    }

    public function createContactEmailSend($contactId, $emailCampaignId, $type = 'manual', $status = 'sent')
    {
        /// First make sure record doesn't already exist for this contact and campaign
        $existing = $this->db->fetchOne(
            "SELECT id FROM email_sends WHERE contact_id = ? AND email_campaign_id = ?",
            [$contactId, $emailCampaignId]
        );

        if ($existing) {
            throw new Exception("Email send record already exists for this contact and campaign");
        }

        $sendData = [
            'contact_id' => $contactId,
            'email_campaign_id' => $emailCampaignId,
            'type' => $type,
            'status' => $status,
            'sent_at' => date('Y-m-d H:i:s')
        ];

        return $this->db->insert('email_sends', $sendData);
    }
}
