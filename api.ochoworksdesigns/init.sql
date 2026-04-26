CREATE DATABASE IF NOT EXISTS ochoworksdesigns;
USE ochoworksdesigns;

-- Sample plans table
CREATE TABLE IF NOT EXISTS plans (
    id INT AUTO_INCREMENT PRIMARY KEY,
    plan_id VARCHAR(50) NOT NULL UNIQUE,
    title VARCHAR(255) DEFAULT NULL,
    description TEXT,
    specs JSON,
    bedrooms DECIMAL(2, 1) DEFAULT NULL,
    bathrooms DECIMAL(2, 1) DEFAULT NULL,
    stories DECIMAL(2, 1) DEFAULT NULL,
    garage DECIMAL(2, 1) DEFAULT NULL,
    basement ENUM('full', 'partial', 'walkout') DEFAULT NULL,
    square_footage INT DEFAULT NULL,
    width DECIMAL(10, 4) DEFAULT NULL,
    depth DECIMAL(10, 4) DEFAULT NULL,
    price DECIMAL(10, 2) DEFAULT 0.00,
    status ENUM('active', 'pending', 'inactive', 'deleted') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) AUTO_INCREMENT = 1001;

alter table plans
    add column version INT DEFAULT 1 AFTER plan_id;

alter table plans
    add column basement_square_footage INT DEFAULT 0 AFTER basement;

alter table plans
    add column main_square_footage INT DEFAULT 0 AFTER basement_square_footage;

alter table plans
    add column garage_square_footage INT DEFAULT 0 AFTER main_square_footage;   

alter table plans
    add column upper_square_footage INT DEFAULT 0 AFTER garage_square_footage;

alter table plans
    change column square_footage total_square_footage INT DEFAULT 0;

alter table plans
    drop column total_square_footage;

CREATE TABLE IF NOT EXISTS plan_images (
    id INT AUTO_INCREMENT PRIMARY KEY,
    plan_id INT NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    image_url VARCHAR(255) NOT NULL,
    ordering INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    status ENUM('active', 'inactive', 'deleted') DEFAULT 'active',
    FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE CASCADE
);

-- Email sending log table
CREATE TABLE IF NOT EXISTS email_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email_to VARCHAR(100) NOT NULL,
    email_subject VARCHAR(255) NOT NULL,
    email_body TEXT,
    response TEXT,
    status ENUM('sent', 'failed') DEFAULT 'sent',
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Indexes for better performance
    INDEX idx_status (status),
    INDEX idx_sent_at (sent_at),
    INDEX idx_email_to (email_to)
);

alter table plans
    add ordering INT DEFAULT NULL AFTER version;

create table `roles` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(45) NOT NULL,
  `description` varchar(255) DEFAULT NULL,
  `created` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `modified` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

insert into roles (name, description) values
('admin', 'Administrator with full access'),
('editor', 'Editor with limited access'),
('viewer', 'Viewer with read-only access');

CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `role_id` int DEFAULT NULL,
  `firstname` varchar(45) DEFAULT NULL,
  `lastname` varchar(45) DEFAULT NULL,
  `address` varchar(256) DEFAULT NULL,
  `city` varchar(45) DEFAULT NULL,
  `state` char(2) DEFAULT NULL,
  `zip` varchar(16) DEFAULT NULL,
  `email` varchar(256) NOT NULL,
  `phone` varchar(45) DEFAULT NULL,
  `timezone_id` int NOT NULL DEFAULT '3',
  `signup_method` enum('email','google') NOT NULL DEFAULT 'email',
  `google_id` varchar(45) DEFAULT NULL,
  `email_verified` tinyint(1) NOT NULL DEFAULT '0',
  `verification_token` varchar(64) DEFAULT NULL,
  `password` varchar(255) DEFAULT NULL,
  `reset_token` varchar(45) DEFAULT NULL,
  `reset_token_timestamp` datetime DEFAULT NULL,
  `created` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `modified` datetime DEFAULT NULL,
  `status` varchar(45) DEFAULT 'active',
  FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`),
  PRIMARY KEY (`id`),
  UNIQUE KEY `id_UNIQUE` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4587 DEFAULT CHARSET=latin1;

-- Blog Posts Table
CREATE TABLE `blog_posts` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `title` varchar(255) NOT NULL,
  `slug` varchar(255) NOT NULL UNIQUE,
  `content` longtext NOT NULL,
  `excerpt` text DEFAULT NULL,
  `featured_image` varchar(500) DEFAULT NULL,
  `status` enum('draft','published','archived') NOT NULL DEFAULT 'draft',
  `featured` tinyint(1) NOT NULL DEFAULT 0,
  `plan_id` varchar(50) DEFAULT NULL,
  `meta_title` varchar(255) DEFAULT NULL,
  `meta_description` varchar(500) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_status` (`status`),
  KEY `idx_featured` (`featured`),
  KEY `idx_plan_id` (`plan_id`),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_slug` (`slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Blog Tags Table
