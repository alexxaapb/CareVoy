import os, subprocess, json

REPO = '/workspaces/CareVoy'
APP = os.path.join(REPO, 'artifacts', 'carevoy')
results = []

# APPROACH: Use BOTH patch-package (for local/standard installs) AND an eas-build
# pre-install hook (bulletproof for EAS pnpm builds). The hook directly seds the file.

# 1. patches/ file for patch-package
patches_dir = os.path.join(APP, 'patches')
os.makedirs(patches_dir, exist_ok=True)
patch_content = """diff --git a/node_modules/@stripe/stripe-react-native/ios/StripeSwiftInterop.h b/node_modules/@stripe/stripe-react-native/ios/StripeSwiftInterop.h
index 0000000..1111111 100644
--- a/node_modules/@stripe/stripe-react-native/ios/StripeSwiftInterop.h
+++ b/node_modules/@stripe/stripe-react-native/ios/StripeSwiftInterop.h
@@ -11,7 +11,7 @@
 #endif
 
 #if __has_include(<stripe_react_native/stripe_react_native-Swift.h>)
-typedef NS_ENUM(NSUInteger, STPPaymentStatus);
+typedef NS_ENUM(NSInteger, STPPaymentStatus);
 #endif
"""
open(os.path.join(patches_dir, '@stripe+stripe-react-native+0.50.3.patch'), 'w').write(patch_content)
results.append("1. Created patch-package patch file")

# 2. package.json: patch-package dep + postinstall
pkg_path = os.path.join(APP, 'package.json')
pkg = json.load(open(pkg_path))
pkg.setdefault('devDependencies', {})
pkg['devDependencies'].setdefault('patch-package', '^8.0.0')
pkg.setdefault('scripts', {})
post = pkg['scripts'].get('postinstall', '')
if 'patch-package' not in post:
    pkg['scripts']['postinstall'] = (post + ' && patch-package').strip() if post else 'patch-package'
json.dump(pkg, open(pkg_path, 'w'), indent=2)
open(pkg_path, 'a').write('\n')
results.append("2. package.json: patch-package + postinstall added")

# 3. BULLETPROOF: eas-build hook that seds every copy of the file after install,
#    before pods. This catches the .pnpm nested path too.
hooks = """#!/usr/bin/env bash
# Fix stripe-react-native enum mismatch for Xcode 26+ (STPPaymentStatus)
# Replaces NSUInteger -> NSInteger in all copies of StripeSwiftInterop.h
set -e
echo "[eas-hook] Patching stripe-react-native StripeSwiftInterop.h ..."
find . -path '*/stripe-react-native/ios/StripeSwiftInterop.h' -type f 2>/dev/null | while read f; do
  sed -i.bak 's/NS_ENUM(NSUInteger, STPPaymentStatus)/NS_ENUM(NSInteger, STPPaymentStatus)/g' "$f" && echo "[eas-hook] patched: $f"
done
echo "[eas-hook] done."
"""
# eas looks for hooks defined in package.json scripts: eas-build-post-install
pkg = json.load(open(pkg_path))
pkg['scripts']['eas-build-post-install'] = "bash ./eas-fix-stripe.sh"
json.dump(pkg, open(pkg_path, 'w'), indent=2)
open(pkg_path, 'a').write('\n')
open(os.path.join(APP, 'eas-fix-stripe.sh'), 'w').write(hooks)
os.chmod(os.path.join(APP, 'eas-fix-stripe.sh'), 0o755)
results.append("3. Added eas-build-post-install hook (eas-fix-stripe.sh) - seds all copies")

for r in results:
    print(r)

# Install patch-package
print("\n=== Installing patch-package locally ===")
r = subprocess.run('cd ' + APP + ' && (npm install patch-package --save-dev --legacy-peer-deps 2>&1 || pnpm add -D patch-package 2>&1) | tail -4', shell=True, capture_output=True, text=True)
print((r.stdout or r.stderr).strip()[:400])

cmds = [
    'rm -f fix_stripe_build.py',
    'git -C ' + REPO + ' add -A artifacts/carevoy/patches artifacts/carevoy/package.json artifacts/carevoy/eas-fix-stripe.sh artifacts/carevoy/package-lock.json artifacts/carevoy/pnpm-lock.yaml',
    'git -C ' + REPO + ' commit -m "fix: patch stripe enum for Xcode 26 via eas hook + patch-package"',
    'git -C ' + REPO + ' push origin main',
]
for cmd in cmds:
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    out = (r.stdout or r.stderr).strip()
    print(out[:200] if out else "(ok)")
