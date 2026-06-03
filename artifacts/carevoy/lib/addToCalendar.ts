import { Alert, Platform } from "react-native";
import * as FileSystem from "expo-file-system";
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
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid calendar date: ${iso}`);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}T${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`;
}

export function buildGoogleCalendarUrl(evt: CalendarEvent): string {
  if (!evt.title || !evt.title.trim()) throw new Error("Calendar event title is required");
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: evt.title.trim(),
    dates: `${formatGCalDate(evt.startISO)}/${formatGCalDate(evt.endISO)}`,
  });
  if (evt.location) params.set("location", evt.location);
  if (evt.description) params.set("details", evt.description);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function buildOutlookUrl(evt: CalendarEvent): string {
  const params = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: evt.title.trim(),
    startdt: new Date(evt.startISO).toISOString(),
    enddt: new Date(evt.endISO).toISOString(),
  });
  if (evt.location) params.set("location", evt.location);
  if (evt.description) params.set("body", evt.description);
  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
}

function buildICS(evt: CalendarEvent): string {
  const esc = (s: string) => s.replace(/([,;\\])/g, "\\$1").replace(/\n/g, "\\n");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//CareVoy//Ride//EN",
    "BEGIN:VEVENT",
    `UID:${Date.now()}@carevoy.co`,
    `DTSTAMP:${formatGCalDate(new Date().toISOString())}`,
    `DTSTART:${formatGCalDate(evt.startISO)}`,
    `DTEND:${formatGCalDate(evt.endISO)}`,
    `SUMMARY:${esc(evt.title.trim())}`,
    evt.location ? `LOCATION:${esc(evt.location)}` : "",
    evt.description ? `DESCRIPTION:${esc(evt.description)}` : "",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean).join("\r\n");
}

export async function openAppleCalendar(evt: CalendarEvent): Promise<void> {
  const ics = buildICS(evt);
  const fileUri = `${FileSystem.cacheDirectory}carevoy-ride.ics`;
  await FileSystem.writeAsStringAsync(fileUri, ics, {
    encoding: FileSystem.EncodingType.UTF8,
  });
  await Linking.openURL(fileUri);
}

// Single entry point — presents a chooser, then routes to the selected calendar.
export async function openInCalendar(evt: CalendarEvent): Promise<void> {
  if (Platform.OS === "web") {
    await Linking.openURL(buildGoogleCalendarUrl(evt));
    return;
  }
  Alert.alert("Add to calendar", undefined, [
    { text: "Apple Calendar", onPress: () => { void openAppleCalendar(evt); } },
    { text: "Google Calendar", onPress: () => { void Linking.openURL(buildGoogleCalendarUrl(evt)); } },
    { text: "Outlook", onPress: () => { void Linking.openURL(buildOutlookUrl(evt)); } },
    { text: "Cancel", style: "cancel" },
  ]);
}
