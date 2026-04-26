CREATE TABLE IF NOT EXISTS campaign_contact_links (
    id INT AUTO_INCREMENT PRIMARY KEY,
    contact_id INT NOT NULL,
    campaign_id INT NOT NULL,
    link_name VARCHAR(250) DEFAULT NULL,
    link_url VARCHAR(500) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY uq_campaign_contact_link (
        campaign_id,
        contact_id,
        link_url
    ),

    INDEX idx_campaign_id (campaign_id),
    INDEX idx_contact_id (contact_id),

    CONSTRAINT fk_ccl_contact
        FOREIGN KEY (contact_id) REFERENCES contacts(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_ccl_campaign
        FOREIGN KEY (campaign_id) REFERENCES email_campaigns(id)
        ON DELETE CASCADE
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;

campaign_contact_link_clicks

DROP TABLE IF EXISTS email_link_clicks;
DROP TABLE IF EXISTS email_campaign_links;

rename table campaign_contact_links to email_campaign_links;

ALTER TABLE email_campaign_links
DROP FOREIGN KEY fk_ccl_contact;

ALTER TABLE email_campaign_links
DROP COLUMN contact_id;

drop table if exists campaign_contact_link_clicks;

CREATE TABLE IF NOT EXISTS campaign_contact_link_clicks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email_campaign_link_id INT NOT NULL,
    contact_id INT NOT NULL,
    clicked_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_email_campaign_link_id (email_campaign_link_id),

    CONSTRAINT fk_cclc_link
        FOREIGN KEY (email_campaign_link_id)
        REFERENCES email_campaign_links(id)
        ON DELETE CASCADE
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;

create table if not exists campaign_contact_opens (
    id int auto_increment primary key,
    campaign_id int not null,
    contact_id int not null,
    opened_at datetime default current_timestamp,

    index idx_campaign_contact (campaign_id, contact_id),

    constraint fk_cco_campaign
        foreign key (campaign_id) references email_campaigns(id)
        on delete cascade,

    constraint fk_cco_contact
        foreign key (contact_id) references contacts(id)
        on delete cascade
) engine=InnoDB
  default charset=utf8mb4
  collate=utf8mb4_unicode_ci;