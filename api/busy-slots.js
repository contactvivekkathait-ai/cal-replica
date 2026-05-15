import { google } from "googleapis";

export default async function handler(req, res) {
  // Allow CORS for local dev
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { date } = req.query;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: "Pass ?date=YYYY-MM-DD" });
  }

  // ── Auth ──────────────────────────────────────────────────────────────────
  // Expects these Vercel env vars:
  //   GOOGLE_CLIENT_EMAIL   – from your service-account JSON
  //   GOOGLE_PRIVATE_KEY    – from your service-account JSON (keep the \n chars)
  //   GOOGLE_CALENDAR_ID    – usually your Gmail address, e.g. you@gmail.com
  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_CLIENT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/calendar.readonly"],
  });

  const calendar = google.calendar({ version: "v3", auth });

  // ── Build time window: 9 AM – 6 PM in the user's requested date ───────────
  // We treat the date as UTC; the frontend already accounts for local TZ display.
  const timeMin = new Date(`${date}T09:00:00Z`).toISOString();
  const timeMax = new Date(`${date}T18:00:00Z`).toISOString();

  try {
    const freebusy = await calendar.freebusy.query({
      requestBody: {
        timeMin,
        timeMax,
        items: [{ id: process.env.GOOGLE_CALENDAR_ID }],
      },
    });

    const busyPeriods =
      freebusy.data.calendars?.[process.env.GOOGLE_CALENDAR_ID]?.busy ?? [];

    // ── Generate all 30-min slots 9:00–17:30 and mark which overlap busy ─────
    const slots = [];
    for (let i = 0; i < 18; i++) {
      const startMinutes = 9 * 60 + i * 30; // minutes from midnight UTC
      const endMinutes = startMinutes + 30;

      const slotStart = new Date(`${date}T${minsToTime(startMinutes)}:00Z`);
      const slotEnd = new Date(`${date}T${minsToTime(endMinutes)}:00Z`);

      const isBusy = busyPeriods.some((b) => {
        const bs = new Date(b.start);
        const be = new Date(b.end);
        return slotStart < be && slotEnd > bs; // overlaps
      });

      if (!isBusy) {
        slots.push(formatSlot(startMinutes));
      }
    }

    return res.status(200).json({ slots, date });
  } catch (err) {
    console.error("Google Calendar error:", err.message);
    return res.status(500).json({ error: "Failed to fetch calendar data." });
  }
}

function minsToTime(mins) {
  const h = String(Math.floor(mins / 60)).padStart(2, "0");
  const m = String(mins % 60).padStart(2, "0");
  return `${h}:${m}`;
}

function formatSlot(startMinutes) {
  // Returns "9:00 AM" style strings to match the frontend format
  let h = Math.floor(startMinutes / 60);
  const m = startMinutes % 60;
  const period = h < 12 ? "AM" : "PM";
  const displayH = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${displayH}:${String(m).padStart(2, "0")} ${period}`;
}
