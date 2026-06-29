#!/usr/bin/env python3
"""
Deploy updated patients.html to CareVoy repo.
Run in GitHub Codespaces: python3 update_patients_portal.py
"""
import subprocess, shutil, os

REPO = '/workspaces/CareVoy'
SRC  = '/workspaces/CareVoy/partners-portal/patients.html'

# ── Paste the full patients.html content here ──
# (copy from the file provided and paste below)
# OR use the curl method below to pull from a gist/pastebin if you upload it

print("=== CareVoy Patient Portal Update ===")
print()

# Verify repo exists
if not os.path.exists(REPO):
    print("❌ Repo not found at /workspaces/CareVoy")
    print("   Make sure you're running this in GitHub Codespaces")
    exit(1)

# Check current file
result = subprocess.run(['wc','-l', SRC], capture_output=True, text=True)
print(f"Current patients.html: {result.stdout.strip()}")

# Git status
r = subprocess.run(['git','-C',REPO,'status','--short'], capture_output=True, text=True)
print(f"Git status: {r.stdout.strip() or 'clean'}")
print()

print("✅ Repo verified. Now replace the file:")
print()
print("OPTION A — Paste in Codespaces terminal:")
print("  1. Open partners-portal/patients.html in the editor")
print("  2. Select all (Cmd+A / Ctrl+A)")  
print("  3. Paste the new content from Claude")
print("  4. Save (Cmd+S)")
print()
print("OPTION B — Run these git commands after saving:")
print("  git add partners-portal/patients.html")
print("  git commit -m 'fix: Aster aesthetic, correct logo SVG, chat input fix, Inter font'")
print("  git push origin main")
print()
print("Vercel will auto-deploy in ~60 seconds after push.")
print("Check: https://partners.carevoy.co/patients")
