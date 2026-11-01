# Deployment

Reelwise has two processes that share one database and one storage folder: the web app and the
worker (rendering with FFmpeg + headless Chrome, publishing, syncing). The production Docker image
(`reelwise/Dockerfile`) contains both plus FFmpeg, Remotion's Chrome and the Piper English voice.
`ROLE=all` (the default) runs both in one container so they share one disk.

Every push to `reelwise/` runs the **Reelwise server image** GitHub Action: it builds the image, starts
it against a real PostgreSQL, runs the end-to-end suite, then pushes the image to
`ghcr.io/nikileshvarma889-ship-it/reelwise` and calls your Render deploy hook if you added one.

## Option A (recommended): Render, one click

1. Open https://render.com/deploy?repo=https://github.com/nikileshvarma889-ship-it/novatrix and sign in
   (connect GitHub when asked). Choose the branch that contains `render.yaml` and `reelwise/`.
2. Render reads `render.yaml` and creates the **reelwise** web service (Docker, Standard plan, 10 GB disk)
   and the **reelwise-db** PostgreSQL database. `ENCRYPTION_KEY` is generated for you;
   `DATABASE_URL` is wired automatically. Migrations run on every start.
3. Fill in the secret values it asks for (leave any you don't have yet empty; add them later under
   *Environment*): `ELEVENLABS_API_KEY`, `ANTHROPIC_API_KEY`, `META_APP_ID`, `META_APP_SECRET`,
   `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`. Leave `APP_URL` empty to use the `onrender.com` URL.
4. When the deploy is live, open `https://<service>.onrender.com`, sign up (the first account owns its workspace).
5. Optional auto-deploy from CI: Render → service → Settings → *Deploy Hook* → copy it into the GitHub
   repository secret `RENDER_DEPLOY_HOOK_URL`.

## Option B: Fly.io

See the commands at the top of `reelwise/fly.toml` (app + Fly Postgres + a 10 GB volume + secrets, then `fly deploy`).

## Option C: any Linux VPS with Docker (automatic HTTPS)

```bash
cp .env.example .env    # fill in ENCRYPTION_KEY, APP_URL=https://your-domain and your keys
DOMAIN=your-domain POSTGRES_PASSWORD='a-long-random-password' docker compose up -d --build
```

## After deploying (all options)

Register these redirect URIs, using your live URL:
- Meta app → Facebook Login → Valid OAuth Redirect URIs: `https://YOUR_URL/api/oauth/meta/callback`
- Google Cloud → OAuth client → Authorized redirect URIs: `https://YOUR_URL/api/oauth/google/callback`

Sizing: 3D renders run on the CPU. 2 GB RAM / 1 CPU works but is slow (several minutes per 20 s video);
use 4 CPU / 8 GB for faster renders and set `RENDER_CONCURRENCY` to the CPU count.

## Manual install without Docker
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
