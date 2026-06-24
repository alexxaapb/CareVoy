import os, subprocess

REPO = '/workspaces/CareVoy'
f = os.path.join(REPO, 'partners-portal', 'nemt-signup.html')
c = open(f).read()

if 'function showBrokerFollowup' not in c:
    c = c.replace(
        '    function showOther(sel,divId){',
        '''    function showBrokerFollowup(sel) {
      document.getElementById('brokerFollowup').style.display =
        (sel.value === 'yes' || sel.value === 'sometimes') ? 'block' : 'none';
    }
    function showOther(sel,divId){'''
    )
    open(f, 'w').write(c)
    print("showBrokerFollowup function added")
    cmds = [
        'rm -f fix_broker_fn.py',
        'git add partners-portal/nemt-signup.html',
        'git commit -m "fix: add missing showBrokerFollowup JS function"',
        'git push origin main',
    ]
    for cmd in cmds:
        r = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd=REPO)
        print((r.stdout or r.stderr).strip()[:150])
else:
    print("Already exists")
