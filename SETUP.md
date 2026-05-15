# Cal Booking — Vercel + Google Calendar Setup Guide

Your booking page reads your real Google Calendar availability and creates events automatically when someone books. Here's how to set it up in ~15 minutes.

---

## Step 1 — Create a Google Cloud Service Account

1. Go to https://console.cloud.google.com and sign in with the Google account that owns your calendar.
2. Click **"Select a project"** → **"New Project"** → name it anything (e.g. `cal-booking`) → **Create**.
3. In the left menu go to **APIs & Services → Library**.
4. Search for **"Google Calendar API"** → click it → click **Enable**.
5. Go to **APIs & Services → Credentials**.
6. Click **"+ Create Credentials"** → **Service Account**.
7. Give it any name (e.g. `cal-booking-sa`) → click **Done** (no extra roles needed).
8. Click the service account you just created → go to the **Keys** tab.
9. Click **Add Key → Create new key → JSON** → Download the file.

The JSON file will look like this — you'll need two values from it:
```json
{
  "client_email": "cal-booking-sa@your-project.iam.gserviceaccount.com",
  "private_key": "-----BEGIN RSA PRIVATE KEY-----\n..."
}
```

---

## Step 2 — Share your Google Calendar with the Service Account

1. Open https://calendar.google.com
2. In the left sidebar, find your calendar → click the **⋮** menu → **Settings and sharing**.
3. Scroll to **"Share with specific people or groups"** → click **"+ Add people"**.
4. Paste the `client_email` from your JSON file.
5. Set permission to **"Make changes to events"** → click **Send**.

---

## Step 3 — Deploy to Vercel

### Option A: GitHub (recommended)

1. Push this project folder to a GitHub repo.
2. Go to https://vercel.com → **Add New Project** → import your repo.
3. Leave all settings as default → click **Deploy**.

### Option B: Vercel CLI

```bash
npm install -g vercel
cd cal-booking
vercel
```

---

## Step 4 — Add Environment Variables in Vercel

In your Vercel project dashboard → **Settings → Environment Variables**, add these three:

| Variable | Value |
|---|---|
| `GOOGLE_CLIENT_EMAIL` | The `client_email` from your JSON (e.g. `cal-booking-sa@...iam.gserviceaccount.com`) |
| `GOOGLE_PRIVATE_KEY` | The full `private_key` from your JSON, including `-----BEGIN...END-----` and all `\n` characters |
| `GOOGLE_CALENDAR_ID` | Your Gmail address (e.g. `you@gmail.com`) |
| `HOST_NAME` | Your name as it should appear in meeting titles (e.g. `Alex Johnson`) |

> **Tip for GOOGLE_PRIVATE_KEY**: Copy the entire value from the JSON including the `-----BEGIN RSA PRIVATE KEY-----` and `-----END RSA PRIVATE KEY-----` parts. Keep the literal `\n` characters — Vercel stores it as-is and the API converts them to real newlines.

After adding env vars, go to **Deployments → Redeploy** to apply them.

---

## How it works end-to-end

```
User picks a date
      ↓
Frontend calls GET /api/busy-slots?date=YYYY-MM-DD
      ↓
Vercel function queries Google Calendar freebusy API
      ↓
Returns only slots that are free on your calendar
      ↓
User picks a slot and fills in their details
      ↓
Frontend calls POST /api/book
      ↓
Vercel function creates a Google Calendar event with Google Meet
      ↓
Both you and the guest receive email invites automatically
```

---

## Customising the page

Open `public/index.html` and update:
- **Host name**: search for `Alex Johnson` and replace with your name
- **Meeting duration**: currently 30 min — the slot grid and API both use 30-min intervals
- **Working hours**: change `9:00:00Z` / `18:00:00Z` in `api/busy-slots.js` to adjust the window
- **Weekends**: the frontend currently blocks Sat/Sun — remove the `isWknd` check in `renderCal()` to enable them

---

## Troubleshooting

| Problem | Fix |
|---|---|
| "Failed to fetch calendar data" | Check that the service account email was shared on your calendar with "Make changes" permission |
| Empty slots on all days | The freebusy query may be failing auth — double-check `GOOGLE_CLIENT_EMAIL` and `GOOGLE_PRIVATE_KEY` in Vercel env vars |
| Private key error | Make sure the key includes the header/footer lines and you didn't accidentally trim it |
| Meet link not appearing | Service accounts need Calendar API with conferenceData enabled — ensure the API is enabled in your Cloud project |
