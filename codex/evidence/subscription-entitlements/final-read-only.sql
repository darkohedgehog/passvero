BEGIN READ ONLY;
SET LOCAL statement_timeout='15s';
SELECT json_build_object(
 'scope',json_build_object('database',current_database(),'port',current_setting('port'),'directory',current_setting('data_directory')),
 'fixtures',(SELECT json_agg(x ORDER BY x.slug) FROM (
   SELECT o.id,o.slug,
   (SELECT count(*) FROM "Product" p WHERE p."organizationId"=o.id) AS products,
   (SELECT json_agg(p.id ORDER BY p.id) FROM "Product" p WHERE p."organizationId"=o.id) AS productIds,
   (SELECT count(*) FROM "ProductVersion" v WHERE v."organizationId"=o.id AND v.status='DRAFT') AS drafts,
   (SELECT row_to_json(e) FROM "OrganizationEntitlementEnrollment" e WHERE e."organizationId"=o.id) AS enrollment,
   (SELECT json_agg(json_build_object('id',r.id,'kind',r."changeKind",'status',r.status) ORDER BY r.id) FROM "CommercialRequest" r WHERE r."organizationId"=o.id) AS requests,
   (SELECT json_agg(json_build_object('id',p.id,'requestId',p."requestId",'kind',p."paymentKind",'start',p."startsAt",'end',p."endsAt",'matchesOffer',p.snapshot=f.snapshot,'activation',a.status,'reasons',a.reasons) ORDER BY p."startsAt") FROM "SubscriptionPaidPeriod" p JOIN "CommercialOffer" f ON f.id=p."offerId" LEFT JOIN "SubscriptionPaidPeriodActivation" a ON a."periodId"=p.id WHERE p."organizationId"=o.id) AS periods,
   (SELECT json_agg(json_build_object('id',u.id,'requestId',u."requestId",'kind',u."paymentKind",'end',u."endsAt",'baseEnd',p."endsAt",'matchesOffer',u.snapshot=f.snapshot)) FROM "SubscriptionUpgradeReceipt" u JOIN "SubscriptionPaidPeriod" p ON p.id=u."basePeriodId" JOIN "CommercialOffer" f ON f.id=u."offerId" WHERE u."organizationId"=o.id) AS upgrades,
   (SELECT json_agg(json_build_object('action',a.action,'count',a.n)) FROM (SELECT action,count(*) n FROM "AuditLog" WHERE "organizationId"=o.id GROUP BY action) a) AS auditCounts
   FROM "Organization" o WHERE o.slug LIKE 'synthetic-entitlements-20260930-%'
 ) x),
 'regulatoryGrant',(SELECT json_agg(json_build_object('userId',"userId",'active',"revokedAt" IS NULL)) FROM "PlatformRegulatoryGrant"),
 'classificationChanges',(SELECT json_agg(json_build_object('productId',"entityId",'actorId',"actorId",'metadata',metadata)) FROM "AuditLog" WHERE action='PRODUCT_REGULATORY_CLASSIFICATION_CHANGED'),
 'existingProductsUnresolved',(SELECT count(*) FROM "Product" WHERE "organizationId"='bdc5aed5-b05a-42e6-895b-9f2f9f8a79a0' AND "regulatoryClassification"='UNRESOLVED'),
 'originalPeriod',(SELECT json_build_object('id',id,'kind',"paymentKind",'start',"startsAt",'end',"endsAt") FROM "SubscriptionPaidPeriod" WHERE "organizationId"='ffe171d1-b6a6-43d5-83bb-890e2fa23c9f'),
 'writes','NONE');
ROLLBACK;
