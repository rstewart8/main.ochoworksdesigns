<?php

// Enable all error reporting for debugging
error_reporting(E_ALL);
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);

// Load environment variables
require_once '../classes/ApiHelpers.php';
ApiHelpers::loadEnv('../.env');

// Load classes
require_once '../classes/Database.php';
require_once '../classes/SendGrid.php';
require_once '../libs/helpers.php';
require_once '../libs/logger.php';
require_once '../classes/emailMarketing.php';
require_once '../handlers/handleCampaigns.php';

// Improved CORS headers
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$allowedOrigins = [
    'https://ochoworksdesigns.com',
    'https://www.ochoworksdesigns.com',
    'http://ochoworksdesigns.com',
    'http://www.ochoworksdesigns.com',
    'http://localhost:4222',  // current local Angular dev port
    'http://127.0.0.1:4222',  // current local Angular dev port
    'http://localhost:4848',  // for local development
    'http://127.0.0.1:4848',  // legacy local development
    'http://localhost:3000',  // for local development
];

$logger = new Logger();

if (in_array($origin, $allowedOrigins)) {
    header('Access-Control-Allow-Origin: ' . $origin);
} else {
    header('Access-Control-Allow-Origin: https://ochoworksdesigns.com');
}

header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-API-Key, Authorization, X-Requested-With');
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Max-Age: 86400'); // Cache preflight for 24 hours

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit(0);
}

$logger->info("API request received");

// Rest of your code remains the same...
// Get the request URI and method
$requestUri = $_SERVER['REQUEST_URI'];
$method = $_SERVER['REQUEST_METHOD'];

// Remove query string and leading slash
$path = parse_url($requestUri, PHP_URL_PATH);
$path = trim($path, '/');

// Split path into segments
$segments = explode('/', $path);

// Initialize database
try {
    $db = new Database($logger);
} catch (Exception $e) {
    ApiHelpers::errorResponse('Database connection failed', 500);
}

$logger->info("Request method: $method, Path: $path");
$logger->info("FILES data: " . json_encode($_FILES));
// Route the request
switch ($segments[0]) {
    case 'api':
        if (isset($segments[1])) {
            switch ($segments[1]) {
                // Public endpoints
                case 'health':
                    handleHealthCheck();
                    break;
                case 'plans':
                    handlePlans($db, $method, $segments);
                    break;
                case 'plan':
                    handlePlan($db, $method, $segments);
                    break;
                case 'contact':
                    handleContact($db, $method);
                    break;

                // Protected endpoints (require API key)
                case 'users':
                    ApiHelpers::requireApiKey();
                    handleUsers($db, $method, $segments);
                    break;
                case 'admin':
                    ApiHelpers::verifyToken();
                    handleAdmin($db, $method, $segments);
                    break;

                case 'marketing':
                    ApiHelpers::verifyToken();
                    handleMarketing($db, $method, $segments);
                    break;

                case 'track':
                    handleTracking($db, $segments);
                    break;

                case 'signup':
                    handleSignup($db, $method);
                    break;

                case 'login':
                    handleLogin($db, $method);
                    break;

                case 'blog':
                    handleBlog($db, $method, $segments);
                    break;

                case 'blog-posts':
                    ApiHelpers::verifyToken();
                    handleBlogPosts($db, $method, $segments);
                    break;

                case 'image':
                    ApiHelpers::verifyToken();
                    handleGenerateImageUrl($db, $method, $segments);
                    break;

                case 'utilities':
                    handleUtilities($db, $method, $segments);
                    break;

                default:
                    ApiHelpers::errorResponse('Endpoint not found', 404);
            }
        } else {
            ApiHelpers::errorResponse('Invalid API endpoint', 400);
        }
        break;

    case 'files':
        // Handle files directly
        handleFiles($method, $segments);
        break;

    default:
        ApiHelpers::jsonResponse([
            'message' => 'Simple PHP API',
            'version' => '1.0.0',
            'endpoints' => [
                'GET /api/health' => 'Public health check',
                'GET /api/posts' => 'Public - Get all published posts',
                'GET /api/plans' => 'Public - Get all active plans',
                'POST /api/contact' => 'Public - Send contact form email',
                'GET /api/users' => 'Protected - Get all users (requires X-API-Key header)',
                'POST /api/users' => 'Protected - Create user (requires X-API-Key header)',
                'GET /api/admin/posts' => 'Protected - Get all posts including drafts',
                'GET /api/admin/emails' => 'Protected - Get email logs',
                'GET /api/admin/email-stats' => 'Protected - Get email statistics'
            ]
        ]);
}

// ... rest of your functions remain exactly the same ...



function handleFiles($method, $segments)
{
    global $logger;

    if ($method !== 'GET') {
        ApiHelpers::errorResponse('Method not allowed', 405);
        return;
    }

    // Check if we have the required path segments
    // Expected: files/plans/{filename}
    if (count($segments) < 3) {
        ApiHelpers::errorResponse('Invalid upload path', 400);
        return;
    }

    $logger->info("Handling upload request for: " . print_r($segments, true));

    $uploadType = $segments[1]; // Should be 'plans'
    $filename = $segments[2];   // The image filename
    $validuploadTypes = ['plans', 'blog'];

    $filePath = "../files/$uploadType/$filename";

    // Validate upload type
    if (!in_array($uploadType, $validuploadTypes)) {
        ApiHelpers::errorResponse('Invalid upload type', 400);
        return;
    }

    // Sanitize filename to prevent directory traversal
    $filename = basename($filename);

    // Updated filename validation - more flexible pattern
    if (!preg_match('/^(plan_|blog_).*\.(jpg|jpeg|png|gif|webp)$/i', $filename)) {
        ApiHelpers::errorResponse('Invalid filename format', 400);
        return;
    }

    // Check if file exists
    if (!file_exists($filePath)) {
        ApiHelpers::errorResponse('Image not found', 404);
        return;
    }

    // Check if it's actually an image file
    $imageInfo = getimagesize($filePath);
    if ($imageInfo === false) {
        ApiHelpers::errorResponse('Invalid image file', 400);
        return;
    }

    // Get the MIME type
    $mimeType = $imageInfo['mime'];

    // Set appropriate headers
    header('Content-Type: ' . $mimeType);
    header('Content-Length: ' . filesize($filePath));
    header('Cache-Control: public, max-age=31536000'); // Cache for 1 year
    header('Expires: ' . gmdate('D, d M Y H:i:s \G\M\T', time() + 31536000));

    // Add ETag for better caching
    $etag = md5_file($filePath);
    header('ETag: "' . $etag . '"');

    // Check if client has cached version
    if (
        isset($_SERVER['HTTP_IF_NONE_MATCH']) &&
        $_SERVER['HTTP_IF_NONE_MATCH'] === '"' . $etag . '"'
    ) {
        http_response_code(304);
        exit;
    }

    // Output the image
    readfile($filePath);
    exit;
}

// Health check endpoint (public)
function handleHealthCheck()
{
    ApiHelpers::successResponse([
        'status' => 'OK',
        'timestamp' => date('Y-m-d H:i:s'),
        'uptime' => sys_getloadavg()[0]
    ]);
}

function handlePlan($db, $method, $segments)
{
    global $logger;

    if ($method !== 'GET') {
        ApiHelpers::errorResponse('Method not allowed', 405);
        return;
    }



    // Check if we have the required path segments
    // Expected: plan/{id}
    if (count($segments) < 3 || !is_numeric($segments[2])) {
        ApiHelpers::errorResponse('Invalid plan ID', 400);
        return;
    }

    $planId = (int)$segments[2];

    try {
        $logger->info("Fetching plan with ID: $planId");

        $statusFilter = " p.status = 'active'";
        $setPlan = false;

        if (count($segments) > 3 && $segments[3] === 'set') {
            $statusFilter = " p.status != 'deleted'";
            $setPlan = true;
        }

        // Fetch the plan details
        $plan = $db->fetchOne(
            "SELECT p.id, p.ordering, p.plan_no, p.title, p.description, p.specs, p.bedrooms, p.bathrooms, p.stories, p.garage, p.basement, p.basement_square_footage, p.main_square_footage, p.garage_square_footage, p.upper_square_footage, p.width, p.depth, p.status, p.created_at, p.updated_at, (COALESCE(p.basement_square_footage, 0) + COALESCE(p.main_square_footage, 0) +  COALESCE(p.garage_square_footage, 0) +  COALESCE(p.upper_square_footage, 0)) AS total_square_footage
             FROM plans p 
             WHERE p.id = ? AND $statusFilter",
            [$planId]
        );

        if (!$plan) {
            ApiHelpers::errorResponse('Plan not found', 404);
            return;
        }

        // Format width and depth for display
        if (!empty($plan['width'])) {
            $plan['formatted_width'] = convertDecimalToFeetInches($plan['width'], 2);
        } else {
            $plan['formatted_width'] = null;
        }

        if (!empty($plan['depth'])) {
            $plan['formatted_depth'] = convertDecimalToFeetInches($plan['depth'], 2);
        } else {
            $plan['formatted_depth'] = null;
        }

        $plan['bedrooms'] = stringifyInt($plan['bedrooms']);
        $plan['bathrooms'] = stringifyInt($plan['bathrooms']);
        $plan['stories'] = stringifyInt($plan['stories']);
        $plan['garage'] = stringifyInt($plan['garage']);
        $plan['basement_square_footage'] = stringifyInt($plan['basement_square_footage']);
        $plan['main_square_footage'] = stringifyInt($plan['main_square_footage']);
        $plan['garage_square_footage'] = stringifyInt($plan['garage_square_footage']);
        $plan['upper_square_footage'] = stringifyInt($plan['upper_square_footage']);
        $plan['total_square_footage'] = stringifyInt($plan['total_square_footage']);

        // Fetch images for the plan
        $imgUrl = $_ENV['API_BASE_URL'];
        $images = $db->fetchAll(
            "SELECT id, image_type, file_name, CONCAT('$imgUrl', image_url) AS image_url, ordering, alt_text 
             FROM plan_images 
             WHERE plan_id = ? AND status = 'active' 
             ORDER BY ordering ASC",
            [$planId]
        );

        $plan['images'] = $images;

        //// If set get notes
        // echo "Segments: " . print_r($segments, true);
        // exit; // Debugging line 
        if ($setPlan) {
            $notes = $db->fetchAll(
                "SELECT id, note, created_at 
                             FROM plan_notes 
                             WHERE plan_id = ? 
                             ORDER BY created_at DESC",
                [$plan['id']]
            );
            $plan['notes'] = $notes;
        }

        ApiHelpers::successResponse($plan);
    } catch (Exception $e) {
        ApiHelpers::errorResponse('Failed to fetch plan details', 500);
    }
}

