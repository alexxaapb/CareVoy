import * as Linking from "expo-linking";

export type CalendarEvent = {
  title: string;
  startISO: string;
  endISO: string;
  location?: string;
  description?: string;
};

function formatGCalDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`Invalid calendar date: ${iso}`);
  }
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mi = String(d.getUTCMinutes()).padStart(2, "0");
  const ss = String(d.getUTCSeconds()).padStart(2, "0");
  return `${yyyy}${mm}${dd}T${hh}${mi}${ss}Z`;
}

export function buildGoogleCalendarUrl(evt: CalendarEvent): string {
  if (!evt.title || !evt.title.trim()) {
    throw new Error("Calendar event title is required");
  }
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: evt.title.trim(),
    dates: `${formatGCalDate(evt.startISO)}/${formatGCalDate(evt.endISO)}`,
  });
  if (evt.location) params.set("location", evt.location);
  if (evt.description) params.set("details", evt.description);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export async function openInCalendar(evt: CalendarEvent): Promise<void> {
  const url = buildGoogleCalendarUrl(evt);
  await Linking.openURL(url);
}
