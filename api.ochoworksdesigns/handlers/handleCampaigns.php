<?php

/**
 * Handle all /api/marketing/campaigns/* endpoints
 * Extracted for cleaner code organization
 * 
 * Endpoints:
 * - GET    /api/marketing/campaigns                 - List campaigns
 * - GET    /api/marketing/campaigns/{id}            - Get single campaign
 * - GET    /api/marketing/campaigns/{id}/stats      - Get campaign statistics
 * - GET    /api/marketing/campaigns/{id}/sends       - Get campaign send logs
 * - GET    /api/marketing/campaigns/{id}/send-status - Get latest send job status (queue)
 * - POST   /api/marketing/campaigns                 - Create campaign
 * - POST   /api/marketing/campaigns/{id}/send       - Queue campaign send (worker processes)
 * - POST   /api/marketing/campaigns/{id}/duplicate  - Duplicate campaign
 * - PUT    /api/marketing/campaigns/{id}            - Update campaign
 * - PATCH  /api/marketing/campaigns/{id}/status     - Update campaign status only
 * - DELETE /api/marketing/campaigns/{id}            - Delete draft campaign
 */
function handleCampaigns($marketing, $method, $segments)
{
    global $logger;

    $logger->info("Handling campaigns endpoint: " . $method . " " . implode('/', $segments));

    $campaignId = $segments[3] ?? null;
    $action = $segments[4] ?? null;
    $altId = $segments[5] ?? null;
    $seg6 = $segments[6] ?? null;
    $seg7 = $segments[7] ?? null;

    $logger->info("Campaign ID: " . ($campaignId ?? 'none') . ", Action: " . ($action ?? 'none') . ", Alt ID: " . ($altId ?? 'none'));

    switch ($method) {
        // =========================================================================
        // GET REQUESTS
        // =========================================================================
        case 'GET':
            if ($campaignId) {
                // -----------------------------------------------------------------
                // GET /api/marketing/campaigns/{id}/stats - Campaign statistics
                // -----------------------------------------------------------------
                if ($action === 'stats') {
                    try {
                        $stats = $marketing->getCampaignStats($campaignId);
                        if ($stats) {
                            ApiHelpers::successResponse($stats);
                        } else {
                            ApiHelpers::errorResponse('Campaign not found', 404);
                        }
                    } catch (Exception $e) {
                        ApiHelpers::errorResponse($e->getMessage(), 400);
                    }
                    return;
                }

                // -----------------------------------------------------------------
                // GET /api/marketing/campaigns/{id}/sends - Campaign send logs
                // -----------------------------------------------------------------
                if ($action === 'sends') {
                    $filters = [
                        'status' => $_GET['status'] ?? null,
                        'opened' => isset($_GET['opened']) ? ($_GET['opened'] === 'true') : null,
                        'clicked' => isset($_GET['clicked']) ? ($_GET['clicked'] === 'true') : null,
                        'search' => $_GET['search'] ?? null,
                        'limit' => (int)($_GET['limit'] ?? 50),
                        'offset' => (int)($_GET['offset'] ?? 0)
                    ];

                    try {
                        $sends = $marketing->getCampaignSends(
                            $campaignId,
                            array_filter($filters, fn($v) => $v !== null)
                        );
                        ApiHelpers::successResponse($sends);
                    } catch (Exception $e) {
                        ApiHelpers::errorResponse($e->getMessage(), 400);
                    }
                    return;
                }

                // -----------------------------------------------------------------
                // GET /api/marketing/campaigns/{id}/recipients - Preview recipients
                // -----------------------------------------------------------------
                if ($action === 'recipients') {
                    $filters = [
                        'tag' => $_GET['tag'] ?? null,
                        'source' => $_GET['source'] ?? null,
                        'subscribed_only' => true,
                        'limit' => (int)($_GET['limit'] ?? 100),
                        'offset' => (int)($_GET['offset'] ?? 0)
                    ];

                    try {
                        $recipients = $marketing->getCampaignRecipients(
                            $campaignId,
                            array_filter($filters, fn($v) => $v !== null)
                        );
                        ApiHelpers::successResponse($recipients);
                    } catch (Exception $e) {
                        ApiHelpers::errorResponse($e->getMessage(), 400);
                    }
                    return;
                }

                // -----------------------------------------------------------------
                // GET /api/marketing/campaigns/{id}/send-status - Latest send job (queue)
                // -----------------------------------------------------------------
                if ($action === 'send-status') {
                    try {
                        $job = $marketing->getLatestCampaignSendJob($campaignId);
                        if ($job) {
                            ApiHelpers::successResponse($job);
                        } else {
                            ApiHelpers::successResponse(null, 'No send job for this campaign');
                        }
                    } catch (Exception $e) {
                        ApiHelpers::errorResponse($e->getMessage(), 400);
                    }
                    return;
                }

                if ($action === 'email-campaigns') {
                    $emailCampaignId = $altId ?? null;

                    if ($emailCampaignId) {
                        switch ($seg6) {
                            case 'unsent-contacts':
                                try {
                                    $filters = [
                                        'subscribed_only' => isset($_GET['subscribed_only'])
                                            ? ($_GET['subscribed_only'] === 'true' || $_GET['subscribed_only'] === '1')
                                            : true,
                                        'tag' => $_GET['tag'] ?? null,
                                        'source' => $_GET['source'] ?? null,
                                        'search' => $_GET['search'] ?? null,
                                        'has_phone' => isset($_GET['has_phone'])
                                            ? ($_GET['has_phone'] === 'true' || $_GET['has_phone'] === '1')
                                            : null,
                                        'limit' => $_GET['limit'] ?? 50,
                                        'offset' => $_GET['offset'] ?? 0,
                                        'city' => $_GET['city'] ?? null,
                                        'state' => $_GET['state'] ?? null
                                    ];

                                    $result = $marketing->getContactsNotSentForEmailCampaign((int)$emailCampaignId, $filters);
                                    ApiHelpers::successResponse($result);
                                    return;
                                } catch (Exception $e) {
                                    $code = strpos($e->getMessage(), 'not found') !== false ? 404 : 500;
                                    ApiHelpers::errorResponse($e->getMessage(), $code);
                                    return;
                                }

                            case 'stats':
                                try {
                                    $stats = $marketing->getEmailCampaignStats($emailCampaignId);
                                    if ($stats) {
                                        ApiHelpers::successResponse($stats);
                                    } else {
                                        ApiHelpers::errorResponse('Email campaign not found', 404);
                                    }
                                } catch (Exception $e) {
                                    ApiHelpers::errorResponse($e->getMessage(), 400);
                                }
                                return;
                             default:
                                ApiHelpers::errorResponse('Email campaign not found for campaign ID ' . $emailCampaignId, 404);
                                 break;
                        }
                        try {
                            $emailCampaign = $marketing->getEmailCampaignById($emailCampaignId);
                            if ($emailCampaign) {
                                ApiHelpers::successResponse($emailCampaign);
                            } else {
                                ApiHelpers::errorResponse('Email campaign not found', 404);
                            }
                        } catch (Exception $e) {
                            ApiHelpers::errorResponse($e->getMessage(), 400);
                        }
                        return;
                    }
                    
                    return;
                }

                $action = $segments[4] ?? null;

                if ($action === 'unsent-contacts') {
                    try {
                        $filters = [
                            'subscribed_only' => isset($_GET['subscribed_only'])
                                ? ($_GET['subscribed_only'] === 'true' || $_GET['subscribed_only'] === '1')
                                : true,
                            'tag' => $_GET['tag'] ?? null,
                            'source' => $_GET['source'] ?? null,
                            'search' => $_GET['search'] ?? null,
                            'has_phone' => isset($_GET['has_phone'])
                                ? ($_GET['has_phone'] === 'true' || $_GET['has_phone'] === '1')
                                : null,
                            'limit' => $_GET['limit'] ?? 50,
                            'offset' => $_GET['offset'] ?? 0,
                            'city' => $_GET['city'] ?? null,
                            'state' => $_GET['state'] ?? null
                        ];

                        $result = $marketing->getContactsNotSentForCampaign((int)$campaignId, $filters);
                        ApiHelpers::successResponse($result);
                        return;
                    } catch (Exception $e) {
                        $code = strpos($e->getMessage(), 'not found') !== false ? 404 : 500;
                        ApiHelpers::errorResponse($e->getMessage(), $code);
                        return;
                    }
                }

                if ($action === 'emails') {
                    try {

                        if ($altId) {
                            $campaign = $marketing->getCampaignEmailById($altId);
                            if (!$campaign) {
                                ApiHelpers::errorResponse('Campaign email not found with alt ID', 404);
                                return;
                            }
                            ApiHelpers::successResponse($campaign);
                            return;
                        }
                        $emails = $marketing->getCampaignEmails($campaignId);
                        ApiHelpers::successResponse($emails);
                    } catch (Exception $e) {
                        $code = strpos($e->getMessage(), 'not found') !== false ? 404 : 500;
                        ApiHelpers::errorResponse($e->getMessage(), $code);
                    }
                    return;
                }

                // -----------------------------------------------------------------
                // GET /api/marketing/campaigns/{id} - Get single campaign
                // -----------------------------------------------------------------
                $campaign = $marketing->getCampaign($campaignId);
                if ($campaign) {
                    ApiHelpers::successResponse($campaign);
                } else {
                    ApiHelpers::errorResponse('Campaign not found', 404);
                }
            } else {
                // -----------------------------------------------------------------
                // GET /api/marketing/campaigns - List campaigns
                // -----------------------------------------------------------------
                $filters = [
                    'search' => $_GET['search'] ?? null,
                    'status' => $_GET['status'] ?? null,
                    'from_date' => $_GET['from_date'] ?? null,
                    'to_date' => $_GET['to_date'] ?? null,
                    'sort_by' => $_GET['sort_by'] ?? 'created_at',
                    'sort_order' => $_GET['sort_order'] ?? 'DESC',
                    'limit' => (int)($_GET['limit'] ?? 50),
                    'offset' => (int)($_GET['offset'] ?? 0)
                ];

                try {
                    $result = $marketing->getCampaigns(
                        array_filter($filters, fn($v) => $v !== null)
                    );
                    ApiHelpers::successResponse($result);
                } catch (Exception $e) {
                    ApiHelpers::errorResponse($e->getMessage(), 500);
                }
            }
            break;

        // =========================================================================
        // POST REQUESTS
        // =========================================================================
        case 'POST':
            if ($campaignId === 'new') {
                $data = ApiHelpers::getJsonInput();

                if (empty($data['name'])) {
                    ApiHelpers::errorResponse('Campaign name is required', 400);
                    return;
                }

                try {
                    $id = $marketing->createCampaign($data);
                    ApiHelpers::successResponse(['id' => $id], 'Campaign created successfully');
                } catch (Exception $e) {
                    ApiHelpers::errorResponse($e->getMessage(), 400);
                }
                return;
            }

            // ---------------------------------------------------------------------
            // POST /api/marketing/campaigns/{id}/send - Queue campaign send
            // ---------------------------------------------------------------------
            if ($campaignId && $action === 'send') {
                $data = ApiHelpers::getJsonInput() ?? [];

                try {
                    $contactIds = $data['contact_ids'] ?? [];
                    $emailCampaignId = $altId ?? null;
                    $filters = $data['filters'] ?? [];

                    $jobId = $marketing->queueCampaignSend($campaignId, $contactIds, $emailCampaignId, $filters);
                    ApiHelpers::successResponse(
                        ['job_id' => $jobId],
                        'Campaign queued for sending. Results will appear in send status and send logs.'
                    );
                } catch (Exception $e) {
                    $logger->error("Campaign send queue error: " . $e->getMessage());
                    ApiHelpers::errorResponse($e->getMessage(), 400);
                }
                return;
            }

            // ---------------------------------------------------------------------
            // POST /api/marketing/campaigns/{id}/duplicate - Duplicate campaign
            // ---------------------------------------------------------------------
            if ($campaignId && $action === 'duplicate') {
                try {
                    $campaign = $marketing->getCampaign($campaignId);
                    if (!$campaign) {
                        ApiHelpers::errorResponse('Campaign not found', 404);
                        return;
                    }

                    // Get user ID from token
                    $tokenData = ApiHelpers::verifyToken(true);
                    $createdBy = null;
                    if ($tokenData && isset($tokenData->data->id)) {
                        $createdBy = $tokenData->data->id;
                    }

                    $newId = $marketing->duplicateCampaign($campaignId, $createdBy);
                    ApiHelpers::successResponse(
                        ['id' => $newId],
                        'Campaign duplicated successfully'
                    );
                } catch (Exception $e) {
                    ApiHelpers::errorResponse($e->getMessage(), 400);
                }
                return;
            }

            // ---------------------------------------------------------------------
            // POST /api/marketing/campaigns/{id}/schedule - Schedule campaign
            // ---------------------------------------------------------------------
            if ($campaignId && $action === 'schedule') {
                $data = ApiHelpers::getJsonInput();

                if (empty($data['scheduled_at'])) {
                    ApiHelpers::errorResponse('Scheduled date/time is required', 400);
                    return;
                }

                try {
                    $marketing->scheduleCampaign($campaignId, $data['scheduled_at']);
                    ApiHelpers::successResponse(null, 'Campaign scheduled successfully');
                } catch (Exception $e) {
                    ApiHelpers::errorResponse($e->getMessage(), 400);
                }
                return;
            }

            // ---------------------------------------------------------------------
            // POST /api/marketing/campaigns/{id}/test - Send test email
            // ---------------------------------------------------------------------
            if ($campaignId && $action === 'test') {
                $data = ApiHelpers::getJsonInput();

                if (empty($data['email'])) {
                    ApiHelpers::errorResponse('Test email address is required', 400);
                    return;
                }

                if (!filter_var($data['email'], FILTER_VALIDATE_EMAIL)) {
                    ApiHelpers::errorResponse('Invalid email format', 400);
                    return;
                }

                try {
                    $result = $marketing->sendTestEmail($campaignId, $data['email']);
                    ApiHelpers::successResponse($result, 'Test email sent successfully');
                } catch (Exception $e) {
                    ApiHelpers::errorResponse($e->getMessage(), 400);
                }
                return;
            }

            if ($campaignId && $action === 'email') {
                $data = ApiHelpers::getJsonInput();

                $requiredFields = ['name', 'subject', 'content'];
                foreach ($requiredFields as $field) {
                    if (empty($data[$field])) {
                        ApiHelpers::errorResponse("Field '$field' is required", 400);
                        return;
                    }
                }

                $data['links'] = $data['links'] ?? [];
                foreach ($data['links'] as $link) {
                    $logger->info("Validating link: " . json_encode($link));
                    if (empty($link['link_url'])) {
                        throw new Exception("Link URL is required");
                    }
                    if (empty($link['link_name'])) {
                        throw new Exception("Link name is required");
                    }
                }



                try {
                    $result = $marketing->createEmailCampaign($campaignId, $data);
                    ApiHelpers::successResponse($result, 'Email campaign created successfully');
                } catch (Exception $e) {
                    ApiHelpers::errorResponse($e->getMessage(), 400);
                }
                return;
            }

            // ---------------------------------------------------------------------
            // POST /api/marketing/campaigns - Create new campaign
            // ---------------------------------------------------------------------
            $data = ApiHelpers::getJsonInput();

            // Validate required fields
            if (empty($data['name'])) {
                ApiHelpers::errorResponse('Campaign name is required', 400);
                return;
            }

            try {
                $id = $marketing->createCampaign($data);
                ApiHelpers::successResponse(['id' => $id], 'Campaign created successfully');
            } catch (Exception $e) {
                ApiHelpers::errorResponse($e->getMessage(), 400);
            }
            break;

        // =========================================================================
        // PUT REQUESTS
        // =========================================================================
        case 'PUT':
            if (!$campaignId) {
                ApiHelpers::errorResponse('Campaign ID required', 400);
                return;
            }

            // Verify campaign exists
            $campaign = $marketing->getCampaign($campaignId);
            if (!$campaign) {
                ApiHelpers::errorResponse('Campaign not found', 404);
                return;
            }

            if ($action === 'emails') {
                try {
                    $data = ApiHelpers::getJsonInput();
                    $marketing->updateEmailCampaign($altId, $data);
                    ApiHelpers::successResponse(null, 'Email Campaign updated successfully');
                } catch (Exception $e) {
                    ApiHelpers::errorResponse($e->getMessage(), 400);
                }
                return;
            }

            $data = ApiHelpers::getJsonInput();

            try {
                $marketing->updateCampaign($campaignId, $data);
                ApiHelpers::successResponse(null, 'Campaign updated successfully');
            } catch (Exception $e) {
                ApiHelpers::errorResponse($e->getMessage(), 400);
            }
            break;

        // =========================================================================
        // PATCH REQUESTS
        // =========================================================================
        case 'PATCH':
            if (!$campaignId) {
                ApiHelpers::errorResponse('Campaign ID required', 400);
                return;
            }

            // ---------------------------------------------------------------------
            // PATCH /api/marketing/campaigns/{id}/status - Update status only
            // ---------------------------------------------------------------------
            if ($action === 'status') {
                $data = ApiHelpers::getJsonInput();

                if (empty($data['status'])) {
                    ApiHelpers::errorResponse('Status is required', 400);
                    return;
                }

                $validStatuses = ['draft', 'scheduled', 'paused', 'cancelled'];
                if (!in_array($data['status'], $validStatuses)) {
                    ApiHelpers::errorResponse(
                        'Invalid status. Allowed: ' . implode(', ', $validStatuses),
                        400
                    );
                    return;
                }

                try {
                    $marketing->updateCampaignStatus($campaignId, $data['status']);
                    ApiHelpers::successResponse(null, 'Campaign status updated');
                } catch (Exception $e) {
                    ApiHelpers::errorResponse($e->getMessage(), 400);
                }
                return;
            }

            // ---------------------------------------------------------------------
            // PATCH /api/marketing/campaigns/{id}/cancel - Cancel sending campaign
            // ---------------------------------------------------------------------
            if ($action === 'cancel') {
                try {
                    $campaign = $marketing->getCampaignEmailById($campaignId);
                    if (!$campaign) {
                        ApiHelpers::errorResponse('Email campaign not found', 404);
                        return;
                    }

                    if (!in_array($campaign['status'], ['scheduled', 'sending'])) {
                        ApiHelpers::errorResponse(
                            'Cannot cancel campaign with status: ' . $campaign['status'],
                            400
                        );
                        return;
                    }

                    $marketing->updateCampaignStatus($campaignId, 'cancelled');
                    ApiHelpers::successResponse(null, 'Campaign cancelled');
                } catch (Exception $e) {
                    ApiHelpers::errorResponse($e->getMessage(), 400);
                }
                return;
            }

            ApiHelpers::errorResponse('Invalid PATCH action', 400);
            break;

        // =========================================================================
        // DELETE REQUESTS
        // =========================================================================
        case 'DELETE':
            if (!$campaignId) {
                ApiHelpers::errorResponse('Campaign ID required', 400);
                return;
            }

            // Verify campaign exists
            $campaign = $marketing->getCampaign($campaignId);
            if (!$campaign) {
                ApiHelpers::errorResponse('Campaign not found', 404);
                return;
            }

            try {
                $marketing->deleteCampaign($campaignId);
                ApiHelpers::successResponse(null, 'Campaign deleted successfully');
            } catch (Exception $e) {
                ApiHelpers::errorResponse($e->getMessage(), 400);
            }
            break;

        // =========================================================================
        // INVALID METHOD
        // =========================================================================
        default:
            ApiHelpers::errorResponse('Method not allowed', 405);
    }
}