function handlePlans($db, $method, $segments)
{
    global $logger;

    switch ($method) {
        case 'GET':
            try {
                $idFilter = '';
                if (count($segments) > 2 && is_numeric($segments[2])) {
                    $id = (int)$segments[2];
                    $idFilter = " and p.id = $id";
                }

                $statusFilter = " p.status = 'active'";
                $setPlan = false;

                $statusString = $_GET['status'] ?? '';

                if ($statusString !== '') {
                    $tokenData = ApiHelpers::verifyToken();
                    if ($tokenData->data->role_id == 1) {
                        $arr = explode(',', $statusString);
                        $statusFilter = " p.status IN ('" . implode("','", array_map('trim', $arr)) . "')";
                    } else {
                    }
                }

                $logger->info("_GET: " . print_r($_GET, true));

                // Get pagination parameters
                if ($idFilter != '') {
                    // If an ID is provided, limit results to that plan
                    $limit = 1; // Only return one plan if ID is specified
                    $page = 1; // Page 1 for single plan
                } else {
                    // Default pagination settings
                    $limit = isset($_GET['limit']) ? min((int)$_GET['limit'], 100) : 10; // Default limit to 10, max 100
                    $page = isset($_GET['page']) ? max((int)$_GET['page'], 1) : 1; // Default to page 1, minimum 1
                }

                // Ensure minimum values
                $limit = max($limit, 1);

                // Calculate offset from page number
                $offset = ($page - 1) * $limit;

                // Get total count for pagination info
                $countQry = "SELECT COUNT(*) as total 
                            FROM plans p 
                            WHERE $statusFilter $idFilter";

                $totalResult = $db->fetchOne($countQry);
                $totalCount = $totalResult['total'] ?? 0;

                // Calculate total pages
                $totalPages = $totalCount > 0 ? ceil($totalCount / $limit) : 1;

                // Fetch plans with pagination
                $qry = "SELECT p.id, p.plan_no, p.ordering, p.title, p.description, p.specs, p.bedrooms, p.bathrooms, p.stories, p.garage, p.basement, p.basement_square_footage, p.main_square_footage, p.garage_square_footage, p.upper_square_footage, p.width, p.depth, p.status, p.created_at, p.updated_at, (COALESCE(p.basement_square_footage, 0) + COALESCE(p.main_square_footage, 0) +  COALESCE(p.garage_square_footage, 0) +  COALESCE(p.upper_square_footage, 0)) AS total_square_footage
                        FROM plans p 
                        WHERE $statusFilter $idFilter 
                        ORDER BY
                            p.ordering IS NULL,  -- Places NULLs at the end
                            p.ordering ASC,  -- Then order by ordering value    
                            p.id DESC  -- Finally order by ID descending
                        LIMIT $limit OFFSET $offset";

                $plans = $db->fetchAll($qry);

                $imgUrl = $_ENV['API_BASE_URL'];

                // Fetch images for each plan and add formatted dimensions
                foreach ($plans as &$plan) {
                    // Add formatted dimensions if they exist
                    if (!empty($plan['width'])) {
                        $plan['formatted_width'] = convertDecimalToFeetInches($plan['width'], 2);
                    } else {
                        $plan['formatted_width'] = null;
                    }

                    if (!empty($plan['depth'])) {
                        $plan['formatted_depth'] = convertDecimalToFeetInches($plan['depth'], 2);
                    } else {
                        $plan['formatted_depth'] = null;
                    }

                    $plan['bedrooms'] = stringifyInt($plan['bedrooms']);
                    $plan['bathrooms'] = stringifyInt($plan['bathrooms']);
                    $plan['stories'] = stringifyInt($plan['stories']);
                    $plan['garage'] = stringifyInt($plan['garage']);
                    $plan['basement_square_footage'] = stringifyInt($plan['basement_square_footage']);
                    $plan['main_square_footage'] = stringifyInt($plan['main_square_footage']);
                    $plan['garage_square_footage'] = stringifyInt($plan['garage_square_footage']);
                    $plan['upper_square_footage'] = stringifyInt($plan['upper_square_footage']);
                    $plan['total_square_footage'] = stringifyInt($plan['total_square_footage']);

                    $images = $db->fetchAll(
                        "SELECT id, image_type, file_name, CONCAT('$imgUrl', image_url) AS image_url, ordering, alt_text 
                         FROM plan_images 
                         WHERE plan_id = ? AND status = 'active' 
                         ORDER BY ordering ASC",
                        [$plan['id']]
                    );
                    $plan['images'] = $images;
                }

                $data = [
                    'count' => count($plans),
                    'total' => (int)$totalCount,
                    'pagination' => [
                        'limit' => $limit,
                        'page' => $page,
                        'total_pages' => $totalPages,
                        'has_next' => $page < $totalPages,
                        'has_previous' => $page > 1
                    ],
                    'plans' => $plans
                ];

                ApiHelpers::successResponse($data);
            } catch (Exception $e) {
                ApiHelpers::errorResponse('Failed to fetch plans', 500);
            }
            break;

        case 'POST':
            ApiHelpers::verifyToken();

            try {
                // Start transaction
                $conn = $db->getConnection();
                $conn->beginTransaction();

                // Check if this is an update (plan_no exists) or create (no plan_no)
                $isUpdate = !empty($_POST['plan_no']);
                $planNo = null;
                $plansId = null;

                if ($isUpdate) {
                    // This is an update operation
                    $planNo = $_POST['plan_no'];

                    // Get plan's database ID and verify it exists
                    $r = $db->fetchOne("SELECT `id` FROM `plans` WHERE `plan_no` = ?", [$planNo]);
                    if (!$r) {
                        throw new InvalidArgumentException('Invalid plan ID for update');
                    }
                    $plansId = $r['id'];

                    $logger->info("Updating existing plan: $planNo (DB ID: $plansId)");
                } else {
                    // This is a create operation - generate new plan_no
                    $planNo = 'PLAN_' . generateRandomPlanId() . '-1';
                    $logger->info("Creating new plan: $planNo");
                }

                // Define validation configuration - all fields are optional
                $validationConfig = [
                    'title' => ['type' => 'text', 'required' => false, 'maxLength' => 255],
                    'description' => ['type' => 'text', 'required' => false, 'maxLength' => 1000],
                    'specs' => ['type' => 'json', 'required' => false],
                    'bedrooms' => ['type' => 'increment', 'increment' => 0.5, 'allowZero' => false],
                    'bathrooms' => ['type' => 'increment', 'increment' => 0.25, 'allowZero' => false],
                    'stories' => ['type' => 'increment', 'increment' => 0.5, 'allowZero' => false],
                    'garage' => ['type' => 'increment', 'increment' => 0.5, 'allowZero' => true],
                    'basement_square_footage' => ['type' => 'integer', 'allowZero' => false],
                    'main_square_footage' => ['type' => 'integer', 'allowZero' => false],
                    'garage_square_footage' => ['type' => 'integer', 'allowZero' => false],
                    'upper_square_footage' => ['type' => 'integer', 'allowZero' => false],
                    'width' => ['type' => 'feet_inches', 'allowZero' => false],
                    'depth' => ['type' => 'feet_inches', 'allowZero' => false],
                    'price' => ['type' => 'currency', 'allowZero' => true],
                    'basement' => ['type' => 'enum', 'values' => ['full', 'partial', 'walkout'], 'required' => false],
                    'status' => ['type' => 'enum', 'values' => ['active', 'inactive', 'pending', 'deleted'], 'required' => false],
                    'ordering' => ['type' => 'integer', 'allowZero' => true]
                ];

                // Only validate and include fields that are present in the payload
                $validatedData = [];

                foreach ($validationConfig as $fieldName => $config) {
                    // Check if field exists in $_POST (including empty strings and zero values)
                    if (array_key_exists($fieldName, $_POST)) {
                        $value = $_POST[$fieldName];

                        // Handle special case for required fields
                        if ($config['required'] ?? false) {
                            $validatedData[$fieldName] = validateField($value, $config, ucfirst($fieldName));
                        } else {
                            // For optional fields, only validate if not empty, unless it's explicitly zero
                            if ($value !== '' && $value !== null) {
                                $validatedData[$fieldName] = validateField($value, $config, ucfirst($fieldName));
                            } elseif ($value === '' || $value === null) {
                                // Set to null for empty optional fields
                                $validatedData[$fieldName] = null;
                            }
                        }
                    }
                }

                // Prepare plan data
                $planData = [];

                // Add plan_no for new records
                if (!$isUpdate) {
                    $planData['plan_no'] = $planNo;
                }

                // Add optional fields that were provided and validated
                $optionalFields = [
                    'title',
                    'description',
                    'specs',
                    'bedrooms',
                    'bathrooms',
                    'stories',
                    'garage',
                    'main_square_footage',
                    'basement_square_footage',
                    'garage_square_footage',
                    'upper_square_footage',
                    'width',
                    'depth',
                    'price',
                    'basement',
                    'status',
                    'ordering'
                ];


                foreach ($optionalFields as $field) {
                    if (array_key_exists($field, $validatedData)) {
                        $planData[$field] = $validatedData[$field];
                    }
                }

                if (!isset($planData['status'])) {
                    // Default status to 'pending' if not provided
                    $planData['status'] = 'pending';
                }

                if ($planData['status'] !== 'active' || !isset($planData['ordering']) || $planData['ordering'] < 1) {
                    $planData['ordering'] = null;
                }

                $logger->info("Plan data before " . ($isUpdate ? "update" : "insert") . ": " . json_encode($planData));

                if ($isUpdate) {
                    // Update existing plan
                    $db->update('plans', $planData, "`id` = :id", ['id' => $plansId]);
                } else {
                    // Insert new plan
                    $plansId = $db->insert('plans', $planData);
                }

                setOrdering($planData['ordering'], $plansId, $db);

                // Handle image files

                // Upload new images
                $uploadedImages = [];
                $imageFields = ['rendering', 'floor_plan', 'gallery'];

                $logger->info("_FILES: " . json_encode($_FILES));

                $order = 0;
                foreach ($imageFields as $field) {
                    for ($i = 1; $i < 10; $i++) {
                        $fileKey = "{$field}-$i";
                        if (isset($_FILES[$fileKey]) && $_FILES[$fileKey]['error'] === UPLOAD_ERR_OK) {
                            $uploadedImages[] = handleImageUploads($_FILES[$fileKey], $plansId, $db, $i, $field);
                        } else {
                            $logger->info("No file uploaded for field: $fileKey");
                        }
                    }
                }

                //// Add image alt text
                $imageValues = $_POST['image_values'] ?? '[]';

                foreach (json_decode($imageValues, true) as $img) {
                    $logger->info("Updating image ID {$img['image_id']} with alt text: {$img['alt_text']}");
                    $db->update('plan_images', ['alt_text' => $img['alt_text']], 'id = :id', ['id' => $img['image_id']]);
                }

                $imageIdsToDelete = $_POST['image_ids_to_delete'] ?? '[]';
                $imageIdsToDelete = json_decode($imageIdsToDelete, true) ?: [];

                $logger->info("Image IDs to delete: " . print_r($imageIdsToDelete, true));
                foreach ($imageIdsToDelete as $imageId) {
                    $logger->info("Deleting image ID: $imageId ");
                    $db->delete('plan_images', "`id` = ?", [$imageId]);
                }

                //// Handle notes
                //// Delete existing notes for the plan
                $db->delete('plan_notes', "`plan_id` = ?", [$plansId]);

                //// Insert new note if provided
                if (isset($_POST['notes']) && trim($_POST['notes']) !== '') {
                    $noteData = [
                        'plan_id' => $plansId,
                        'note' => trim($_POST['notes']),
                        'created_at' => date('Y-m-d H:i:s')
                    ];
                    $db->insert('plan_notes', $noteData);
                }

                // Commit transaction
                $conn->commit();

                // Format width and depth for display in response (if they exist)
                if (isset($planData['width'])) {
                    $planData['formatted_width'] = convertDecimalToFeetInches($planData['width'], 2);
                }
                if (isset($planData['depth'])) {
                    $planData['formatted_depth'] = convertDecimalToFeetInches($planData['depth'], 2);
                }

                // Return the created/updated plan data
                $responseData = [
                    'plan_no' => $planNo,
                    'database_id' => $plansId,
                    'is_update' => $isUpdate,
                    'data' => $planData,
                    'images' => $uploadedImages
                ];

                ApiHelpers::successResponse($responseData, $isUpdate ? 'Plan updated successfully' : 'Plan created successfully');
            } catch (InvalidArgumentException $e) {
                // Handle validation errors
                if (isset($conn)) {
                    $conn->rollback();
                }
                ApiHelpers::errorResponse($e->getMessage(), 400);
            } catch (Exception $e) {
                // Rollback transaction on error
                if (isset($conn)) {
                    $conn->rollback();
                }
                ApiHelpers::errorResponse('Failed to ' . ($isUpdate ?? false ? 'update' : 'create') . ' plan: ' . $e->getMessage(), 500);
            }
            break;

        default:
            ApiHelpers::errorResponse('Method not allowed', 405);
            break;
    }
}

/**
 * Handle multiple image files for a plan
 */
function handleImageUploads($file, $planId, $db, $order, $imageType)
{
    global $logger;

    $logger->info("Handling image uploads for plan ID: $planId");

    $hostUrl = $_ENV['API_BASE_URL'];
    $uploadedImages = [];
    $uploadDir = '../files/plans/';

    // Create upload directory if it doesn't exist
    if (!is_dir($uploadDir)) {
        if (!mkdir($uploadDir, 0755, true)) {
            $logger->error("Failed to create upload directory: $uploadDir");
            throw new Exception('Failed to create upload directory');
        }
    }

    // Allowed image types
    $allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    $maxFileSize = 5 * 1024 * 1024; // 5MB


    $fileName = $file['name'];
    $fileTmpName = $file['tmp_name'];
    $fileSize = $file['size'];
    $fileType = $file['type'];

    // Validate file type
    if (!in_array($fileType, $allowedTypes)) {
        throw new Exception("Invalid file type for $fileName. Only JPEG, JPG, and PNG are allowed.");
    }

    // Validate file size
    if ($fileSize > $maxFileSize) {
        throw new Exception("File $fileName is too large. Maximum size is 5MB.");
    }

    // Generate unique filename
    $fileExtension = strtolower(pathinfo($fileName, PATHINFO_EXTENSION));
    $uniqueFileName = 'plan_' . $planId . '_' . time() . '_' . $order . '.' . $fileExtension;
    $filePath = $uploadDir . $uniqueFileName;

    // Move uploaded file
    if (!move_uploaded_file($fileTmpName, $filePath)) {
        throw new Exception("Failed to upload file: $fileName");
    }

    // Generate web-accessible URL
    $imageUrl = '/files/plans/' . $uniqueFileName;

    // Insert into database
    $imageData = [
        'plan_id' => $planId,
        'image_type' => $imageType,
        'file_name' => $fileName,
        'image_url' => $imageUrl,
        'ordering' => $order,
        'status' => 'active'
    ];

    $imageId = $db->insert('plan_images', $imageData);

    $logger->info("Image uploaded and database record created: " . print_r($imageData, true));

    // Add to response array
    return $imageData;
}

// Contact form endpoint (public)
function handleContact($db, $method)
{
    global $logger;
    $logger->info("Handling contact form submission");
    if ($method !== 'POST') {
        ApiHelpers::errorResponse('Method not allowed', 405);
        return;
    }

    try {
        $data = ApiHelpers::getJsonInput();

        $logger->info("Contact form data: " . json_encode($data));

        if (!$data) {
            ApiHelpers::errorResponse('Invalid JSON data', 400);
            return;
        }

        // Validate required fields
        ApiHelpers::validateRequired($data, ['name', 'email', 'message']);

        // Check if reCAPTCHA is required (not in local environment)
        $environment = $_ENV['ENV'] ?? $_ENV['ENVIRONMENT'] ?? 'production';
        $isLocal = strtolower($environment) === 'local';

        if (!$isLocal) {
            // reCAPTCHA is required in non-local environments
            if (empty($data['recaptchaToken'])) {
                ApiHelpers::errorResponse('reCAPTCHA verification is required', 400);
                return;
            }

            if (!SendGrid::verifyRecaptcha($data['recaptchaToken'])) {
                ApiHelpers::errorResponse('reCAPTCHA verification failed', 400);
                return;
            }
        } else {
            // Optional: Verify reCAPTCHA if token is provided in local environment
            if (!empty($data['recaptchaToken'])) {
                if (!SendGrid::verifyRecaptcha($data['recaptchaToken'])) {
                    ApiHelpers::errorResponse('reCAPTCHA verification failed', 400);
                    return;
                }
            }
        }

        // Basic input sanitization
        $name = trim(strip_tags($data['name']));
        $email = trim(strip_tags($data['email']));
        $message = trim(strip_tags($data['message']));

        // Validate length
        if (strlen($name) < 2 || strlen($name) > 100) {
            ApiHelpers::errorResponse('Name must be between 2 and 100 characters', 400);
            return;
        }

        if (strlen($message) < 10 || strlen($message) > 5000) {
            ApiHelpers::errorResponse('Message must be between 10 and 5000 characters', 400);
            return;
        }

        // Send email using SendGrid
        $sendGrid = new SendGrid($db);
        $result = $sendGrid->sendContactEmail($name, $email, $message);

        ApiHelpers::successResponse([
            'sent' => true,
            'timestamp' => date('Y-m-d H:i:s')
        ], 'Message sent successfully');
    } catch (Exception $e) {
        $logger->error("Contact form error: " . $e->getMessage());
        ApiHelpers::errorResponse('Failed to send message. Please try again later.', 500);
    }
}

