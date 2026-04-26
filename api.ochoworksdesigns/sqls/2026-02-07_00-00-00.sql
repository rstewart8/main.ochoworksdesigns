alter table contacts
add column website varchar(512) null after company;

alter table contacts
rename column name to firstname;

alter table contacts
add column lastname varchar(255) null after firstname;