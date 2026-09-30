"""One reviewed operator-bundle correction; original deployment package is immutable."""
import hashlib, json, os, pathlib, runpy, stat, sys
P=pathlib.Path
package=P('/var/lib/passvero-subscription-package')
pin='deb54c562d283c8f816bcc225808d46869b4c102646d38994a8b12cbcd48cac9'
fixed_pin='caae305e547d2ff67f6f6ca88bf6a29cdb809fc792e3eb20b0ead8b84626ddf7'
try:
    assert os.geteuid()==0 and os.uname().nodename=='srv1834647'
    for p in [package,*package.parents]:
        s=p.lstat();assert stat.S_ISDIR(s.st_mode) and s.st_uid==0 and not s.st_mode&0o022
    def read(p):
        s=p.lstat();assert stat.S_ISREG(s.st_mode) and s.st_uid==0 and not s.st_mode&0o022
        return p.read_bytes()
    raw=read(package/'manifest.json');assert hashlib.sha256(raw).hexdigest()==pin
    manifest=json.loads(raw)
    for name,h in manifest['package_files'].items():
        assert '/' not in name and name not in ('.','..')
        assert hashlib.sha256(read(package/name)).hexdigest()==h
    sys.argv=[str(package/'setup.py'),pin]
    op=runpy.run_path(str(package/'setup.py'),run_name='verified_operator_library')
    m=op['verify']();op['scope']()
    state=P('/var/lib/passvero-subscription-commercial')
    assert json.loads(read(state/'application/report.json'))['manifest']==pin
    assert (P('/var/www/passvero-acceptance/.next/BUILD_ID')).read_text().strip()==m['build_id']
    facts=json.loads(op['sql']('''BEGIN READ ONLY;
    SELECT json_build_object(
      'fixtures',(SELECT count(*) FROM "Organization" WHERE slug='synthetic-subscription-commercial-20260930' OR "displayName"='SYNTHETIC — Subscription commercial acceptance'),
      'billingGrants',(SELECT count(*) FROM "PlatformBillingGrant" WHERE "userId"='40e51001-912c-4bcf-aa45-d866632aac85'::uuid AND "revokedAt" IS NULL));
    ROLLBACK;'''))
    assert facts=={'fixtures':0,'billingGrants':1},'SETUP_STATE_REQUIRES_REVIEW'
    print(json.dumps({'precheck':facts,'writesSoFar':'NONE'}),flush=True)
    original=read(package/'setup.cjs')
    needle=b'SELECT pg_advisory_xact_lock(9302026,147)'
    assert original.count(needle)==1
    fixed=original.replace(needle,needle+b'::text AS lock')
    assert hashlib.sha256(fixed).hexdigest()==fixed_pin
    directory=state/'setup-runtime';s=directory.lstat()
    assert stat.S_ISDIR(s.st_mode) and s.st_uid==0 and not s.st_mode&0o022
    target=directory/'setup-fixture-lockfix.cjs'
    assert not target.exists() and not target.is_symlink(),'DO_NOT_RETRY'
    os.umask(0o077)
    with target.open('xb') as f:f.write(fixed)
    target.chmod(0o644)
    kw=op['identity']('postgres')
    kw['extra_groups']=[op['pwd'].getpwnam('passvero-staging').pw_gid]
    kw['env']['NODE_PATH']='/var/www/passvero-acceptance/node_modules'
    accounts=m['approved_accounts']
    print(op['run'](['/usr/bin/node',str(target),'fixture',accounts['prodaja@zivic-elektro.com'],accounts['zivic.darko79@gmail.com']],timeout=45,**kw))
except Exception as e:
    print(json.dumps({'result':'STOP','reason':str(e) if isinstance(e,AssertionError) else type(e).__name__,'retry':'MANUAL_REVIEW_REQUIRED'}))
    sys.exit(1)