function getUserSelectSql()
{
    return "SELECT id, role_id, firstname, lastname, address, city, state, zip, email, phone,
                   timezone_id, signup_method, google_id, email_verified, verification_token,
                   reset_token, reset_token_timestamp, created AS created_at, modified AS updated_at,
                   status, CONCAT_WS(' ', firstname, lastname) AS name
            FROM users";
}

function fetchUserById($db, $userId)
{
    return $db->fetchOne(getUserSelectSql() . " WHERE id = ?", [$userId]);
}

// Protected users endpoint
function handleUsers($db, $method, $segments)
{
    switch ($method) {
        case 'GET':
            try {
                if (isset($segments[2])) {
                    // Get specific user
                    $userId = (int)$segments[2];
                    $user = fetchUserById($db, $userId);

                    if (!$user) {
                        ApiHelpers::errorResponse('User not found', 404);
                    }

                    ApiHelpers::successResponse($user);
                } else {
                    // Get all users
                    $users = $db->fetchAll(getUserSelectSql() . " ORDER BY created DESC");
                    ApiHelpers::successResponse($users);
                }
            } catch (Exception $e) {
                ApiHelpers::errorResponse('Failed to fetch users', 500);
            }
            break;

        case 'POST':
            try {
                $data = ApiHelpers::getJsonInput();

                if (!$data) {
                    ApiHelpers::errorResponse('Invalid JSON data', 400);
                }

                ApiHelpers::validateRequired($data, ['email']);

                if (!filter_var($data['email'], FILTER_VALIDATE_EMAIL)) {
                    ApiHelpers::errorResponse('Invalid email format', 400);
                }

                $firstname = trim((string)($data['firstname'] ?? ''));
                $lastname = trim((string)($data['lastname'] ?? ''));
                $name = trim((string)($data['name'] ?? ''));

                if ($name !== '' && $firstname === '' && $lastname === '') {
                    $nameParts = preg_split('/\s+/', $name, 2);
                    $firstname = $nameParts[0] ?? '';
                    $lastname = $nameParts[1] ?? '';
                }

                $userData = [
                    'email' => $data['email']
                ];

                if ($firstname !== '') {
                    $userData['firstname'] = $firstname;
                }
                if ($lastname !== '') {
                    $userData['lastname'] = $lastname;
                }
                if (isset($data['role_id'])) {
                    $userData['role_id'] = (int)$data['role_id'];
                }
                if (!empty($data['status'])) {
                    $userData['status'] = $data['status'];
                }

                $userId = $db->insert('users', $userData);

                $user = fetchUserById($db, $userId);

                ApiHelpers::successResponse($user, 'User created successfully');
            } catch (Exception $e) {
                if (strpos($e->getMessage(), 'Duplicate entry') !== false) {
                    ApiHelpers::errorResponse('Email already exists', 409);
                }
                ApiHelpers::errorResponse('Failed to create user', 500);
            }
            break;

        default:
            ApiHelpers::errorResponse('Method not allowed', 405);
    }
}

function handleSignup($db, $method)
{
    global $logger;
    if ($method === 'POST') {
        $data = ApiHelpers::getJsonInput();

        $logger->info("Signup attempt data: " . print_r($data, true));

        if (!$data) {
            ApiHelpers::errorResponse('Invalid JSON data', 400);
            return;
        }

        ApiHelpers::validateRequired($data, ['email', 'password']);

        // Check if user already exists
        $existingUser = $db->fetchOne("SELECT * FROM users WHERE email = ? AND status != 'deleted'", [$data['email']]);
        if ($existingUser) {
            ApiHelpers::errorResponse('Email already registered', 409);
            return;
        }

        // Hash the password
        $hashedPassword = password_hash($data['password'], PASSWORD_BCRYPT);

        // Create new user
        $userId = $db->insert('users', [
            'email' => $data['email'],
            'password' => $hashedPassword,
            'role_id' => 3 // Default role (e.g., regular user)
        ]);

        $user = $db->fetchOne("SELECT email FROM users WHERE id = ?", [$userId]);

        ApiHelpers::successResponse($user, 'User registered successfully');
    } else {
        ApiHelpers::errorResponse('Method not allowed', 405);
    }
}

function isDevelopmentEnvironment()
{
    $env = strtolower(trim((string) ($_ENV['ENV'] ?? '')));
    return in_array($env, ['local', 'dev', 'development'], true);
}

function getTableColumns($db, $tableName)
{
    static $tableColumns = [];

    if (isset($tableColumns[$tableName])) {
        return $tableColumns[$tableName];
    }

    $columns = [];
    $rows = $db->fetchAll("SHOW COLUMNS FROM {$tableName}");
    foreach ($rows as $row) {
        if (!empty($row['Field'])) {
            $columns[$row['Field']] = true;
        }
    }

    $tableColumns[$tableName] = $columns;
    return $columns;
}

function getDevelopmentLoginCredentials()
{
    return [
        'email' => 'dev@ochoworksdesigns.local',
        'password' => 'dev-password-123'
    ];
}

function ensureDevelopmentLoginUser($db)
{
    global $logger;

    if (!isDevelopmentEnvironment()) {
        return;
    }

    $credentials = getDevelopmentLoginCredentials();
    $adminRoleId = (int) ($_ENV['ADMIN_ROLE_ID'] ?? 1);
    $userColumns = getTableColumns($db, 'users');
    $selectFields = ['id', 'email', 'password'];

    foreach (['role_id', 'firstname', 'lastname', 'name', 'email_verified', 'status'] as $field) {
        if (isset($userColumns[$field])) {
            $selectFields[] = $field;
        }
    }

    $existingUser = $db->fetchOne(
        "SELECT " . implode(', ', $selectFields) . " FROM users WHERE email = ? LIMIT 1",
        [$credentials['email']]
    );

    $passwordHash = password_hash($credentials['password'], PASSWORD_BCRYPT);
    $userData = [
        'email' => $credentials['email'],
        'password' => $passwordHash
    ];

    if (isset($userColumns['role_id'])) {
        $userData['role_id'] = $adminRoleId;
    }
    if (isset($userColumns['firstname'])) {
        $userData['firstname'] = 'Dev';
    }
    if (isset($userColumns['lastname'])) {
        $userData['lastname'] = 'Admin';
    }
    if (isset($userColumns['name'])) {
        $userData['name'] = 'Dev Admin';
    }
    if (isset($userColumns['status'])) {
        $userData['status'] = 'active';
    }
    if (isset($userColumns['email_verified'])) {
        $userData['email_verified'] = 1;
    }

    if (!$existingUser) {
        $db->insert('users', $userData);
        $logger->info("Created development login user for local environment");
        return;
    }

    $hasExpectedPassword = !empty($existingUser['password']) && password_verify($credentials['password'], $existingUser['password']);
    $hasExpectedProfile = true;

    if (isset($userColumns['role_id'])) {
        $hasExpectedProfile = $hasExpectedProfile && (int) ($existingUser['role_id'] ?? 0) === $adminRoleId;
    }
    if (isset($userColumns['firstname'])) {
        $hasExpectedProfile = $hasExpectedProfile && ($existingUser['firstname'] ?? '') === 'Dev';
    }
    if (isset($userColumns['lastname'])) {
        $hasExpectedProfile = $hasExpectedProfile && ($existingUser['lastname'] ?? '') === 'Admin';
    }
    if (isset($userColumns['name'])) {
        $hasExpectedProfile = $hasExpectedProfile && ($existingUser['name'] ?? '') === 'Dev Admin';
    }
    if (isset($userColumns['email_verified'])) {
        $hasExpectedProfile = $hasExpectedProfile && (int) ($existingUser['email_verified'] ?? 0) === 1;
    }
    if (isset($userColumns['status'])) {
        $hasExpectedProfile = $hasExpectedProfile && ($existingUser['status'] ?? '') === 'active';
    }

    if ($hasExpectedPassword && $hasExpectedProfile) {
        return;
    }

    $db->update('users', $userData, 'id = :id', ['id' => $existingUser['id']]);
    $logger->info("Updated development login user for local environment");
}

function getLoginUserRoleId($user)
{
    if (isset($user['role_id'])) {
        return (int) $user['role_id'];
    }

    if (
        isDevelopmentEnvironment() &&
        isset($user['email']) &&
        $user['email'] === getDevelopmentLoginCredentials()['email']
    ) {
        return (int) ($_ENV['ADMIN_ROLE_ID'] ?? 1);
    }

    return 0;
}

function handleLogin($db, $method)
{
    global $logger;
    if ($method === 'POST') {
        $data = ApiHelpers::getJsonInput();

        $logger->info("Login attempt data: " . print_r($data, true));
        if (!$data) {
            ApiHelpers::errorResponse('Invalid JSON data', 400);
            return;
        }

        ApiHelpers::validateRequired($data, ['email', 'password']);

        ensureDevelopmentLoginUser($db);

        // Check user credentials
        $user = $db->fetchOne("SELECT * FROM users WHERE email = ?", [$data['email']]);

        if (!$user || !password_verify($data['password'], $user['password'])) {
            ApiHelpers::errorResponse('Invalid email or password', 401);
            return;
        }

        // Generate JWT token
        // $token = JwtHelpers::generateToken($user['id'], $user['role_id']);
        $token = ApiHelpers::generateToken([
            'id' => $user['id'],
            'role_id' => getLoginUserRoleId($user)
        ]);
        ApiHelpers::successResponse(['token' => $token], 'Login successful');
    } else {
        ApiHelpers::errorResponse('Method not allowed', 405);
    }
}

