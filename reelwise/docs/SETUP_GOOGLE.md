# Google Cloud + YouTube setup

1. Go to https://console.cloud.google.com and create (or pick) a project.
2. Under **APIs & Services → Library**, enable:
   - **YouTube Data API v3**;
   - **YouTube Analytics API**.
3. Under **APIs & Services → OAuth consent screen**:
   - Choose **External** and fill in the app name, support email and privacy policy.
   - Add these scopes:
     - `youtube.upload`
     - `youtube.readonly`
     - `youtube.force-ssl`
     - `yt-analytics.readonly`
   - While in **Testing**, add your Google account under **Test users**.
4. Under **APIs & Services → Credentials → Create credentials → OAuth client ID**:
   - Choose **Web application**.
   - Add this authorised redirect URI: `https://YOUR_DOMAIN/api/oauth/google/callback` (for local development: `http://localhost:3000/api/oauth/google/callback`).
5. Copy the client ID and secret into `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.

## Things to know

- **Video visibility:** uploads from apps that haven't passed Google's **API compliance audit** are locked to *private* by YouTube.
  - To publish public videos, request the audit: https://support.google.com/youtube/contact/yt_api_form
  - Until then, uploads succeed but stay private.
- **Quota:** the default quota is 10,000 units per day, and one upload costs about 1,600 units. Reelwise shows "quota exceeded" errors and retries later.
- **Custom thumbnails:** they need a verified YouTube channel (phone verification).
- **Refresh tokens:** Reelwise stores the refresh token encrypted and renews access tokens automatically.
  - While the consent screen is in **Testing**, Google expires refresh tokens after 7 days. Publish the consent screen to avoid that.
