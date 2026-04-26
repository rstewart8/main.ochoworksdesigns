<?php
$path = dirname(__FILE__);

require_once $path . '/../libs/logger.php';

class Mailtrap {
    private $db;
    private $apiKey;
    private $fromEmail;
    private $fromName;
    private $inboxId;
    private $logger;

    public function __construct($database = null) {
        $this->db = $database;

        if (empty($_ENV['EMAIL_API_KEY'])) {
            throw new Exception('EMAIL_API_KEY not set');
        }

        if (empty($_ENV['MAILTRAP_INBOX_ID'])) {
            throw new Exception('MAILTRAP_INBOX_ID not set');
        }

        $this->apiKey    = $_ENV['EMAIL_API_KEY'];
        $this->inboxId   = $_ENV['MAILTRAP_INBOX_ID'];
        $this->fromEmail = $_ENV['FROM_EMAIL'] ?? 'noreply@example.com';
        $this->fromName  = $_ENV['FROM_NAME'] ?? 'Application';
        $this->logger = new Logger();
    }

    /**
     * Matches SendGrid::sendEmail($emailData)
     */
    public function sendEmail($emailData) {
        $required = ['to_email', 'subject', 'content', 'from_email', 'from_name'];

        foreach ($required as $field) {
            if (empty($emailData[$field])) {
                throw new Exception("Missing required field: {$field}");
            }
        }

        $toEmail = $emailData['to_email'];
        $toName  = $emailData['to_name'] ?? '';
        $subject = $emailData['subject'];
        $content = $emailData['content'];
        $fromEmail = $emailData['from_email'];
        $fromName = $emailData['from_name'];
        $sendPlainText = !empty($emailData['send_plain_text']);
        $plainTextBody = $emailData['plain_text'] ?? strip_tags($content);

        $status   = 'failed';
        $response = null;

        try {
            $result = $this->sendViaMailtrap(
                $toEmail,
                $subject,
                $content,
                $toName,
                $fromEmail,
                $fromName,
                $plainTextBody,
                $sendPlainText
            );

            if (!$result['success']) {
                throw new Exception($result['error'] ?? 'Mailtrap send failed');
            }

            $status   = 'sent';
            $response = $result['response'] ?? null;

            return [
                'success' => true,
                'message' => 'Email sent (Mailtrap)',
            ];

        } catch (Exception $e) {
            $response = $e->getMessage();
            error_log('Mailtrap Error: ' . $response);
            throw $e;
        } finally {
            $this->logEmail(
                $toEmail,
                $subject,
                $content,
                $response,
                $status
            );
        }
    }

    /**
     * Contact form helper (same behavior as SendGrid)
     */
    public function sendContactEmail($name, $email, $message) {
        $subject = "New Contact Form Submission from {$name}";

        $html = "
        <div style='font-family: Arial, sans-serif; max-width: 600px'>
            <h2>New Contact Form Submission</h2>
            <p><strong>Name:</strong> " . htmlspecialchars($name) . "</p>
            <p><strong>Email:</strong> " . htmlspecialchars($email) . "</p>
            <hr>
            <p>" . nl2br(htmlspecialchars($message)) . "</p>
            <p style='font-size:12px;color:#666;'>Sent: " . date('Y-m-d H:i:s') . "</p>
        </div>";

        return $this->sendEmail([
            'to_email'   => $_ENV['CONTACT_EMAIL'] ?? 'admin@example.com',
            'to_name'    => 'Website Admin',
            'subject'    => $subject,
            'content'    => $html,
            'reply_to'   => $email
        ]);
    }

    /**
     * Mailtrap API sender (based on your function)
     */
    private function sendViaMailtrap($toEmail, $subject, $htmlContent, $toName = '', $fromEmail = null, $fromName = null, $plainTextContent = null, $sendPlainText = false) {
        $data = [
            'from' => [
                'email' => $fromEmail ?? $this->fromEmail,
                'name'  => $fromName ?? $this->fromName
            ],
            'to' => [
                [
                    'email' => $toEmail,
                    'name'  => $toName
                ]
            ],
            'subject' => $subject
        ];

        if ($sendPlainText) {
            $data['text'] = $plainTextContent ?? strip_tags($htmlContent);
        } else {
            $data['html'] = $htmlContent;
            if (!empty($plainTextContent)) {
                $data['text'] = $plainTextContent;
            }
        }

        $ch = curl_init();

        curl_setopt_array($ch, [
            CURLOPT_URL            => "https://sandbox.api.mailtrap.io/api/send/{$this->inboxId}",
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => json_encode($data),
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER     => [
                'Authorization: Bearer ' . $this->apiKey,
                'Content-Type: application/json'
            ]
        ]);
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error    = curl_error($ch);

        $this->logger->info("Mailtrap api key: " . $this->apiKey);
        $this->logger->info("Mailtrap response: " . $response);
        $this->logger->info("Mailtrap HTTP code: " . $httpCode);
        $this->logger->info("Mailtrap cURL error: " . $error);

        $ch = null;

        if ($error) {
            return [
                'success' => false,
                'error'   => 'cURL error: ' . $error
            ];
        }

        if ($httpCode >= 200 && $httpCode < 300) {
            return [
                'success'  => true,
                'response' => $response
            ];
        }

        $responseData = json_decode($response, true);

        return [
            'success'   => false,
            'error'     => $responseData['errors'][0] ?? 'Mailtrap API error',
            'http_code'=> $httpCode
        ];
    }

    /**
     * Shared DB logging (same as SendGrid)
     */
    private function logEmail($emailTo, $subject, $body, $response, $status) {
        if (!$this->db) {
            return;
        }

        try {
            $this->db->insert('email_logs', [
                'email_to'      => $emailTo,
                'email_subject' => $subject,
                'email_body'    => $body,
                'response'      => $response,
                'status'        => $status
            ]);
        } catch (Exception $e) {
            error_log('Email log failed: ' . $e->getMessage());
        }
    }

    public function getEmailLogs($limit = 50, $offset = 0) {
        if (!$this->db) {
            throw new Exception('Database connection required');
        }

        return $this->db->fetchAll(
            "SELECT * FROM email_logs ORDER BY sent_at DESC LIMIT $limit OFFSET $offset"
        );
    }

    public function getEmailStats() {
        if (!$this->db) {
            throw new Exception('Database connection required');
        }

        return (new SendGrid($this->db))->getEmailStats();
    }
}
