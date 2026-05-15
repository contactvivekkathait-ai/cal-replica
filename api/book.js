import { google } from "googleapis";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const { date, slot, name, email, phone, company, notes } = req.body ?? {};
  if (!date || !slot || !name || !email) {
    return res.status(400).json({ error: "Missing required fields." });
  }

  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_CLIENT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/calendar"],
  });

  const calendar = google.calendar({ version: "v3", auth });

  // Parse "9:00 AM" → hours/minutes
  const [tp, period] = slot.split(" ");
  let [h, m] = tp.split(":").map(Number);
  if (period === "PM" && h !== 12) h += 12;
  if (period === "AM" && h === 12) h = 0;

  const startISO = `${date}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
  const endH = Math.floor((h * 60 + m + 30) / 60);
  const endM = (m + 30) % 60;
  const endISO = `${date}T${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}:00`;

  const hostName = process.env.HOST_NAME || "Alex Johnson";
  const hostEmail = process.env.GOOGLE_CALENDAR_ID;

  const description = [
    `Guest: ${name}`,
    `Email: ${email}`,
    phone ? `Phone: ${phone}` : null,
    company ? `Company: ${company}` : null,
    notes ? `\nAgenda:\n${notes}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const event = await calendar.events.insert({
      calendarId: process.env.GOOGLE_CALENDAR_ID,
      requestBody: {
        summary: `30 Min Meeting – ${name}`,
        description,
        start: { dateTime: startISO, timeZone: "UTC" },
        end: { dateTime: endISO, timeZone: "UTC" },
        reminders: {
          useDefault: false,
          overrides: [
            { method: "email", minutes: 60 },
            { method: "popup", minutes: 10 },
          ],
        },
      },
    });

    const meetLink =
      event.data.conferenceData?.entryPoints?.find(
        (e) => e.entryPointType === "video"
      )?.uri ?? null;

    return res.status(200).json({ success: true, meetLink, eventId: event.data.id });
  } catch (err) {
    console.error("Create event error:", err.message);
    return res.status(500).json({ error: "Failed to create calendar event." });
  }
}