// Protected admin endpoint
function handleAdmin($db, $method, $segments)
{
    global $logger;

    if (!isset($segments[2])) {
        ApiHelpers::errorResponse('Admin endpoint not specified', 404);
        return;
    }


    switch ($segments[2]) {
        case 'posts':
            if ($method === 'GET') {
                try {
                    // Admin can see all posts including drafts
                    $posts = $db->fetchAll("
                        SELECT bp.*, bp.author AS author_name
                        FROM blog_posts bp
                        ORDER BY bp.created_at DESC
                    ");

                    ApiHelpers::successResponse($posts);
                } catch (Exception $e) {
                    ApiHelpers::errorResponse('Failed to fetch posts', 500);
                }
            } else {
                ApiHelpers::errorResponse('Method not allowed', 405);
            }
            break;

        case 'emails':
            if ($method === 'GET') {
                try {
                    $sendGrid = new SendGrid($db);

                    // Get pagination parameters
                    $limit = isset($_GET['limit']) ? min((int)$_GET['limit'], 100) : 50;
                    $offset = isset($_GET['offset']) ? (int)$_GET['offset'] : 0;

                    $emails = $sendGrid->getEmailLogs($limit, $offset);

                    ApiHelpers::successResponse([
                        'emails' => $emails,
                        'pagination' => [
                            'limit' => $limit,
                            'offset' => $offset,
                            'count' => count($emails)
                        ]
                    ]);
                } catch (Exception $e) {
                    echo ("Email logs error: " . $e->getMessage());
                    ApiHelpers::errorResponse('Failed to fetch email logs', 500);
                }
            } else {
                ApiHelpers::errorResponse('Method not allowed', 405);
            }
            break;

        case 'email-stats':
            if ($method === 'GET') {
                try {
                    $sendGrid = new SendGrid($db);
                    $stats = $sendGrid->getEmailStats();

                    ApiHelpers::successResponse($stats);
                } catch (Exception $e) {
                    ApiHelpers::errorResponse('Failed to fetch email statistics', 500);
                }
            } else {
                ApiHelpers::errorResponse('Method not allowed', 405);
            }
            break;

        case 'sitemap':
            switch ($method) {
                case 'POST':
                    try {
                        $logger->info("segments: " . print_r($segments, true));

                        $which = count($segments) > 3 ? $segments[3] : null;

                        if (!$which) {
                            ApiHelpers::errorResponse('Invalid sitemap action', 400);
                            return;
                        }

                        switch ($which) {
                            case 'post':
                                $blogPostId = count($segments) > 4 ? (int)$segments[4] : null;
                                $logger->info("Generating sitemap blogPostId: $blogPostId");
                                if (!updateSitemapWithBlogPost($blogPostId)) {
                                    ApiHelpers::errorResponse('Failed to update sitemap', 500);
                                    return;
                                }
                                break;
                            case 'regenerate':
                                $results = regenerateBlogSitemap();
                                ApiHelpers::successResponse($results, 'Sitemap regenerated successfully');

                                break;
                            case 'manage':

                                $data = ApiHelpers::getJsonInput();

                                if (!$data) {
                                    ApiHelpers::errorResponse('Invalid JSON data', 400);
                                    return;
                                }

                                $results = [];

                                $logger->info("Sitemap manage data: " . print_r($data, true));

                                foreach ($data['urls'] as $urlData) {
                                    // Validate required fields
                                    ApiHelpers::validateRequired($urlData, ['loc']);

                                    $loc = trim($urlData['loc']);
                                    $lastmod = isset($urlData['lastmod']) ? trim($urlData['lastmod']) : date('Y-m-d');
                                    $changefreq = isset($urlData['changefreq']) ? trim($urlData['changefreq']) : 'monthly';
                                    $priority = isset($urlData['priority']) ? trim($urlData['priority']) : '0.5';

                                    $result = manageSitemapEntry($loc, $lastmod, $changefreq, $priority);
                                    if ($result) {
                                        $results[] = ['loc' => $loc, 'success' => true];
                                    } else {
                                        $results[] = ['loc' => $loc, 'success' => false];
                                    }
                                }
                                ApiHelpers::successResponse($results, 'Sitemap entry managed successfully');

                                break;

                            case 'notify':
                                $results = notifySearchEngines();
                                ApiHelpers::successResponse($results, 'Search engines notified successfully');
                                break;
                            default:
                                ApiHelpers::errorResponse('Invalid sitemap request', 400);
                                return;
                        }
                    } catch (Exception $e) {
                        $logger->error("Sitemap update error: " . $e->getMessage());
                        ApiHelpers::errorResponse('Failed to update sitemap: ' . $e->getMessage(), 500);
                        return;
                    }
                    $logger->info("Sitemap update process completed");
                    ApiHelpers::successResponse(['updated' => true], 'Sitemap updated successfully');
                    break;

                default:
                    ApiHelpers::errorResponse('Method not allowed', 405);
                    break;
            }
            break;

        case 'cities':
            if ($method === 'GET') {
                try {
                    $cities = $db->fetchAll("SELECT city, count(*) as cnt FROM ochoworksdesigns.contacts where city is not null group by city order by city;");
                    ApiHelpers::successResponse($cities);
                } catch (Exception $e) {
                    ApiHelpers::errorResponse('Failed to fetch cities', 500);
                }
            } else {
                ApiHelpers::errorResponse('Method not allowed', 405);
            }
            break;

        case 'states':
            if ($method === 'GET') {
                try {
                    $states = $db->fetchAll("SELECT state, count(*) as cnt FROM ochoworksdesigns.contacts where state is not null group by state order by state;");
                    ApiHelpers::successResponse($states);
                } catch (Exception $e) {
                    ApiHelpers::errorResponse('Failed to fetch cities', 500);
                }
            } else {
                ApiHelpers::errorResponse('Method not allowed', 405);
            }
            break;

        default:
            ApiHelpers::errorResponse('Admin endpoint not found', 404);
    }
}

function parseMultipartFormData($input)
{
    // Get boundary
    $contentType = $_SERVER['CONTENT_TYPE'] ?? '';
    preg_match('/boundary=(.*)$/', $contentType, $matches);

    if (!isset($matches[1])) {
        return [];
    }

    $boundary = '--' . $matches[1];
    $blocks = preg_split("/-+$matches[1]/", $input);
    array_pop($blocks); // Remove last empty block

    $data = [];

    foreach ($blocks as $block) {
        if (empty($block)) continue;

        if (strpos($block, 'application/octet-stream') !== false) {
            // Handle file uploads if needed
            continue;
        }

        preg_match('/name=\"([^\"]*)\"[\n|\r]+([^\n\r].*)?\r$/s', $block, $matches);
        if (isset($matches[1]) && isset($matches[2])) {
            $data[$matches[1]] = trim($matches[2]);
        }
    }

    return $data;
}

/**
 * Handle public blog endpoints
 */
function handleBlog($db, $method, $segments)
{
    global $logger;

    switch ($method) {
        case 'GET':
            return handleGetBlog($db, $segments);
            break;
        case 'POST':
            ApiHelpers::verifyToken();
            return handleBlogPosts($db, $method, $segments);
            break;

        case 'PUT':
            ApiHelpers::verifyToken();
            return handleBlogPosts($db, $method, $segments);
            break;

        default:
            ApiHelpers::errorResponse('Method not allowed', 405);
            break;
    }
}

function handleGetBlog($db, $segments)
{
    global $logger;

    // Check if we have a specific blog post request
    // Expected: blog/{slug} or blog/{id}
    if (count($segments) >= 3) {
        $identifier = $segments[2];

        $statusFilter = " AND bp.status = 'published'";

        $isAdmin = ApiHelpers::isAdmin(); // Just to log the user if admin
        $logger->info("Fetching blog post for identifier: $identifier | Is Admin: " . ($isAdmin ? 'Yes' : 'No'));

        if ($isAdmin) {
            // Admins can see all posts including drafts
            $statusFilter = " AND bp.status IN ('published', 'draft', 'archived')";
        }

        // Try to get by slug first, then by ID if numeric
        if (is_numeric($identifier)) {
            $blogPost = $db->fetchOne(
                "SELECT bp.*, 
                        GROUP_CONCAT(DISTINCT t.name) as tags
                 FROM blog_posts bp
                 LEFT JOIN blog_post_tags bpt ON bp.id = bpt.blog_post_id
                 LEFT JOIN tags t ON bpt.tag_id = t.id
                 WHERE bp.id = ? $statusFilter
                 GROUP BY bp.id",
                [$identifier]
            );
        } else {
            $blogPost = $db->fetchOne(
                "SELECT bp.*, 
                        GROUP_CONCAT(DISTINCT t.name) as tags
                 FROM blog_posts bp
                 LEFT JOIN blog_post_tags bpt ON bp.id = bpt.blog_post_id
                 LEFT JOIN tags t ON bpt.tag_id = t.id
                 WHERE bp.slug = ? $statusFilter
                 GROUP BY bp.id",
                [$identifier]
            );
        }

        if (!$blogPost) {
            ApiHelpers::errorResponse('Blog post not found', 404);
            return;
        }

        $blogPostId = $blogPost['id'];

        // Get gallery images
        $images = $db->fetchAll(
            "SELECT id, is_featured, image_url, alt_text, sort_order
             FROM blog_post_images 
             WHERE blog_post_id = ? 
             ORDER BY sort_order ASC",
            [$blogPostId]
        );

        $featuredImage = null;
        foreach ($images as $img) {
            if ($img['is_featured']) {
                $featuredImage = $img['image_url'];
                break;
            }
        }

        //// Fetch from blog_post_keywords and return in comma separated string
        $keywords = $db->fetchAll(
            "SELECT keyword 
             FROM blog_post_keywords 
             WHERE blog_post_id = ?",
            [$blogPostId]
        );

        //// increment view count (only for published posts and non-admins)
        if (!$isAdmin && $blogPost['status'] === 'published') {
            try {
                $db->query("UPDATE blog_posts SET views = views + 1 WHERE id = ?", [$blogPostId]);
            } catch (Exception $e) {
                $logger->error("Failed to increment view count for blog post ID $blogPostId: " . $e->getMessage());
            }
        }

        $blogPost['meta_keywords'] = implode(',', array_column($keywords, 'keyword'));
        $blogPost['featured_image'] = $featuredImage;
        $blogPost['tags'] = $blogPost['tags'] ? explode(',', $blogPost['tags']) : [];
        $blogPost['images'] = $images;
        $blogPost['views'] = (int)$blogPost['views'];

        ApiHelpers::successResponse($blogPost);
        return;
    }

    // Get all published blog posts with pagination
    try {
        $logger->info("Fetching all published blog posts get request: " . print_r($_GET, true));
        $limit = isset($_GET['per_page']) ? min((int)$_GET['per_page'], 100) : 10;
        $page = isset($_GET['page']) ? max((int)$_GET['page'], 1) : 1;
        $offset = ($page - 1) * $limit;

        $searchFilter = '';
        $values = [];
        if (isset($_GET['category']) && !empty($_GET['category'])) {
            $category = trim(strip_tags($_GET['category']));
            $searchFilter = " AND bp.category = ?";
            $values[] = $category;
        }

        //// set search filter
        if (isset($_GET['search']) && !empty($_GET['search'])) {
            $search = '%' . trim(strip_tags($_GET['search'])) . '%';
            $searchFilter .= " AND (bp.title LIKE ? OR bp.content LIKE ? OR bp.excerpt LIKE ? OR t.name LIKE ? OR EXISTS (SELECT 1 
            FROM blog_post_tags bpt2 
            JOIN tags t2 ON bpt2.tag_id = t2.id 
            WHERE bpt2.blog_post_id = bp.id 
            AND t2.name LIKE ?))";
            $values[] = $search;
            $values[] = $search;
            $values[] = $search;
            $values[] = $search;
            $values[] = $search;
        }

        $statusFilter = " bp.status = 'published'";

        $isAdmin = ApiHelpers::isAdmin(); // Just to log the user if admin
        $logger->info("Is Admin: " . ($isAdmin ? 'Yes' : 'No'));
        if ($isAdmin) {
            // Admins can see all posts including drafts

            if (isset($_GET['status']) && !empty($_GET['status'])) {
                $statusString = $_GET['status'];

                // Split the comma-separated string into an array and trim whitespace
                $statusArray = array_map('trim', explode(',', $statusString));

                // Remove any empty values
                $statusArray = array_filter($statusArray, function ($status) {
                    return !empty($status);
                });

                if (!empty($statusArray)) {
                    // Create placeholders for the IN clause
                    $placeholders = str_repeat('?,', count($statusArray) - 1) . '?';
                    $statusFilter = " bp.status IN ($placeholders)";

                    // Add each status to the values array at the beginning
                    $values = array_merge($statusArray, $values);
                }
            }
        }

        // Get total count
        $results = $db->fetchAll("SELECT bp.*, 
                        GROUP_CONCAT(DISTINCT t.name) as tags 
                        FROM blog_posts bp 
                        LEFT JOIN blog_post_tags bpt ON bp.id = bpt.blog_post_id
                        LEFT JOIN tags t ON bpt.tag_id = t.id
                        WHERE $statusFilter $searchFilter
                        GROUP BY bp.id", $values);

        $logger->info("Total results fetched: " . count($results));

        $totalCount = count($results);
        $totalPages = $totalCount > 0 ? ceil($totalCount / $limit) : 1;

        // Get blog posts with tags
        $blogPosts = $db->fetchAll(
            "SELECT bp.*,
                    GROUP_CONCAT(DISTINCT t.name) as tags
             FROM blog_posts bp
             LEFT JOIN blog_post_tags bpt ON bp.id = bpt.blog_post_id
             LEFT JOIN tags t ON bpt.tag_id = t.id
             WHERE $statusFilter $searchFilter
             GROUP BY bp.id
             ORDER BY bp.featured DESC, bp.created_at DESC
             LIMIT $limit OFFSET $offset",
            $values
        );

        // Process tags for each post
        foreach ($blogPosts as &$post) {
            $post['tags'] = $post['tags'] ? explode(',', $post['tags']) : [];
        }

        $defaultImgUrl = $_ENV['APP_BASE_URL'] . $_ENV['APP_POST_DEFAULT_IMAGE'];

        //// Get featured image for each post
        foreach ($blogPosts as &$post) {
            $featuredImage = $db->fetchOne(
                "SELECT image_url 
                 FROM blog_post_images 
                 WHERE blog_post_id = ? AND is_featured = 1 
                 LIMIT 1",
                [$post['id']]
            );
            $post['featured_image'] = $featuredImage ? $featuredImage['image_url'] : $defaultImgUrl;
        }

        $data = [
            'count' => count($blogPosts),
            'total' => (int)$totalCount,
            'pagination' => [
                'limit' => $limit,
                'page' => $page,
                'total_pages' => $totalPages,
                'has_next' => $page < $totalPages,
                'has_previous' => $page > 1
            ],
            'posts' => $blogPosts
        ];

        ApiHelpers::successResponse($data);
    } catch (Exception $e) {
        $logger->error("Error fetching blog posts: " . $e->getMessage());
        ApiHelpers::errorResponse('Failed to fetch blog posts', 500);
    }
}

/**
 * Handle protected blog posts management (admin only)
 */
function handleBlogPosts($db, $method, $segments)
{
    global $logger;
    try {
        $postData = ApiHelpers::getJsonInput();
        $data = $postData['blogs'][0] ?? null;

        $logger->info("POST data: " . print_r($data, true));

        $postId = null;

        if ($method == 'PUT') {
            $logger->info("segments: " . print_r($segments, true));

            $postId = $segments[2] ?? null;
            if (!$postId) {
                throw new InvalidArgumentException('Blog post ID is required for update');
            }
        }

        // Start transaction
        $conn = $db->getConnection();
        $conn->beginTransaction();

        // Validate and sanitize input data
        $title =  array_key_exists('title', $data) ? trim(strip_tags($data['title'])) : null;
        $content = array_key_exists('content', $data) ? trim($data['content']) : null; // Don't strip tags from content as it may contain HTML
        $author = array_key_exists('author', $data) ? trim(strip_tags($data['author'])) : 'Randy'; // Default to 'Randy' if not provided
        $category = array_key_exists('category', $data) ? trim(strip_tags($data['category'])) : null;
        $excerpt = array_key_exists('excerpt', $data) ? trim(strip_tags($data['excerpt'])) : null;
        $status = array_key_exists('status', $data) ? $data['status'] : 'draft';
        $metaTitle = array_key_exists('meta_title', $data) ? trim(strip_tags($data['meta_title'])) : null;
        $metaDescription = array_key_exists('meta_description', $data) ? trim(strip_tags($data['meta_description'])) : null;
        $metaKeywords = array_key_exists('meta_keywords', $data) ? trim(strip_tags($data['meta_keywords'])) : null;
        $slug = array_key_exists('slug', $data) ? trim(strip_tags($data['slug'])) : null;
        $tags = array_key_exists('tags', $data) ? $data['tags'] : [];

        $images = array_key_exists('images', $data) ? $data['images'] : [];
        $planNo = array_key_exists('plan_no', $data) ? trim(strip_tags($data['plan_no'])) : null;

        $planId = null;

        if ($planNo) {
            //// check if plan exists
            $plan = $db->fetchOne("SELECT id FROM plans WHERE plan_no = ?", [$planNo]);
            $planId = $plan['id'] ?? null;

            //// If not plan record found, throw error
            if (!$plan) {
                throw new InvalidArgumentException('Invalid plan number provided');
            }
        }

        // Validate title length
        if (strlen($title) < 3 || strlen($title) > 255) {
            throw new InvalidArgumentException('Title must be between 3 and 255 characters');
        }

        // Validate content length
        if (strlen($content) < 10) {
            throw new InvalidArgumentException('Content must be at least 10 characters long');
        }

        // Validate excerpt length
        if (strlen($excerpt) > 500) {
            throw new InvalidArgumentException('Excerpt cannot exceed 500 characters');
        }

        // Validate meta description length
        if ($metaDescription && strlen($metaDescription) > 160) {
            throw new InvalidArgumentException('Meta description cannot exceed 160 characters');
        }

        // Validate status
        $allowedStatuses = ['draft', 'published', 'pending'];
        if (!in_array($status, $allowedStatuses)) {
            throw new InvalidArgumentException('Invalid status value');
        }

        // Set slug as unique
        if ($postId) {
            // For updates, fetch existing slug if not provided
            $existingPost = $db->fetchOne("SELECT slug FROM blog_posts WHERE slug = ? and id = ?", [$slug, $postId]);
            if (!$existingPost) {
                $slugs = $db->fetchAll("SELECT id FROM blog_posts WHERE slug like '$slug%'");
                $cnt = count($slugs);
                $slug = "$slug-" . ($cnt + 1);
            }
        } else {
            $slugs = $db->fetchAll("SELECT id FROM blog_posts WHERE slug like '$slug%'");
            $cnt = count($slugs);

            $slug = "$slug-" . ($cnt + 1);
        }

        // Prepare blog post data
        $blogPostData = [
            'title' => $title,
            'slug' => $slug,
            'content' => $content,
            'excerpt' => $excerpt,
            'author' => $author,
            'category' => $category,
            'status' => $status,
            'meta_title' => $metaTitle,
            'meta_description' => $metaDescription,
            'plan_id' => $planId,
        ];

        $logger->info("Blog post data to insert: " . json_encode($blogPostData));

        if ($postId) {
            // Update existing post
            $db->update('blog_posts', $blogPostData, "`id` = :id", ['id' => $postId]);
            $logger->info("Updated blog post with ID: $postId");

            // Clear existing tags and images
            $db->delete('blog_post_tags', "`blog_post_id` = ?", [$postId]);
            $db->delete('blog_post_images', "`blog_post_id` = ?", [$postId]);
            $db->delete('blog_post_keywords', "`blog_post_id` = ?", [$postId]);
        } else {
            $postId = $db->insert('blog_posts', $blogPostData);
        }

        if (!$postId) {
            throw new Exception('Failed to create blog post record');
        }

        $logger->info("Created blog post with ID: $postId");

        //// Insert Keywords
        if (!empty($metaKeywords)) {
            $keywordArr = array_map('trim', explode(',', $metaKeywords));
            foreach ($keywordArr as $keyword) {
                if (!empty($keyword)) {
                    $db->insert('blog_post_keywords', [
                        'blog_post_id' => $postId,
                        'keyword' => $keyword
                    ]);
                }
            }
        }

        // Handle tags
        if (!empty($tags) && is_array($tags)) {
            handleBlogTags($db, $postId, $tags);
        }

        //// insert image urls
        foreach ($images as $index => $image) {
            $isFeatured = isset($image['isFeatured']) ? (int)$image['isFeatured'] : 0;
            $imageData = [
                'blog_post_id' => $postId,
                'image_url' => $image['url'],
                'alt_text' => $image['alt'] ?? null,
                'sort_order' => $image['sort_order'] ?? $index,
                'is_featured' => $isFeatured
            ];

            $db->insert('blog_post_images', $imageData);
        }




        // Commit transaction
        $conn->commit();

        $logger->info("Blog post created successfully: " . json_encode($blogPostData));

        $blogPostData['blog_post_id'] = $postId;

        ApiHelpers::successResponse($blogPostData, 'Blog post created successfully');
    } catch (InvalidArgumentException $e) {
        if (isset($conn)) {
            $conn->rollback();
        }
        $logger->error("Blog post validation error: " . $e->getMessage());
        ApiHelpers::errorResponse($e->getMessage(), 400);
    } catch (Exception $e) {
        if (isset($conn)) {
            $conn->rollback();
        }
        $logger->error("Blog post creation error: " . $e->getMessage());
        ApiHelpers::errorResponse('Failed to create blog post: ' . $e->getMessage(), 500);
    }
}

