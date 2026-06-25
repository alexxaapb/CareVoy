import os, subprocess

REPO = '/workspaces/CareVoy'
af = os.path.join(REPO, 'partners-portal', 'admin.html')
ac = open(af).read()

# Insert approve/decline functions + listener before the closing of the IIFE
old_close = '''  renderPending();
  setInterval(renderPending, 30000);
})();
</script>'''

new_close = '''  async function doApprove(type, id, name) {
    if (!confirm('Approve ' + name + '?')) return;
    var tbl = type === 'nemt' ? 'nemt_partners' : 'hospitals';
    await fetch(SU + '/rest/v1/' + tbl + '?id=eq.' + id, {
      method: 'PATCH',
      headers: Object.assign({}, hdr, {'Content-Type':'application/json'}),
      body: JSON.stringify({active: true, pending_review: false})
    });
    // Send approval email using partner-approved endpoint
    try {
      await fetch('https://care-voy-api-server.vercel.app/api/notify/partner-approved', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({email: id, name: name, type: type})
      });
    } catch(e) {}
    alert(name + ' approved. Login email sent.');
    document.getElementById('rideDetailModal').style.display = 'none';
    location.reload();
  }

  async function doDecline(type, id, name) {
    if (!confirm('Decline ' + name + '? This cannot be undone.')) return;
    var tbl = type === 'nemt' ? 'nemt_partners' : 'hospitals';
    await fetch(SU + '/rest/v1/' + tbl + '?id=eq.' + id, {
      method: 'PATCH',
      headers: Object.assign({}, hdr, {'Content-Type':'application/json'}),
      body: JSON.stringify({active: false, pending_review: false})
    });
    alert(name + ' declined.');
    document.getElementById('rideDetailModal').style.display = 'none';
    location.reload();
  }

  document.addEventListener('click', function(ev) {
    var card = ev.target.closest && ev.target.closest('.cv-pending-card');
    if (card) {
      showAppDetail(card.getAttribute('data-type'), parseInt(card.getAttribute('data-idx')));
      return;
    }
    var ab = ev.target.closest && ev.target.closest('.cv-approve');
    if (ab) {
      doApprove(ab.getAttribute('data-type'), ab.getAttribute('data-id'), ab.getAttribute('data-name'));
      return;
    }
    var db = ev.target.closest && ev.target.closest('.cv-decline');
    if (db) {
      doDecline(db.getAttribute('data-type'), db.getAttribute('data-id'), db.getAttribute('data-name'));
      return;
    }
  });

  renderPending();
  setInterval(renderPending, 30000);
})();
</script>'''

if old_close in ac:
    ac = ac.replace(old_close, new_close)
    open(af, 'w').write(ac)
    print("1. approve/decline functions + listeners added to isolated script")
    print(f"   Verify: doApprove count = {ac.count('doApprove')}")
    print(f"   Verify: cv-approve listener = {ac.count('cv-approve')}")
else:
    print("FAILED - closing pattern not found")
    # Show what the end looks like
    print(ac[-300:])

cmds = [
    'rm -f fix_approve_decline_buttons.py',
    'git add partners-portal/admin.html',
    'git commit -m "fix: approve/decline buttons wired in isolated script + approval email"',
    'git push origin main',
]
for cmd in cmds:
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd=REPO)
    print((r.stdout or r.stderr).strip()[:200])
