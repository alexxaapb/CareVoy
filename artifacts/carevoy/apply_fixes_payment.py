#!/usr/bin/env python3
# Run from artifacts/carevoy/ -> python3 apply_fixes_payment.py
# Replit payment edit #3 only. Safe: exact match or skip.

path = "app/(tabs)/payment.tsx"

before = '''    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) return;
    setPatientId(userId);
    const { data } = await supabase
      .from("patients")
      .select("email, stripe_customer_id")
      .eq("id", userId)
      .maybeSingle();
    // Intentionally do NOT load any saved email from the DB into the demo
    // build — keep "janedoe@gmail.com" visible for investor screenshots.
    setHasCustomer(!!data?.stripe_customer_id?.startsWith("cus_"));'''

after = '''    const {
      data: { session },
    } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    if (!userId) return;
    setPatientId(userId);
    const { data } = await supabase
      .from("patients")
      .select("email, stripe_customer_id")
      .eq("id", userId)
      .maybeSingle();
    setEmail(data?.email ?? session?.user?.email ?? "");
    setHasCustomer(!!data?.stripe_customer_id?.startsWith("cus_"));'''

with open(path, "r", encoding="utf-8") as f:
    content = f.read()

n = content.count(before)
if n == 1:
    content = content.replace(before, after)
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print("OK    payment: getSession + load real email")
elif n == 0:
    print("MISS  payment edit #3 (no exact match)")
else:
    print(f"AMBIG payment edit #3 (found {n} times)")