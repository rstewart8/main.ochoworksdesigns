
RENAME TABLE email_contacts TO contacts;

CREATE TABLE IF NOT EXISTS `contact_notes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `contact_id` int NOT NULL,
  `content` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `note_type` enum('general','call','email','meeting','follow_up','other') COLLATE utf8mb4_unicode_ci DEFAULT 'general',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `deleted_at` datetime DEFAULT NULL,
  `is_pinned` tinyint(1) DEFAULT '0',
  `created_by` int DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_contact_notes_contact` (`contact_id`),
  KEY `idx_contact_notes_type` (`note_type`),
  KEY `idx_contact_notes_pinned` (`is_pinned`),
  KEY `idx_contact_notes_created` (`created_at`),
  CONSTRAINT `contact_notes_ibfk_1` FOREIGN KEY (`contact_id`) REFERENCES `contacts` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=391 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- CONTACT CALLS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS contact_calls (
    id INT AUTO_INCREMENT PRIMARY KEY,
    contact_id INT NOT NULL,
    direction ENUM('inbound', 'outbound') NOT NULL DEFAULT 'outbound',
    phone_number VARCHAR(50) NULL,
    duration_seconds INT NULL COMMENT 'Call duration in seconds',
    outcome ENUM('answered', 'voicemail', 'no_answer', 'busy', 'wrong_number', 'callback_requested', 'other') DEFAULT 'answered',
    notes TEXT NULL,
    follow_up_date DATE NULL COMMENT 'Scheduled follow-up date',
    follow_up_notes VARCHAR(500) NULL,
    called_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by INT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- SAFE DROP: contacts.notes
-- ============================================================================

SET @sql := (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'contacts'
        AND COLUMN_NAME = 'notes'
    ),
    'ALTER TABLE contacts DROP COLUMN notes;',
    'SELECT "contacts.notes does not exist";'
  )
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ============================================================================
-- SAFE DROP: email_campaigns foreign key
-- ============================================================================

SET @sql := (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
      WHERE CONSTRAINT_SCHEMA = DATABASE()
        AND TABLE_NAME = 'email_campaigns'
        AND CONSTRAINT_NAME = 'email_campaigns_ibfk_1'
    ),
    'ALTER TABLE email_campaigns DROP FOREIGN KEY email_campaigns_ibfk_1;',
    'SELECT "FK email_campaigns_ibfk_1 does not exist";'
  )
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ============================================================================
-- SAFE DROP: email_sends foreign key
-- ============================================================================

SET @sql := (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
      WHERE CONSTRAINT_SCHEMA = DATABASE()
        AND TABLE_NAME = 'email_sends'
        AND CONSTRAINT_NAME = 'email_sends_ibfk_2'
    ),
    'ALTER TABLE email_sends DROP FOREIGN KEY email_sends_ibfk_2;',
    'SELECT "FK email_sends_ibfk_2 does not exist";'
  )
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

ALTER TABLE email_sends
ADD CONSTRAINT email_sends_contact_fk
FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE;

-- ============================================================================
-- SAFE DROP: email_unsubscribes foreign key
-- ============================================================================

SET @sql := (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
      WHERE CONSTRAINT_SCHEMA = DATABASE()
        AND TABLE_NAME = 'email_unsubscribes'
        AND CONSTRAINT_NAME = 'email_unsubscribes_ibfk_1'
    ),
    'ALTER TABLE email_unsubscribes DROP FOREIGN KEY email_unsubscribes_ibfk_1;',
    'SELECT "FK email_unsubscribes_ibfk_1 does not exist";'
  )
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

ALTER TABLE email_unsubscribes
ADD CONSTRAINT email_unsubscribes_contact_fk
FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE;

alter table contacts
add column deleted_at datetime default null after updated_at;

alter table contacts
add column phone INT null after email;

alter table contacts
modify column phone VARCHAR(50) null;

alter table contact_notes
add column is_active TINYINT(1) NOT NULL DEFAULT 1 after note_type;

alter table contact_notes
add column deleted_at datetime default null after is_active;

alter table contacts
add column last_contacted_at datetime default null after source;

alter table contact_calls
add column is_active TINYINT(1) NOT NULL DEFAULT 1 after called_at;

alter table contact_calls
add column deleted_at datetime default null after is_active;