# Deployment

Reelwise has two processes that share one database and one storage folder:

| Process | Command | Needs |
|---|---|---|
| Web app | `npm run build && npm start` | Node 20+, DB |
| Worker | `npm run worker` | Node 20+, DB, FFmpeg, Chrome/Chromium, 2+ CPU cores (4+ recommended for 3D rendering) |

## Recommended: one Linux VM (or container host)

1. Provision a VM (4 vCPU / 8 GB RAM or larger). Install Node 22, FFmpeg and PostgreSQL, or use a managed database such as Supabase.
2. Clone the repository and run `npm ci`. Fill in `.env` (start from `.env.example`). Set `APP_URL` to your HTTPS domain.
3. Run `npm run db:migrate`, then `npm run build`.
4. Run both processes under systemd or pm2:
   - `pm2 start "npm start" --name reelwise-web`
   - `pm2 start "npm run worker" --name reelwise-worker`
5. Put Nginx or Caddy in front for HTTPS. Allow uploads of up to 1 GB (Nginx: `client_max_body_size 1g;`).
6. Register `https://YOUR_DOMAIN/api/oauth/meta/callback` and `https://YOUR_DOMAIN/api/oauth/google/callback` in the Meta and Google consoles.

## Supabase

- Use the **connection pooling** URL as `DATABASE_URL`, and run `npm run db:migrate` once.
- The migrations enable row-level security on every table with no public policies. Supabase's `anon` and `authenticated` keys can't read anything; only the app's database role can.

## Storage

- Media lives in `STORAGE_DIR`. For several servers, mount shared storage (NFS or EFS), or adapt `src/lib/storage.ts` to S3 or Supabase Storage.
- Back up the database and `STORAGE_DIR` regularly.

## Security checklist

- **Secrets:** use a long random `ENCRYPTION_KEY`. Store it in your secret manager and never change it after tokens are saved, or the stored tokens become unreadable.
- **HTTPS only:** session cookies are `Secure` in production.
- **Rate limiting:** the built-in limiter runs per process. Add an edge or WAF rate limit for multi-instance deployments.
- **API keys:**
  - Keep the Claude and ElevenLabs keys only in `.env` or in Settings (both are encrypted).
  - Rotate any key that has been shared in chat or email.
