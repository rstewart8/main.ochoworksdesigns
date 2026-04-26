<?php

require_once(__DIR__ . '/../libs/tokenizer.php');

class ApiHelpers {
    
    public static function loadEnv($path = '.env') {
        if (!file_exists($path)) {
            return;
        }
        
        $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        foreach ($lines as $line) {
            if (strpos(trim($line), '#') === 0) {
                continue;
            }
            
            list($name, $value) = explode('=', $line, 2);
            $name = trim($name);
            $value = trim($value);
            
            if (!array_key_exists($name, $_ENV)) {
                $_ENV[$name] = $value;
            }
        }
    }
    
    public static function jsonResponse($data, $status = 200) {
        http_response_code($status);
        header('Content-Type: application/json');
        
        // Process data to decode JSON strings back to arrays
        $processedData = self::processJsonFields($data);
        
        echo json_encode($processedData);
        exit;
    }
    
    public static function errorResponse($message, $status = 400) {
        self::jsonResponse([
            'error' => true,
            'message' => $message
        ], $status);
    }
    
    public static function successResponse($data, $message = null) {
        $response = [
            'success' => true,
            'data' => $data
        ];
        
        if ($message) {
            $response['message'] = $message;
        }
        
        self::jsonResponse($response);
    }
    
    public static function requireApiKey() {
        $apiKey = null;
        
        // Try multiple methods to get the API key
        
        // Method 1: getallheaders() with case-insensitive search
        if (function_exists('getallheaders')) {
            $headers = getallheaders();
            foreach ($headers as $key => $value) {
                // echo "Header: $key => $value\n"; // Debugging line
                if (strtolower(trim($key)) === 'x-api-key') {
                    $apiKey = trim($value);
                    break;
                }
            }
        }
        
        // Method 2: $_SERVER with standard HTTP_ prefix
        if (!$apiKey && isset($_SERVER['HTTP_X_API_KEY'])) {
            $apiKey = trim($_SERVER['HTTP_X_API_KEY']);
        }
        
        // Method 3: Check for variations in $_SERVER
        if (!$apiKey) {
            $serverKeys = ['HTTP_X_API_KEY', 'HTTP_X-API-KEY', 'HTTP_XAPIKEY'];
            foreach ($serverKeys as $serverKey) {
                if (isset($_SERVER[$serverKey])) {
                    $apiKey = trim($_SERVER[$serverKey]);
                    break;
                }
            }
        }
        
        if (!$apiKey) {
            self::errorResponse('API key required', 401);
            exit;
        }
        
        // Validate against expected API key
        $expectedApiKey = $_ENV['API_KEY'] ?? null;
        if (!$expectedApiKey || $apiKey !== $expectedApiKey) {
            self::errorResponse('Invalid API key', 403);
            exit;
        }
    }
    
    /**
     * Verify JWT token from Authorization header
     * Extracts Bearer token and validates it using the tokenizer class
     * Returns decoded token data on success, exits with error on failure
     */
    public static function verifyToken($ignoreException = false) {
        $token = null;
        
        // Method 1: Try getallheaders() with case-insensitive search
        if (function_exists('getallheaders')) {
            $headers = getallheaders();
            foreach ($headers as $key => $value) {
                if (strtolower(trim($key)) === 'authorization') {
                    $authHeader = trim($value);
                    if (preg_match('/Bearer\s+(.*)$/i', $authHeader, $matches)) {
                        $token = $matches[1];
                    }
                    break;
                }
            }
        }
        
        // Method 2: Try $_SERVER with HTTP_AUTHORIZATION
        if (!$token && isset($_SERVER['HTTP_AUTHORIZATION'])) {
            $authHeader = trim($_SERVER['HTTP_AUTHORIZATION']);
            if (preg_match('/Bearer\s+(.*)$/i', $authHeader, $matches)) {
                $token = $matches[1];
            }
        }
        
        // Method 3: Check for other authorization header variations
        if (!$token) {
            $authKeys = ['HTTP_AUTHORIZATION', 'REDIRECT_HTTP_AUTHORIZATION'];
            foreach ($authKeys as $authKey) {
                if (isset($_SERVER[$authKey])) {
                    $authHeader = trim($_SERVER[$authKey]);
                    if (preg_match('/Bearer\s+(.*)$/i', $authHeader, $matches)) {
                        $token = $matches[1];
                        break;
                    }
                }
            }
        }
        
        if (!$token && !$ignoreException) {
            self::errorResponse('Authorization token required', 401);
            exit;
        }
        
        // Validate token using tokenizer class
        // Note: tokenizer::validate expects an array, so we pass the token in an array
        if ($token) {
            $decoded = tokenizer::validate([$token]);
        } else {
            $decoded = null;
        }
        
        if (!$decoded && !$ignoreException) {
            self::errorResponse('Invalid or expired token', 403);
            exit;
        }
        
        return $decoded;
    }
    
    public static function getRequestMethod() {
        return $_SERVER['REQUEST_METHOD'];
    }
    
    public static function getJsonInput() {
        $input = file_get_contents('php://input');
        return json_decode($input, true);
    }
    
    public static function validateRequired($data, $required) {
        $missing = [];
        foreach ($required as $field) {
            if (!isset($data[$field]) || empty($data[$field])) {
                $missing[] = $field;
            }
        }
        
        if (!empty($missing)) {
            self::errorResponse('Missing required fields: ' . implode(', ', $missing), 400);
        }
    }
    
    /**
     * Recursively process data to decode JSON strings back to arrays
     */
    private static function processJsonFields($data) {
        if (is_array($data)) {
            foreach ($data as $key => $value) {
                $data[$key] = self::processJsonFields($value);
            }
        } elseif (is_string($data)) {
            // Check if string looks like JSON (starts with [ or {)
            $trimmed = trim($data);
            if ((strpos($trimmed, '[') === 0 && strrpos($trimmed, ']') === strlen($trimmed) - 1) ||
                (strpos($trimmed, '{') === 0 && strrpos($trimmed, '}') === strlen($trimmed) - 1)) {
                
                $decoded = json_decode($data, true);
                
                // Only use decoded version if it's valid JSON and results in an array
                if (json_last_error() === JSON_ERROR_NONE && (is_array($decoded) || is_object($decoded))) {
                    return $decoded;
                }
            }
        }
        
        return $data;
    }

    public static function generateToken($input) {
        return tokenizer::generate($input);
    }

    public static function validateToken($token) {
        return tokenizer::validate($token);
    }

    public static function isAdmin() {
        $decoded = self::verifyToken(true);
        if (!$decoded) {
            return false;
        }

        $adminRoleId = $_ENV['ADMIN_ROLE_ID'] ?? '1';
        
        if (isset($decoded->data->role_id) && $decoded->data->role_id == $adminRoleId) {
            return true;
        }
    }
}