/**
 * Handle blog tags for a post
 */
function handleBlogTags($db, $postId, $tags)
{
    foreach ($tags as $tagName) {
        $tagName = trim($tagName);
        if (empty($tagName)) continue;

        // Get or create tag
        $tag = $db->fetchOne("SELECT id FROM tags WHERE name = ?", [$tagName]);

        if (!$tag) {
            $tagId = $db->insert('tags', [
                'name' => $tagName,
                'created_at' => date('Y-m-d H:i:s')
            ]);
        } else {
            $tagId = $tag['id'];
        }

        // Link tag to post
        $db->insert('blog_post_tags', [
            'blog_post_id' => $postId,
            'tag_id' => $tagId
        ]);
    }
}

/**
 * Handle blog gallery images
 */
function handleBlogImages($db, $postId, $images)
{
    foreach ($images as $index => $image) {
        $imageData = [
            'blog_post_id' => $postId,
            'image_url' => $image['image_url'],
            'image_type' => $image['image_type'] ?? 'general',
            'caption' => $image['caption'] ?? null,
            'alt_text' => $image['alt_text'] ?? null,
            'sort_order' => $image['sort_order'] ?? $index,
            'is_featured' => !empty($image['is_featured']) ? 1 : 0
        ];

        $db->insert('blog_post_images', $imageData);
    }
}

/**
 * Generate URL-friendly slug from title
 */
function generateSlug($title)
{
    // Convert to lowercase
    $slug = strtolower($title);

    // Replace non-letter or digits with hyphens
    $slug = preg_replace('/[^a-z0-9]+/', '-', $slug);

    // Remove leading/trailing hyphens
    $slug = trim($slug, '-');

    return $slug;
}

function handleBlogFileUploads($files, $postId, $db, $logger)
{
    $logger->info("Handling file uploads for blog post ID: $postId");

    $hostUrl = $_ENV['API_BASE_URL'];
    $uploadedFiles = [];
    $uploadDir = '../files/blog/';

    // Create upload directory if it doesn't exist
    if (!is_dir($uploadDir)) {
        if (!mkdir($uploadDir, 0755, true)) {
            $logger->error("Failed to create upload directory: $uploadDir");
            throw new Exception('Failed to create upload directory');
        }
    }

    // Allowed file types
    $allowedImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    $allowedTypes = $allowedImageTypes;
    $maxFileSize = 5 * 1024 * 1024; // 5MB

    // Handle multiple files
    $fileCount = count($files['name']);

    for ($i = 0; $i < $fileCount; $i++) {
        // Skip if no file uploaded
        if ($files['error'][$i] === UPLOAD_ERR_NO_FILE) {
            continue;
        }

        // Check for upload errors
        if ($files['error'][$i] !== UPLOAD_ERR_OK) {
            throw new Exception('File upload error for file ' . ($i + 1));
        }

        $fileName = $files['name'][$i];
        $fileTmpName = $files['tmp_name'][$i];
        $fileSize = $files['size'][$i];
        $fileType = $files['type'][$i];

        // Validate file type
        if (!in_array($fileType, $allowedTypes)) {
            throw new Exception("Invalid file type for $fileName. Only JPEG, JPG, PNG, GIF, and WEBP files are allowed.");
        }

        // Validate file size
        if ($fileSize > $maxFileSize) {
            throw new Exception("File $fileName is too large. Maximum size is 5MB.");
        }

        // Generate unique filename
        $fileExtension = strtolower(pathinfo($fileName, PATHINFO_EXTENSION));
        $uniqueFileName = 'blog_' . $postId . '_' . time() . '_' . $i . '.' . $fileExtension;
        $filePath = $uploadDir . $uniqueFileName;

        $imageInfo = getimagesize($fileTmpName);
        if ($imageInfo === false) {
            throw new Exception("File $fileName is not a valid image file");
        }

        // Move uploaded file
        if (!move_uploaded_file($fileTmpName, $filePath)) {
            throw new Exception("Failed to upload file: $fileName");
        }

        // Generate web-accessible URL
        $fileUrl = '/files/blog/' . $uniqueFileName;

        // Persist uploaded blog media using the active blog_post_images schema.
        $imageData = [
            'blog_post_id' => $postId,
            'image_url' => $fileUrl,
            'image_type' => 'general',
            'sort_order' => $i + 1,
            'alt_text' => null,
            'caption' => null,
            'is_featured' => 0
        ];

        $imageId = $db->insert('blog_post_images', $imageData);

        // Add to response array
        $uploadedFiles[] = [
            'id' => $imageId,
            'original_name' => $fileName,
            'file_name' => $uniqueFileName,
            'url' => $hostUrl . $fileUrl,
            'type' => 'image',
            'mime_type' => $fileType,
            'size' => $fileSize,
            'sort_order' => $i + 1
        ];

        $logger->info("Successfully uploaded file: $fileName as $uniqueFileName");
    }

    return $uploadedFiles;
}

function handleUtilities($db, $method, $segments)
{
    global $logger;

    if ($method !== 'GET') {
        ApiHelpers::errorResponse('Method not allowed', 405);
        return;
    }

    try {

        $logger->info("Fetching utilities " . print_r($segments, true));

        if (count($segments) < 3) {
            ApiHelpers::errorResponse('Utility type not specified', 400);
            return;
        }

        $segment = $segments[2];

        $logger->info("Fetching utilities for segment: $segment");

        $data = [];

        switch ($segment) {
            case 'categories':
                $data = fetchCategories($db);
                break;

            case 'tags':
                $data = $db->fetchAll("SELECT id, name FROM tags WHERE status = 'active' ORDER BY name ASC");
                break;

            default:
                ApiHelpers::errorResponse('Unknown utility type', 400);
        }

        ApiHelpers::successResponse($data);
    } catch (Exception $e) {
        ApiHelpers::errorResponse('Failed to fetch categories', 500);
    }
}


function fetchCategories($db)
{
    $qry = "SELECT c1.id, c1.name,c1.slug,c1.status,c1.sort_order";
    $qry .= ", CASE WHEN c1.parent_id IS NULL THEN 'Main Category' ELSE CONCAT('Subcategory of: ', c2.name)END AS category_type";
    $qry .= " FROM categories c1";
    $qry .= " LEFT JOIN categories c2 ON c1.parent_id = c2.id";
    $qry .= " ORDER BY COALESCE(c1.parent_id, c1.id), c1.sort_order";

    return $db->fetchAll($qry);
}

function handleGenerateImageUrl($db, $method, $segments)
{
    global $logger;

    if (count($segments) < 3) {
        ApiHelpers::errorResponse('Image folder not specified', 400);
        return;
    }

    $folder = $segments[2];

    if ($method !== 'POST') {
        ApiHelpers::errorResponse('Method not allowed', 405);
        return;
    }

    //// If not _FILES, return error
    if (empty($_FILES) || !isset($_FILES['image'])) {
        ApiHelpers::errorResponse('No file uploaded', 400);
        return;
    }

    try {
        $logger->info("Generating image URL for folder: $folder");

        $uploadDir = "../files/$folder";

        // Create upload directory if it doesn't exist
        if (!is_dir($uploadDir)) {
            if (!mkdir($uploadDir, 0755, true)) {
                $logger->error("Failed to create upload directory: $uploadDir");
                throw new Exception('Failed to create upload directory');
            }
        }

        // Allowed image types
        $allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
        $maxFileSize = 5 * 1024 * 1024; // 5MB

        $file = $_FILES['image'];

        $fileName = $file['name'];
        $fileTmpName = $file['tmp_name'];
        $fileSize = $file['size'];
        $fileType = $file['type'];

        // Validate file type
        if (!in_array($fileType, $allowedTypes)) {
            throw new Exception("Invalid file type for $fileName. Only JPEG, JPG, and PNG are allowed.");
        }

        // Validate file size
        if ($fileSize > $maxFileSize) {
            throw new Exception("File $fileName is too large. Maximum size is 5MB.");
        }

        // Generate unique filename
        $fileExtension = strtolower(pathinfo($fileName, PATHINFO_EXTENSION));
        $uniqueFileName = 'blog_' . time() . '.' . $fileExtension;
        $filePath = $uploadDir . '/' . $uniqueFileName;

        // Move uploaded file
        if (!move_uploaded_file($fileTmpName, $filePath)) {
            throw new Exception("Failed to upload file: $fileName");
        }

        // Generate web-accessible URL
        $imageUrl = $_ENV['API_BASE_URL'] . "/files/$folder/$uniqueFileName";

        $logger->info("Image uploaded: " . $imageUrl);

        ApiHelpers::successResponse(['url' => $imageUrl]);
    } catch (Exception $e) {
        $logger->error("Image upload error: " . $e->getMessage());
        ApiHelpers::errorResponse('Failed to upload image', 500);
    }
}

function setOrdering($order, $planNo, $db)
{
    global $logger;

    $logger->info("Setting ordering: $order with plan ID $planNo" . print_r($order, true));

    $qry = "SELECT id, ordering 
        FROM plans 
        WHERE status='active'
            ORDER BY 
                ordering IS NULL,
                ordering ASC,
                id DESC
        LIMIT 20";
    $plans = $db->fetchAll($qry);

    $updatedIds = [];
    $ordering = 0;
    for ($i = 0; $i < count($plans); $i++) {
        $plan = $plans[$i];
        $pId = $plans[$i]['id'];
        $pOrder = $plans[$i]['ordering'];
        $updatedIds[] = $pId;
        $logger->info("Checking plan ID: {$plan['id']} with ordering: {$plan['ordering']}");
        $ordering++;

        if ($ordering == $order && $pId != $planNo) {
            $ordering++;
        }

        if ($pId == $planNo) {
            // Set ordering for the specified plan
            $logger->info("Order already set for plan ID $pId to ordering $order");
            $ordering--;
            continue;
        }

        // Set ordering for other plans
        $db->update('plans', ['ordering' => $ordering], 'id = :id', ['id' => $pId]);
        $logger->info("Set plan ID $pId to ordering $ordering");
    }

    //// set ordering to null for plans not in the updated list
    if (!empty($updatedIds)) {
        $placeholders = implode(',', array_fill(0, count($updatedIds), '?'));
        $db->query("UPDATE plans SET ordering = NULL WHERE id NOT IN ($placeholders) AND status = 'active'", $updatedIds);
        $logger->info("Set ordering to NULL for plans not in: " . implode(',', $updatedIds));
    }
}

