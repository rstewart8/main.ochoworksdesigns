-- Email Marketing Integration Migration
-- Run this migration to add email marketing capabilities to your architectural app

-- =====================================================
-- CONTACTS/SUBSCRIBERS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS email_contacts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    company VARCHAR(255),
    tags JSON DEFAULT NULL,
    source VARCHAR(50) DEFAULT 'manual',
    is_subscribed TINYINT(1) DEFAULT 1,
    is_active TINYINT(1) DEFAULT 1,
    subscribed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    unsubscribed_at DATETIME DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE INDEX idx_email (email),
    INDEX idx_is_active (is_active),
    INDEX idx_is_subscribed (is_subscribed),
    INDEX idx_source (source),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- CAMPAIGNS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS email_campaigns (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    subject VARCHAR(500) NOT NULL,
    preview_text VARCHAR(255) DEFAULT NULL,
    content LONGTEXT,
    from_name VARCHAR(255) DEFAULT NULL,
    from_email VARCHAR(255) DEFAULT NULL,
    reply_to VARCHAR(255) DEFAULT NULL,
    status ENUM('draft', 'scheduled', 'sending', 'sent', 'paused', 'cancelled') DEFAULT 'draft',
    scheduled_at DATETIME DEFAULT NULL,
    started_at DATETIME DEFAULT NULL,
    completed_at DATETIME DEFAULT NULL,
    total_recipients INT DEFAULT 0,
    total_sent INT DEFAULT 0,
    total_opened INT DEFAULT 0,
    total_clicked INT DEFAULT 0,
    total_bounced INT DEFAULT 0,
    total_unsubscribed INT DEFAULT 0,
    created_by INT DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_status (status),
    INDEX idx_created_at (created_at),
    INDEX idx_scheduled_at (scheduled_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- EMAIL SENDS TABLE (tracks individual email sends)
-- =====================================================
CREATE TABLE IF NOT EXISTS email_sends (
    id INT AUTO_INCREMENT PRIMARY KEY,
    campaign_id INT NOT NULL,
    contact_id INT NOT NULL,
    tracking_id VARCHAR(64) NOT NULL,
    status ENUM('pending', 'sent', 'failed', 'bounced', 'complained') DEFAULT 'pending',
    error_message TEXT DEFAULT NULL,
    sent_at DATETIME DEFAULT NULL,
    opened_at DATETIME DEFAULT NULL,
    open_count INT DEFAULT 0,
    clicked_at DATETIME DEFAULT NULL,
    click_count INT DEFAULT 0,
    user_agent VARCHAR(500) DEFAULT NULL,
    ip_address VARCHAR(45) DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE INDEX idx_tracking_id (tracking_id),
    INDEX idx_campaign_id (campaign_id),
    INDEX idx_contact_id (contact_id),
    INDEX idx_status (status),
    INDEX idx_sent_at (sent_at),
    INDEX idx_opened_at (opened_at),
    
    FOREIGN KEY (campaign_id) REFERENCES email_campaigns(id) ON DELETE CASCADE,
    FOREIGN KEY (contact_id) REFERENCES email_contacts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- CAMPAIGN LINKS TABLE (for click tracking)
-- =====================================================
CREATE TABLE IF NOT EXISTS email_campaign_links (
    id INT AUTO_INCREMENT PRIMARY KEY,
    campaign_id INT NOT NULL,
    original_url VARCHAR(2048) NOT NULL,
    tracking_code VARCHAR(64) NOT NULL,
    click_count INT DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE INDEX idx_tracking_code (tracking_code),
    INDEX idx_campaign_id (campaign_id),
    
    FOREIGN KEY (campaign_id) REFERENCES email_campaigns(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- LINK CLICKS TABLE (individual click tracking)
-- =====================================================
CREATE TABLE IF NOT EXISTS email_link_clicks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    link_id INT NOT NULL,
    send_id INT NOT NULL,
    clicked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    user_agent VARCHAR(500) DEFAULT NULL,
    ip_address VARCHAR(45) DEFAULT NULL,
    
    INDEX idx_link_id (link_id),
    INDEX idx_send_id (send_id),
    INDEX idx_clicked_at (clicked_at),
    
    FOREIGN KEY (link_id) REFERENCES email_campaign_links(id) ON DELETE CASCADE,
    FOREIGN KEY (send_id) REFERENCES email_sends(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- UNSUBSCRIBE LOG TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS email_unsubscribes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    contact_id INT NOT NULL,
    campaign_id INT DEFAULT NULL,
    reason VARCHAR(255) DEFAULT NULL,
    feedback TEXT DEFAULT NULL,
    ip_address VARCHAR(45) DEFAULT NULL,
    unsubscribed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_contact_id (contact_id),
    INDEX idx_campaign_id (campaign_id),
    INDEX idx_unsubscribed_at (unsubscribed_at),
    
    FOREIGN KEY (contact_id) REFERENCES email_contacts(id) ON DELETE CASCADE,
    FOREIGN KEY (campaign_id) REFERENCES email_campaigns(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- SAMPLE DATA (optional - remove in production)
-- =====================================================
-- INSERT INTO email_contacts (email, name, company, tags, source) VALUES
-- ('john.doe@example.com', 'John Doe', 'Acme Corp', '["customer", "vip"]', 'manual'),
-- ('jane.smith@example.com', 'Jane Smith', 'Tech Solutions', '["prospect"]', 'website'),
-- ('bob.wilson@example.com', 'Bob Wilson', 'StartupXYZ', '["customer"]', 'import');

-- INSERT INTO email_campaigns (name, subject, content, status) VALUES
-- ('Welcome Series', 'Welcome to OchoWorks Designs!', '<h1>Welcome!</h1><p>Thank you for your interest in our architectural designs.</p>', 'draft'),
-- ('Monthly Newsletter', 'January 2025 Newsletter', '<h1>Happy New Year!</h1><p>Check out our latest home designs.</p>', 'draft');