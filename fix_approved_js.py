import os, subprocess

f = '/workspaces/CareVoy/api-server/api/notify/partner-approved.js'
c = open(f, 'rb').read()

# Show hex of the problem characters around "subject"
idx = c.find(b'subject')
print("Raw bytes around subject line:")
print(c[idx:idx+80])
print("")

# Replace ALL non-ASCII characters in the file with safe equivalents
c_str = c.decode('utf-8')
# Replace all curly/smart quotes and dashes
c_str = c_str.replace('\u2018', "'").replace('\u2019', "'")  # curly single quotes
c_str = c_str.replace('\u201c', '"').replace('\u201d', '"')  # curly double quotes
c_str = c_str.replace('\u2014', '-').replace('\u2013', '-')  # em-dash, en-dash
c_str = c_str.replace('\u2026', '...')  # ellipsis

open(f, 'w', encoding='utf-8').write(c_str)
print("All smart quotes and dashes replaced")

# Verify
v = open(f, encoding='utf-8').read()
lines = [l.strip()[:100] for l in v.split('\n') if 'subject' in l.lower() or ('you' in l.lower() and 'approved' in l.lower())]
print("Verify:", lines)

cmds = [
    'rm -f fix_approved_js.py',
    'git add api-server/api/notify/partner-approved.js',
    'git commit -m "fix: replace all smart quotes and em-dashes in partner-approved.js"',
    'git push origin main',
]
for cmd in cmds:
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd='/workspaces/CareVoy')
    print((r.stdout or r.stderr).strip()[:200])