function updateSitemapWithBlogPost($blogPostId)
{
    global $db, $logger;

    // Get blog post details
    $blogPost = $db->fetchOne(
        "SELECT slug, status, updated_at FROM blog_posts WHERE id = ?",
        [$blogPostId]
    );

    if (!$blogPost) {
        throw new Exception('Blog post not found');
    }

    // Only add published blog posts to sitemap
    if ($blogPost['status'] !== 'published') {
        throw new Exception('Only published blog posts can be added to sitemap');
    }

    $slug = $blogPost['slug'];
    $lastmod = date('Y-m-d', strtotime($blogPost['updated_at']));

    // Define the sitemap file path
    $sitemapPath = $_ENV['SITEMAP_FILE_PATH'];
    $logger->info("Updating sitemap at path: $sitemapPath for blog post ID: $blogPostId");

    if (!file_exists($sitemapPath)) {
        throw new Exception("Sitemap file not found at path: $sitemapPath");
    }

    // Load the existing sitemap
    $dom = new DOMDocument('1.0', 'UTF-8');
    $dom->formatOutput = true;
    $dom->preserveWhiteSpace = false;

    if (!$dom->load($sitemapPath)) {
        throw new Exception('Failed to load sitemap file in updateSitemapWithBlogPost');
    }

    // Get the urlset element
    $urlset = $dom->getElementsByTagName('urlset')->item(0);

    if (!$urlset) {
        throw new Exception('Invalid sitemap structure - urlset not found');
    }

    $baseUrl = $_ENV['APP_BASE_URL'];
    $blogUrl = $baseUrl . '/blog/list/' . $slug;

    $logger->info("Looking for existing URL: $blogUrl");

    // Check if URL already exists using a more robust approach
    $xpath = new DOMXPath($dom);

    // Try multiple XPath approaches to handle potential issues
    $xpathQueries = [
        "//url[loc/text()='$blogUrl']",
        "//url[loc='$blogUrl']",
        "//url[normalize-space(loc)='$blogUrl']"
    ];

    $existingUrlNode = null;
    foreach ($xpathQueries as $query) {
        $existingUrl = $xpath->query($query);
        if ($existingUrl->length > 0) {
            $existingUrlNode = $existingUrl->item(0);
            $logger->info("Found existing URL using query: $query");
            break;
        }
    }

    // Alternative approach: manually iterate through all URL elements
    if (!$existingUrlNode) {
        $logger->info("XPath didn't find existing URL, checking manually...");
        $allUrls = $urlset->getElementsByTagName('url');

        foreach ($allUrls as $urlElement) {
            $locElement = $urlElement->getElementsByTagName('loc')->item(0);
            if ($locElement) {
                $currentUrl = trim($locElement->textContent);
                $logger->info("Comparing '$currentUrl' with '$blogUrl'");

                if ($currentUrl === $blogUrl) {
                    $existingUrlNode = $urlElement;
                    $logger->info("Found existing URL through manual check");
                    break;
                }
            }
        }
    }

    if ($existingUrlNode && $existingUrlNode instanceof DOMElement) {
        // Update existing entry
        $logger->info("Updating existing blog post URL in sitemap: $blogUrl");

        $lastmodNode = $existingUrlNode->getElementsByTagName('lastmod')->item(0);
        if ($lastmodNode) {
            $lastmodNode->textContent = $lastmod;
        } else {
            // Add lastmod if it doesn't exist
            $lastmodElement = $dom->createElement('lastmod', $lastmod);
            $existingUrlNode->appendChild($lastmodElement);
        }
    } else {
        // Create new URL element
        $logger->info("Adding new blog post URL to sitemap: $blogUrl");

        $urlElement = $dom->createElement('url');

        // Add loc element
        $locElement = $dom->createElement('loc');
        $locElement->textContent = $blogUrl; // Use textContent instead of direct value to avoid encoding issues
        $urlElement->appendChild($locElement);

        // Add lastmod element
        $lastmodElement = $dom->createElement('lastmod', $lastmod);
        $urlElement->appendChild($lastmodElement);

        // Add changefreq element
        $changefreqElement = $dom->createElement('changefreq', 'monthly');
        $urlElement->appendChild($changefreqElement);

        // Add priority element
        $priorityElement = $dom->createElement('priority', '0.6');
        $urlElement->appendChild($priorityElement);

        // Find the best position to insert (before contact page, which should be last)
        $allUrls = $urlset->getElementsByTagName('url');
        $inserted = false;

        foreach ($allUrls as $url) {
            $locElement = $url->getElementsByTagName('loc')->item(0);
            if ($locElement) {
                $loc = $locElement->textContent;
                if (strpos($loc, '/contact') !== false) {
                    $urlset->insertBefore($urlElement, $url);
                    $inserted = true;
                    break;
                }
            }
        }

        // If contact page not found, just append
        if (!$inserted) {
            $urlset->appendChild($urlElement);
        }
    }

    // Save the updated sitemap
    if (!$dom->save($sitemapPath)) {
        throw new Exception('Failed to save sitemap file');
    }

    cleanupDuplicateUrls();

    $logger->info("Sitemap updated successfully for blog post ID: $blogPostId");
    return true;
}

function cleanupDuplicateUrls()
{
    global $logger;

    $sitemapPath = $_ENV['SITEMAP_FILE_PATH'];

    if (!file_exists($sitemapPath)) {
        throw new Exception("Sitemap file not found at path: $sitemapPath");
    }

    // Load the sitemap
    $dom = new DOMDocument('1.0', 'UTF-8');
    $dom->formatOutput = true;
    $dom->preserveWhiteSpace = false;

    if (!$dom->load($sitemapPath)) {
        throw new Exception('Failed to load sitemap file in cleanupDuplicateUrls');
    }

    $urlset = $dom->getElementsByTagName('urlset')->item(0);
    if (!$urlset) {
        throw new Exception('Invalid sitemap structure - urlset not found');
    }

    $seenUrls = [];
    $duplicatesToRemove = [];

    // Find all duplicate URLs
    $allUrls = $urlset->getElementsByTagName('url');

    foreach ($allUrls as $urlElement) {
        $locElement = $urlElement->getElementsByTagName('loc')->item(0);
        if ($locElement) {
            $url = trim($locElement->textContent);

            if (isset($seenUrls[$url])) {
                // This is a duplicate
                $duplicatesToRemove[] = $urlElement;
                $logger->info("Found duplicate URL: $url");
            } else {
                $seenUrls[$url] = $urlElement;
            }
        }
    }

    // Remove duplicates
    foreach ($duplicatesToRemove as $duplicate) {
        $urlset->removeChild($duplicate);
    }

    $logger->info("Removed " . count($duplicatesToRemove) . " duplicate URLs from sitemap");

    // Save the cleaned sitemap
    if (!$dom->save($sitemapPath)) {
        throw new Exception('Failed to save cleaned sitemap file');
    }

    return count($duplicatesToRemove);
}

function regenerateBlogSitemap()
{
    global $db, $logger;

    $sitemapPath = $_ENV['SITEMAP_FILE_PATH'];

    if (!file_exists($sitemapPath)) {
        throw new Exception("Sitemap file not found at path: $sitemapPath");
    }

    // Load sitemap
    $dom = new DOMDocument('1.0', 'UTF-8');
    $dom->formatOutput = true;
    $dom->preserveWhiteSpace = false;

    if (!$dom->load($sitemapPath)) {
        throw new Exception('Failed to load sitemap file in regenerateBlogSitemap');
    }

    $urlset = $dom->getElementsByTagName('urlset')->item(0);

    if (!$urlset) {
        throw new Exception('Invalid sitemap structure - urlset not found');
    }

    $baseUrl = $_ENV['APP_BASE_URL'];
    $logger->info("Starting blog sitemap regeneration with base URL: $baseUrl");

    // Remove all existing blog URLs using multiple approaches
    $removedCount = 0;

    // First try XPath approach
    $xpath = new DOMXPath($dom);
    $xpathQueries = [
        "//url[contains(loc/text(), '/blog/list/')]",
        "//url[contains(loc, '/blog/list/')]",
        "//url[contains(normalize-space(loc), '/blog/list/')]"
    ];

    $blogUrlsToRemove = [];

    foreach ($xpathQueries as $query) {
        $blogUrls = $xpath->query($query);
        if ($blogUrls->length > 0) {
            $logger->info("Found " . $blogUrls->length . " blog URLs using query: $query");
            foreach ($blogUrls as $blogUrl) {
                $blogUrlsToRemove[] = $blogUrl;
            }
            break; // Use first successful query
        }
    }

    // Manual fallback: iterate through all URL elements if XPath didn't work
    if (empty($blogUrlsToRemove)) {
        $logger->info("XPath didn't find blog URLs, checking manually...");
        $allUrls = $urlset->getElementsByTagName('url');

        foreach ($allUrls as $urlElement) {
            $locElement = $urlElement->getElementsByTagName('loc')->item(0);
            if ($locElement) {
                $url = trim($locElement->textContent);
                if (strpos($url, '/blog/list/') !== false) {
                    $blogUrlsToRemove[] = $urlElement;
                    $logger->info("Found blog URL to remove: $url");
                }
            }
        }
    }

    // Remove duplicate entries from removal array
    $uniqueBlogUrls = [];
    foreach ($blogUrlsToRemove as $urlElement) {
        // Ensure we're working with a DOMElement
        if (!($urlElement instanceof DOMElement)) {
            continue;
        }

        $locElement = $urlElement->getElementsByTagName('loc')->item(0);
        if ($locElement && $locElement instanceof DOMElement) {
            $url = trim($locElement->textContent);
            if (!isset($uniqueBlogUrls[$url])) {
                $uniqueBlogUrls[$url] = $urlElement;
            }
        }
    }

    // Remove the blog URLs
    foreach ($uniqueBlogUrls as $url => $urlElement) {
        try {
            if ($urlElement->parentNode) {
                $urlElement->parentNode->removeChild($urlElement);
                $removedCount++;
                $logger->info("Removed existing blog URL: $url");
            }
        } catch (Exception $e) {
            $logger->error("Failed to remove URL $url: " . $e->getMessage());
        }
    }

    $logger->info("Removed $removedCount existing blog URLs from sitemap");

    // Get all published blog posts
    $blogPosts = $db->fetchAll(
        "SELECT slug, updated_at FROM blog_posts WHERE status = 'published' ORDER BY updated_at DESC"
    );

    $logger->info("Found " . count($blogPosts) . " published blog posts to add to sitemap");

    // Add each blog post to sitemap
    $addedCount = 0;
    foreach ($blogPosts as $post) {
        try {
            $blogUrl = $baseUrl . '/blog/list/' . $post['slug'];
            $lastmod = date('Y-m-d', strtotime($post['updated_at']));

            $logger->info("Adding blog post to sitemap: {$post['slug']} -> $blogUrl");

            $urlElement = $dom->createElement('url');

            // Create loc element using textContent to avoid encoding issues
            $locElement = $dom->createElement('loc');
            $locElement->textContent = $blogUrl;
            $urlElement->appendChild($locElement);

            $lastmodElement = $dom->createElement('lastmod', $lastmod);
            $urlElement->appendChild($lastmodElement);

            $changefreqElement = $dom->createElement('changefreq', 'monthly');
            $urlElement->appendChild($changefreqElement);

            $priorityElement = $dom->createElement('priority', '0.6');
            $urlElement->appendChild($priorityElement);

            // Find the best position to insert (before contact page, which should be last)
            $allUrls = $urlset->getElementsByTagName('url');
            $inserted = false;

            foreach ($allUrls as $url) {
                $locElement = $url->getElementsByTagName('loc')->item(0);
                if ($locElement) {
                    $loc = $locElement->textContent;
                    if (strpos($loc, '/contact') !== false) {
                        $urlset->insertBefore($urlElement, $url);
                        $inserted = true;
                        break;
                    }
                }
            }

            // If contact page not found, just append
            if (!$inserted) {
                $urlset->appendChild($urlElement);
            }

            $addedCount++;
        } catch (Exception $e) {
            $logger->error("Failed to add blog post {$post['slug']} to sitemap: " . $e->getMessage());
        }
    }

    // Save updated sitemap
    if (!$dom->save($sitemapPath)) {
        throw new Exception('Failed to save sitemap file');
    }

    $logger->info("Blog sitemap regenerated successfully - Removed: $removedCount, Added: $addedCount posts");

    return [
        'removed' => $removedCount,
        'added' => $addedCount,
        'total_posts' => count($blogPosts)
    ];
}

function manageSitemapEntry($loc, $lastmod, $changefreq, $priority)
{
    global $logger;

    // Validate URL format
    if (!filter_var($loc, FILTER_VALIDATE_URL)) {
        throw new InvalidArgumentException('Invalid URL format for loc parameter');
    }

    // Validate changefreq values
    $validChangefreq = ['always', 'hourly', 'daily', 'weekly', 'monthly', 'yearly', 'never'];
    if (!in_array($changefreq, $validChangefreq)) {
        throw new InvalidArgumentException('Invalid changefreq value. Must be one of: ' . implode(', ', $validChangefreq));
    }

    // Validate priority (must be between 0.0 and 1.0)
    if (!is_numeric($priority) || $priority < 0 || $priority > 1) {
        throw new InvalidArgumentException('Invalid priority value. Must be between 0.0 and 1.0');
    }

    // Validate lastmod format (YYYY-MM-DD)
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $lastmod)) {
        throw new InvalidArgumentException('Invalid lastmod format. Use YYYY-MM-DD');
    }

    $sitemapPath = $_ENV['SITEMAP_FILE_PATH'];

    if (!file_exists($sitemapPath)) {
        throw new Exception("Sitemap file not found at path: $sitemapPath");
    }

    // Load the existing sitemap
    $dom = new DOMDocument('1.0', 'UTF-8');
    $dom->formatOutput = true;
    $dom->preserveWhiteSpace = false;

    if (!$dom->load($sitemapPath)) {
        throw new Exception('Failed to load sitemap file in manageSitemapEntry');
    }

    // Get the urlset element
    $urlset = $dom->getElementsByTagName('urlset')->item(0);

    if (!$urlset) {
        throw new Exception('Invalid sitemap structure - urlset not found');
    }

    $logger->info("Looking for existing URL: $loc");

    // Check if URL already exists using multiple approaches
    $xpath = new DOMXPath($dom);
    $xpathQueries = [
        "//url[loc/text()='$loc']",
        "//url[loc='$loc']",
        "//url[normalize-space(loc)='$loc']"
    ];

    $existingUrlNode = null;
    foreach ($xpathQueries as $query) {
        $existingUrl = $xpath->query($query);
        if ($existingUrl->length > 0) {
            $existingUrlNode = $existingUrl->item(0);
            $logger->info("Found existing URL using XPath query: $query");
            break;
        }
    }

    // Fallback: manually iterate through all URL elements
    if (!$existingUrlNode) {
        $logger->info("XPath didn't find existing URL, checking manually...");
        $allUrls = $urlset->getElementsByTagName('url');

        foreach ($allUrls as $urlElement) {
            $locElement = $urlElement->getElementsByTagName('loc')->item(0);
            if ($locElement) {
                $currentUrl = trim($locElement->textContent);
                if ($currentUrl === $loc) {
                    $existingUrlNode = $urlElement;
                    $logger->info("Found existing URL through manual check");
                    break;
                }
            }
        }
    }

    $isUpdate = false;

    if ($existingUrlNode && $existingUrlNode instanceof DOMElement) {
        // Update existing entry
        $logger->info("Updating existing URL in sitemap: $loc");
        $isUpdate = true;

        // Update or create lastmod
        $lastmodNode = $existingUrlNode->getElementsByTagName('lastmod')->item(0);
        if ($lastmodNode) {
            $lastmodNode->textContent = $lastmod;
        } else {
            $lastmodElement = $dom->createElement('lastmod', $lastmod);
            $existingUrlNode->appendChild($lastmodElement);
        }

        // Update or create changefreq
        $changefreqNode = $existingUrlNode->getElementsByTagName('changefreq')->item(0);
        if ($changefreqNode) {
            $changefreqNode->textContent = $changefreq;
        } else {
            $changefreqElement = $dom->createElement('changefreq', $changefreq);
            $existingUrlNode->appendChild($changefreqElement);
        }

        // Update or create priority
        $priorityNode = $existingUrlNode->getElementsByTagName('priority')->item(0);
        if ($priorityNode) {
            $priorityNode->textContent = $priority;
        } else {
            $priorityElement = $dom->createElement('priority', $priority);
            $existingUrlNode->appendChild($priorityElement);
        }
    } else {
        // Create new URL element
        $logger->info("Adding new URL to sitemap: $loc");

        $urlElement = $dom->createElement('url');

        // Add loc element
        $locElement = $dom->createElement('loc');
        $locElement->textContent = $loc;
        $urlElement->appendChild($locElement);

        // Add lastmod element
        $lastmodElement = $dom->createElement('lastmod', $lastmod);
        $urlElement->appendChild($lastmodElement);

        // Add changefreq element
        $changefreqElement = $dom->createElement('changefreq', $changefreq);
        $urlElement->appendChild($changefreqElement);

        // Add priority element
        $priorityElement = $dom->createElement('priority', $priority);
        $urlElement->appendChild($priorityElement);

        // Find appropriate position to insert
        // Try to maintain some logical order by priority and type
        $allUrls = $urlset->getElementsByTagName('url');
        $inserted = false;

        // Insert before contact page if it exists (assuming contact should be last)
        foreach ($allUrls as $url) {
            $locElement = $url->getElementsByTagName('loc')->item(0);
            if ($locElement) {
                $currentLoc = $locElement->textContent;
                if (strpos($currentLoc, '/contact') !== false) {
                    $urlset->insertBefore($urlElement, $url);
                    $inserted = true;
                    break;
                }
            }
        }

        // If contact page not found, append to end
        if (!$inserted) {
            $urlset->appendChild($urlElement);
        }
    }

    // Save the updated sitemap
    if (!$dom->save($sitemapPath)) {
        throw new Exception('Failed to save sitemap file');
    }

    $logger->info("Sitemap entry managed successfully for URL: $loc");

    return [
        'action' => $isUpdate ? 'updated' : 'created',
        'url' => $loc,
        'lastmod' => $lastmod,
        'changefreq' => $changefreq,
        'priority' => $priority
    ];
}

