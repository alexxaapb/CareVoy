import { Alert, Platform } from "react-native";
import * as Calendar from "expo-calendar";
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

// Apple: insert directly via expo-calendar. No share sheet / .ics — iOS can't
// reliably present a share sheet from inside an Alert button, which is why the
// previous approach silently closed.
export async function openAppleCalendar(evt: CalendarEvent): Promise<void> {
  try {
    const { status } = await Calendar.requestCalendarPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Calendar access needed",
        "Turn on calendar access for CareVoy in Settings to add your ride.",
      );
      return;
    }
    let calendarId: string | null = null;
    if (Platform.OS === "ios") {
      const def = await Calendar.getDefaultCalendarAsync();
      calendarId = def?.id ?? null;
    }
    if (!calendarId) {
      const cals = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
      const writable = cals.find((c) => c.allowsModifications);
      calendarId = writable?.id ?? cals[0]?.id ?? null;
    }
    if (!calendarId) {
      Alert.alert("No calendar found", "Couldn't find a calendar to add your ride to.");
      return;
    }
    await Calendar.createEventAsync(calendarId, {
      title: evt.title,
      startDate: new Date(evt.startISO),
      endDate: new Date(evt.endISO),
      location: evt.location,
      notes: evt.description,
    });
    Alert.alert("Added to calendar", "Your ride is on your calendar.");
  } catch (e) {
    Alert.alert(
      "Couldn't add to calendar",
      e instanceof Error ? e.message : "Please try again.",
    );
  }
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
