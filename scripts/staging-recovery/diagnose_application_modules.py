"""Read-only hashes for an application preflight STOP; no cluster or acceptance retry."""
import hashlib
import json
import os
import pathlib
import re
import stat
import subprocess

ROOT=pathlib.Path('/var/lib/passvero-staging-recovery')
APP=pathlib.Path('/var/www/passvero-acceptance')
SET='20261001T212354Z'
BUILD_PIN='b11c50998d87f134c3611c4e5337604990315b83b18d43eafe91403635351e85'
HELPER_PIN='c3b794a89ccfe7a7b95da3ae7580cfa3c7606ec94d693be4930a5824f5f73aee'
# Exact reviewed bundle input identities; diagnostics do not depend on installed metadata.
MODULES={'src/application/documents/bytes.ts': 'b09a9d1ec2d10e9a330352bc15a99271dd3de894d9fdb1145cba639304ec9710', 'src/application/documents/contracts.ts': 'fdb5f4448424c2175089955da78a304ecc1b4240b164e675880ad790539f26d3', 'src/application/documents/pdf.ts': '07697db8850f782bce3efe447f5430c2491ca06588097f482c7501f80b009fd8', 'src/application/errors/application-error.ts': '89bfd62a6ab94681e85cb8b3d57f4b09b002a638430de77ec074497ed493ebc1', 'src/application/permissions/product-permissions.ts': 'e716f110722779dadb9ba5f96713a0cec30c2b3a243e39d19ca5b1790f240c19', 'src/application/products/export-catalog/contracts.ts': '71b4ab48f017ec1135c1053680736e1d66e0b5ed5eee78ff9f05242a1b760d05', 'src/application/products/export-catalog/csv.ts': '3419d540dc4eb8e2fa0104c619850a3295d87e43fd4345caa5678c818300f0c6', 'src/application/products/export-catalog/export-catalog.ts': 'da30f95fa7e5630819a633335099b9708b62daa552b3a10b23ed3202b0c2b708', 'src/application/products/images/contracts.ts': '117ceff40a0e49923cb22b44f6d3e3aa3cd7422b693c893dc0ebc580eebed4c1', 'src/application/products/images/service.ts': '7fb5fe12143737db88183b842e34d2caa9072d9c6300ee513e34cc831249c48c', 'src/application/products/product-search.ts': '77548eaa3b650333675cbca5419b4aa282947bd648222c660333ffbffda7ef7d'}

def require(value,reason):
    if not value:raise RuntimeError(reason)

def inventory(path,expected=None,private=False):
    row={'path':str(path),'expectedSha256':expected}
    try:
        info=path.lstat()
        row.update(exists=True,uid=info.st_uid,mode=oct(stat.S_IMODE(info.st_mode)))
        if not stat.S_ISREG(info.st_mode):
            row['state']='SYMLINK' if stat.S_ISLNK(info.st_mode) else 'NOT_REGULAR'
            return row,None
        if info.st_size>131072:row['state']='OVERSIZE';return row,None
        if private and (info.st_uid!=0 or info.st_mode&0o077):
            row['state']='UNSAFE_PRIVATE_POSTURE';return row,None
        body=path.read_bytes()
        row.update(state='READABLE',bytes=len(body),actualSha256=digest(body))
        if expected is not None:row['matchesExpected']=digest(body)==expected
        return row,body
    except FileNotFoundError:row.update(exists=False,state='MISSING')
    except PermissionError:row['state']='UNREADABLE'
    except OSError as error:row.update(state='READ_ERROR',errno=error.errno)
    return row,None

def digest(value):return hashlib.sha256(value).hexdigest()

def inspect_modules(build,app,git_blob):
    modules=build['applicationModules']
    require(len(modules)==11,'MODULE_MANIFEST_COUNT')
    result=[]
    for name,expected in modules.items():
        require(re.fullmatch(r'src/application/[A-Za-z0-9_./-]+\.ts',name)
                and '..' not in pathlib.PurePosixPath(name).parts and re.fullmatch('[0-9a-f]{64}',expected),'MODULE_MANIFEST_PATH')
        path=app/name
        require(path.resolve().is_relative_to(app.resolve()),'APPLICATION_SOURCE_SCOPE')
        row,body=inventory(path,expected)
        row['path']=name
        row['matchesReviewedBundle']=body is not None and digest(body)==expected
        head=git_blob(name)
        row['gitHeadSourceSha256']=digest(head) if head is not None else None
        row['matchesGitHeadSource']=head==body if head is not None and body is not None else None
        if body is not None and not row['matchesReviewedBundle']:
            try:
                text=body.decode('utf-8-sig')
                row['lfWithoutBomSha256']=digest(text.replace('\r\n','\n').encode())
                row['lfWithoutBomMatchesReviewed']=row['lfWithoutBomSha256']==expected
            except UnicodeDecodeError:row['encoding']='NOT_UTF8'
        result.append(row)
    return result

def main():
    require(os.geteuid()==0 and os.uname().nodename=='srv1834647','OPERATOR_HOST')
    control=ROOT/'control'/SET
    required=[('build',ROOT/'operator/application-read-build.json',BUILD_PIN),
        ('helper',ROOT/'operator'/('verify-application-'+HELPER_PIN+'.py'),HELPER_PIN),
        ('closure',control/'application-recovery-closure.json',None)]
    evidence={label:inventory(path,pin,True)[0] for label,path,pin in required}
    attempt=inventory(control/'application-recovery-attempt.json',private=True)[0]
    def git(*args):
        try:
            result=subprocess.run(['/usr/bin/git','-c','safe.directory='+str(APP),'-C',str(APP),*args],
                capture_output=True,timeout=5,env={'PATH':'/usr/bin:/bin','LANG':'C','GIT_OPTIONAL_LOCKS':'0'})
        except (OSError,subprocess.TimeoutExpired):return None
        require(len(result.stdout)<=131072,'GIT_OUTPUT_BOUND')
        return result.stdout if result.returncode==0 else None
    head=git('rev-parse','HEAD')
    head_text=head.decode().strip() if head is not None else None
    if head_text is not None and not re.fullmatch('[0-9a-f]{40}',head_text):head_text=None
    modules=inspect_modules({'applicationModules':MODULES},APP,lambda name:git('show','HEAD:'+name))
    print(json.dumps({'diagnostic':'READ_ONLY_APPLICATION_MODULE_INVENTORY_V2','setId':SET,'applicationGitHead':head_text,
        'modules':modules,'missingModules':sum(row['state']=='MISSING' for row in modules),
        'mismatchedModules':sum(not row['matchesReviewedBundle'] for row in modules),
        'requiredEvidence':evidence,'applicationAttempt':attempt,'clusterStarted':False,'acceptanceRepeated':False,
        'writes':'NONE','stagingPauseRequested':False,'b2Calls':0,'smtpCalls':0,'telegramCalls':0}))

if __name__=='__main__':
    try:main()
    except Exception as error:
        reason=str(error) if isinstance(error,RuntimeError) else type(error).__name__
        print(json.dumps({'diagnostic':'STOP','reason':reason,'writes':'NONE','clusterStarted':False,
            'stagingPauseRequested':False,'smtpCalls':0,'telegramCalls':0}))
        raise SystemExit(1)
