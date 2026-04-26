# Simple PHP API with MySQL and Docker

A lightweight PHP REST API with MySQL database, Docker containerization, and both public and protected endpoints.

## Features

- **Docker Setup**: Complete containerization with PHP 8.1 and MySQL 8.0
- **Database Class**: Custom PDO wrapper with common database operations
- **Environment Configuration**: Secure configuration with .env file
- **API Key Authentication**: Protected endpoints requiring API key
- **Public Endpoints**: Open access endpoints for general use
- **Error Handling**: Consistent JSON error responses
- **CORS Support**: Cross-origin resource sharing enabled

## Quick Start

1. **Clone and Setup**
```bash
git clone <your-repo>
cd <your-project>
```

2. **Configure Environment**
```bash
cp .env.example .env
# Edit .env file with your settings
```

3. **Start Services**
```bash
docker-compose up -d
```

4. **Access API**
- API Base URL: http://localhost:8888
- Docker MySQL: localhost:3307 (from host machine)
- Your existing MySQL: localhost:3306 (unchanged)

## API Endpoints

### Public Endpoints (No API Key Required)

- `GET /` - API information and available endpoints
- `GET /api/health` - Health check
- `GET /api/posts` - Get all published posts

### Protected Endpoints (Require API Key)

- `GET /api/users` - Get all users
- `GET /api/users/{id}` - Get specific user
- `POST /api/users` - Create new user
- `GET /api/admin/posts` - Get all posts (including drafts)

## Authentication

Protected endpoints require the `X-API-Key` header:

```bash
curl -H "X-API-Key: your-secret-api-key-here" \
     http://localhost:8888/api/users
```

## Usage Examples

### Health Check (Public)
```bash
curl http://localhost:8888/api/health
```

### Get Published Posts (Public)
```bash
curl http://localhost:8888/api/posts
```

### Get All Users (Protected)
```bash
curl -H "X-API-Key: your-secret-api-key-here" \
     http://localhost:8888/api/users
```

### Create User (Protected)
```bash
curl -X POST \
     -H "Content-Type: application/json" \
     -H "X-API-Key: your-secret-api-key-here" \
     -d '{"name":"John Doe","email":"john@example.com"}' \
     http://localhost:8888/api/users
```

### Get All Posts as Admin (Protected)
```bash
curl -H "X-API-Key: your-secret-api-key-here" \
     http://localhost:8888/api/admin/posts
```


## Database Schema

The API includes sample tables:

- **users**: id, name, email, created_at, updated_at
- **posts**: id, user_id, title, content, status, created_at, updated_at

## Configuration

### Environment Variables (.env)

```env
DB_HOST=db
DB_PORT=3306
DB_NAME=ochoworksdesigns
DB_USER=admin
DB_PASSWORD=admin_password
API_KEY=your-secret-api-key-here
DEBUG=true
```

### Security Notes

1. **Change API Key**: Update the API_KEY in .env file
2. **Database Passwords**: Use strong passwords in production
3. **HTTPS**: Always use HTTPS in production
4. **Rate Limiting**: Consider implementing rate limiting for production

## Development

### Adding New Endpoints

1. Add route in `public/index.php`
2. Create handler function
3. Use `ApiHelpers::requireApiKey()` for protected endpoints
4. Use `ApiHelpers::successResponse()` and `ApiHelpers::errorResponse()` for consistent responses

### Database Operations

The Database class provides methods for common operations:

```php
// Insert
$id = $db->insert('users', ['name' => 'John', 'email' => 'john@example.com']);

// Update
$affected = $db->update('users', ['name' => 'Jane'], 'id = :id', [':id' => 1]);

// Delete
$affected = $db->delete('users', 'id = :id', [':id' => 1]);

// Fetch all
$users = $db->fetchAll('SELECT * FROM users');

// Fetch one
$user = $db->fetchOne('SELECT * FROM users WHERE id = ?', [1]);
```

## Docker Commands

```bash
# Start services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Rebuild containers
docker-compose up --build -d

# Access Docker database
docker-compose exec db mysql -u admin -p ochoworksdesign

# Or from host machine
mysql -h 127.0.0.1 -P 3307 -u admin -p ochoworksdesigns

# docker bash
docker exec -it apiochoworksdesigns-web-1 bash

```

## Troubleshooting

1. **Port Conflicts**: The setup uses port 3307 for Docker MySQL to avoid conflicts with your existing MySQL on 3306
2. **Database Connection**: Ensure containers are running with `docker-compose ps`
3. **Permissions**: Check file permissions if getting access errors
4. **API Key**: Verify X-API-Key header is set correctly for protected endpoints
```
api.ochoworksdesigns
├─ .DS_Store
├─ .env
├─ Dockerfile
├─ README.md
├─ classes
│  ├─ ApiHelpers.php
│  ├─ Database.php
│  └─ SendGrid.php
├─ docker-compose.yml
├─ files
│  └─ plans
│     ├─ plan_1019_1753709369_0.png
│     ├─ plan_1020_1753709453_0.png
│     ├─ plan_1021_1753709456_0.png
│     ├─ plan_1022_1753710566_0.png
│     ├─ plan_1023_1753710567_0.png
│     ├─ plan_1024_1753710568_0.png
│     ├─ plan_1025_1753710571_0.png
│     ├─ plan_1026_1753710572_0.png
│     ├─ plan_1027_1753710574_0.png
│     ├─ plan_1028_1753710576_0.png
│     ├─ plan_1029_1753710577_0.png
│     ├─ plan_1030_1753710579_0.png
│     ├─ plan_1031_1753710581_0.png
│     ├─ plan_1032_1753710583_0.png
│     ├─ plan_1033_1753710586_0.png
│     ├─ plan_1034_1753710588_0.png
│     ├─ plan_1035_1753710589_0.png
│     ├─ plan_1036_1753710591_0.png
│     ├─ plan_1037_1753713202_0.png
│     ├─ plan_1038_1753717828_0.png
│     ├─ plan_1039_1753730281_0.png
│     ├─ plan_1040_1753790472_0.png
│     ├─ plan_1041_1753790509_0.png
│     ├─ plan_1042_1753791995_0.png
│     └─ plan_1043_1753792525_0.png
├─ init.sql
├─ libs
│  ├─ helpers.php
│  └─ logger.php
└─ public
   ├─ .htaccess
   └─ index.php

```