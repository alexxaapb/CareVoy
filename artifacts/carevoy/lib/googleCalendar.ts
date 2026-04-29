// Google Calendar helper: fetch upcoming events that look like medical
// appointments. Events are filtered by keyword in summary/location/description
// and by any pre-loaded facility name we know about. We never write to the
// user's calendar.

const MEDICAL_KEYWORDS = [
  "appointment",
  "doctor",
  "dr.",
  "dr ",
  "surgery",
  "surgical",
  "pre-op",
  "post-op",
  "dialysis",
  "therapy",
  "physical therapy",
  "checkup",
  "check-up",
  "follow up",
  "follow-up",
  "hospital",
  "clinic",
  "infusion",
  "chemo",
  "oncology",
  "cardio",
  "mri",
  "ct scan",
  "x-ray",
  "ultrasound",
  "lab",
  "blood draw",
  "biopsy",
  "consult",
];

const FACILITY_NAMES = [
  "OhioHealth",
  "Riverside Methodist",
  "Grant Medical",
  "Wexner",
  "OSU Medical",
  "Mount Carmel",
  "Nationwide Children",
  "DaVita",
  "Fresenius",
  "US Renal",
  "Brookdale",
  "Sunrise",
  "Danbury",
  "Atria",
];

export type GCalEvent = {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  start: string; // ISO
  end: string; // ISO
  htmlLink?: string;
};

export type MedicalEventMatch = {
  event: GCalEvent;
  matchedKeyword: string;
};

function looksMedical(e: GCalEvent): string | null {
  const haystack =
    `${e.summary ?? ""}\n${e.location ?? ""}\n${e.description ?? ""}`.toLowerCase();
  for (const kw of MEDICAL_KEYWORDS) {
    if (haystack.includes(kw)) return kw;
  }
  for (const fac of FACILITY_NAMES) {
    if (haystack.includes(fac.toLowerCase())) return fac;
  }
  return null;
}

export async function fetchUpcomingMedicalEvents(
  accessToken: string,
  daysAhead = 14,
): Promise<MedicalEventMatch[]> {
  const now = new Date();
  const max = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);
  const params = new URLSearchParams({
    timeMin: now.toISOString(),
    timeMax: max.toISOString(),
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "50",
  });
  const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    if (res.status === 401)
      throw new Error("CALENDAR_TOKEN_EXPIRED");
    throw new Error(`Google Calendar API error ${res.status}`);
  }
  const json = (await res.json()) as {
    items?: Array<{
      id: string;
      summary?: string;
      description?: string;
      location?: string;
      start: { dateTime?: string; date?: string };
      end: { dateTime?: string; date?: string };
      htmlLink?: string;
    }>;
  };
  const matches: MedicalEventMatch[] = [];
  for (const it of json.items ?? []) {
    const ev: GCalEvent = {
      id: it.id,
      summary: it.summary ?? "(no title)",
      description: it.description,
      location: it.location,
      start: it.start.dateTime ?? `${it.start.date}T00:00:00`,
      end: it.end.dateTime ?? `${it.end.date}T23:59:00`,
      htmlLink: it.htmlLink,
    };
    const kw = looksMedical(ev);
    if (kw) matches.push({ event: ev, matchedKeyword: kw });
  }
  return matches;
}
