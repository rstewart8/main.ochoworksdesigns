#!/bin/sh
set -eu

chmod 0644 /etc/cron.d/main-ochoworksdesigns || true
touch /var/log/ochoworksdesigns/campaign-queue.log

exec cron -f
