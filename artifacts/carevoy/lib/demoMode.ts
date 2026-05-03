/**
 * Investor / pitch-deck demo mode.
 *
 * When the URL contains `?demo=1` (web only), screens skip the auth gate
 * and render with hard-coded "Jane Doe" demo data so screenshots look
 * filled-out and polished. The flag is sticky for the browser session via
 * sessionStorage so subnavigation (e.g. Home → Book a Ride) preserves it.
 *
 * Native (iOS/Android) builds always return `false` — this is a web-only
 * affordance for pitch deck capture.
 */
export function isDemoMode(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const search = window.location.search ?? "";
    if (search.includes("demo=1")) {
      window.sessionStorage.setItem("__cv_demo", "1");
      return true;
    }
    return window.sessionStorage.getItem("__cv_demo") === "1";
  } catch {
    return false;
  }
}
