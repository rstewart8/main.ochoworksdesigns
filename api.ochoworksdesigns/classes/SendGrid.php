<?php
$path = realpath(__DIR__ . '/../');
require_once $path . '/libs/logger.php';

class SendGrid {
    private $apiKey;
    private $baseUrl = 'https://api.sendgrid.com/v3/mail/send';
    private $db;
    private $emailProvider;
    private $logger;
    
    public function __construct($database = null) {
        $this->apiKey = $_ENV['EMAIL_API_KEY'] ?? null;
        $this->emailProvider = $_ENV['EMAIL_PROVIDER'] ?? 'mailtrap';
        $this->db = $database;
        $this->logger = new Logger();
        
        if (!$this->apiKey) {
            throw new Exception('SendGrid API key not found in environment variables');
        }
    }
    
    /**
     * Send an email using SendGrid API
     * 
     * @param array $emailData - Array containing email details
     * @return array - Response from SendGrid API
     * @throws Exception
     */
    public function sendEmail($emailData) {
        $this->logger->info("emailProvider: " . $this->emailProvider .  " email Data: " . print_r($emailData, true));
        if ($this->emailProvider !== 'sendgrid') {
            $this->logger->info("Using alternative email provider: " . $this->emailProvider);
            require_once __DIR__ . '/Mailtrap.php';
            $mailtrap = new Mailtrap($this->db);
            return $mailtrap->sendEmail($emailData);
        }
        $required = ['to_email', 'from_email', 'from_name', 'subject', 'content'];
        
        foreach ($required as $field) {
            if (empty($emailData[$field])) {
                throw new Exception("Required field '{$field}' is missing");
            }
        }

        $sendPlainText = !empty($emailData['send_plain_text']);
        $plainTextBody = $emailData['plain_text'] ?? strip_tags($emailData['content']);

        $contentItems = [];
        if ($sendPlainText) {
            $this->logger->info("Sending plain text email as requested");
            $contentItems[] = [
                'type' => 'text/plain',
                'value' => $plainTextBody
            ];
        } else {
            $this->logger->info("Sending HTML email as requested");
            $contentItems[] = [
                'type' => $emailData['content_type'] ?? 'text/html',
                'value' => $emailData['content']
            ];

            if (!empty($emailData['plain_text'])) {
                $contentItems[] = [
                    'type' => 'text/plain',
                    'value' => $plainTextBody
                ];
            }
        }
        
        $payload = [
            'personalizations' => [
                [
                    'to' => [
                        [
                            'email' => $emailData['to_email'],
                            'name' => $emailData['to_name']??$emailData['to_email']
                        ]
                    ]
                ]
            ],
            'from' => [
                'email' => $emailData['from_email'],
                'name' => $emailData['from_name']
            ],
            'subject' => $emailData['subject'],
            'content' => $contentItems
        ];
        
        // Add reply-to if provided
        if (!empty($emailData['reply_to_email'])) {
            $payload['reply_to'] = [
                'email' => $emailData['reply_to_email'],
                'name' => $emailData['reply_to_name'] ?? $emailData['reply_to_email']
            ];
        }
        
        $status = 'failed';
        $result = null;
        $response = null;
        
        try {
            $result = $this->makeRequest($payload);
            $status = 'sent';
            $response = json_encode($result);
        } catch (Exception $e) {
            $status = 'failed';
            $response = $e->getMessage();
            // Log the error but still log to database
            $this->logger->error("SendGrid Error: " . $e->getMessage());
            throw $e; // Re-throw the exception
        } finally {
            // Log to database regardless of success/failure
            $this->logEmail(
                $emailData['to_email'],
                $emailData['subject'],
                $emailData['content'],
                $response,
                $status
            );
        }
        
        return $result;
    }
    
    /**
     * Send a contact form email
     * 
     * @param string $name - Contact's name
     * @param string $email - Contact's email
     * @param string $message - Contact's message
     * @return array - Response from SendGrid API
     */
    public function sendContactEmail($name, $email, $message) {
        $toEmail = $_ENV['CONTACT_EMAIL'] ?? $_ENV['ADMIN_EMAIL'] ?? 'admin@example.com';
        $fromEmail = $_ENV['FROM_EMAIL'] ?? 'noreply@example.com';
        $fromName = $_ENV['FROM_NAME'] ?? 'Website Contact Form';
        
        $subject = "New Contact Form Submission from {$name}";
        
        $htmlContent = "
        <div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;'>
            <h2 style='color: #333; border-bottom: 2px solid #eee; padding-bottom: 10px;'>
                New Contact Form Submission
            </h2>
            
            <div style='background: #f9f9f9; padding: 20px; border-radius: 5px; margin: 20px 0;'>
                <p><strong>Name:</strong> " . htmlspecialchars($name) . "</p>
                <p><strong>Email:</strong> " . htmlspecialchars($email) . "</p>
            </div>
            
            <div style='background: #fff; padding: 20px; border: 1px solid #ddd; border-radius: 5px;'>
                <h3 style='color: #555; margin-top: 0;'>Message:</h3>
                <p style='line-height: 1.6; color: #333;'>" . nl2br(htmlspecialchars($message)) . "</p>
            </div>
            
            <div style='margin-top: 20px; padding: 15px; background: #e8f4fd; border-radius: 5px; font-size: 12px; color: #666;'>
                <p><strong>Sent:</strong> " . date('Y-m-d H:i:s') . "</p>
                <p><strong>IP Address:</strong> " . ($_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? 'Unknown') . "</p>
            </div>
        </div>";
        
        return $this->sendEmail([
            'to_email' => $toEmail,
            'to_name' => 'Website Admin',
            'from_email' => $fromEmail,
            'from_name' => $fromName,
            'reply_to_email' => $email,
            'reply_to_name' => $name,
            'subject' => $subject,
            'content' => $htmlContent,
            'content_type' => 'text/html'
        ]);
    }
    
