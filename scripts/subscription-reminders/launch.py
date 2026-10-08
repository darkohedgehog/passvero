"""Root-owned staging launcher; credentials pass only in memory to the existing runtime UID."""
import json
import os
import pathlib
import pwd
import re
import subprocess
import sys

APP = pathlib.Path('/var/www/passvero-acceptance')
BUNDLE = pathlib.Path('/usr/local/libexec/passvero-subscription-reminders/worker.cjs')

def main():
    assert os.geteuid() == 0 and os.uname().nodename == 'srv1834647'
    args = sys.argv[1:]
    assert args == ['scheduled'] or (len(args) == 2 and args[0] in ('run', 'enqueue') and re.fullmatch(r'[0-9a-f-]{36}', args[1]))
    account = pwd.getpwnam('passvero-staging')
    identity = dict(user=account.pw_uid, group=account.pw_gid, extra_groups=os.getgrouplist(account.pw_name, account.pw_gid), cwd='/')
    # Query only named PM2 process metadata. Never emit the PM2 environment dump.
    probe = "const a=require('/usr/lib/node_modules/pm2/modules/pm2-axon'),r=require('/usr/lib/node_modules/pm2/modules/pm2-axon-rpc'),s=a.socket('req'),c=new r.Client(s);setTimeout(()=>process.exit(2),5000);s.once('connect',()=>c.call('getMonitorData',{},(e,v)=>{if(e)process.exit(1);console.log(JSON.stringify(v.map(p=>({name:p.name,pid:p.pid,status:p.pm2_env.status,cwd:p.pm2_env.pm_cwd}))));s.close();process.exit(0)}));s.connect('/home/passvero-staging/.pm2/rpc.sock');"
    result = subprocess.run(['/usr/bin/node', '-e', probe], **identity, env={'PATH': '/usr/bin:/bin'}, capture_output=True, text=True, timeout=10, check=True)
    rows = json.loads(result.stdout)
    assert len(rows) == 1 and rows[0]['name'] == 'passvero-acceptance' and rows[0]['status'] == 'online' and rows[0]['cwd'] == str(APP)
    pid = rows[0]['pid']
    assert isinstance(pid, int) and pid > 1
    proc = pathlib.Path('/proc') / str(pid)
    assert proc.stat().st_uid == account.pw_uid and (proc / 'cwd').resolve() == APP
    raw = dict(part.split(b'=', 1) for part in (proc / 'environ').read_bytes().split(b'\0') if b'=' in part)
    keys = ['PASSVERO_RUNTIME_ENV', 'BETTER_AUTH_URL', 'DATABASE_URL', 'AUTH_DATABASE_URL', 'SMTP_HOST', 'SMTP_PORT', 'SMTP_SECURE', 'SMTP_USER', 'SMTP_PASSWORD', 'AUTH_EMAIL_FROM', 'AUTH_EMAIL_REPLY_TO']
    environment = {key: raw[key.encode()].decode() for key in keys}
    assert environment['PASSVERO_RUNTIME_ENV'] == 'staging' and environment['BETTER_AUTH_URL'] == 'https://staging.passvero.eu'
    for file in [BUNDLE, pathlib.Path(__file__)]:
        info = file.lstat()
        assert file.is_file() and not file.is_symlink() and info.st_uid == 0 and not info.st_mode & 0o022
    environment.update(PATH='/usr/bin:/bin', NODE_PATH=str(APP / 'node_modules'), NODE_ENV='production')
    result = subprocess.run(['/usr/bin/node', str(BUNDLE), *args], **identity, env=environment, timeout=185, capture_output=True, text=True)
    # The TS entrypoint emits a small allowlisted result. Never relay stack traces/stderr.
    assert result.returncode == 0
    output = json.loads(result.stdout)
    assert output.get('worker') in ('IDLE', 'ENQUEUED', 'COMPLETED', 'SKIPPED', 'BLOCKED')
    print(json.dumps(output))

try:
    main()
except Exception:
    print(json.dumps({'worker': 'FAILED', 'reason': 'STAGING_LAUNCH_FAILED'}))
    sys.exit(1)
