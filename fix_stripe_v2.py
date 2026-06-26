import os, subprocess, json

REPO = '/workspaces/CareVoy'
APP = os.path.join(REPO, 'artifacts', 'carevoy')
pkg_path = os.path.join(APP, 'package.json')

print("STEP 1: Read package.json")
pkg = json.load(open(pkg_path))
current = pkg['scripts']['eas-build-pre-install']
print("  Current pre-install hook:")
print("  " + current)
print()

# The sed fix to append. After pnpm install, node_modules exists at monorepo root (../..).
# We cd back to repo root, find every StripeSwiftInterop.h, replace NSUInteger->NSInteger.
stripe_fix = (
    " && echo '[stripe-fix] patching enum...' "
    "&& find ../.. -path '*stripe-react-native/ios/StripeSwiftInterop.h' -type f "
    "-exec sed -i 's/NS_ENUM(NSUInteger, STPPaymentStatus)/NS_ENUM(NSInteger, STPPaymentStatus)/g' {} + "
    "&& echo '[stripe-fix] done'"
)

if 'stripe-fix' in current:
    print("STEP 2: Fix already present. Nothing to do.")
else:
    pkg['scripts']['eas-build-pre-install'] = current + stripe_fix
    json.dump(pkg, open(pkg_path, 'w'), indent=2)
    open(pkg_path, 'a').write('\n')
    print("STEP 2: Appended stripe-fix to eas-build-pre-install hook.")
    print()
    print("  New hook:")
    print("  " + pkg['scripts']['eas-build-pre-install'])
print()

print("STEP 3: Verify it wrote correctly")
check = json.load(open(pkg_path))
print("  stripe-fix in hook:", 'stripe-fix' in check['scripts']['eas-build-pre-install'])
print()

print("STEP 4: git add + commit + push")
for cmd in [
    ['git', '-C', REPO, 'add', 'artifacts/carevoy/package.json'],
    ['git', '-C', REPO, 'commit', '-m', 'fix: patch stripe enum in eas pre-install hook (xcode 26)'],
    ['git', '-C', REPO, 'push', 'origin', 'main'],
]:
    r = subprocess.run(cmd, capture_output=True, text=True)
    out = (r.stdout + r.stderr).strip()
    print("  $ " + ' '.join(cmd[3:] if cmd[1]=='-C' else cmd))
    print("  " + (out[:300] if out else "(ok)"))
    print()

import os as _os
_os.remove('/workspaces/CareVoy/fix_stripe_v2.py') if _os.path.exists('/workspaces/CareVoy/fix_stripe_v2.py') else None