CREATE TABLE `blog_tags` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL UNIQUE,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Blog Post Tags Junction Table
CREATE TABLE `blog_post_tags` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `blog_post_id` int(11) NOT NULL,
  `tag_id` int(11) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_post_tag` (`blog_post_id`, `tag_id`),
  KEY `idx_blog_post_id` (`blog_post_id`),
  KEY `idx_tag_id` (`tag_id`),
  CONSTRAINT `fk_blog_post_tags_post` FOREIGN KEY (`blog_post_id`) REFERENCES `blog_posts` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_blog_post_tags_tag` FOREIGN KEY (`tag_id`) REFERENCES `blog_tags` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Blog Images Table
CREATE TABLE `blog_images` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `blog_post_id` int(11) NOT NULL,
  `image_url` varchar(500) NOT NULL,
  `image_type` enum('elevation','floorplan','exterior','interior','site_plan','general') NOT NULL DEFAULT 'general',
  `caption` varchar(255) DEFAULT NULL,
  `alt_text` varchar(255) DEFAULT NULL,
  `sort_order` int(11) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_blog_post_id` (`blog_post_id`),
  KEY `idx_sort_order` (`sort_order`),
  CONSTRAINT `fk_blog_images_post` FOREIGN KEY (`blog_post_id`) REFERENCES `blog_posts` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add some sample data for testing
INSERT INTO `blog_tags` (`name`) VALUES
('Modern'),
('Farmhouse'),
('Two-Story'),
('Open Floor Plan'),
('Contemporary'),
('Ranch'),
('Traditional');

-- Sample blog post
INSERT INTO `blog_posts` (`title`, `slug`, `content`, `excerpt`, `status`, `featured`, `meta_title`, `meta_description`) VALUES
('Modern Farmhouse Design with Open Concept', 'modern-farmhouse-design-open-concept', 
'<h2>Introducing Our Latest Modern Farmhouse Design</h2>
<p>This stunning 2,400 square foot modern farmhouse combines the best of contemporary living with classic farmhouse charm. The open concept design creates a seamless flow between the kitchen, dining, and living areas, perfect for both everyday family life and entertaining guests.</p>

<h3>Key Features</h3>
<ul>
<li>Open concept kitchen and living area</li>
<li>Master suite on main floor</li>
<li>Covered front and back porches</li>
<li>3 bedrooms, 2.5 bathrooms</li>
<li>2-car attached garage</li>
</ul>

<p>The exterior features a combination of board and batten siding with stone accents, creating visual interest while maintaining the farmhouse aesthetic. Large windows throughout provide abundant natural light and enhance the connection between indoor and outdoor spaces.</p>',
'A stunning modern farmhouse design featuring open concept living, covered porches, and perfect blend of contemporary and traditional elements.',
'published', 1, 
'Modern Farmhouse Design - Open Concept Floor Plan | House Plans',
'Discover our modern farmhouse design with open concept living, 3 bedrooms, covered porches and contemporary farmhouse style. Perfect for families.');

-- Link the sample post to some tags
INSERT INTO `blog_post_tags` (`blog_post_id`, `tag_id`) 
SELECT 1, `id` FROM `blog_tags` WHERE `name` IN ('Modern', 'Farmhouse', 'Open Floor Plan');

-- Modify decimal columns to DECIMAL(4,3)
ALTER TABLE plans 
MODIFY COLUMN bedrooms DECIMAL(4,3) DEFAULT NULL,
MODIFY COLUMN bathrooms DECIMAL(4,3) DEFAULT NULL,
MODIFY COLUMN stories DECIMAL(4,3) DEFAULT NULL,
MODIFY COLUMN garage DECIMAL(4,3) DEFAULT NULL;
