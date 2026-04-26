//// add columns for plain text content and send_plain_text flag
ALTER TABLE email_campaigns
ADD COLUMN send_plain_text BOOLEAN DEFAULT TRUE AFTER content;

ALTER TABLE campaign_contact_link_clicks DROP FOREIGN KEY fk_cclc_link;