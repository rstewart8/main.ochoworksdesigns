
-- Create categories table
CREATE TABLE categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    parent_id INT NULL,
    status ENUM('active', 'inactive') DEFAULT 'active',
    sort_order INT DEFAULT 0,
    post_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_slug (slug),
    INDEX idx_status (status),
    INDEX idx_parent_id (parent_id),
    INDEX idx_sort_order (sort_order),
    
    FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL
);

-- Use a transaction to ensure data consistency
START TRANSACTION;

-- Insert main categories first
INSERT INTO categories (name, slug, description, sort_order) VALUES
-- Audience-based categories
('Owner-Builders', 'owner-builders', 'DIY construction guidance and detailed plan explanations for self-motivated homeowners', 10),
('Home Buyers', 'home-buyers', 'Design inspiration, lot optimization, and custom solutions for future homeowners', 20),
('Builders & Contractors', 'builders-contractors', 'Technical specifications and construction efficiency tips for construction professionals', 30),

-- Plan type categories  
('Custom Designs', 'custom-designs', 'Unique architectural solutions tailored to specific client needs', 40),
('Stock Plans', 'stock-plans', 'Our collection of ready-to-build home designs', 50),
('Plan Modifications', 'plan-modifications', 'Adaptations and refinements of existing designs', 60),

-- Home style categories
('Modern Farmhouse', 'modern-farmhouse', 'Contemporary farmhouse designs with rustic charm', 70),
('Contemporary', 'contemporary', 'Clean, modern architectural designs', 80),
('Traditional', 'traditional', 'Classic home designs with timeless appeal', 90),
('Craftsman', 'craftsman', 'Handcrafted detail and natural materials', 100),
('Ranch', 'ranch', 'Single-story homes with horizontal emphasis', 110),

-- Feature-based categories
('Single Story', 'single-story', 'One-level living solutions', 120),
('Two Story', 'two-story', 'Multi-level home designs', 130),
('Basement Plans', 'basement-plans', 'Homes featuring basement levels', 140),
('Large Garages', 'large-garages', 'Homes with oversized garage spaces', 150),
('Open Concepts', 'open-concepts', 'Flowing, connected living spaces', 160),

-- Process and educational categories
('Site Planning', 'site-planning', 'Lot utilization and optimal building placement strategies', 170),
('Construction Tips', 'construction-tips', 'Building process insights from 30+ years of experience', 180),
('Design Process', 'design-process', 'Behind-the-scenes look at our architectural workflow', 190),
('Before & After', 'before-after', 'Plan refinements and design transformations', 200);

-- Get the IDs we just inserted and store them in variables
SET @ranch_id = (SELECT id FROM categories WHERE slug = 'ranch');
SET @traditional_id = (SELECT id FROM categories WHERE slug = 'traditional');
SET @custom_designs_id = (SELECT id FROM categories WHERE slug = 'custom-designs');
SET @stock_plans_id = (SELECT id FROM categories WHERE slug = 'stock-plans');

-- Now insert subcategories using the stored IDs
INSERT INTO categories (name, slug, description, parent_id, sort_order) VALUES
-- Subcategories for Home Styles
('Luxury Ranch', 'luxury-ranch', 'High-end single-story designs', @ranch_id, 1),
('Modern Traditional', 'modern-traditional', 'Traditional style with contemporary updates', @traditional_id, 1),

-- Subcategories for Custom Designs
('Mountain Homes', 'mountain-homes', 'Custom designs for mountainous terrain', @custom_designs_id, 1),
('Lakefront Properties', 'lakefront-properties', 'Waterfront custom home solutions', @custom_designs_id, 2),

-- Subcategories for Size
('Starter Homes', 'starter-homes', 'Compact, efficient designs for first-time buyers', @stock_plans_id, 1),
('Executive Homes', 'executive-homes', 'Large, luxury home designs', @stock_plans_id, 2);

-- Commit the transaction
COMMIT;

