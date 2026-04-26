-- ============================================================================
-- CAMPAIGN SEND QUEUE
-- Jobs are queued by POST /api/marketing/campaigns/{id}/send; a cron worker
-- processes them and stores results here and in email_sends.
-- ============================================================================

CREATE TABLE IF NOT EXISTS campaign_send_queue (
    id INT AUTO_INCREMENT PRIMARY KEY,
    campaign_id INT NOT NULL,
    contact_ids JSON DEFAULT NULL COMMENT 'Optional: send only to these contact IDs',
    filters JSON DEFAULT NULL COMMENT 'Optional: tag, source, subscribed_only when contact_ids not used',
    status ENUM('queued', 'sending', 'sent', 'failed') NOT NULL DEFAULT 'queued',
    total_recipients INT DEFAULT 0,
    total_sent INT DEFAULT 0,
    total_failed INT DEFAULT 0,
    error_summary JSON DEFAULT NULL COMMENT 'Array of {contact_id, email, error} for failures',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    started_at DATETIME DEFAULT NULL,
    completed_at DATETIME DEFAULT NULL,

    INDEX idx_campaign_id (campaign_id),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at),
    INDEX idx_status_created (status, created_at),

    FOREIGN KEY (campaign_id) REFERENCES email_campaigns(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE `ochoworksdesigns`.`contacts` 
CHANGE COLUMN `email` `email` VARCHAR(255) NULL ,
DROP INDEX `idx_email` ;
;

ALTER TABLE contacts
ADD COLUMN address VARCHAR(255) NULL AFTER company,
ADD COLUMN city VARCHAR(100) NULL AFTER address,
ADD COLUMN state VARCHAR(100) NULL AFTER city,
ADD COLUMN zip VARCHAR(20) NULL AFTER state,
ADD COLUMN country VARCHAR(100) NULL AFTER zip;