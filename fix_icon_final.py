import os, subprocess, re

REPO = '/workspaces/CareVoy'
PP = os.path.join(REPO, 'partners-portal')

# Exact same base64 image tag the login page uses
ICON = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDI0IDEwMjQiPjxyZWN0IHdpZHRoPSIxMDI0IiBoZWlnaHQ9IjEwMjQiIGZpbGw9IiMwNjBEMUYiLz48ZyB0cmFuc2Zvcm09InRyYW5zbGF0ZSgzMjAuMzQgNjkxLjk1KSBzY2FsZSgwLjUwOTEgLTAuNTA5MSkiPjxwYXRoIGQ9Ik0zODMgNzEyUTUxNSA3MTIgNjA1LjAgNjQxLjVRNjk1IDU3MSA3MjEgNDUwSDUxMFE0OTEgNDkwIDQ1Ny41IDUxMS4wUTQyNCA1MzIgMzgwIDUzMlEzMTIgNTMyIDI3MS41IDQ4My41UTIzMSA0MzUgMjMxIDM1NFEyMzEgMjcyIDI3MS41IDIyMy41UTMxMiAxNzUgMzgwIDE3NVE0MjQgMTc1IDQ1Ny41IDE5Ni4wUTQ5MSAyMTcgNTEwIDI1N0g3MjFRNjk1IDEzNiA2MDUuMCA2NS41UTUxNSAtNSAzODMgLTVRMjc5IC01IDE5OS4wIDQwLjVRMTE5IDg2IDc1LjUgMTY3LjVRMzIgMjQ5IDMyIDM1NFEzMiA0NTggNzUuNSA1MzkuNVExMTkgNjIxIDE5OS4wIDY2Ni41UTI3OSA3MTIgMzgzIDcxMloiIGZpbGw9IiNGRkZGRkYiLz48L2c+PHBhdGggZD0iTSA3NTguMjAgNTU1LjQxIEEgMjUwIDI1MCAwIDEgMSA3NTguMjAgNDY4LjU5IiBmaWxsPSJub25lIiBzdHJva2U9IiMwMEMyQTgiIHN0cm9rZS13aWR0aD0iMjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPjxjaXJjbGUgY3g9Ijc1OC4yMCIgY3k9IjU1NS40MSIgcj0iMTciIGZpbGw9IiNGNUE2MjMiLz48Y2lyY2xlIGN4PSI3NTguMjAiIGN5PSI0NjguNTkiIHI9IjE3IiBmaWxsPSIjRjVBNjIzIi8+PC9zdmc+'
ICON_TAG = f'<img src="{ICON}" width="40" height="40" style="border-radius:9px;flex-shrink:0">'

for fname in ['nemt-signup.html', 'facility-signup.html']:
    fpath = os.path.join(PP, fname)
    c = open(fpath).read()
    c = re.sub(r'<img src="[^"]*"[^>]*style="[^"]*logo-icon[^"]*"[^>]*>|<img src="[^"]*carevoy-icon[^"]*"[^>]*>|<img src="data:image[^"]*"[^>]*>', ICON_TAG, c)
    # Also remove the now-empty logo-icon div wrapper if needed
    open(fpath, 'w').write(c)
    print(f"Fixed icon in {fname}")

cmds = [
    'rm -f fix_icon_final.py',
    'git add partners-portal/nemt-signup.html partners-portal/facility-signup.html',
    'git commit -m "fix: use exact same base64 icon as login page"',
    'git push origin main',
]
for cmd in cmds:
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd=REPO)
    print((r.stdout or r.stderr).strip()[:200])
