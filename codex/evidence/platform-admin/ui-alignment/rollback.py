"""Restore the prior application build and its deployment metadata; retain all application data."""
import pathlib,os,pwd,subprocess,json
P=pathlib.Path;A=P('/var/www/passvero-acceptance');R=P('/var/lib/passvero-platform-ui-c513679/application');O=P('/var/lib/passvero-onboarding-deploy-2cb9d6e/application/manifest.json');suffix='.before-platform-ui-c513679'
assert os.geteuid()==0 and os.uname().nodename=='srv1834647'
s=json.loads((R/'state.json').read_text());assert s['stop_attempted']
a=pwd.getpwnam('passvero-staging');kw=dict(user=a.pw_uid,group=a.pw_gid,extra_groups=os.getgrouplist(a.pw_name,a.pw_gid),cwd='/',env={'PATH':'/usr/bin:/bin','LANG':'C','PM2_HOME':a.pw_dir+'/.pm2'},capture_output=True,text=True,timeout=45)
def pm(args):
 p=subprocess.run(['/usr/bin/node','/usr/lib/node_modules/pm2/bin/pm2',*args],**kw);assert p.returncode==0,'PM2_COMMAND_FAILED'
pm(['stop','passvero-acceptance'])
for name in ['.next','messages']:
 backup=A/(name+suffix)
 if backup.exists():
  failed=R/('failed-'+name.lstrip('.'));assert not failed.exists(),'ROLLBACK_ALREADY_ATTEMPTED'
  if (A/name).exists():(A/name).rename(failed)
  backup.rename(A/name)
t=O.with_name('manifest.ui-restore.json');t.write_bytes((R/'previous-runtime-manifest.json').read_bytes());t.chmod(0o600);os.replace(t,O)
pm(['restart','passvero-acceptance'])
assert (A/'.next/BUILD_ID').read_text().strip()==s['old_build']
pm(['save'])
print('STAGING_PLATFORM_UI_ROLLBACK=PASS; DATA_AND_OPERATOR_RETAINED; CONFIGURATION_AND_SCANNERS_UNTOUCHED')