function notifySearchEngines()
{
    global $logger;

    // Get sitemap URL - construct from environment variables
    $baseUrl = $_ENV['APP_BASE_URL'];
    $sitemapUrl = rtrim($baseUrl, '/') . '/sitemap.xml';

    $logger->info("Notifying search engines about sitemap: $sitemapUrl");

    // Define search engine ping endpoints
    $searchEngines = [
        'Google' => [
            'url' => 'http://www.google.com/ping?sitemap=' . urlencode($sitemapUrl),
            'name' => 'Google'
        ],
        'Bing' => [
            'url' => 'http://www.bing.com/ping?sitemap=' . urlencode($sitemapUrl),
            'name' => 'Bing'
        ],
        'Yandex' => [
            'url' => 'http://webmaster.yandex.com/ping?sitemap=' . urlencode($sitemapUrl),
            'name' => 'Yandex'
        ]
    ];

    $results = [];
    $successCount = 0;
    $failureCount = 0;

    foreach ($searchEngines as $engine => $config) {
        $logger->info("Pinging {$config['name']} with URL: {$config['url']}");

        try {
            $result = pingSearchEngine($config['url'], $config['name']);
            $results[$engine] = $result;

            if ($result['success']) {
                $successCount++;
                $logger->info("{$config['name']} pinged successfully - HTTP {$result['response_code']} in {$result['response_time']}ms");
                if (!empty($result['response_body'])) {
                    $logger->info("{$config['name']} response body: {$result['response_body']}");
                }
            } else {
                $failureCount++;
                $logger->info("{$config['name']} ping failed: {$result['message']} - HTTP {$result['response_code']} in {$result['response_time']}ms");
                if (!empty($result['response_body'])) {
                    $logger->info("{$config['name']} error response body: {$result['response_body']}");
                }
            }
        } catch (Exception $e) {
            $failureCount++;
            $results[$engine] = [
                'success' => false,
                'message' => 'Exception: ' . $e->getMessage(),
                'response_code' => null,
                'response_time' => null
            ];
            $logger->error("{$config['name']} ping exception: " . $e->getMessage());
        }
    }

    $summary = [
        'sitemap_url' => $sitemapUrl,
        'total_engines' => count($searchEngines),
        'successful' => $successCount,
        'failed' => $failureCount,
        'results' => $results,
        'timestamp' => date('Y-m-d H:i:s')
    ];

    $logger->info("Search engine notification complete. Success: $successCount, Failed: $failureCount");

    return $summary;
}

function pingSearchEngine($pingUrl, $engineName)
{
    global $logger;

    $startTime = microtime(true);

    if ($_ENV['ENV'] !== 'production') {
        $logger->info("Development environment detected - skipping actual ping to $engineName");
        return [
            'success' => true,
            'message' => 'Ping skipped in development environment',
            'response_code' => 200,
            'response_time' => 0
        ];
    }

    exit;
    $logger->info("Starting ping to $engineName at URL: $pingUrl");

    // Initialize cURL
    $ch = curl_init();

    // Set cURL options
    curl_setopt_array($ch, [
        CURLOPT_URL => $pingUrl,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_TIMEOUT => 30, // 30 second timeout
        CURLOPT_CONNECTTIMEOUT => 10, // 10 second connection timeout
        CURLOPT_USERAGENT => 'Mozilla/5.0 (compatible; SitemapNotifier/1.0)',
        CURLOPT_SSL_VERIFYPEER => false, // For development - set to true in production
        CURLOPT_SSL_VERIFYHOST => false, // For development - set to true in production
        CURLOPT_HEADER => false,
        CURLOPT_NOBODY => false,
        CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,
        CURLOPT_VERBOSE => false // Set to true for even more detailed debugging
    ]);

    // Execute the request
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    $curlInfo = curl_getinfo($ch);
    $responseTime = round((microtime(true) - $startTime) * 1000, 2); // in milliseconds

    // Log detailed cURL info
    $logger->info("$engineName cURL Info - HTTP Code: $httpCode, Content Type: " . ($curlInfo['content_type'] ?? 'unknown') . ", Total Time: {$responseTime}ms");

    if (!empty($curlInfo['redirect_url'])) {
        $logger->info("$engineName redirect detected to: " . $curlInfo['redirect_url']);
    }

    curl_close($ch);

    // Log raw response (truncated for readability)
    if ($response !== false) {
        $responsePreview = strlen($response) > 500 ? substr($response, 0, 500) . '...' : $response;
        $logger->info("$engineName raw response (first 500 chars): " . $responsePreview);
    }

    // Check for cURL errors
    if ($response === false || !empty($error)) {
        $logger->error("$engineName cURL error: " . ($error ?: 'Unknown error'));
        return [
            'success' => false,
            'message' => 'cURL error: ' . ($error ?: 'Unknown error'),
            'response_code' => $httpCode,
            'response_time' => $responseTime,
            'curl_info' => $curlInfo
        ];
    }

    // Analyze response based on search engine
    $analysisResult = analyzeSearchEngineResponse($engineName, $httpCode, $response);
    $logger->info("$engineName response analysis: " . $analysisResult['interpretation']);

    // Check HTTP response code
    if ($httpCode >= 200 && $httpCode < 300) {
        $logger->info("$engineName ping successful - HTTP $httpCode received in {$responseTime}ms");
        return [
            'success' => true,
            'message' => 'Successfully notified ' . $engineName,
            'response_code' => $httpCode,
            'response_time' => $responseTime,
            'response_body' => strlen($response) > 200 ? substr($response, 0, 200) . '...' : $response,
            'analysis' => $analysisResult,
            'curl_info' => [
                'content_type' => $curlInfo['content_type'] ?? null,
                'redirect_url' => $curlInfo['redirect_url'] ?? null,
                'total_time' => $curlInfo['total_time'] ?? null
            ]
        ];
    } else {
        $logger->info("$engineName ping failed - HTTP $httpCode received in {$responseTime}ms");
        return [
            'success' => false,
            'message' => 'HTTP error code: ' . $httpCode,
            'response_code' => $httpCode,
            'response_time' => $responseTime,
            'response_body' => strlen($response) > 200 ? substr($response, 0, 200) . '...' : $response,
            'analysis' => $analysisResult,
            'curl_info' => [
                'content_type' => $curlInfo['content_type'] ?? null,
                'redirect_url' => $curlInfo['redirect_url'] ?? null,
                'total_time' => $curlInfo['total_time'] ?? null
            ]
        ];
    }
}

function analyzeSearchEngineResponse($engineName, $httpCode, $responseBody)
{
    $interpretation = '';
    $status = 'unknown';

    switch (strtolower($engineName)) {
        case 'google':
            if ($httpCode == 200) {
                if (
                    stripos($responseBody, 'successfully') !== false ||
                    stripos($responseBody, 'received') !== false ||
                    empty(trim($responseBody))
                ) {
                    $interpretation = 'Google likely accepted the sitemap notification';
                    $status = 'accepted';
                } else {
                    $interpretation = 'Google responded with HTTP 200 but response content is unclear';
                    $status = 'unclear';
                }
            } else {
                $interpretation = "Google returned HTTP $httpCode - may indicate an issue";
                $status = 'error';
            }
            break;

        case 'bing':
            if ($httpCode == 200) {
                if (
                    stripos($responseBody, 'thanks') !== false ||
                    stripos($responseBody, 'received') !== false ||
                    empty(trim($responseBody))
                ) {
                    $interpretation = 'Bing likely accepted the sitemap notification';
                    $status = 'accepted';
                } else {
                    $interpretation = 'Bing responded with HTTP 200 but response content is unclear';
                    $status = 'unclear';
                }
            } else {
                $interpretation = "Bing returned HTTP $httpCode - may indicate an issue";
                $status = 'error';
            }
            break;

        case 'yandex':
            if ($httpCode == 200) {
                if (
                    stripos($responseBody, 'ok') !== false ||
                    stripos($responseBody, 'success') !== false ||
                    empty(trim($responseBody))
                ) {
                    $interpretation = 'Yandex likely accepted the sitemap notification';
                    $status = 'accepted';
                } else {
                    $interpretation = 'Yandex responded with HTTP 200 but response content is unclear';
                    $status = 'unclear';
                }
            } else {
                $interpretation = "Yandex returned HTTP $httpCode - may indicate an issue";
                $status = 'error';
            }
            break;

        default:
            if ($httpCode >= 200 && $httpCode < 300) {
                $interpretation = "$engineName returned HTTP $httpCode - likely successful";
                $status = 'accepted';
            } else {
                $interpretation = "$engineName returned HTTP $httpCode - likely failed";
                $status = 'error';
            }
    }

    return [
        'status' => $status,
        'interpretation' => $interpretation,
        'response_length' => strlen($responseBody),
        'response_empty' => empty(trim($responseBody))
    ];
}

/**
 * Handle all /api/marketing/* endpoints
 * Protected by JWT authentication
 */
