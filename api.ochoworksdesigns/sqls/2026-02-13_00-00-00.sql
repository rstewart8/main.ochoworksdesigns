create table campaigns (
  id int not null auto_increment,
  name varchar(255) not null,
  status enum('active', 'inactive', 'deleted') default 'active',
  created_at timestamp default current_timestamp,
  updated_at timestamp default current_timestamp on update current_timestamp,
  primary key (id)
);

alter table email_campaigns
  add column campaign_id int after id,
  add foreign key (campaign_id) references campaigns(id);

create table contact_email_campaigns (
  id int not null auto_increment,
  contact_id int not null,
  campaign_email_id int not null,
  email_send_id int not null,
  created_at timestamp default current_timestamp,
  updated_at timestamp default current_timestamp on update current_timestamp,
  primary key (id),
  foreign key (contact_id) references contacts(id),
  foreign key (campaign_email_id) references email_campaigns(id),
  foreign key (email_send_id) references email_sends(id)
);

alter table email_sends
rename column campaign_id to email_campaign_id;

alter table email_unsubscribes
rename column campaign_id to email_campaign_id;

alter table email_campaign_links
rename column campaign_id to email_campaign_id;

alter table email_sends
add column type enum('automatic', 'manual') default 'automatic' after tracking_id;

alter table campaign_send_queue
rename column campaign_id to email_campaign_id;

alter table campaign_contact_opens
rename column campaign_id to email_campaign_id;

alter table email_campaigns
add column track boolean default false after reply_to;

alter table email_sends
modify column tracking_id varchar(255) default null after contact_id;
