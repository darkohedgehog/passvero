# PENDING_OPERATOR_COMMAND — VPS TERMINAL: read-only failed deployment/closure diagnosis
sudo /usr/bin/python3 -I -B - <<'PASSVERO_FAILED_CLOSURE_DIAGNOSIS'
import datetime,hashlib,importlib.util,json,os,pathlib,re,stat,subprocess
P=pathlib.Path
root=P('/var/lib/passvero-marketing-pin-alignment-20261012')
helper=root/'deploy-resume-prepared.py'
def normalized(e):
 s=str(e)
 return s if re.fullmatch('[A-Z0-9_]{1,160}',s) else type(e).__name__
def probe(fn):
 try:return fn()
 except Exception as e:return {'status':'STOP','reason':normalized(e)}
assert os.geteuid()==0 and os.uname().nodename=='srv1834647','OPERATOR_HOST'
assert stat.S_ISREG(helper.lstat().st_mode) and not helper.is_symlink() and hashlib.sha256(helper.read_bytes()).hexdigest()=='497c298b074574120c863c4d1b904dd9dc311f8f22a999e1f58d5c8fada5fb76','HELPER_CHANGED'
spec=importlib.util.spec_from_file_location('diagnosis_definitions_only',helper)
h=importlib.util.module_from_spec(spec);spec.loader.exec_module(h)
out={'diagnostic':'READ_ONLY_FAILED_CLOSURE','observedUTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'mutations':'NONE','automaticRetry':False,'captureRestoreWorkerSmtpTelegramCalls':0}
for name in ('resume-first-failure.json','resume-closure-failure.json','resume-closure.json'):
 out[name]=probe(lambda name=name:json.loads(h.read(root/name))) if (root/name).exists() else None
out['artifacts']={name:{'exists':(root/name).exists(),'symlink':(root/name).is_symlink()} for name in ('previous-.next','previous-messages','failed-new-.next','failed-new-messages','prepared','attempt.json','resume-attempt.json')}
for label,path in {'canonicalSha256':h.CANONICAL,'configSha256':h.CODE/'config.json','backupStateSha256':h.BACKUP/'state.json'}.items():out[label]=probe(lambda path=path:h.sha(h.read(path)))
out['buildId']=probe(lambda:h.read(h.APP/'.next/BUILD_ID').decode().strip())
out['manifestOld']=probe(lambda:{'filesVerified':len(h.verify_manifest(h.read(h.CANONICAL),h.OLD_CANONICAL,h.OLD_BUILD)['files'])})
out['manifestNew']=probe(lambda:{'filesVerified':len(h.verify_manifest(h.read(h.CANONICAL),h.NEW_CANONICAL,h.NEW_BUILD)['files'])})
state=probe(lambda:json.loads(h.read(h.BACKUP/'state.json')))
out['backupState']={k:state.get(k) for k in ('mode','hold','attempts')} if isinstance(state,dict) else state
out['units']={name:probe(lambda name=name:h.unit(name)) for name in (*h.TIMERS,'passvero-staging-backup.service','passvero-staging-backup-monitor.service','passvero-subscription-reminders.timer','passvero-subscription-reminders.service')}
prepare,cap=h.helpers(json.loads(h.read(root/'old-config.json')))
out['runtimeScope']=probe(lambda:prepare.runtime()[0])
js="""const a=require('/usr/lib/node_modules/pm2/modules/pm2-axon'),r=require('/usr/lib/node_modules/pm2/modules/pm2-axon-rpc'),s=a.socket('req'),c=new r.Client(s);setTimeout(()=>process.exit(2),5000);s.once('connect',()=>c.call('getMonitorData',{},(e,v)=>{if(e||!Array.isArray(v))process.exit(1);console.log(JSON.stringify(v.map(p=>({name:p.name,pid:p.pid,status:p.pm2_env.status,cwd:p.pm2_env.pm_cwd,pmId:p.pm2_env.pm_id,restartCount:p.pm2_env.restart_time,exitCode:p.pm2_env.exit_code,port:p.pm2_env.PORT,errorLog:p.pm2_env.pm_err_log_path,outLog:p.pm2_env.pm_out_log_path}))));s.close();process.exit(0)}));s.connect('/home/passvero-staging/.pm2/rpc.sock');"""
rows=probe(lambda:json.loads(prepare.run(['/usr/bin/node','-e',js],**prepare.account('passvero-staging'),env={'PATH':'/usr/bin:/bin'})))
out['pm2']=[]
port=None
if isinstance(rows,list):
 for row in rows:
  logs={}
  if row.get('name')=='passvero-acceptance' and row.get('cwd')==str(h.APP):
   value=str(row.get('port',''))
   if value.isdecimal() and 1024<=int(value)<=65535:port=int(value)
   for key in ('errorLog','outLog'):
    def classify(key=key):
     p=P(row[key]);assert not p.is_symlink() and p.resolve().is_relative_to(P('/home/passvero-staging/.pm2/logs')),'LOG_SCOPE'
     with p.open('rb') as f:
      f.seek(max(0,p.stat().st_size-65536));text=f.read(65536).decode('utf-8','replace')
     modules=re.findall(r"Cannot find module ['\"]([@A-Za-z0-9_./-]{1,160})['\"]",text)
     return {'historicalTailOnly':True,'rawLog':'NOT_EXPOSED','categories':[x for x in ('EACCES','ENOENT','EADDRINUSE','MODULE_NOT_FOUND','ERR_MODULE_NOT_FOUND','Cannot find module','Could not find a production build','Permission denied','TypeError','SyntaxError') if x in text],'missingModules':sorted(set(modules))[:8]}
    logs[key]=probe(classify)
  out['pm2'].append({k:v for k,v in row.items() if k not in ('errorLog','outLog','port')})
  out['pm2'][-1]['boundedLogClassification']=logs
else:out['pm2']=rows
def http(url):
 r=subprocess.run(['/usr/bin/curl','--silent','--max-time','5','--output','/dev/null','--write-out','%{http_code} %{ssl_verify_result} %{remote_ip}',url],capture_output=True,timeout=7)
 fields=r.stdout.decode().strip().split()
 return {'curlReturnCode':r.returncode,'httpCode':fields[0] if fields else None,'tlsVerify':fields[1] if len(fields)>1 else None,'remoteIp':fields[2] if len(fields)>2 else None,'bodyAndStderr':'NOT_EXPOSED'}
out['publicHttps']=probe(lambda:http('https://staging.passvero.eu/hr'))
out['localHttp']=probe(lambda:http('http://127.0.0.1:'+str(port)+'/hr')) if port else {'status':'NOT_PROBED_PORT_NOT_CONFIRMED'}
print(json.dumps(out,sort_keys=True,indent=2),flush=True)
PASSVERO_FAILED_CLOSURE_DIAGNOSIS
