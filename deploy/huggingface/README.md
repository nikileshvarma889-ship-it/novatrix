# Free hosting: Hugging Face Space + Neon

Server address: **https://lnikileshvarma-reelwise.hf.space** (the Android app opens it directly).

1. **Database (Neon, free):** sign up at neon.tech → create a project → copy the connection string
   (`postgresql://…neon.tech/neondb?sslmode=require…`).
2. **Space (Hugging Face, free):** huggingface.co/new-space → name `reelwise` → SDK **Docker** → template **Blank**
   → hardware **CPU basic (free)** → **Public** → Create.
3. In the Space: **Files → + Add file → Create a new file**, name it `Dockerfile`, paste this folder's `Dockerfile`, commit.
4. **Settings → Variables and secrets → New secret** (three times):
   `DATABASE_URL` (from Neon), `ENCRYPTION_KEY` (32 random bytes, base64 — keep it forever, it protects saved tokens),
   `GEMINI_API_KEY`.
5. Wait for the build (about 10–15 minutes). The Space shows **Running**; the app is live.

Free-tier limits: the Space sleeps after 48 h without visitors (the app wakes it, about a minute) and its disk is
reset on restart (rendered video files are lost; accounts, brands and settings stay in Neon). To pick up new code,
use **Settings → Factory rebuild**.
