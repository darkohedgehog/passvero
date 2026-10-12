"""New-schema adapter of the accepted exact catalog equivalence verifier.

Only the historical fixed six/six cardinality is removed. Reviewed constraint
pairs come from the separately hash-pinned historical verifier at runtime.
Unknown differences still fail; no broad SQL/text normalization is performed.
"""
import hashlib
import json

REVIEWED_CONSTRAINTS = {}


def require(value, reason):
    if not value:
        raise RuntimeError(reason)


def signature(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True).encode()).hexdigest()


def verify_catalog(source,current,restore):
    # No generic whitespace/parenthesis/cast normalization. Only six fully reviewed exact pairs.
    import copy
    left=copy.deepcopy(source);right=copy.deepcopy(current)
    left.pop('database');right.pop('database')
    exceptions={'constraints':[],'relations':[]}
    require(len(left['constraints'])==len(right['constraints']),'CONSTRAINT_INVENTORY')
    for a,b in zip(left['constraints'],right['constraints']):
        if a==b:continue
        key=(a['table'],a['name'])
        require(key==(b['table'],b['name']) and key in REVIEWED_CONSTRAINTS
                and {k:v for k,v in a.items() if k!='definition'}=={k:v for k,v in b.items() if k!='definition'}
                and (signature(a['definition']),signature(b['definition']))==REVIEWED_CONSTRAINTS[key],
                'UNREVIEWED_CONSTRAINT_DIFFERENCE')
        exceptions['constraints'].append({'table':key[0],'name':key[1],'sourceSha256':signature(a['definition']),
                                         'restoredSha256':signature(b['definition'])})
        b['definition']=a['definition']
    require(len(left['relations'])==len(right['relations']),'RELATION_INVENTORY')
    for a,b in zip(left['relations'],right['relations']):
        if a==b:continue
        owner='passvero_migrator'
        require({k:v for k,v in a.items() if k!='acl'}=={k:v for k,v in b.items() if k!='acl'}
                and a['owner']==owner and a['kind']=='r' and b['acl'] is None
                and a['acl']=='{passvero_migrator=arwdDxt/passvero_migrator}', 'UNREVIEWED_RELATION_ACL_DIFFERENCE')
        ident=restore.literal(a['name'])
        projection="json_build_object('grantor',pg_get_userbyid(grantor),'grantee',CASE WHEN grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(grantee) END,'privilege',privilege_type,'option',is_grantable)"
        aggregate="coalesce(json_agg("+projection+" ORDER BY grantor,grantee,privilege_type,is_grantable),'[]'::json)"
        acl=restore.sql("SELECT json_build_object('source',(SELECT "+aggregate+" FROM aclexplode("+
            restore.literal(a['acl'])+"::aclitem[])), 'restored',(SELECT "+aggregate+
            " FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) p WHERE n.nspname='public' AND c.relname="+ident+"))")
        require(acl['source']==acl['restored'] and len(acl['source'])==7,'RESTORED_EFFECTIVE_TABLE_ACL')
        exceptions['relations'].append({'name':a['name'],'owner':owner,'sourceAcl':a['acl'],
                                      'restoredAcl':None,'effectiveAcl':acl['restored']})
        b['acl']=a['acl']
    require(left==right,'RESTORED_CATALOG_UNREVIEWED_DIFFERENCE')
    # Counts vary with the new schema; every allowed difference above remains exact.
    return exceptions