function handleMarketing($db, $method, $segments)
{
    global $logger;

    if (!isset($segments[2])) {
        ApiHelpers::errorResponse('Marketing endpoint not specified', 404);
        return;
    }

    $marketing = new EmailMarketing($db, $logger);

    switch ($segments[2]) {
        // =====================================================================
        // CONTACTS: /api/marketing/contacts
        // =====================================================================
        case 'contacts':
            $contactId = $segments[3] ?? null;

            $s4 = (isset($segments[4]) ? $segments[4] : null);
            $s5 = isset($segments[5]) ? $segments[5] : null;
            $s6 = isset($segments[6]) ? $segments[6] : null;

            switch ($method) {
                case 'GET':
                    if ($contactId) {
                        switch ($s4) {
                            case 'notes':
                                if ($contactId === null) {
                                    ApiHelpers::errorResponse('Contact ID required for adding notes', 400);
                                    return;
                                }

                                $limit = $_GET['limit'] ?? 50;
                                $offset = $_GET['offset'] ?? 0;
                                $pinnedFirst = isset($_GET['pinned_first']) ? (($_GET['pinned_first'] == '1' || $_GET['pinned_first'] === 'true') ? 1 : 0) : 0;

                                $result = $marketing->getContactNotes($contactId, $limit, $offset, $pinnedFirst);
                                ApiHelpers::successResponse($result);
                                return;
                                break;
                            case 'calls':
                                $limit = $_GET['limit'] ?? 50;
                                $offset = $_GET['offset'] ?? 0;

                                $result = $marketing->getContactCalls($contactId, $limit, $offset);
                                ApiHelpers::successResponse($result);
                                return;
                            case 'email-sends':
                                $limit = $_GET['limit'] ?? 50;
                                $offset = $_GET['offset'] ?? 0;

                                $result = $marketing->contactEmailSends($contactId, $limit, $offset);
                                ApiHelpers::successResponse($result);
                                return;
                            default:
                                break;
                        }

                        // Get single contact
                        $contact = $marketing->getContact($contactId);
                        if ($contact) {
                            ApiHelpers::successResponse($contact);
                        } else {
                            ApiHelpers::errorResponse('Contact not found', 404);
                        }
                    } else {
                        // List contacts with filters
                        $filters = [
                            'search' => $_GET['search'] ?? null,
                            'tag' => $_GET['tag'] ?? null,
                            'source' => $_GET['source'] ?? null,
                            'subscribed' => isset($_GET['subscribed']) ? ($_GET['subscribed'] === 'true') : null,
                            'limit' => $_GET['limit'] ?? 50,
                            'offset' => $_GET['offset'] ?? 0,
                            'city' => $_GET['city'] ?? null,
                            'state' => $_GET['state'] ?? null,
                            'lastContacted' => $_GET['last_contacted'] ?? null,
                        ];

                        $result = $marketing->getContacts(array_filter($filters, fn($v) => $v !== null));
                        ApiHelpers::successResponse($result);
                    }
                    break;

                case 'POST':
                    $data = ApiHelpers::getJsonInput();

                    $logger->info("segments: " . json_encode($segments));

                    // Check for bulk import
                    if (isset($segments[3]) && $segments[3] === 'import') {
                        if (!isset($data['contacts']) || !is_array($data['contacts'])) {
                            ApiHelpers::errorResponse('Contacts array required for import', 400);
                            return;
                        }

                        $source = $data['source'] ?? 'import';
                        $result = $marketing->importContacts($data['contacts'], $source);
                        ApiHelpers::successResponse($result, 'Import completed');
                        return;
                    }

                    // Check for notes
                    if ($s4 === 'notes') {

                        if ($contactId === null) {
                            ApiHelpers::errorResponse('Contact ID required for adding notes', 400);
                            return;
                        }

                        $data['contact_id'] = $contactId;

                        $result = $marketing->createNote($data);
                        ApiHelpers::successResponse(['id' => $result], 'Note added successfully');
                        return;
                    }

                    if ($s4 === 'calls') {
                        if ($contactId === null) {
                            ApiHelpers::errorResponse('Contact ID required for logging calls', 400);
                            return;
                        }

                        $data['contact_id'] = $contactId;

                        $result = $marketing->logCall($data);
                        ApiHelpers::successResponse(['id' => $result], 'Call logged successfully');
                        return;
                    }

                    if ($contactId && $s4 === 'email-sends' && $s5) {
                        try {
                            $result = $marketing->createContactEmailSend($contactId, $s5);
                            ApiHelpers::successResponse(['id' => $result], 'Email send created successfully');
                        } catch (Exception $e) {
                            ApiHelpers::errorResponse('Cannot create email send for specific contact - email campaign: ' . $e->getMessage(), 400);
                            return;
                        }
                    }


                    // Single contact creation
                    // if (empty($data['email'])) {
                    //     ApiHelpers::errorResponse('Email is required', 400);
                    //     return;
                    // }

                    // if (!filter_var($data['email'], FILTER_VALIDATE_EMAIL)) {
                    //     ApiHelpers::errorResponse('Invalid email format', 400);
                    //     return;
                    // }

                    try {
                        $id = $marketing->createContact($data);
                        ApiHelpers::successResponse(['id' => $id], 'Contact created successfully');
                    } catch (Exception $e) {
                        ApiHelpers::errorResponse($e->getMessage(), 400);
                    }
                    break;

                case 'PUT':
                    if (!$contactId) {
                        ApiHelpers::errorResponse('Contact ID required', 400);
                        return;
                    }

                    if ($s5 === null && $s4 === 'notes') {
                        ApiHelpers::errorResponse('Note ID required for updating notes', 400);
                        return;
                    }

                    $data = ApiHelpers::getJsonInput();

                    try {

                        switch ($s4) {
                            case 'notes':

                                if ($s6 == 'pin') {
                                    // Pin or unpin note
                                    $marketing->toggleNotePin($s5);
                                    ApiHelpers::successResponse(null, 'Note pin status updated successfully');
                                    return;
                                }
                                $marketing->updateNote($s5, $data);
                                ApiHelpers::successResponse(null, 'Note updated successfully');
                                break;

                            case 'calls':
                                $marketing->updateCall($s5, $data);
                                ApiHelpers::successResponse(null, 'Call updated successfully');
                                break;
                            default:
                                $marketing->updateContact($contactId, $data);
                                ApiHelpers::successResponse(null, 'Contact updated successfully');
                                break;
                        }
                    } catch (Exception $e) {
                        ApiHelpers::errorResponse($e->getMessage(), 400);
                    }
                    break;

                case 'DELETE':
                    if (!$contactId) {
                        ApiHelpers::errorResponse('Contact ID required', 400);
                        return;
                    }

                    try {

                        switch ($s4) {
                            case 'notes':
                                if ($s5 === null) {
                                    ApiHelpers::errorResponse('Note ID required for deleting notes', 400);
                                    return;
                                }
                                $marketing->deleteNote($s5);
                                ApiHelpers::successResponse(null, 'Note deleted successfully');
                                break;

                            case 'calls':
                                if ($s5 === null) {
                                    ApiHelpers::errorResponse('Call ID required for deleting calls', 400);
                                    return;
                                }
                                $marketing->deleteCall($s5);
                                ApiHelpers::successResponse(null, 'Call deleted successfully');
                                return;
                                break;
                            default:
                                break;
                        }

                        $marketing->deleteContact($contactId);
                        ApiHelpers::successResponse(null, 'Contact deleted successfully');
                    } catch (Exception $e) {
                        ApiHelpers::errorResponse($e->getMessage(), 400);
                    }
                    break;

                default:
                    ApiHelpers::errorResponse('Method not allowed', 405);
            }
            break;

        // =====================================================================
        // CAMPAIGNS: /api/marketing/campaigns
        // Delegated to handleCampaigns() for cleaner organization
        // =====================================================================
        case 'campaigns':
            handleCampaigns($marketing, $method, $segments);
            break;

        // =====================================================================
        // CAMPAIGN RECORDS: /api/marketing/campaign-records/{id}
        // Parent campaign record maintenance
        // =====================================================================
        case 'campaign-records':
            $campaignId = $segments[3] ?? null;

            if (!$campaignId || !is_numeric($campaignId)) {
                ApiHelpers::errorResponse('Campaign ID required', 400);
                return;
            }

            switch ($method) {
                case 'PUT':
                    try {
                        $marketing->updateCampaignRecord((int) $campaignId, ApiHelpers::getJsonInput() ?? []);
                        ApiHelpers::successResponse(null, 'Campaign updated successfully');
                    } catch (Exception $e) {
                        ApiHelpers::errorResponse($e->getMessage(), 400);
                    }
                    return;

                case 'DELETE':
                    try {
                        $marketing->deleteCampaignRecord((int) $campaignId);
                        ApiHelpers::successResponse(null, 'Campaign deleted successfully');
                    } catch (Exception $e) {
                        ApiHelpers::errorResponse($e->getMessage(), 400);
                    }
                    return;

                default:
                    ApiHelpers::errorResponse('Method not allowed', 405);
                    return;
            }

        // =====================================================================
        // EMAIL CAMPAIGNS: /api/marketing/email-campaigns/{id}
        // =====================================================================
        case 'email-campaigns':
            $emailCampaignId = $segments[3] ?? null;

            if (!$emailCampaignId || !is_numeric($emailCampaignId)) {
                ApiHelpers::errorResponse('Email campaign ID required', 400);
                return;
            }

            switch ($method) {
                case 'DELETE':
                    try {
                        $marketing->deleteEmailCampaign((int) $emailCampaignId);
                        ApiHelpers::successResponse(null, 'Email campaign deleted successfully');
                    } catch (Exception $e) {
                        ApiHelpers::errorResponse($e->getMessage(), 400);
                    }
                    return;

                default:
                    ApiHelpers::errorResponse('Method not allowed', 405);
                    return;
            }

        // =====================================================================
        // NOTES: /api/marketing/notes (cross-contact endpoints)
        // =====================================================================
        case 'notes':
            $action = $segments[3] ?? null;

            if ($method !== 'GET') {
                ApiHelpers::errorResponse('Method not allowed', 405);
                return;
            }

            switch ($action) {
                case 'recent':
                    $limit = $_GET['limit'] ?? 20;
                    $noteType = $_GET['note_type'] ?? null;

                    try {
                        $notes = $marketing->getRecentNotes($limit, $noteType);
                        ApiHelpers::successResponse($notes);
                    } catch (Exception $e) {
                        ApiHelpers::errorResponse($e->getMessage(), 500);
                    }
                    break;

                case 'search':
                    $query = $_GET['q'] ?? '';
                    $limit = $_GET['limit'] ?? 20;

                    if (empty($query)) {
                        ApiHelpers::errorResponse('Search query (q) is required', 400);
                        return;
                    }

                    try {
                        $notes = $marketing->searchNotes($query, $limit);
                        ApiHelpers::successResponse($notes);
                    } catch (Exception $e) {
                        ApiHelpers::errorResponse($e->getMessage(), 500);
                    }
                    break;

                default:
                    ApiHelpers::errorResponse('Notes endpoint not found', 404);
            }
            break;

        // =====================================================================
        // CALLS: /api/marketing/calls (cross-contact endpoints)
        // =====================================================================
        case 'calls':
            $action = $segments[3] ?? null;

            if ($method !== 'GET') {
                ApiHelpers::errorResponse('Method not allowed', 405);
                return;
            }

            switch ($action) {
                case 'recent':
                    $limit = $_GET['limit'] ?? 20;
                    $direction = $_GET['direction'] ?? null;

                    try {
                        $calls = $marketing->getRecentCalls($limit, $direction);
                        ApiHelpers::successResponse($calls);
                    } catch (Exception $e) {
                        ApiHelpers::errorResponse($e->getMessage(), 500);
                    }
                    break;

                case 'follow-ups':
                    try {
                        $calls = $marketing->getPendingFollowUps();
                        ApiHelpers::successResponse($calls);
                    } catch (Exception $e) {
                        ApiHelpers::errorResponse($e->getMessage(), 500);
                    }
                    break;

                case 'stats':
                    $startDate = $_GET['start_date'] ?? null;
                    $endDate = $_GET['end_date'] ?? null;

                    try {
                        $stats = $marketing->getCallStats($startDate, $endDate);
                        ApiHelpers::successResponse($stats);
                    } catch (Exception $e) {
                        ApiHelpers::errorResponse($e->getMessage(), 500);
                    }
                    break;

                default:
                    ApiHelpers::errorResponse('Calls endpoint not found', 404);
            }
            break;

        // =====================================================================
        // STATS: /api/marketing/stats
        // =====================================================================
        case 'stats':
            if ($method !== 'GET') {
                ApiHelpers::errorResponse('Method not allowed', 405);
                return;
            }

            try {
                $stats = $marketing->getMarketingStats();
                ApiHelpers::successResponse($stats);
            } catch (Exception $e) {
                ApiHelpers::errorResponse($e->getMessage(), 500);
            }
            break;

        case 'dups':
            if ($method !== 'GET') {
                ApiHelpers::errorResponse('Method not allowed', 405);
                return;
            }

            try {
                /// get email, phone from url params
                $email = $_GET['email'] ?? null;
                $phone = $_GET['phone'] ?? null;
                $contactId = $_GET['contact_id'] ?? null;
                $dups = $marketing->getDuplicateContacts($contactId, $email, $phone);
                ApiHelpers::successResponse($dups);
            } catch (Exception $e) {
                ApiHelpers::errorResponse($e->getMessage(), 500);
            }
            break;

        default:
            ApiHelpers::errorResponse('Marketing endpoint not found', 404);
    }
}

/**
 * Handle tracking endpoints
 * /api/track/open/{trackingId} - Open tracking pixel
 * /api/track/unsubscribe/{trackingId} - Unsubscribe handling
 */
function handleTracking($db, $segments)
{
    global $logger;

    if (!isset($segments[2]) || !isset($segments[3])) {
        http_response_code(400);
        return;
    }

    $action = $segments[2];
    $s3 = $segments[3];
    $s4 = isset($segments[4]) ? $segments[4] : null;

    $marketing = new EmailMarketing($db, $logger);

    switch ($action) {
        case 'open':
            // Track open and return 1x1 transparent GIF
            $marketing->trackOpen($s3);

            header('Content-Type: image/gif');
            header('Cache-Control: no-cache, no-store, must-revalidate');
            header('Pragma: no-cache');
            header('Expires: 0');

            // 1x1 transparent GIF
            echo base64_decode('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7');
            exit();
            break;

        case 'click':
            if ($s4 == null) {
                http_response_code(400);
                echo '<h1>Contact ID is required</h1>';
                exit();
            }
            // Track click and redirect to actual URL
            $sent = $marketing->trackClick($s3, $s4);

            if ($sent) {
                exit();
            } else {
                http_response_code(404);
                echo '<h1>Link not found or already processed</h1>';
                exit();
            }
            break;

        case 'unsubscribe':
            $method = $_SERVER['REQUEST_METHOD'];

            if ($method === 'GET') {
                // Show unsubscribe confirmation page
                $result = $marketing->trackUnsubscribe($s3);

                if ($result) {
                    // Return simple HTML confirmation
                    header('Content-Type: text/html; charset=UTF-8');
                    echo '<!DOCTYPE html>
<html>
<head>
    <title>Unsubscribed</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        body { 
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            display: flex; 
            justify-content: center; 
            align-items: center; 
            min-height: 100vh; 
            margin: 0; 
            background: #f5f5f5;
        }
        .container { 
            text-align: center; 
            padding: 40px; 
            background: white; 
            border-radius: 8px; 
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            max-width: 400px;
        }
        h1 { color: #333; margin-bottom: 16px; }
        p { color: #666; line-height: 1.6; }
        .checkmark { font-size: 48px; color: #4CAF50; margin-bottom: 16px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="checkmark">✓</div>
        <h1>Unsubscribed Successfully</h1>
        <p>You have been removed from our mailing list and will no longer receive marketing emails from us.</p>
        <p><small>Email: ' . htmlspecialchars($result['email']) . '</small></p>
    </div>
</body>
</html>';
                    exit();
                } else {
                    http_response_code(404);
                    echo '<h1>Link not found or already processed</h1>';
                    exit();
                }
            }

            // POST request - API response
            if ($method === 'POST') {
                $data = json_decode(file_get_contents('php://input'), true);
                $result = $marketing->trackUnsubscribe(
                    $s3,
                    $data['reason'] ?? null,
                    $data['feedback'] ?? null
                );

                if ($result) {
                    ApiHelpers::successResponse($result, 'Unsubscribed successfully');
                } else {
                    ApiHelpers::errorResponse('Invalid tracking link', 404);
                }
            }
            break;

        default:
            http_response_code(404);
            break;
    }
}
