import os, subprocess

REPO = '/workspaces/CareVoy'
idx = os.path.join(REPO, 'artifacts', 'carevoy', 'app', '(tabs)', 'index.tsx')
ic = open(idx).read()

old_map = '''const RIDE_STATUS_LABELS: Record<string, string> = {
  pending: "Finding your driver",
  invited: "Booking confirmed",
  confirmed: "Booking confirmed",
  assigned: "Driver assigned",
  en_route: "Driver on the way",
  arrived: "Driver arrived",
  completed: "Ride completed",
  cancelled: "Cancelled",
};'''

new_map = '''const RIDE_STATUS_LABELS: Record<string, string> = {
  pending: "Finding your driver",
  invited: "Confirmed",
  confirmed: "Confirmed",
  assigned: "Driver assigned",
  en_route: "Driver on the way",
  arrived: "Driver arrived",
  completed: "Ride completed",
  cancelled: "Cancelled",
};'''

if old_map in ic:
    ic = ic.replace(old_map, new_map)
    open(idx, 'w').write(ic)
    print("Status labels simplified: invited+confirmed both show 'Confirmed'")
    cmds = [
        'rm -f fix_status_labels.py',
        'git add "artifacts/carevoy/app/(tabs)/index.tsx"',
        'git commit -m "fix: simplify ride status labels - invited+confirmed both show Confirmed"',
        'git push origin main',
    ]
    for cmd in cmds:
        r = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd=REPO)
        print((r.stdout or r.stderr).strip()[:150])
else:
    print("Map not found - build65 may not have run yet. Run build65 first then this.")
