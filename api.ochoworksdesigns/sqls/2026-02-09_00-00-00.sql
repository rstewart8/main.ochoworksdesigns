alter table contact_calls
add column follow_up_complete boolean default false after follow_up_notes;

alter table contact_calls
modify column follow_up_complete int default 0;