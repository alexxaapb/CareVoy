export type AddressSuggestion = {
  id: string;
  label: string;
  fullAddress: string;
};

type NominatimAddress = {
  house_number?: string;
  road?: string;
  city?: string;
  town?: string;
  village?: string;
  hamlet?: string;
  state?: string;
  postcode?: string;
};

type NominatimResult = {
  place_id?: number;
  osm_id?: number;
  display_name: string;
  address?: NominatimAddress;
};

let inflight: AbortController | null = null;

function shortLabel(d: NominatimResult): string {
  const a = d.address ?? {};
  const street = [a.house_number, a.road].filter(Boolean).join(" ");
  const city = a.city || a.town || a.village || a.hamlet || "";
  const region = a.state || "";
  return [street, city, region].filter(Boolean).join(", ") || d.display_name;
}

export async function searchAddresses(
  query: string,
): Promise<AddressSuggestion[]> {
  const q = query.trim();
  if (q.length < 4) return [];
  if (inflight) inflight.abort();
  inflight = new AbortController();
  try {
    const params = [
      "format=json",
      "addressdetails=1",
      "limit=5",
      "countrycodes=us",
      `q=${encodeURIComponent(q)}`,
    ].join("&");
    const url = `https://nominatim.openstreetmap.org/search?${params}`;
    // User-Agent is a forbidden header in browsers (silently dropped) but is
    // honored on React Native native runtimes. Nominatim's usage policy asks
    // apps to identify themselves; the browser's own UA satisfies the policy
    // when this runs on web.
    const headers: Record<string, string> = {
      "Accept-Language": "en",
      "User-Agent": "CareVoy/1.0 (https://carevoy.co)",
    };
    const res = await fetch(url, {
      signal: inflight.signal,
      headers,
    });
    if (!res.ok) return [];
    const data = (await res.json()) as NominatimResult[];
    if (!Array.isArray(data)) return [];
    return data.map((d) => ({
      id: String(d.place_id ?? d.osm_id ?? d.display_name),
      label: shortLabel(d),
      fullAddress: d.display_name,
    }));
  } catch (e) {
    if ((e as { name?: string })?.name === "AbortError") return [];
    return [];
  }
}
