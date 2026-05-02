# main.ochoworksdesigns

This repo contains the OchoWorks Designs public site split into two existing applications:

- `web.ochoworksdesigns/`: Angular frontend
- `api.ochoworksdesigns/`: PHP API plus the MySQL schema bootstrap

The repo root now provides a Docker-based local development workflow similar to `client.ochoworksdesigns`, but aligned to the ports requested for this app.

## Local Dev Stack

Run the full dev stack from the repo root:

```bash
./start.sh
```

Stop it with:

```bash
./shutdown.sh
```

The root scripts use `docker compose` and expose:

- Angular app: `http://localhost:4222`
- PHP API: `http://localhost:8222`
- API health check: `http://localhost:8222/api/health`
- MySQL host access: `127.0.0.1:3622`

The startup script will create `api.ochoworksdesigns/.env` from `api.ochoworksdesigns/.env.example` if it does not already exist.

## What Runs

`docker-compose.yml` starts four services:

- `db`: MySQL 8.4 with the schema from `api.ochoworksdesigns/init.sql`
- `api`: Apache + PHP for `api.ochoworksdesigns/public`
- `cron`: the queue worker that runs `process_campaign_send_queue.php` every minute
- `frontend`: Angular dev server with polling enabled for Docker-friendly live reload

Local data and logs are stored at:

- `mysql-data/`
- `var/log/ochoworksdesigns/`

## Helpful Commands

Show container status:

```bash
docker compose ps
```

Tail logs:

```bash
docker compose logs -f api frontend cron db
```

Connect to MySQL from the host:

```bash
mysql -h 127.0.0.1 -P 3622 -u admin -p ochoworksdesigns
```

## Troubleshooting

If MySQL fails on the very first boot with an init error, reset the local dev database and start again:

```bash
./shutdown.sh
rm -rf mysql-data
./start.sh
```

That reset is only needed when the initial schema load is interrupted, because MySQL only runs `api.ochoworksdesigns/init.sql` when the data directory is empty.

## Notes

- The Angular dev server is bind-mounted, so frontend edits should hot reload without restarting the stack.
- The PHP API is bind-mounted too, so PHP file changes are picked up immediately.
- The root setup leaves the existing nested app directories intact and only adds the repo-level Docker entry points around them.

## Production Deploy

Production deployment now runs from the repo root:

```bash
./deploy.sh -b master
```

See `aws-ec2-production-setup.txt` for the EC2 layout, Nginx setup, and API `.env` values. The root deploy builds the Angular SSR app, reloads PM2, and runs the PHP API plus cron worker through `docker-compose.production.yml`.
