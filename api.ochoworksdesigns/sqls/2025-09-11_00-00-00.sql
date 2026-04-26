alter table plan_images
    add column alt_text VARCHAR(255) DEFAULT NULL AFTER image_url;  