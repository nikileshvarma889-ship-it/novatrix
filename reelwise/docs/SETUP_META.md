# Meta setup (Instagram professional accounts + Facebook Pages)

Reelwise uses **Facebook Login** with the Graph API. Instagram accounts must be **Business or Creator** accounts linked to a Facebook Page you manage.

## 1. Create the app

1. Go to https://developers.facebook.com/apps and create an app with the **Business** type.
2. Add these products:
   - **Facebook Login for Business** (or **Facebook Login**);
   - **Instagram Graph API**.
3. Under **App settings → Basic**:
   - Copy the **App ID** to `META_APP_ID`.
   - Copy the **App secret** to `META_APP_SECRET`.
   - Add your privacy policy URL and app domain.
4. Under **Facebook Login → Settings → Valid OAuth Redirect URIs**, add:
   `https://YOUR_DOMAIN/api/oauth/meta/callback`
   (for local development: `http://localhost:3000/api/oauth/meta/callback`).
5. Set `META_GRAPH_VERSION` to the Graph API version shown in your dashboard (the default is `v23.0`).

## 2. Permissions Reelwise requests

| Permission | Used for |
|---|---|
| `pages_show_list`, `pages_read_engagement`, `business_management` | Listing your Pages and their linked Instagram accounts |
| `pages_manage_posts` | Publishing videos to Pages |
| `pages_read_user_content`, `pages_manage_engagement` | Reading and replying to Page comments |
| `read_insights` | Page insights |
| `instagram_basic`, `instagram_content_publish` | Publishing Instagram Reels |
| `instagram_manage_comments` | Reading and replying to Instagram comments |
| `instagram_manage_insights` | Instagram insights |

## 3. Development mode and App Review

- **Development mode:** the app only works for people with a role on it (admins, developers, testers). That's enough to use Reelwise with your own accounts.
- **Other businesses:** to let other businesses connect, submit **App Review** for the permissions above, and complete **Business Verification**.

If a permission isn't granted, Reelwise shows which one is missing. Publishing fails with a clear message rather than pretending.

## 4. Platform limits to know

- **Instagram Reels:**
  - must be 3–90 seconds;
  - must be 9:16, H.264 + AAC (Reelwise exports this);
  - Instagram allows 50 API-published posts per 24 hours per account.
- **Facebook Page videos:** Meta processes them after upload. Reelwise waits until Meta reports the video as ready before marking it Published.
- **Rate limits:** the Graph API applies limits. Reelwise retries with backoff and shows the error.
