#!/usr/bin/env python3
# Run from artifacts/carevoy/  ->  python3 apply_fixes_1.py
# Safe: only replaces EXACT matches. Misses are reported, never forced.

EDITS = [
    {
        "file": "lib/careContext.tsx",
        "label": "careContext: getUser -> getSession (home/profile load)",
        "before": '''    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id ?? null;''',
        "after": '''    const {
      data: { session },
    } = await supabase.auth.getSession();
    const userId = session?.user?.id ?? null;''',
    },
    {
        "file": "app/(tabs)/notifications.tsx",
        "label": "notifications: getUser -> getSession (My Alerts hang)",
        "before": '''    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) return;''',
        "after": '''    const {
      data: { session },
    } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    if (!userId) return;''',
    },
    {
        "file": "app/book-ride.tsx",
        "label": "book-ride: getSession (home-address loader)",
        "before": '''      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) return;
      const targetId = activePatientId ?? userId;''',
        "after": '''      const {
        data: { session },
      } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (!userId) return;
      const targetId = activePatientId ?? userId;''',
    },
    {
        "file": "app/book-ride.tsx",
        "label": "book-ride: real pickup address (was hardcoded Columbus)",
        "before": '''      // Investor-screenshot-safe demo default: always seed the pickup with
      // a clean Columbus, OH address regardless of what's in the DB so the
      // ride summary never leaks a real personal address.
      setPickupAddress("850 N High St, Columbus, OH 43215");
      void pat?.home_address;''',
        "after": '''      // Pre-fill the pickup with the patient's real home address on file.
      setPickupAddress(pat?.home_address ?? "");''',
    },
    {
        "file": "app/book-ride.tsx",
        "label": "book-ride: getSession (submit handler)",
        "before": '''    setSubmitting(true);
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    const bookingPatientId = activePatientId ?? userId;''',
        "after": '''    setSubmitting(true);
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    const bookingPatientId = activePatientId ?? userId;''',
    },
    {
        "file": "app/(tabs)/payment.tsx",
        "label": "payment: email default no longer janedoe",
        "before": '''  const [autoEmail, setAutoEmail] = useState(true);
  // Investor-screenshot-safe default. The user can overwrite this in the
  // input and Save; we only seed it as a clean placeholder value so the
  // demo never shows a real personal email.
  const [email, setEmail] = useState("janedoe@gmail.com");''',
        "after": '''  const [autoEmail, setAutoEmail] = useState(true);
  const [email, setEmail] = useState("");''',
    },
    {
        "file": "app/(tabs)/payment.tsx",
        "label": "payment: demo-mode seed email",
        "before": '''    if (isDemoMode()) {
      setPatientId("demo-jane");
      setHasCustomer(true);''',
        "after": '''    if (isDemoMode()) {
      setPatientId("demo-jane");
      setEmail("janedoe@gmail.com");
      setHasCustomer(true);''',
    },
    {
        "file": "app/(tabs)/profile.tsx",
        "label": "profile: getSession in load()",
        "before": '''    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) {
      setProfile(null);
      return;
    }''',
        "after": '''    const {
      data: { session },
    } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    if (!userId) {
      setProfile(null);
      return;
    }''',
    },
    {
        "file": "app/(tabs)/profile.tsx",
        "label": "profile: sign-out timeout (stuck sign-out)",
        "before": '''  const doSignOut = async () => {
    setSigningOut(true);
    try {
      await supabase.auth.signOut();
    } catch {''',
        "after": '''  const doSignOut = async () => {
    setSigningOut(true);
    try {
      // Race signOut against a short timeout so a stalled token refresh
      // can't leave the button stuck on "Signing out...".
      await Promise.race([
        supabase.auth.signOut(),
        new Promise((resolve) => setTimeout(resolve, 2500)),
      ]);
    } catch {''',
    },
]

def main():
    by_file = {}
    for e in EDITS:
        by_file.setdefault(e["file"], []).append(e)

    for path, edits in by_file.items():
        try:
            with open(path, "r", encoding="utf-8") as f:
                content = f.read()
        except FileNotFoundError:
            print(f"FILE MISSING: {path}")
            continue
        original = content
        for e in edits:
            n = content.count(e["before"])
            if n == 1:
                content = content.replace(e["before"], e["after"])
                print(f"OK    {e['label']}")
            elif n == 0:
                print(f"MISS  {e['label']}  (no exact match - handle by hand)")
            else:
                print(f"AMBIG {e['label']}  (found {n} times - skipped)")
        if content != original:
            with open(path, "w", encoding="utf-8") as f:
                f.write(content)

if __name__ == "__main__":
    main()