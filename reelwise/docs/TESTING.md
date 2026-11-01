# Testing

## Unit tests

```bash
npm test
```

These cover:
- token encryption and tamper detection;
- upload type detection by file signature;
- subtitle timing;
- Auto Pilot scheduling;
- Meta error explanations;
- the Telugu → Bunty voice rule;
- the approval schema.

## End-to-end workflow

Start the server (`npm run build && npm start`) and a worker (`npm run worker`), then:

```bash
set -a; . ./.env; set +a; node --import tsx tests/e2e.mjs
```

It runs the real workflow against the running app:

1. **Sign-up and sign-in:** password rules, bcrypt hashing, a wrong password rejected.
2. **Security:** CSRF blocking, login rate limiting, security headers.
3. **Brands and uploads:** brand creation and validation; a logo upload and a rejected disguised file.
4. **AI without a key:** shows an actionable message.
5. **Rendering:** a hand-written storyboard renders a real MP4 (H.264 + AAC, 9:16) with a thumbnail, and streams with range requests.
6. **Isolation:** another workspace gets 404 for the video and its file.
7. **Approval rules:** you can't approve before the video is ready, and approval needs explicit confirmation.
8. **Approval effects:** approval triggers the 1080p render; publishing with an invalid token ends as **Failed**, never Published.

## Manual checks with real accounts

1. Connect a test Instagram professional account, a Facebook Page and a YouTube channel.
2. Create a video and approve it to one account with "Publish now".
3. Confirm the queue shows Publishing → Published only after the post appears on the platform.
4. Schedule a second post, drag it to another day in the Calendar, and confirm it publishes at the new time.
5. Comment on the post from another account, sync the Smart Inbox, suggest a reply, edit it, tick the confirmation and send it.
6. Sync analytics a day later and compare the numbers with the platform's own dashboard.
