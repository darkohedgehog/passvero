# PENDING_OPERATOR_COMMAND — VPS TERMINAL, staging READ ONLY; diagnose first failed command
sudo /usr/bin/python3 -I -B - <<'PASSVERO_PREFLIGHT_COMMAND_DIAGNOSIS'
import hashlib,json,os,pathlib,pwd,re,subprocess
P=pathlib.Path
step='HOST'
results=[]
def run(label,args,**kwargs):
 global step
 step=label
 r=subprocess.run(args,capture_output=True,text=True,timeout=20,**kwargs)
 if r.returncode:
  kind=next((k for k,p in [('MODULE_NOT_FOUND','MODULE_NOT_FOUND'),('NOT_FOUND','not found'),('ACCESS_DENIED','Permission denied'),('TLS_VERIFY','certificate'),('CONNECTION_REFUSED','ECONNREFUSED')] if p.lower() in r.stderr.lower()),'OTHER')
  print(json.dumps({'result':'STOP_DIAGNOSED','check':label,'exitCode':r.returncode,'stderrClass':kind,'stderrBytes':len(r.stderr.encode()),'stdoutBytes':len(r.stdout.encode()),'automaticRetry':False,'mutations':'NONE'}),flush=True)
  raise SystemExit(1)
 results.append({'check':label,'exitCode':0})
 return r.stdout.strip()
try:
 assert os.geteuid()==0 and os.uname().nodename=='srv1834647','WRONG_HOST_OR_USER'
 names=['passvero-staging-backup.timer','passvero-staging-backup-monitor.timer','passvero-subscription-reminders.timer','passvero-staging-backup.service','passvero-staging-backup-monitor.service','passvero-subscription-reminders.service']
 units={}
 for n in names:
  output=run('SYSTEMCTL_SHOW:'+n,['/usr/bin/systemctl','show',n,'--property=Id,LoadState,ActiveState,SubState,UnitFileState'])
  units[n]=dict(line.split('=',1) for line in output.splitlines() if '=' in line)
 run('RECOVERY_UNIT_LIST',['/usr/bin/systemctl','list-units','--all','--plain','--no-legend','passvero-stage*capture*.service','passvero-stage*restore*.service','passvero-stage*recovery*.service','passvero-stage*resume*.service','passvero-marketing*deploy*.service'])
 for n in names[:3]:
  if units[n].get('ActiveState')!='active': continue
  obj=run('TIMER_OBJECT:'+n,['/usr/bin/busctl','call','org.freedesktop.systemd1','/org/freedesktop/systemd1','org.freedesktop.systemd1.Manager','GetUnit','s',n])
  assert re.fullmatch(r'o "/org/freedesktop/systemd1/unit/[A-Za-z0-9_]+"',obj),'TIMER_OBJECT_FORMAT'
  for prop in ['NextElapseUSecRealtime','NextElapseUSecMonotonic']:
   value=run('TIMER_PROPERTY:'+n+':'+prop,['/usr/bin/busctl','get-property','org.freedesktop.systemd1',obj[3:-1],'org.freedesktop.systemd1.Timer',prop])
   assert re.fullmatch(r't [0-9]{1,20}',value),'TIMER_TYPED_VALUE_FORMAT'
 tls=run('STAGING_HTTPS_TLS',['/usr/bin/curl','--silent','--show-error','--max-time','15','--output','/dev/null','--write-out','%{http_code} %{ssl_verify_result}','https://staging.passvero.eu/'])
 assert tls=='200 0','HTTPS_TLS_UNEXPECTED'
 a=pwd.getpwnam('passvero-staging')
 probe="const a=require('/usr/lib/node_modules/pm2/modules/pm2-axon'),r=require('/usr/lib/node_modules/pm2/modules/pm2-axon-rpc'),s=a.socket('req'),c=new r.Client(s);setTimeout(()=>process.exit(2),5000);s.once('connect',()=>c.call('getMonitorData',{},(e,v)=>{if(e)process.exit(1);console.log(JSON.stringify(v.map(p=>({name:p.name,pid:p.pid,status:p.pm2_env.status,cwd:p.pm2_env.pm_cwd}))));s.close();process.exit(0)}));s.connect('/home/passvero-staging/.pm2/rpc.sock');"
 rows=json.loads(run('PM2_READ_ONLY_RPC',['/usr/bin/node','-e',probe],user=a.pw_uid,group=a.pw_gid,extra_groups=os.getgrouplist(a.pw_name,a.pw_gid),cwd='/',env={'PATH':'/usr/bin:/bin'}))
 assert len(rows)==1 and rows[0]['name']=='passvero-acceptance' and rows[0]['status']=='online' and rows[0]['cwd']=='/var/www/passvero-acceptance','RUNTIME_IDENTITY'
 proc=P('/proc')/str(rows[0]['pid'])
 assert proc.stat().st_uid==a.pw_uid and (proc/'cwd').resolve()==P('/var/www/passvero-acceptance'),'RUNTIME_PID_SCOPE'
 raw=(proc/'environ').read_bytes()
 env=dict(v.split(b'=',1) for v in raw.split(bytes([0])) if b'=' in v)
 env_probe="const {loadEnvConfig}=require('/var/www/passvero-acceptance/node_modules/@next/env');const {createHash}=require('node:crypto');loadEnvConfig('/var/www/passvero-acceptance',false,{info(){},error(){throw Error('BUILD_ENV_READ_FAILED')}});const k=process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;console.log(JSON.stringify({canonicalOrigin:process.env.BETTER_AUTH_URL,runtimeEnvironment:process.env.PASSVERO_RUNTIME_ENV,publicTurnstile:{present:!!k,sha256:k?createHash('sha256').update(k).digest('hex'):null}}));"
 effective=json.loads(run('EFFECTIVE_BUILD_SETTINGS',[str(proc/'exe'),'-e',env_probe],cwd='/var/www/passvero-acceptance',env={**{k.decode():v.decode() for k,v in env.items()},'NODE_ENV':'production'}))
 run('RUNTIME_NODE_VERSION',[str(proc/'exe'),'--version'])
 assert (proc/'environ').read_bytes()==raw,'RUNTIME_CHANGED_DURING_READ'
 print(json.dumps({'result':'COMMAND_DIAGNOSIS_ALL_READS_SUCCEEDED','checks':results,'units':units,'effectiveBuildSummary':effective,'notAReleasePreflightPass':True,'automaticRetry':False,'mutations':'NONE'}),flush=True)
except SystemExit:
 raise
except BaseException as e:
 reason=str(e) if re.fullmatch('[A-Z0-9_]{1,100}',str(e)) else type(e).__name__
 print(json.dumps({'result':'STOP_DIAGNOSED','check':step,'reason':reason,'automaticRetry':False,'mutations':'NONE'}),flush=True)
 raise SystemExit(1)
PASSVERO_PREFLIGHT_COMMAND_DIAGNOSIS
