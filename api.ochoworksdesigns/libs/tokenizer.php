<?php 

require_once __DIR__ . '/../vendor/autoload.php';
use Firebase\JWT\JWT;
use Firebase\JWT\Key;

class tokenizer {
    public static function generate($input) {
        // Token generation logic using JWT

        $key = $_ENV['JWT_SECRET'];
        $payload = [
            'iat' => time(),
            'exp' => time() + 604800,
            'data' => $input
        ];

        $jwt = JWT::encode($payload, $key, 'HS256');
        return $jwt;
    }

    public static function validate($tokens) {
        // Token validation logic
        $key = $_ENV['JWT_SECRET'];

        $decoded = null;

        foreach ($tokens as $token) {
            try {
                $decoded = JWT::decode($token, new Key($key, 'HS256'));
            } catch (Exception $e) {
                
            }
        }

        return $decoded;
    }
}


?>