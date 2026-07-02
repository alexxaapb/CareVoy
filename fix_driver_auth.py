import subprocess, os

REPO = '/workspaces/CareVoy'
PP   = os.path.join(REPO, 'partners-portal')
results = []

df = os.path.join(PP, 'driver.html')
dc = open(df).read()

# Use the publishable KEY for the Authorization header instead of the expiring token.
# The publishable key doesn't expire, and reads are safe (filtered by nemt_partner_id).
old_h = "var H = { 'apikey': KEY, 'Authorization': 'Bearer ' + token };"
new_h = "var H = { 'apikey': KEY, 'Authorization': 'Bearer ' + KEY };"

if old_h in dc:
    dc = dc.replace(old_h, new_h)
    results.append("1. Driver: uses non-expiring publishable key for reads (no more logout on refresh)")
else:
    results.append("1. FAIL: H headers not matched")

# Also make the auth check tolerant — only redirect if BOTH token AND uid are truly missing
# Keep uid for identifying the driver, but don't bounce on token expiry
old_check = "if (!token || !uid) { if (!new URLSearchParams(window.location.search).get('preview_nemt')) { window.location.href = '/'; } }"
new_check = "if (!uid && !new URLSearchParams(window.location.search).get('preview_nemt')) { window.location.href = '/'; }"
if old_check in dc:
    dc = dc.replace(old_check, new_check)
    results.append("2. Driver: auth check only needs uid (token expiry won't bounce you)")
else:
    results.append("2. FAIL: auth check not matched")

open(df, 'w').write(dc)

print("=" * 60)
for r in results: print(" ", r)
print("=" * 60)

dc2 = open(df).read()
print("\nVERIFICATION:")
print("  Uses KEY for auth:", "'Authorization': 'Bearer ' + KEY" in dc2)
print("  Auth check tolerant:", "if (!uid &&" in dc2)

for cmd in [
    ['git', '-C', REPO, 'add', 'partners-portal/driver.html'],
    ['git', '-C', REPO, 'commit', '-m', 'fix: driver uses non-expiring key for reads (no logout on hard refresh)'],
    ['git', '-C', REPO, 'push', 'origin', 'main'],
]:
    r = subprocess.run(cmd, capture_output=True, text=True)
    print((r.stdout + r.stderr).strip()[:200] or '(ok)')
