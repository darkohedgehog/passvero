from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlparse
import re,json,hashlib,tarfile
R=Path('/tmp/passvero-dashboard-release-20261027');S=R/'build-source';O='https://staging.passvero.eu';sha=lambda b:hashlib.sha256(b).hexdigest()
class Tags(HTMLParser):
 def __init__(self):super().__init__();self.links=[];self.meta=[]
 def handle_starttag(self,t,a):
  if t=='link':self.links.append(dict(a))
  if t=='meta':self.meta.append(dict(a))
records=[];text_count=0;binary=[]
for p in sorted((S/'.next/server/app').rglob('*')):
 if not p.is_file() or p.suffix not in ('.html','.rsc','.body'):continue
 try:text=p.read_bytes().decode('utf8')
 except UnicodeDecodeError:binary.append(str(p.relative_to(S)));continue
 text_count+=1;assert not re.search(r'passvero-preview\.invalid|localhost|127\.0\.0\.1',text),str(p)
 if p.suffix=='.html':
  tags=Tags();tags.feed(text);canonical=[x['href'] for x in tags.links if x.get('rel')=='canonical'];alternates=[x['href'] for x in tags.links if 'hreflang' in x];og=[x['content'] for x in tags.meta if x.get('property')=='og:url']
  if canonical:
   assert len(canonical)==1 and alternates and len(og)==1
   for u in canonical+alternates+og:assert u==O or u.startswith(O+'/'),u
   records.append({'path':str(p.relative_to(S)),'sha256':sha(p.read_bytes()),'canonical':canonical[0],'alternateCount':len(alternates),'og':og[0]})
assert len(records)==36,len(records)
sitemap=(S/'.next/server/app/sitemap.xml.body').read_text();urls=re.findall(r'<loc>(.*?)</loc>',sitemap);assert len(urls)==36 and all(u==O or u.startswith(O+'/') for u in urls)
robots=(S/'.next/server/app/robots.txt.body').read_text();assert O+'/sitemap.xml' in robots
cfg=json.loads((S/'.next/required-server-files.json').read_text())['config'];actual={k:cfg.get(k) for k in ['basePath','assetPrefix','trailingSlash','output','distDir']};baseline=json.loads(Path('codex/evidence/dashboard-ui-final-20261027/operator-baseline-pass.json').read_text())['buildTimeBaseline'];assert actual==baseline['nextConfig'];assert sorted(cfg.get('env',{}))==baseline['explicitEnvKeys']
audit={'result':'PASS_STAGING_ORIGIN_METADATA','origin':O,'canonicalHreflangOgSets':records,'sitemapUrls':urls,'robots':'PASS','generatedTextResponsesScanned':text_count,'binaryBodiesExcluded':binary,'testsRepeated':False,'nextConfig':actual};(R/'staging-build-url-audit.json').write_text(json.dumps(audit,indent=2)+'\n')
files={};barcode=[];csv=[];traces=0
for p in sorted((S/'.next').rglob('*')):
 if not p.is_file():continue
 rel=p.relative_to(S);parts=rel.parts
 if parts[1] in ('cache','dev'):continue
 assert not p.is_symlink();body=p.read_bytes();files[str(rel)]={'bytes':len(body),'sha256':sha(body)}
 if p.suffix=='.js':
  text=body.decode();assert not re.search(r'(?:require|import)\([\"\'](?:bwip-js|csv-parse)(?:/[^\"\']*)?[\"\']\)',text),str(rel)
  if b'bwipjs' in body:barcode.append(str(rel))
  if b'CSV_QUOTE_NOT_CLOSED' in body:csv.append(str(rel))
 if str(p).endswith('.nft.json'):
  traces+=1;assert not any('bwip-js' in x or 'csv-parse' in x for x in json.loads(body)['files'])
for p in sorted((S/'messages').glob('*.json')):
 body=p.read_bytes();files[str(p.relative_to(S))]={'bytes':len(body),'sha256':sha(body)}
assert barcode and csv
local=json.loads(Path('codex/evidence/dashboard-ui-final-20261027/release-manifest.json').read_text());source_hashes={x['path']:x['afterSha256'] for x in local['reviewedSourceFiles']}
for name,h in source_hashes.items():assert sha((S/name).read_bytes())==h
artifact={'buildId':(S/'.next/BUILD_ID').read_text().strip(),'sourceCommit':'45a04f6a202b9867ade081657ca545f9f19232ea','sourceHashes':source_hashes,'canonicalOrigin':O,'metadataAuditSha256':sha((R/'staging-build-url-audit.json').read_bytes()),'bundledDependencies':{'barcodeMembers':barcode,'csvMembers':csv,'noExternalImports':True,'tracesChecked':traces},'publicAssets':[],'status':'REVIEWED_STAGING_BUILD_PENDING_EXACT_PACKAGE_PREFLIGHT','files':files}
(R/'artifact-manifest.json').write_text(json.dumps(artifact,sort_keys=True,indent=2)+'\n')
assert not (R/'application.tar.gz').exists()
with tarfile.open(R/'application.tar.gz','w:gz') as t:
 for name in sorted(files):t.add(S/name,arcname=name,recursive=False)
summary={'buildId':artifact['buildId'],'members':len(files),'archiveSha256':sha((R/'application.tar.gz').read_bytes()),'artifactManifestSha256':sha((R/'artifact-manifest.json').read_bytes()),'bytes':(R/'application.tar.gz').stat().st_size,'sourceCommit':artifact['sourceCommit'],'publicAssetMutation':'NONE_ALL_RETAINED','canonicalMetadata':'PASS_36_SETS','generatedTextResponsesScanned':text_count,'bundledDependencies':artifact['bundledDependencies']};(R/'release-summary.json').write_text(json.dumps(summary,indent=2)+'\n');print(json.dumps(summary,indent=2))
