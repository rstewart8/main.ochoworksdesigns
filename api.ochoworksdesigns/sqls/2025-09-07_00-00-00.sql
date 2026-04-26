ALTER TABLE blog_tags
RENAME TO tags;

ALTER TABLE tags
ADD COLUMN status ENUM('active', 'inactive') NOT NULL DEFAULT 'active';

create table blog_post_keywords (
    id INT AUTO_INCREMENT PRIMARY KEY,
    blog_post_id INT NOT NULL,
    keyword VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (blog_post_id) REFERENCES blog_posts(id) ON DELETE CASCADE
);

alter table blog_post_images
add column is_featured TINYINT(1) DEFAULT 0 AFTER blog_post_id;

alter table blog_images
RENAME TO blog_post_images;

alter table blog_post_tags
change column tag tag_id INT NOT NULL;

alter table blog_posts
add column category VARCHAR(100) DEFAULT NULL AFTER excerpt;

alter table blog_posts
add column author VARCHAR(100) DEFAULT NULL AFTER category;

alter table blog_posts
add column views INT DEFAULT 0 AFTER status;