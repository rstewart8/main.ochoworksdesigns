#!/usr/bin/env php
<?php
/**
 * Campaign send queue worker. Run from cron to process queued campaign sends.
 *
 * Usage:
 *   php process_campaign_send_queue.php           # Process one job (default for cron)
 *   php process_campaign_send_queue.php --max=5   # Process up to 5 jobs
 *
 * Cron example (every minute):
 *   * * * * * cd /path/to/api.ochoworksdesigns && php process_campaign_send_queue.php >> /var/log/campaign_queue.log 2>&1
 */

// Run from API root so paths resolve
$apiRoot = dirname(__FILE__);
chdir($apiRoot);

require_once $apiRoot . '/classes/ApiHelpers.php';
ApiHelpers::loadEnv($apiRoot . '/.env');

// Ensure logger env (may not be set in CLI)
if (empty($_ENV['LOGGERPATH'])) {
    $_ENV['LOGGERPATH'] = $apiRoot . '/logs/queue.log';
}
if (empty($_ENV['ERRORPATH'])) {
    $_ENV['ERRORPATH'] = $apiRoot . '/logs/queue_error.log';
}
$logsDir = $apiRoot . '/logs';
if (!is_dir($logsDir)) {
    @mkdir($logsDir, 0755, true);
}

require_once $apiRoot . '/classes/Database.php';
require_once $apiRoot . '/libs/helpers.php';
require_once $apiRoot . '/libs/logger.php';
require_once $apiRoot . '/classes/emailMarketing.php';

$logger = new Logger();

$maxJobs = 1;
foreach (array_slice($argv, 1) as $arg) {
    if (preg_match('/^--max=(\d+)$/', $arg, $m)) {
        $maxJobs = max(1, (int) $m[1]);
        break;
    }
}

try {
    $db = new Database($logger);
    $marketing = new EmailMarketing($db, $logger);
    $processed = 0;
    while ($processed < $maxJobs && $marketing->processNextQueuedJob()) {
        $processed++;
        $logger->info("Processed campaign send queue job ($processed of $maxJobs).");
    }
    if ($processed === 0) {
        $logger->info("No queued campaign send jobs.");
    }
} catch (Exception $e) {
    $logger->error("Campaign send queue worker: " . $e->getMessage());
    exit(1);
}
exit(0);
