import os, subprocess, json

REPO = '/workspaces/CareVoy'
APP = os.path.join(REPO, 'artifacts', 'carevoy')
pkg_path = os.path.join(APP, 'package.json')
app_json_path = os.path.join(APP, 'app.json')

print("STEP 1: Replace broken sed line with clean perl (no parens, no escaping)")
pkg = json.load(open(pkg_path))
hook = pkg['scripts']['eas-build-pre-install']

# Find the find...-exec... portion (whatever it currently is) and rebuild it cleanly.
# Strip any existing stripe-fix tail, then append the correct one.
base = hook.split(" && echo '[stripe-fix]")[0]   # everything before our fix
clean_fix = (
    " && echo '[stripe-fix] patching enum' "
    "&& find ../.. -path '*stripe-react-native/ios/StripeSwiftInterop.h' -type f "
    "-exec perl -pi -e 's/NSUInteger, STPPaymentStatus/NSInteger, STPPaymentStatus/g' {} + "
    "&& echo '[stripe-fix] done'"
)
pkg['scripts']['eas-build-pre-install'] = base + clean_fix
json.dump(pkg, open(pkg_path, 'w'), indent=2)
open(pkg_path, 'a').write('\n')
print("  New hook:")
print("  " + pkg['scripts']['eas-build-pre-install'])
print()

print("STEP 2: Ensure buildNumber = 69")
app = json.load(open(app_json_path))
old_bn = app['expo']['ios'].get('buildNumber')
app['expo']['ios']['buildNumber'] = "69"
json.dump(app, open(app_json_path, 'w'), indent=2)
open(app_json_path, 'a').write('\n')
print(f"  buildNumber: {old_bn} -> 69")
print()

print("STEP 3: Verify")
cp = json.load(open(pkg_path))['scripts']['eas-build-pre-install']
ca = json.load(open(app_json_path))['expo']['ios']['buildNumber']
print("  perl present:", 'perl -pi' in cp)
print("  sed gone:", 'sed -i' not in cp)
print("  no double-backslash:", '\\\\' not in cp)
print("  buildNumber:", ca)
print()

print("STEP 4: Local dry-run of the exact perl on a sample file")
os.makedirs('/tmp/cvverify', exist_ok=True)
open('/tmp/cvverify/StripeSwiftInterop.h','w').write('typedef NS_ENUM(NSUInteger, STPPaymentStatus);\n')
subprocess.run("perl -pi -e 's/NSUInteger, STPPaymentStatus/NSInteger, STPPaymentStatus/g' /tmp/cvverify/StripeSwiftInterop.h", shell=True)
print("  Result:", open('/tmp/cvverify/StripeSwiftInterop.h').read().strip())
print("  Correct:", 'NS_ENUM(NSInteger, STPPaymentStatus)' in open('/tmp/cvverify/StripeSwiftInterop.h').read())
print()

print("STEP 5: commit + push")
for cmd in [
    ['git','-C',REPO,'add','artifacts/carevoy/package.json','artifacts/carevoy/app.json'],
    ['git','-C',REPO,'commit','-m','fix: perl-based stripe enum patch (no escaping), build 69'],
    ['git','-C',REPO,'push','origin','main'],
]:
    r = subprocess.run(cmd, capture_output=True, text=True)
    out=(r.stdout+r.stderr).strip()
    print("  " + (out[:250] if out else "(ok)"))
