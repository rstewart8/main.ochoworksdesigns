ALTER TABLE plan_images
ADD COLUMN image_type ENUM('rendering', 'floor_plan', 'gallery') DEFAULT 'gallery' AFTER plan_id;

UPDATE plan_images
SET image_type = 'rendering'
WHERE ordering = 1;

UPDATE plan_images
SET image_type = 'floor_plan'
WHERE ordering = 2;

create table plan_notes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    plan_id INT NOT NULL,
    note TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE CASCADE
);