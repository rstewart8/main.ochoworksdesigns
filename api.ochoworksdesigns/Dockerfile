FROM php:8.3-apache

# Install system dependencies used by Apache, Composer, and the cron worker.
RUN apt-get update && apt-get install -y \
    cron \
    git \
    nano \
    unzip \
    && rm -rf /var/lib/apt/lists/*

# Install PDO MySQL extension
RUN docker-php-ext-install pdo pdo_mysql

# Install Composer
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

# Enable Apache mod_rewrite
RUN a2enmod rewrite

# Create log directory
RUN mkdir -p /var/log/ochoworksdesigns
RUN mkdir -p /var/www/web
RUN mkdir -p /var/www/web/public

# Set the document root
ENV APACHE_DOCUMENT_ROOT /var/www/html/public
RUN sed -ri -e 's!/var/www/html!${APACHE_DOCUMENT_ROOT}!g' /etc/apache2/sites-available/*.conf
RUN sed -ri -e 's!/var/www/!${APACHE_DOCUMENT_ROOT}!g' /etc/apache2/apache2.conf /etc/apache2/conf-available/*.conf

# Copy application files
COPY . /var/www/html/

# Install Composer dependencies (if composer.json exists)
WORKDIR /var/www/html
RUN if [ -f composer.json ]; then composer install --no-dev --optimize-autoloader; fi

# Set permissions
RUN chown -R www-data:www-data /var/www/html/
RUN chmod -R 755 /var/www/html/
RUN chown -R www-data:www-data /var/log/ochoworksdesigns
RUN chmod -R 755 /var/log/ochoworksdesigns
RUN chown -R www-data:www-data /var/www/web
RUN chmod -R 755 /var/www/web