    /**
     * Make HTTP request to SendGrid API
     * 
     * @param array $payload - Email payload
     * @return array - API response
     * @throws Exception
     */
    private function makeRequest($payload) {

        $this->logger->info("Making request to SendGrid API with payload: " . json_encode($payload));
        $ch = curl_init();
        
        curl_setopt_array($ch, [
            CURLOPT_URL => $this->baseUrl,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => json_encode($payload),
            CURLOPT_HTTPHEADER => [
                'Authorization: Bearer ' . $this->apiKey,
                'Content-Type: application/json'
            ],
            CURLOPT_TIMEOUT => 30,
            CURLOPT_SSL_VERIFYPEER => true
        ]);
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        
        $ch = null;
        
        $this->logger->info("SendGrid API response: " . $response);
        if ($error) {
            throw new Exception("cURL Error: {$error}");
        }
        
        $decodedResponse = json_decode($response, true);
        
        if ($httpCode >= 200 && $httpCode < 300) {
            return [
                'success' => true,
                'message' => 'Email sent successfully',
                'http_code' => $httpCode,
                'response' => $decodedResponse
            ];
        } else {
            $errorMessage = 'Failed to send email';
            
            if ($decodedResponse && isset($decodedResponse['errors'])) {
                $errors = [];
                foreach ($decodedResponse['errors'] as $error) {
                    $errors[] = $error['message'] ?? 'Unknown error';
                }
                $errorMessage = implode(', ', $errors);
            }
            
            throw new Exception("SendGrid API Error: {$errorMessage} (HTTP {$httpCode})");
        }
    }
    
    /**
     * Verify reCAPTCHA token (optional security feature)
     * 
     * @param string $token - reCAPTCHA token
     * @return bool - Whether token is valid
     */
    public static function verifyRecaptcha($token) {
        $secretKey = $_ENV['RECAPTCHA_SECRET_KEY'] ?? null;
        
        if (!$secretKey || !$token) {
            return false;
        }
        
        $ch = curl_init();
        
        curl_setopt_array($ch, [
            CURLOPT_URL => 'https://www.google.com/recaptcha/api/siteverify',
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => http_build_query([
                'secret' => $secretKey,
                'response' => $token,
                'remoteip' => $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? ''
            ]),
            CURLOPT_TIMEOUT => 10
        ]);
        
        $response = curl_exec($ch);
        $ch = null;
        
        if ($response === false) {
            return false;
        }
        
        $result = json_decode($response, true);
        
        return isset($result['success']) && $result['success'] === true;
    }
    
    /**
     * Log email to database
     * 
     * @param string $emailTo - Recipient email
     * @param string $subject - Email subject
     * @param string $body - Email body/content
     * @param string $response - SendGrid API response or error message
     * @param string $status - Status (sent/failed)
     */
    private function logEmail($emailTo, $subject, $body, $response, $status) {
        if (!$this->db) {
            return; // Skip logging if no database connection
        }
        
        try {
            $this->db->insert('email_logs', [
                'email_to' => $emailTo,
                'email_subject' => $subject,
                'email_body' => $body,
                'response' => $response,
                'status' => $status
            ]);
        } catch (Exception $e) {
            // Log database error but don't throw exception
            // We don't want email logging failure to prevent email sending
            error_log("Failed to log email to database: " . $e->getMessage());
        }
    }
    
    /**
     * Get email logs (for admin use)
     * 
     * @param int $limit - Number of logs to retrieve
     * @param int $offset - Offset for pagination
     * @return array - Email logs
     */
    public function getEmailLogs($limit = 50, $offset = 0) {
        if (!$this->db) {
            throw new Exception('Database connection required for email logs');
        }
        
        $r = $this->db->fetchAll(
            "SELECT * FROM email_logs ORDER BY sent_at DESC LIMIT $limit OFFSET $offset"
        );
        return $r;
    }
    
    /**
     * Get email log statistics
     * 
     * @return array - Statistics about email logs
     */
    public function getEmailStats() {
        if (!$this->db) {
            throw new Exception('Database connection required for email stats');
        }
        
        $stats = [
            'total' => 0,
            'sent' => 0,
            'failed' => 0,
            'today' => 0,
            'this_week' => 0,
            'this_month' => 0
        ];
        
        // Total emails
        $result = $this->db->fetchOne("SELECT COUNT(*) as count FROM email_logs");
        $stats['total'] = (int)$result['count'];
        
        // Sent vs Failed
        $result = $this->db->fetchOne("SELECT COUNT(*) as count FROM email_logs WHERE status = 'sent'");
        $stats['sent'] = (int)$result['count'];
        
        $result = $this->db->fetchOne("SELECT COUNT(*) as count FROM email_logs WHERE status = 'failed'");
        $stats['failed'] = (int)$result['count'];
        
        // Time-based stats
        $result = $this->db->fetchOne("SELECT COUNT(*) as count FROM email_logs WHERE DATE(sent_at) = CURDATE()");
        $stats['today'] = (int)$result['count'];
        
        $result = $this->db->fetchOne("SELECT COUNT(*) as count FROM email_logs WHERE YEARWEEK(sent_at, 1) = YEARWEEK(CURDATE(), 1)");
        $stats['this_week'] = (int)$result['count'];
        
        $result = $this->db->fetchOne("SELECT COUNT(*) as count FROM email_logs WHERE YEAR(sent_at) = YEAR(CURDATE()) AND MONTH(sent_at) = MONTH(CURDATE())");
        $stats['this_month'] = (int)$result['count'];
        
        return $stats;
    }
}
