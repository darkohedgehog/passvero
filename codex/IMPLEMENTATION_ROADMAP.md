# Passvero — stanje implementacije i redosled nastavka

## STAGING_RECURRING_DB_STORAGE_BACKUP_AND_MONITORING — 2026-10-09

**COMPLETE 12.10.2026: A–D PASS, CONTINUOUS, hold=false; backup/monitor active/enabled.**
Raniji checkpointi čekanja/STOP-a ispod su historijski; završni dokazi navedeni su na kraju. Prethodni 08.10
readiness pregled i necommitovani diff su sačuvani. [Jedan plan, konačni opseg odobrenja
i potpuni operatorski blokovi](../docs/superpowers/runbooks/existing-backup-coverage-staging-recovery.md#staging_recurring_db_storage_backup_and_monitoring--2026-10-09),
[postojeći završni izveštaj](EXISTING_BACKUP_COVERAGE_AND_STAGING_RECOVERY_COMPLETION.md#recurring-staging-continuation--2026-10-09).
Poslednji [operatorski correction output](evidence/backup-recovery/operator-monotonic-correction-installed-pass-20261010.json):
novi pin podudaran, attempts=0/hold=false, web online, reminder timer enabled/active,
servis inactive, bez aktivnog capture-a ili preostalog workera; istorija failure-a očuvana.
Potvrđeni termini **11. i 12.10.2026. 04:30UTC / 06:30 Europe/Zagreb CEST**.
Čekamo dva uspešna redovna seta; jedan results-read posle **12.10 05:10UTC / 07:10CEST**.
A još nije prihvaćen, B–D NOT_RUN; marketing deploy odložen. Bez ponavljanja instalacije,
lokalnih provera, ručnog capture-a ili polling-a. Prethodni HOLD/pending navodi ispod
su istorijski checkpointi, ne trenutno poslednje potvrđeno stanje.

Operatorski read-only preflight PASS (09.10 14:21UTC): 56 tabela/33 migracije, 7 Storage
objekata/368,798B, ~81GiB slobodno; reminder timer enabled/active, jedna kampanja.
To je poslednji dokumentovani inventar, ne live capture/recovery prihvatanje.
Adapter i četiri pinovana operatorska bloka lokalno provereni (24 fokusirana testa).
Ponovo se koristi staging B2 prefix/repo, prihvaćeni helperi i application reader;
production backup/monitoring nepromenjeni. Prema instalacionom outputu uključeni su
dnevni04:30UTC / targetRPO24h i monitoring
stale>25h/hourly:20UTC, 14/8/6 retencija **samo dry-run**, zaseban staging signal u
postojećem zaštićenom Telegram chatu; **bez testne poruke**. Prirodni reminder drain
pre pauze, nezavisni resume; najviše2 zakazana capture-a/1 restore, potom A–D promocija.
**A čeka zakazane dokaze; B–D NOT_RUN; novi set/restore ID-jevi NONE.**
Raspored/nadzor enabled prema [operatorskoj instalaciji](evidence/backup-recovery/operator-recurring-installation-pass-20261009.json);
uspešni poslovi i signali još NOT_PROVEN.
Korisnik je potvrdio paket i postojeći zaštićeni Telegram chat; bez testne poruke.
Termini: 10.10. i 11.10.2026. u **04:30 UTC / 06:30 Europe/Zagreb (CEST)**.
Potvrđeni [read-only uzrok i stanje](evidence/backup-recovery/operator-recurring-failure-read-only-cause-20261010.json):
`int()` nad `LastTriggerUSecMonotonic="1w 1d 13h 5min 47.034136s"` pada pre
rezervacije; D-Bus daje typed mikrosekunde. attempts=0/completed=[], hold=true;
web online/3001 accepting, reminder timer enabled/active, servis success/inactive,
nema preostalog workera ni novog lokalnog/B2 seta. Stari nepotpuni 01.10 artefakti
su istorijski i ostaju sačuvani. Sutrašnji 11.10 04:30UTC/06:30CEST capture blokira HOLD.
Korekcija odobrena: typed D-Bus monotonic čitanje i precizan predrezervacioni kod;
17 relevantnih adapter testova PASS, ostale funkcije identične starom payloadu.
Pregledani pinovani operatorski correction/hold-release blok u postojećem runbooku
čeka output. Poslednje potvrđeno live stanje i dalje old adapter/attempts=0/hold=true;
instalacija, puštanje hold-a i novi capture-i nisu potvrđeni. Pre release-a blok proverava
pinove, ekskluzivni job lock, neaktivni capture, web i idle writere; čuva failure/adapter
istoriju. Bez ručnog pokretanja, retry-ja, restarta ili promene rasporeda.
Ako završi pre 11.10 04:30UTC, očekujemo **11. i 12.10 04:30UTC/06:30CEST**, results-read
12.10 posle **05:10UTC/07:10CEST**; inače naredna dva redovna dana prema operator outputu.
B–D i marketing deploy ostaju odloženi; pri novom neuspehu HOLD i pregled.

## UX polish iz korisničke provere — 2026-10-04

[Jedinstveni pregled i odvojeni dokazi](CSV_IMPORT_IMAGE_UPLOAD_AND_PRODUCT_PRESENTATION_UX_POLISH.md).
Korisnik prodaja@zivic-elektro.com u Živić-elektro - staging test prijavio je uspešno
kreiranje Razdjelni ormar MUT 4, PDF scan, image upload/prikaz, DPP publish/QR i CSV export.
Potvrdio je novu objavu pre QR osvežavanja, a naknadno i da samo draft save
bez nove objave ne menja javnu verziju (korisnički dokaz koraka 5).
Staging browser read-only potvrdio je SKU 05.66.81 konflikt i 0 selected: očekivan deny.
UI daje četiri CSV koraka, lokalizovano mapiranje, filename picker, konkretan disabled
razlog i GTIN/SKU razdvajanje, progress/partial/error; image izbor/save status; dekorativne
DPP/preview ikonice. Pravila/API/pipeline/DTO neizmenjeni. Local test/TS/lint/build/browser
PASS; build HqpP77R94fR_j4Jo_P_0u. Deployment v1 STOP/RUNTIME_PACKAGE_DRIFT
u preflightu pre zamene/restarta: lokalni package/lock pinovi umesto staging runtime
pinova. Read-only 12:48:06 lokalno PASS_RUNTIME_PIN_CORRECTION_ONLY: svi runtime/artefakti
neizmenjeni. Odvojeni v2 metadata pin correction sa identičnim UI buildom;
V2 deployment PASS, HTTPS 200, 826 artefakata; rollback pripremljen/nije izvršen.
Live CSV PASS: jedan zadržan nejavni sintetički nacrt UX-CSV-20261004-0c77b9,
explicit keyboard selection/confirm, success, same-file report replay bez duplikata,
SKU conflict disabled uz razlog. Image izbor bez upload/save; javni DPP/preview
read-only PASS, mobile 375 px bez overflow-a. Error/partial i šest jezika lokalni dokazi.
Prethodni recovery source/report/manifests sačuvani; novi [UX manifest](evidence/ux-polish/source-manifest.json)
je odvojen. Bez commita/pusha, production pristupa, reminder-a ili brisanja podataka.

Dodatna dorada na zahtev korisnika: uklonjen samo javni GTIN objašnjavajući pasus;
STAGING_DEPLOY_PASS, build _xSIVqA6vEbfYig6Tcxqj, HTTPS 200;
read-only javni prikaz potvrđuje barkod/broj bez pasusa. Rollback pripremljen.
Ostalo neizmenjeno; prethodni UX
deployment manifest sačuvan.

## Konačan pregled — stvarni staging unos i korisnički acceptance (2026-10-02)

**Ograničen stvarni unos može početi nakon korisnikovog pregleda plana**, u tačnoj
odobrenoj organizaciji, uz važeće sadržajno pravo, raspoložive kvote i zadržane
izvorne podatke/fajlove izvan staginga. Signature-health recovery je PASS iz operatorskog outputa 02.10: tri zakazane
prihvaćene objave 87498/87499/87500 i završni stvarni reader accepted=true u
19:55:34.890 UTC; qpdf active/listening, staging HTTPS 200. PDF korak može ući
u korisnički scenario; stvarni upload/scan/download još nije izvršen. Ranije
reader odbijanje/odsutan snapshot je oporavljeno, bez tvrdnje o trajnoj freshness.
Nije odobrenje dugotrajnog rada ili produkcije.

[Korisnički scenario, uslovi, operatorski blok i prioriteti](STAGING_REAL_DATA_READINESS_AND_USER_ACCEPTANCE_PLAN.md).

Početno stanje ovog pregleda: branch `main`; HEAD, lokalni `origin/main` i
aktuelni udaljeni `refs/heads/main` jednaki su
`703f588f1d6589f3e7b0118d991eab9ca8a35aa0` (`git ls-remote`, 2026-10-02).
Worktree i index bili su čisti pre dokumentacijskih izmena. Posle ovog zadatka
očekivane su samo dve dokumentacijske promene; nema commita/pusha. Source HEAD
nije automatski identitet VPS runtimea: poslednji prihvaćeni executable build je
`8QNIYVVZWEsQaCL9uLZ5Q`, sa 826 artefakata potvrđenih recovery dokazom. Današnji
runtime nije ponovo proglašen proverenim na osnovu tog istorijskog podatka.

### Objedinjeno funkcionalno stanje

PASS u tabeli znači raniji prihvaćeni dokaz iz povezanog završnog izveštaja,
ne ponovljeni test ili današnji operativni pregled. Source je pregledan read-only.

| Oblast / implementirano | Prihvaćeno lokalno i na stagingu | Aktivno / ograničenje / prepreka unosu |
| --- | --- | --- |
| [Pristup, odobrenje, aktivacija, prijava](CONTROLLED_EARLY_ACCESS_ONBOARDING_STAGING.md) | Lokalna validacija, autorizacija, provisioning/replay; staging zahtev → eksplicitno odobrenje → dostava → aktivacija → prijava i tačna organizacija PASS. | Kontrolisani pristup; javni self-service signup isključen. Postojeći aktiviran račun može koristiti scenario; novi račun zahteva operatorovo odobrenje. Nema nove email serije u ovom pregledu. |
| [Organizacija/billing](ORGANIZATION_BILLING_PROFILE_IMPLEMENTATION_AND_STAGING_ACCEPTANCE.md), [Platform Admin](PLATFORM_ADMIN_ORGANIZATIONS_AND_BILLING_OVERVIEW_STAGING.md) | Lokalno tenant/CAS/audit i sveže grant/session/identity provere; staging billing create/update/reload i platform list/detail/search/tenant-return PASS. | Billing profil je privatan i nije uslov product unosa. Tenant OWNER/ADMIN nije platform autoritet; read-only, billing i regulatory grantovi su zasebni. Neovlašćen korisnik ne prolazi operator deo. Live pagination/grant-revoke negativni scenariji nisu novi PASS niti prepreka običnom unosu. |
| [Trial/paketi/kvote/istek/obnova/upgrade/downgrade](SUBSCRIPTION_ENTITLEMENTS_QUOTAS_AND_PLAN_CHANGES_STAGING.md) | Lokalno concurrency, shared CSV/storage/publication enforcement, kalendar, obnova, replacement; staging trial limit, istek/write denial, javni HTML, upgrade i dozvoljen/blokiran downgrade PASS. [Početna kupovina](SUBSCRIPTION_MANUAL_COMMERCIAL_WORKFLOW_STAGING.md) UI PASS; kasnija reminder serija potvrđuje obnovu/stale cancellation. | Manual B2B, samo SIMULATED_PAYMENT dokazi; nema bank/Stripe naplate. Dva konačna staging izuzetka važe do 2026-10-31T00:00:00Z. Istek/kvote blokiraju sadržajne izmene; login/read/export/billing profil ostaju uz autorizaciju. Live novi image/PDF grace transport, concurrency i rollback ostaju ograničeni dokazi, ne opšti blocker. |
| [Proizvodi/proizvođač](MANUFACTURER_IMPLEMENTATION.md), [GTIN/barkod](PRODUCT_GTIN_VALIDATION_AND_BARCODE_STAGING.md), [slike/verzije](PRODUCT_IMAGE_UPLOAD_VERSIONING_AND_PUBLIC_DPP_STAGING.md) | Lokalno tenant/CAS/snapshot; staging create/edit, manufacturer v1/v2, GTIN validacija/nasleđivanje/dekodiranje, slika A/v1 → B/v2 i očuvani bajtovi PASS. CN/prevodi/materijali imaju postojeće lokalne dokaze i raniji DPP/CN prikaz. | Tokovi implementirani. Manufacturer snapshot je odvojen od tenant/billing identiteta. GTIN format/check-digit nije GS1 vlasništvo; CN nije automatsko pravno mišljenje. Unos zahteva pravo i kvotu, bez novog infrastrukturnog uslova. |
| [Pretraga](PRODUCT_CATALOG_SEARCH_STAGING.md), [CSV export](PRODUCT_CATALOG_CSV_EXPORT_STAGING.md), [create-only import](PRODUCT_CATALOG_CSV_IMPORT_STAGING.md) | Lokalno 5.000 proizvoda/redova, paginacija, tenant, escape, replay/concurrency/rollback; staging name/SKU/GTIN pretraga, full/filtered/empty export i 5-row preview/3 selected drafts/replay PASS. | Aktivni tokovi; import preview ne piše, izbor je eksplicitan, nema update/upsert/XLSX. Nije pun export round-trip/backup; slike/PDF/proizvođač/istorija se ne uvoze. Live veliki katalog i konkurencija nisu ponavljani. Trial ukupno 3 kreiranja uključuje import. |
| [PDF/scan/preuzimanje](DOCUMENT_MALWARE_SCAN_SCHEMA_AND_CONTRACT.md), [post-restart recovery](DOCUMENT_SIGNATURE_HEALTH_POST_RESTART_RECOVERY.md) | Lokalno struktura/auth/integritet/status/recovery; staging UNSCANNED deny, eksplicitni CLEAN i isti download bajtovi, validan EICAR INFECTED deny, malformed upload deny. Recovery 23.09: reader/scheduled publikacije i privatni CLEAN smoke PASS. | AVAILABLE nije CLEAN; qpdf struktura nije antivirus. Stari reboot BLOCKED je superseded prihvaćenim recoveryjem, ali današnja freshness nije istorijski PASS. Aktuelni operatorski preflight 02.10. 19:20:58 UTC: readerExit=1/accepted=false, qpdf active/listening. Dijagnoza 19:36:49 UTC: producer UNTRUSTED/EVIDENCE_CONTINUITY_REQUIRED u UPDATER, četiri initialization granice; snapshot odsutan pre/posle readera, PRIVATE_READ_ENOENT. Naknadni recovery 02.10 PASS: tri scheduled prihvaćene objave i fresh reader sequence 87500; HTTPS 200/qpdf listening. Stvarni PDF scan/download čeka korisnički scenario, fail-closed granica očuvana. Live expired-PENDING recovery i neopažene engine promene nisu dokazani. |
| Javni DPP/QR i immutable objava | Lokalna javna allowlista, tenant/snapshot/asset/publication zaštita; staging anonimni DPP, screen-phone QR, GTIN dekoder, manufacturer/image v1/v2 i javni CLEAN PDF/stari link deny PASS. [PDF dokaz](DOCUMENT_MALWARE_SCAN_SCHEMA_AND_CONTRACT.md), [verzije](CREATE_DRAFT_FROM_PUBLISHED_PRODUCT.md). | Samo eksplicitna objava javno namenjenih podataka. Novi draft ne menja objavljeni snapshot; nova objava zadržava istoriju na stabilnom linku. Paper QR nije potvrđen. Regulatornu klasifikaciju ne pretpostavljati; UNRESOLVED/MANDATORY imaju zasebnu politiku, ne generičko komercijalno gašenje. |
| [Podsetnici/dostava](SUBSCRIPTION_REMINDERS_AND_DELIVERY_STAGING_ACCEPTANCE.md) | Lokalno pragovi 30/7/1/istek, dedup/outbox/UNKNOWN/faults; staging 4 potvrđene dostave, replay bez novih sends, 2 stale cancellations, timer-triggered IDLE i desktop/mobile delivery UI PASS. | Poslednje stanje: timer DISABLED_INACTIVE, campaignsEnabled=0; nije uključeno ovim pregledom. Pregled istorije postoji, automatski podsetnik se ne očekuje. Live faults/concurrency nisu dokazani; ne sprečavaju ručno praćen staging unos. |
| [Backup/recovery](EXISTING_BACKUP_COVERAGE_AND_STAGING_RECOVERY_COMPLETION.md) | Jednokratni staging DB + svi stvarno sačuvani image/PDF bajtovi + minimalni non-secret config; stvarni B2 download/hash, izolovani PG restore/ACL/count i application private read PASS. | Snapshot 2026-10-01T21:23:54Z; nema staging rasporeda/RPO/freshness/Telegram. Noviji unosi nisu pokriveni tim setom. Supabase reupload, full web/auth/fresh scanner bootstrap nisu dokazani obnovom. Ograničen unos uz kopije izvora je primeren; dugotrajan autoritativan rad nije time zaštićen. |

### Automatizacije, zadržani podaci i redosled

Poslednji recovery closure: staging ONLINE_UNPAUSED, reminder timer off/campaigns 0;
to je prihvaćeni snapshot, ne današnji VPS pregled. Staging B2 set je jednokratan.
Postojeći production PostgreSQL B2/restic backup (02:00 UTC), hourly freshness i
Telegram su zaseban sistem; nisu menjani niti pristupani u ovom zadatku. Njihovo
postojanje ne daje backup zaštitu novim staging zapisima.

Izuzeci za `6d686789-6379-4824-ae02-df97043cbbc0` (Živić-elektro - staging test) i
`bdc5aed5-b05a-42e6-895b-9f2f9f8a79a0` (Passvero Acceptance):
`[2026-09-30T00:00:00Z, 2026-10-31T00:00:00Z)`, tj. 30.09. 02:00–31.10. 01:00
Europe/Zagreb/Belgrade; Start limiti 25 objavljenih mesta, 100 sačuvanih proizvoda,
2 GiB i 10 PDF/verzija. Nisu kupljeni paketi, trial niti automatsko produženje.
Po isteku bez drugog prava sadržaj se zaključava; čitanje/export/billing ne gase se
samim istekom, uz postojeće dozvole. UNRESOLVED se ne preklasifikuje radi testa.

Sintetički proizvodi, organizacije, image/PDF istorija, billing profil, import
receipts, trial/plan-change/reminder fixture i audit ostaju. Tačni izvori i granice
brojanja su u povezanom planu; nema brisanja niti tvrdnje da je stari broj današnji.

1. **Pre unosa:** korisnikov pregled plana, tačna organizacija/pravo/slobodne kvote,
   kopije izvora i prihvaćena backup granica; za PDF aktuelni read-only reader/socket
   rezultat. Završni rezultat: zabeležen izbor organizacije i PASS PDF uslov ili
   eksplicitno odložen PDF korak. Nema dokazanog opšteg product blockera.
2. **Tokom evaluacije:** jedna 30–45 min sesija i jedan objedinjeni zapis odstupanja;
   pre 31.10. potvrditi šta dalje sa izuzetkom i novim podacima. Za duže oslanjanje
   na staging zasebno dogovoriti backup raspored/RPO/retenciju i ostvariti novi set
   koji pokriva novije unose. Bez automatske aktivacije u ovom pregledu.
3. **Pre produkcije:** zasebno odobren rollout, komercijalne/regulatorne i retention
   odluke, automatizovana DB+Storage zaštita i prihvaćen full-provider/web/auth/scanner
   recovery, monitoring/alarmi i odobren reminder scope. Rezultat mora biti konkretan
   production acceptance i operativni runbook, ne zbir preimenovanih NOT_PROVEN.
4. **Ne blokira MVP:** fizički paper QR, širi accessibility/device sweep, marketing
   usklađivanje pre poziva, analytics/ERP/XLSX/Stripe i napredniji catalog UX po potrebi.

**Reader rejection diagnosis — završeno 2026-10-02:**
READER_REJECTION_CAUSE=IDENTIFIED iz operatorskog outputa 19:36:49.806809 UTC
(21:36:49 lokalno). Producer timer enabled/active/waiting; poslednja tri rezultata
UNTRUSTED/EVIDENCE_CONTINUITY_REQUIRED/UPDATER; updater log četiri initialization
granice. Producer konfiguracija/hash i reader/producer putanje podudarni.
Snapshot odsutan pre i posle UID-1001 readera; stvarni reader exit=1/accepted=false,
sourceConditionObservation=PRIVATE_READ_ENOENT, stabilno opažanje. Source privatni
lstat ENOENT → HEALTH_UNAVAILABLE → null objašnjava konkretno reader odbijanje;
producer failure invalidation objašnjava odsustvo važećeg snapshota. Nema zaključka
ko je/kada/zašto izazvao ranije restartove; aktivni updater/daemon ne obnavljaju
izgubljeni validation kontinuitet. Snapshot schema/sequence/observedAt/expiresAt
nisu dostupni jer fajl ne postoji; nisu proglašeni neispravnim. Lock nije prisutan
niti je tretiran kao uzrok. Nema dijagnostičkih mutacija ili scan/producer poziva.

**Release alignment and execution — odobreno 2026-10-02:** korisnik je odobrio
minimalnu exact-artifact pin korekciju i jedan postojeći fresh-base recovery posle
PASS kompatibilnosti. [Izveštaj](DOCUMENT_SIGNATURE_HEALTH_POST_RESTART_RECOVERY.md)
beleži reviewed hashove i kriterijume. Operator 19:48:35 UTC: installed hashovi,
826 artefakata i build 8QNIYVVZWEsQaCL9uLZ5Q potvrđeni;
PASS_ONLY_RELEASE_PIN_INCOMPATIBLE. Source diff je jedna tačna pin zamena,
[manifest](evidence/signature-recovery/release-alignment-source-manifest.json).
**RECOVERY_COMPLETE / PASS:** operator izvršio jedan novi attempt
recovery-20261002-release-8qni-01; originalni alat sačuvan, recoveryExit=0.
Tri zakazane objave sequence 87498/87499/87500, rastući observedAt, TTL 60 s;
stvarni fresh reader accepted=true. Updater kontinuitet i daemon/scheduled
kriterijumi postojeće procedure prihvaćeni. Freshclam/clamd running, qpdf listening,
producer timer waiting i service success/exit 0, staging HTTPS 200.
Reminder disabled/inactive i campaigns 0 pre/posle.
[Operatorski dokaz](evidence/signature-recovery/release-alignment-recovery-result.json).
Ranija dijagnoza ostaje istorijski dokaz; istorijski uzrok restartova nepoznat.
Nema novih scan/upload/EICAR/OOM/backup serija. Reboot/dugotrajni rad nisu dokazani.

**Preporučena sledeća radnja:** korisnik nakon pregleda prolazi
[korisnički scenario](STAGING_REAL_DATA_READINESS_AND_USER_ACCEPTANCE_PLAN.md#jedna-korisnička-sesija--približno-40-minuta),
uključujući stvarni PDF upload, eksplicitni scan i kontrolisani download.

Sledeći odeljci su istorija. Njihove ranije tvrdnje „nije implementirano“,
PENDING/BLOCKED i tadašnje Git stanje nisu konačan status gde ih noviji prihvaćeni
izveštaji i ovaj pregled izričito superseduju. Ne ponavljati istorijske komande.

## Final result — approved one-off staging recovery COMPLETE

Recorded2026-10-02 Europe/Zagreb from returned operator output. No operator command
remains pending for this approved series. Capture is an as-of snapshot2026-10-01T21:23:54Z,
not a promise about future writes. Exact operator execution UTC was not in the final
output; the final application unit ran2.424s/success/status0, invocation
ac45bf2cfa6c4026acd3daee314dbad1. Complete evidence chain is retained in
codex/evidence/backup-recovery/approved-recovery-completion.json and
codex/evidence/backup-recovery/operator-application-recovery-pass.json.

| Component | Final evidence |
| --- | --- |
| Existing topology | Production PG16/passvero:5432 and separate passvero_test retained; acceptance PG16/passvero_acceptance:5433. passvero_migrator is an owner/deployment role, not a separate database. Runtime/auth/backup/test roles remain separated. |
| Existing production protection | Existing B2/restic PostgreSQL job, daily02:00UTC schedule/hourly freshness/Telegram, protected credentials and prior accepted production restore retained unchanged. Last inspected successful production set20261001T020750Z; this is accepted inspection evidence, not a fresh Oct2 production-job execution claim. |
| Actual addition | One consistent acceptance DB+all actually stored private staging document/image bytes+minimal non-secret config recovery set in separate restic prefix passvero-staging-recovery-v1/ in the existing B2 bucket. No production repository validator/job changes. |
| Set and offsite | Set20261001T212354Z;payload964172B. Real B2 snapshot2c317b57154c0ded8436b56ee9d970a8f7601dc63f89e310829a9172a8aa7ca2 downloaded and all file hashes verified. Repository9058358d97bdd3b7e2ef56c53ea132f4b7be74752f213cbfbcc093c5331b9b35;recovery manifest2c5ccd0b89064cc0b431444337ab7700c1638914cfd23f1b9366d22ac13d3132. |
| Consistency | Capture pause3.034s;51 tables locked;outsideDBclients0;stagingWriters0;Storage inventory+bytes unchanged. Accepted independent timeout resume proof reused. Application resumed before B2 transfer/restore. |
| File scope | Whole passvero-staging-documents/passvero-staging-images:5 stored objects/6145B, including every actually retained historical/archive/original/derived object present at capture. Nine DB references=5 stored+4 accepted cleanup tombstones. Deleted tombstone bytes2959B do not exist and were not restored; filename metadata alone is not a retained original. No automatic deletion. |
| Database recovery | Actual downloaded dump restored to private PG16/passvero_staging_recovery under /var/lib/passvero-staging-recovery/restore/20261001T212354Z/pgdata. All51 counters/31 migrations/owners/effective ACLs/sequences/refs MATCH; exactly6 reviewed constraint representations and6 owner-default ACL equivalences. No TCP; existing DB/test/staging never overwritten. Final DB verification reused during app read; no rerestore. |
| Application read | Actual catalog export, bounded PDF metadata/bytes reader and private image download/recheck services PASS using private restored DB/read-only ports and actual B2-downloaded filesystem bytes. Representative PDF629B/image1168B/checksums MATCH;catalog unchanged. All826 executable deployment artifact hashes matched;11 module input provenance verified against accepted build base. Raw historical src checkout is not executable identity. |
| Configuration | Included allowlisted runtime/PG settings+HBA/scanner requirements/source-build-package-lock identity in four configuration JSON files, linked by recovery-set.json hashes. Raw env/password/key/B2/SMTP/Telegram secrets excluded from config and never printed/committed/rotated. Protected DB dump retains required identity/business records. Full executable binaries and raw whole-system configs are not copied in this set. |
| Final closure | PASS;stagingONLINE_UNPAUSED;restore clusterSTOPPED;private parents0700 restored;reminder timerDISABLED_INACTIVE;campaignsEnabled0;all history/artifacts retained;SMTP/Telegram0 throughout this recovery series. |
| Reminder evidence retained | Four independently confirmed receipts, zero replay additional dispatches, two stale cancellations. No reminder/email acceptance repeated. |

Remaining dependencies are explicit limits of the completed proof: Supabase provider
reupload NOT_PERFORMED; full web service/authenticated session/fresh scanner trust
NOT_TESTED. Private-file application reading is not a full live provider recovery.
Independent protected secret/global role bootstrap inputs and available reviewed
source/build or retained deployment artifact are needed for full application bootstrap;
build identity in the config set is not a binary backup. Existing escrow procedure is
retained; its availability is not re-proven by this read harness. Fresh scanner/ClamAV/
qpdf evidence must be established before live document delivery, without bypassing
security gates. No such activation or new integration was part of this approved series.

Automatic staging backup/RPO/freshness/Telegram schedule NOT_INTRODUCED. Existing
production scheduling/reporting remains unchanged, and the proved staging snapshot
covers the capture instant only. A future recurring staging policy is a separate concrete
decision; no implementation work or operator command is opened automatically.
Local source unchanged main/originmainf778721ed77d87ad8e7de1dd38e0e5a51b688b60;
source operational helpers/tests/docs remain uncommitted, indexEMPTY. Accepted tests
are reused; only final evidence/JSON/manifest/whitespace/secret checks are needed now.
No production, secret, scanner/producer config, email/Telegram, deletion, retention,
forget/prune, commit or push action. All earlier checkpoints below are historical;
PENDING labels and commands in them are retained evidence, not current instructions.

## Historical checkpoint — artifact-bound application read subsequently passed; do not rerun

Returned READ_ONLY_APPLICATION_MODULE_INVENTORY_V2 completed: raw Git checkout
3eec70abc80887eb4c098236c9b54ebc28d9fc58, six missing modules, two different document
modules, three identical modules. All five present sources match that checkout exactly;
LF/BOM conversion does not explain differences. Installed build/helper/closure evidence
is private0600/hash-matched, original application attempt absent. It does NOT prove
that running staging build is3eec70a: reviewed deploy intentionally replaces only.next
and messages, leaving rawsrc and Git checkout untouched. Earlier statement that staging
runs the old Git revision is superseded by this distinction. No app upgrade justified.

Actual root cause: verifier incorrectly used historical rawsrc as execution identity.
Reviewed installer scripts/subscription-reminders/install.py establishes accepted
reminders deployment build8QNIYVVZWEsQaCL9uLZ5Q/manifest1d7f456d13ce8cf1bb7173bc3c731be4fd7e61d6a5fbb70fb8aca99eba04f1cf.
Local evidence verifies all11 unchanged recovery bundle inputs against accepted original
build base1fc84aa8ccc3118f8158029e8edf99275c8f7f6e and all826 local build artefact bytes
against the accepted deployment package. No new application bundle or production code.

Corrected helper validates that same pinned existing deployment manifest, captured
package/lock/build identity, canonical manifest's reminder provenance, all826 live
.next/messages file hashes and existing runtime dependency hashes. Hash mismatches
still STOP; no general bypass/normalization. Readonly artifact hashing does not redeploy
or repeat email/Telegram acceptance. Raw checkout is explicitly not execution identity.
Reuse installed hash-pinned bundle/build. New private provenance file549271de0275b711bab687ce0a954887054debdfde4ccd55c0fcc20b2991f58d,
helper e168795c416c97deb477d22999bf01438bf2e502b76bc3acfb8073e350204abf,
unit application-artifact, and separate application-recovery-artifact attempt/config/
summary/closure names preserve original helper/closure/claims. Same already restored
PG16/socket-only/read-only cluster; no new database, rerestore, staging pause or transfer.
Same300s/25s/control-group/UMask0077/ExecStopPost/ACL cleanup boundaries. On STOP retain
reason and evidence; no automatic retry. Ten affected full operator-flow tests and four
complete installer fixtures PASS, including stale/missing raw checkout with matching
executable artefacts, changed executable/runtime/provenance/canonical manifest, existing
claim/unit and retained prior bytes. Exact2 payloads/Python/shell packaging PASS; unchanged
10 actual application-reader tests reused. Operator application proof remains pending.

Captured set20261001T212354Z/snapshot2c317b57154c0ded8436b56ee9d970a8f7601dc63f89e310829a9172a8aa7ca2:
B2 download/all-file hashes and final51-table/31-migration/ACL/count/sequence/ref DB
proof retained. Latest closure: clusterSTOPPED,parents0700,stageONLINE_UNPAUSED,
reminder timerOFF/campaigns0. Four confirmed receipts/replay0/two stale cancellations
retained. Production backup/freshness/Telegram/scanner/producer/credentials unchanged;
one-off recovery only, automatic staging backup schedule not introduced. Private app
service proof only; Supabase reupload NOT_PERFORMED and full web/auth/fresh scanner
recovery NOT_TESTED remain explicit dependencies. No deletion, commit or push.
PENDING_OPERATOR_COMMAND_APPLICATION_ARTIFACT_RECOVERY.

## Historical checkpoint — inventory V2 subsequently completed; do not rerun

Returned diagnostic STOP/FileNotFoundError/writes NONE/clusterStarted false. The
first diagnostic incorrectly required every installed evidence/source path to exist
and did not identify the missing path. No conclusion about which path is absent is
yet supported. Its failed source/command remains retained as historical evidence.
This does not invalidate the accepted B2/DB restore proof or repair the original
APPLICATION_MODULE_CHANGED preflight; application proof remains NOT_YET_RUN.

Correct only the read-only diagnostic: embed the exact11 reviewed expected module
identities, independently inventory installed build/helper/closure and all11 sources.
Missing, unreadable, unsafe-private, nonregular, symlink and oversize paths are labeled
with their precise reviewed path; no source text/secret is printed. Missing installed
metadata no longer prevents source inventory; missing sources no longer hide remaining
rows. Existing Git HEAD/source hashes are optional readonly metadata. Hash mismatch
is reported, never accepted/bypassed. Closure metadata inventory is not current runtime
health proof. No source deployment, SQL/cluster start, ACL/file writes, pause, B2/Storage,
SMTP/Telegram calls, acceptance retry or automatic cleanup. Seven focused tests PASS,
including full main flow with missing build/helper/closure/source files and absent Git;
Python/shell syntax and exact-source block checks PASS. Prior acceptance reused.
PENDING_OPERATOR_COMMAND_READ_ONLY_APPLICATION_MODULE_INVENTORY_V2.

## Historical checkpoint — module diagnostic subsequently hit missing file; do not rerun

Operator unitfaf168178f56437bba9e8a473eb920bc returned APPLICATION_RECOVERY_PREFLIGHT /
APPLICATION_MODULE_CHANGED in0.583s. At least one of the11 live application source
hashes differs from the reviewed bundle; first mismatched path was not printed by
the original fail-fast guard. Package/lock/build identity and downloaded-set checks
preceded this guard successfully. Source control flow stops before application attempt
claim, ancestor ACL grant, cluster start or application read. Do not infer why code
bytes differ, bypass source checks, redeploy staging or re-run the acceptance unit.
Closure PASS: cluster STOPPED, parent0700, staging ONLINE_UNPAUSED, reminder timer
DISABLED_INACTIVE/campaigns0, SMTP/Telegram0. Actual B2 download/file checksum and
final DB recovery PASS remain accepted. Application proof remains NOT_YET_RUN.
Raw evidence: codex/evidence/backup-recovery/operator-application-preflight-module-changed.json.

Minimal next read-only diagnostic: verify installed helper/build pins and saved closure,
confirm application attempt absent; print all11 expected/current hashes, optional VPS
Git HEAD/source hashes and LF/no-BOM comparisons for mismatches. No source contents,
credentials, SQL, cluster start, permissions/file writes, B2/Storage calls, staging
pause or acceptance retry. Four synthetic hash/CRLF/code-change/symlink fixtures and
Python/shell syntax PASS. Local11 module hashes equal current HEAD; VPS identity
must be established from operator output before choosing a source correction.
All accepted capture/B2/DB/reminder/timeout/Telegram checks reused unchanged; no
production/backup schedule/freshness/credential change, email, deletion, commit or push.
PENDING_OPERATOR_COMMAND_READ_ONLY_APPLICATION_MODULE_IDENTITIES.

## Historical checkpoint — application preflight subsequently stopped; DB proof retained

Returned operator evidence recorded 2026-10-02; set20261001T212354Z, actual B2 snapshot
2c317b57154c0ded8436b56ee9d970a8f7601dc63f89e310829a9172a8aa7ca2.
Final database unit invocation3ddfbb1dcdcb40e58f23b009e72102d6 completed success/status0
in2.571s. All51 tables/counters,31 migrations, sequences, database ACL and catalogue
owners/ACLs MATCH. Exactly six reviewed constraint representations and six owner
ACL/default equivalences accepted by their bounded comparator. Nine asset references,
five restored stored objects and four accepted cleanup tombstones verified.
No rerestore/schema/business writes. Closure PASS: cluster STOPPED, private parents0700,
staging ONLINE_UNPAUSED, reminder timer DISABLED_INACTIVE, campaignsEnabled0.
Raw sanitized output: codex/evidence/backup-recovery/operator-final-database-verification-pass.json.

Only remaining operator step: isolated application services read from this already
verified private database and actual B2-downloaded filesystem bytes. Reviewed helper
c3b794a89ccfe7a7b95da3ae7580cfa3c7606ec94d693be4930a5824f5f73aee starts the same
socket-only PG16 cluster with default_transaction_read_only=on; it does not restore
again or pause staging. Hash-pinned bundle uses11 deployed application modules
(checked against unchanged captured package/lock/build identity) and existing zod.
Actual catalog export and private image download/recheck services, plus bounded PDF
bytes/metadata reader, run with readonly SQL/private filesystem ports. No credentials
or live application environment passed. All mutation/public transport ports denied.
Exclusive attempt/summary/closure retain history. Unit UMask0077,RuntimeMaxSec300,
TimeoutStopSec25,control-group kill and independent ExecStopPost preserve the accepted
private ancestor ACL/0700 closure. No automatic retry on STOP.

Local evidence:10 application reader tests and6 synthetic complete operator tests
PASS; focused strict TypeScript/Python/Node/shell checks and exact three-payload/hash
packaging PASS. Prior capture, real B2 download/checksum, final database, timeout,
reminder delivery/replay/stale cancellation and Telegram acceptance reused unchanged.
This proves private application service reading only: Supabase restore NOT_PERFORMED;
full web service, authenticated session and fresh scanner trust NOT_TESTED. Independent
secret/role credential escrow and provider/scanner activation remain recovery dependencies.
Four confirmed reminder receipts, replay0 additional sends and two stale cancellations
retained. Production backup/freshness/Telegram/scanner/producer/credentials unchanged;
no email, new staging schedule, deletion, commit or push. This is a one-off recovery set.
PENDING_OPERATOR_COMMAND_APPLICATION_RECOVERY_READ.

## Historical checkpoint — final DB verification subsequently passed; do not rerun

Review update2026-10-02 Europe/Zagreb. Returned six full definition pairs match all
12 previously returned SHA signatures. Differences are solely associative grouping
of existing AND operands and uniform varchar-array→text[] casting versus individual
varchar-element→text casts; predicates, limits, literals, column references, regexes
and OR groups are identical. No schema change warranted. New comparator accepts
only these exact six (table,constraint,sourceSHA,restoredSHA) pairs; no generic text/
parenthesis/cast normalizer. Other constraint fields and all other catalogue sections
remain strict. For exactly six owner-only relation ACL→NULL pairs, require identical
owner/kind/RLS/name, ownerpassvero_migrator/tablekindr, exact old ACL; then SELECT
aclexplode of saved ACL versus coalesce(actualACL,acldefault('r',actualOwner)). Compare
grantor/grantee/privilege/grant-option lists; no GRANT/REVOKE or permission repairs.
Unexpected differences remain STOP. This corrects the verifier's overly strict text
comparison, not restored schema/data. The reviewed full definitions are retained.

Next is already approved final verification of the existing B2-restored database:
51 table counters,31 migration metadata/checksums, sequences, owners/ACL,9 exact
asset references/5 stored objects/4 accepted cleanup tombstones. Same private PG16
cluster, no re-restore/new target, TCP disabled, SQL default read-only, business/schema
writes NONE. Distinct database-final unit/claim/closure; UMask0077,300s/25s/control-group/
ExecStopPost protections, named postgres execute-only ancestor ACL and0700 cleanup
retained. Actual PG acceptance and isolated application product/PDF/image reads
remain pending operator output. No repeated B2/capture/reminder/Telegram acceptance.

11 affected comparator tests PASS: exact pairs/effective ACL pass, changed limits,
owners,grants,RLS,role/function/constraint identity/count fail; inputs unchanged.
Full installer exact source/hash/UMask/closure/Python/shell syntax PASS. Prior tests
and accepted runtime/capture/B2/private byte checks reused. No Codex privileged action,
production/schedule/freshness/scanner/producer/credential change, email, business or
snapshot deletion, commit or push. No automatic staging schedule introduced.
PENDING_OPERATOR_COMMAND_FINAL_DATABASE_VERIFICATION. Application read is next.


## Current checkpoint — catalog diagnosis PASS; six constraint definitions pending review

Returned READ_ONLY_RESTORED_CATALOG_COMPLETE is successful diagnostic, not DB acceptance:
12 differences only: six constraint-definition hashes and six relation ACLs. All
columns,defaultACLs,enums,functions,indexes,migrations,roles,schemas,pending counters,
non-public schemas and large objects match strictly. Six ACL pairs are owner-only
{passvero_migrator=arwdDxt/passvero_migrator} versus null/default. PostgreSQL16
privilege docs describe null as default privileges; semantic validation must still
check each relation owner/kind and actual expanded ACL, not ignore ACLs globally.
No permission/schema correction justified by these ACL representations alone.

Diagnostic closure PASS: private cluster stopped, parent0700, stage online,timerOFF,
campaigns0,SMTP/Telegram0. No restore repeated or business/schema writes. Constraint
hashes alone do not prove logical equivalence or actual difference. Next minimal
operator block reads the already saved source and restored catalogues, verifies B2
manifest/source-catalog SHA and saved constraint-difference hashes, and prints only
six metadata definition pairs. No cluster start, SQL, chmod, provider call, file write,
new database or rerestore. Await concrete definitions before comparator correction.
Python/shell syntax PASS; existing8 diagnostic and28 restore tests reused unchanged.
Capture/B2/reminder/timeout/production/freshness/Telegram proof remains retained;
full DB/application recovery still pending. No commit/push or automatic schedule.
PENDING_OPERATOR_COMMAND_SAVED_CONSTRAINT_DEFINITIONS.


## Current checkpoint — dump restored; strict catalog mismatch STOP; closure PASS

Returned helper5fb296f9... proves closure permission repair PASS/contents unchanged.
Unit invocation66133792f28045ce89f45b6ed23fdae9 stopped VERIFY_RESTORED_DATABASE /
RESTORED_CATALOG_MISMATCH after3.233s. Source control flow reaches this check only
after successful single-transaction pg_restore and database-ACL application. This
is restored data, not an accepted DB recovery proof. Returned closure PASS: isolated
cluster STOPPED, ancestors0700, staging online, reminder timer OFF/campaigns0,
SMTP/Telegram0. No restore rerun or new destination is proposed.

Next bounded diagnosis imports the installed hash-pinned helper, rechecks downloaded
B2 manifest/bytes and original private failed unit/closure, matches PG16 existing
pgdata/socket ownership and saved parent ACL inode identities, then temporarily
starts only this same cluster without TCP and default_transaction_read_only=on.
It SELECTs the captured catalogue, saves the full current catalogue privately and
prints differing sections/field paths; owner/ACL metadata is shown, SQL definitions
and defaults only hashed. Text/row-order-only equality is a diagnostic hint, not a
waived ACL check. No table/role/ACL/schema mutation or pg_restore; private runtime,
logs, attempt/evidence and temporary ancestor ACL are written as operational proof.
Separate catalog-diagnostic unit/claim/closure;UMask0077,300s/25s,KillMode control-group
and ExecStopPost enforce private-cluster stop and ancestor0700 restoration. Never
reset previous attempts; on error retain evidence and STOP/manual review. PG/application
acceptance remains NOT_PROVEN until remaining comparisons and reads pass.

8 new affected synthetic diagnostic tests plus complete installer source/hash/guard
and Python/shell syntax PASS; old28 restore tests and accepted capture/B2/reminder/
timeout proofs reused. PENDING_OPERATOR_COMMAND_CATALOG_DIAGNOSTIC; no privileged
operation executed by Codex. Existing B2/production/freshness/Telegram/scanner/producer/
keys unchanged; no automatic staging schedule, email, snapshot/business deletion,
commit or push. Private filesystem proof is not Supabase/full application recovery.


## Current checkpoint — PRIVATE_PATH cause confirmed; private-closure repair ready

Returned READ_ONLY_RESTORE_PRIVATE_PATH checked33 paths: the only failures are
originalClosure and stdlibClosure, regular root-owned0644. No restore attempt,
pgdata, socket directory or ACL baseline exists; writes/providers0. Actual defect
confirmed: prior ExecStopPost lacked a process umask and unit UMask. This was not
a DB, Storage, offsite or ACL-xattr failure; none of those new restore operations ran.

Minimum repair: explicitly os.umask077 in close(), unit UMask0077, and a guarded
one-time0644→0600 repair of exactly the two non-secret retained closure JSONs.
Both full JSON values must match accepted closure exactly, ownerroot/regular/single
link/mode0644/size<8192 via O_NOFOLLOW-held descriptors. Previous stdlib unit result,
invocation d3b214d0c90944acb5be57f7656da545 and helper hash must match; no attempt/
pgdata/socket/ACL baseline may exist. Record both before hashes privately before
fchmod; verify bytes/inode/device/owner unchanged. No validator weakening, generic
chmod, secret reading, package install, old helper or unit reset. Original closure
bytes are preserved. Any unexpected condition STOP/manual review; never auto retry.

Reviewed new helper5fb296f96c37fb3ebfb681f534e6df01cf392c9fb8b993c322f696d20794fd0f;
new unit passvero-stage-restore-20261001T212354Z-private.service;300s/25s/control-group
limits and separate ExecStopPost retained. New restore-closure-private.json, old
closures retained. Named postgres execute-only ACL and inode-bound cleanup unchanged.
28 affected synthetic tests PASS, including start-close-with-umask022→0600 regression,
content/mode/unit/claim rejection and bytes-preserved two-file repair. Complete
installer exact-source/hash, UMask property, shell/Python syntax PASS. Live repair/
PG/application reads NOT_YET_RUN; PENDING_OPERATOR_COMMAND_PRIVATE_DATABASE_RESTORE.

Reuse accepted actual B2 snapshot2c317b57.../5objects/all964172 bytes, capture3.034s,
independent timeout proof and reminders4 receipts/replay0/cancelled2. Staging remains
online per latest accepted closure; timer/campaigns OFF. No new capture, B2 upload,
email, Telegram, production job/freshness/schedule/credential/scanner/producer change,
automatic staging schedule, deletion, commit or push. Private filesystem proof still
does not imply Supabase or full service recovery. Application read follows DB proof.


## Current checkpoint — PRIVATE_PATH preflight STOP; closure PASS; read-only diagnosis pending

Returned stdlib helper9e092b11... unit invocation d3b214d0c90944acb5be57f7656da545
stopped RESTORE_PREFLIGHT/PRIVATE_PATH after353ms. Closure PASS: cluster stopped,
parents0700, stage online, timer OFF/campaigns0, SMTP/Telegram0. Accepted B2 retrieval
and capture remain unchanged; no automatic restore retry. Source review identifies
an unconfirmed hypothesis: separate ExecStopPost process does not set os.umask077,
and the unit does not specify UMask0077, so prior closure JSON may be0644 and rejected
by cap.read/private. Do not change rights or loosen validators on that hypothesis.
A bounded read-only lstat inventory is the next operator command; no contents of
secrets, no SQL/Storage/B2/network provider calls, no pause or restore. It identifies
exact private-path failures and existence of attempt/pgdata/ACL baseline. Await
actual output before a repair/continuation. Prior22 synthetic tests reused; diagnostic
Python/shell syntax PASS. No source/helper edits, commit, push or deletion this turn.


## Current checkpoint — PG preflight STOP; closure PASS; reviewed ACL continuation

Returned database restore STOP: RESTORE_PREFLIGHT / ACL_TOOL_UNAVAILABLE.
Original helper15fedf7fe4feecc12c79778a551ebba8f8c56793eabf04bb7d8e33a0be753034 remains installed and retained.
Unit passvero-stage-restore-20261001T212354Z.service / invocation
e2d37c7e744149efb0afbe3ea63f76c8 exited1 after539ms. Returned closure PASS:
cluster STOPPED;parent0700;staging ONLINE_UNPAUSED;timer disabled/inactive;campaigns0;
SMTP/Telegram0. Source ordering places missing-tool STOP before attempt/ACL/pgdata
writes. The continuation checks original source hash, unit result/invocation, retained
closure and absence of attempt/pgdata/old ACL backup before proceeding; no reset.

The only source repair replaces getfacl/setfacl with Python os.getxattr/setxattr/
removexattr for Linux system.posix_acl_access, according to kernel UAPI v2 tags and
little-endian encoding. No package installation, new dependency, chmod broadening,
production configuration or credential permission change. Existing extended parent
ACL remains STOP. Named postgres entry grants execute only, group/other0; original
three parents' inode/device/uid/gid/mode are saved privately. ExecStopPost verifies
identity and expected ACL before removal/restoring0700; it attempts all three even
if one fails and reports a closure error rather than claiming success. Existing
preflight closure retained, new restore-closure-stdlib.json written exclusively.
Reviewed continuation source9e092b115fe1d60e3497e39a714935b02fc9063b1fd241e2609c96199d7fd2d7;
new transient unit suffix -acl-stdlib;300s runtime/25s stop/KillMode control-group
unchanged. Any actual attempt failure remains STOP, no automatic retry.

22 affected synthetic tests PASS; complete installer source/hash fixture and shell/
Python syntax PASS. Linux ACL operations are mocked locally; live Linux/PG restore
remains NOT_YET_RUN. Already accepted B2 snapshot2c317b57.../bytes964172/5objects,
capture3.034s/resume, independent timeout and reminder4 receipts/replay0/cancelled2
are reused. No B2 transfer, capture pause, email or Telegram acceptance repeated.
Existing production jobs/freshness/schedules/keys/scanner/producer unchanged. No
automatic staging schedule, commit, push or deletion. Isolated application read
remains pending after DB proof; private filesystem proof is not Supabase recovery.


## Current checkpoint — real B2 retrieval and byte restore PASS; PG restore pending

Operator output for set `20261001T212354Z` confirms snapshot
`2c317b57154c0ded8436b56ee9d970a8f7601dc63f89e310829a9172a8aa7ca2`,
repository `9058358d97bdd3b7e2ef56c53ea132f4b7be74752f213cbfbcc093c5331b9b35`,
manifest `2c5ccd0b89064cc0b431444337ab7700c1638914cfd23f1b9366d22ac13d3132`.
Exact separate prefix passvero-staging-recovery-v1/;964172 bytes;all set files
checksummed;5 stored objects6145 bytes;9 references and4 accepted absent tombstones.
This is actual B2 retrieval into private filesystem, not a Supabase restore.
Staging ONLINE_UNPAUSED, reminders disabled/inactive, campaigns0, SMTP/Telegram0.
No additional capture or B2 upload is needed or authorized as an automatic replay.
Capture3.034s closure, four confirmed reminder receipts/replay0/two cancelled and
unchanged accepted production backup/freshness/Telegram evidence remain retained.

Next approved phase is the exact downloaded dump into new private PG16 pgdata,
DB passvero_staging_recovery, socket-only55434. A root-owned hash-pinned operator
helper executes in its own bounded transient systemd unit; maximum300 seconds,
stop25 seconds, KillMode control-group plus ExecStopPost restore/closure. Only the
new isolated cluster is terminated on interruption/error/timeout. Existing target,
attempt or unit means STOP, never overwrite/retry. Parent ROOT/restore/set remain
root0700 except temporary named execute-only postgres ACL; original basic ACLs
are saved privately and restored by ExecStopPost. Existing extended ACL or missing
existing ACL tools means STOP before the attempt; no package installation or rights
changes to credentials, storage or production. Backups remain root0600. No trust
HBA, role passwords or TCP listener; root/postgres peer authentication on private
socket only. Roles' captured attributes, ownership and relevant schema/table/function/
enum/default/database ACLs are compared; passwords and uncaptured role memberships
remain independent protected recovery dependencies, not whole-cluster claims.

15 affected local synthetic tests, full installer source/hash fixture and shell/Python
syntax PASS. Old accepted guard/source/offsite proofs are reused, not repeated.
PG/application restore is NOT_YET_RUN until operator output. This database phase
stops the private cluster and retains it for the subsequent already-approved isolated
application read. It does not launch a web server, timer, business worker or scanner.
No automatic staging backup schedule, production change, commit, push or deletion.


## Current checkpoint — consistent capture PASS; B2 transfer pending

Returned operator evidence for `20261001T212354Z` proves capture PASS and staging
ONLINE_RESUMED after 3.034 seconds. Reviewed helper d4c644cf0100ef94e96277bfe372616d998bac05dad2d9a068cd8938ef10b5fa was installed; original failed claim/set retained.
51 tables locked; outside clients0 and staging writers0; Storage metadata/bytes
unchanged. Set964172 bytes;5 stored objects;9 references;4 accepted absent tombstones.
Accepted independent timeout proof reused. Additional pause consumed; no new pause
or capture retry is authorized by this continuation. Reminder timer disabled/inactive,
campaigns0; accepted four receipts/replay0/two cancelled remain unchanged.

Next is the already approved exact-prefix B2 upload and real private filesystem
restore. New offsite helper has12 synthetic contract tests PASS; old42 source tests
are reused. The complete operator block is below. It verifies existing credentials
and prefix without printing secrets; never runs the production backup job or retention.
Exclusive attempt/restore paths prevent replay/overwrite; failures retain artifacts.
Database restore and isolated application reads remain NOT_YET_RUN, as does B2 until
operator output. Filesystem bytes alone prove neither Supabase nor full service recovery.
No automatic staging schedule introduced; production/freshness/Telegram unchanged.
No privileged command run by Codex, no commit or push.


## Aktualizacija — installer-only STOP zatvoren; odobrena pauza nije iskorišćena

Vraćeni read-only output potvrđuje originalni claim, nema extra claima ni novog
helpera; staging online, timer/service/campaigns OFF; writes/Storage/B2/SMTP/Telegram0.
Dodatna pauza ostaje odobrena i nije iskorišćena. Konačan skraćeni VPS delta installer
rekonstruiše isti odobreni d4c644cf0100ef94e96277bfe372616d998bac05dad2d9a068cd8938ef10b5fa iz postojeće hash-pinned neuspešne verzije.
Patch/source SHA i compile pre install/exec; stare oznake/skupovi ostaju.7 pogođenih
installer fixture testova + syntax PASS; raniji42 source testa/live guard/SQL/Storage
dokazi se ne ponavljaju.85s capture+25s nezavisni resume, stvarna pauza≤120s,
set≤1GiB/free≥4GiB i bez retryja ostaju isti. PENDING_OPERATOR_COMMAND_APPROVED_CAPTURE_DELTA.
Čeka se output; B2 transfer i izolovani restore slede tek nakon PASS capture/resume,
u već odobrenim granicama. Bez nove potvrde, production/deploy scannera/kredencijala/
emailova/Telegrama/commita/pusha.4 receipts/replay0/stale2 ostaju prihvaćeni. Raniji
odlomci ispod su istorija, ne instrukcije za ponavljanje.

## Aktualizacija — additional installer STOP; bez capture reruna

Vraćeni STOP/Error nastao pre helper-installed outputa; pauseRequested=false,
remote writes/SMTP/Telegram0. Moj prethodni chat blok je imao ubačene razmake u
Base64 literalima. Strogo dekodiranje lokalno reprodukuje binascii.Error/class Error;
intaktni pregledani artifact i odobreni source pin d4c644cf0100ef94e96277bfe372616d998bac05dad2d9a068cd8938ef10b5fa ostaju isti.
Decode je pre install/exec/novog claima/pauze; VPS stanje se ipak proverava uskim
read-only blokom (original/extra claim, helper hash, PM2 staging, reminder gates).
4 lokalna fixture testa/syntax PASS; raniji42 source testa i timeout/SQL/Storage
prihvaćeni dokazi se ne ponavljaju. PENDING_OPERATOR_COMMAND_INSTALLER_STOP_READ_ONLY;
ne resetovati claim, ne replayovati oštećen capture blok. Ako dodatni claim postoji,
STOP/manual review. Odobrenje ostaje sačuvano, potrošnja se ne pretpostavlja bez
operatorskog stanja. B2/restore nisu pokrenuti. Nema source/deploy/production/promena
tajni, commita ili pusha;4 receipts/replay0/stale2 ostaju prihvaćeni. Raniji odlomci
ispod su hronološki dokazi, ne komande za rerun.

## Aktualizacija 2026-10-01 — zatvoren capture failure; plan jedne dodatne pauze

Najnovije: korisnik je izričito odobrio jednu dodatnu pauzu≤120s sa pregledanim
helperom d4c644cf0100ef94e96277bfe372616d998bac05dad2d9a068cd8938ef10b5fa,
85s capture+25s nezavisni resume. PENDING_OPERATOR_COMMAND_ADDITIONAL_CAPTURE;
output još nije vraćen. B2/restore nakon uspešnog capture/resume ostaju odobreni.

Vraćeni read-only dokaz za set20261001T203612Z potvrđuje SQL_RESULT_SHAPE pri
LOCK_AND_EXPORT_SNAPSHOT, prihvaćen systemd timeout guard i uspešan resume za2,743s.
Staging je pri tom pregledu online/port3001 dostupan; timer disabled/inactive, reminder
service inactive, campaigns0. Nema dumpa/manifesta/B2 transfera/restore dokaza. Prvi
claim/artefakti ostaju; SMTP/Telegram0. JSON formatter potvrđen na dva sintetička reda;
prihvaćeni read-only/guard dokaz ne ponavljati.

Plan/runbook ima kompletan pregledani draft VPS bloka i eksplicitni launcher samo
posle ovog tačnog neuspeha: sveža merenja dok app radi, zaseban exclusive claim sa
hashom originala, nova set/control putanja, jedna dodatna pauza≤120s, nepromenjeni
85s capture+25s nezavisni resume. Payload≤1GiB/free≥4GiB.42 lokalnih testova PASS;
source nije deployan. Capture transaction/PM2/guard/resume ostaju isti. Običan launcher
ne zaobilazi originalni claim; dodatni blok čeka PENDING_APPROVAL_ONE_ADDITIONAL_PAUSE.
Razlog novog odobrenja: original dozvoljava jednu pauzu, koja je potrošena. Ne traži
se ponovno odobrenje nepromenjenog B2/private restore/prod sistema. Prenos/preuzimanje
B2 i izolovani DB/PDF/image/app restore nastavljaju se tek nakon uspešnog novog skupa
uz vraćen staging. Bez novog rasporeda, production promena, emailova/Telegrama,
automatskog brisanja ili commita/pusha. Četiri potvrđena primitka/replay0/dve stale
cancellations ostaju prihvaćeni. Sledeći checkpointovi su istorija, ne komande za rerun.

Istorijski checkpoint pre capture pokušaja: preparation20261001T190516Z i reference preflight PASS.
9 DB referenci =5 sačuvanih objekata6145B +4 ranije prihvaćena cleanup tombstone zapisa
(2959 odsutnih bajtova);0 orphan objekata. U tom ranijem preflightu staging nije bio pauziran, remote writes/SMTP/
Telegram0. Ne ponavljati prihvaćene pripreme/cleanup. Lokalni capture source/testovi i
potpuni hash-pinned operatorski handoff spremni,34/34 testova PASS; systemd timeout/
post-stop dokaz pre pauze,85s capture+25s resume,51 SHARE zaključana tabela i isti
snapshot za dump/manifest/reference. PM2 postojeći daemon RPC; bez novih daemon/env.
PENDING_OPERATOR_COMMAND_GUARDED_CAPTURE; stvarni capture/B2/restore još neizvedeni.
Jednokratni dokaz ne uvodi automatski staging raspored. Nema commita/pusha/production
promjena. Slijedeći odlomci čuvaju ranije checkpointove kao istoriju, ne nove naloge.
Vraćeni helper-state output: prepare postoji/validan; references/capture nisu instalirani,
one-pause claim ne postoji. Potpun direktni VPS installer sada koristi kratke linije;
source hash nepromijenjen,34 testa PASS. Capture i dalje čeka operatorski rezultat.

Main/local origin potvrđeni na `f778721ed77d87ad8e7de1dd38e0e5a51b688b60`; live remote
isti pri ranijem početnom pregledu. Worktree sadrži dokumentaciju/dokaze i pripremnu operatorsku Python skriptu/testove
ove cjeline; index prazan. Postojeći produkcijski B2/S3 restic, daily backup, hourly
freshness i Telegram ostaju nepromijenjeni. Zadržani su današnji offsite skup
`20261001T020750Z`, marker star47793s u17:24 CEST (<26h), prihvaćeni B2 PostgreSQL
restore18.08. i recovery operational PASS24.08.; današnji staging restore nije izveden.

V3 potvrđuje `main:5432/passvero` (17 migracija), zaseban test u main (16 migracija),
i `acceptance:5433/passvero_acceptance` (31 migracija,51 tablica). Migrator je uloga.
Staging ima sedam PDF zapisa (tri AVAILABLE,četiri ARCHIVED) i dvije READY slike,
ukupno9104 referenciranih bajtova. To nije kopija bajtova ni potpuni bucket inventar.
Identificirani postojeći posao cilja produkcijski DB, ne acceptance DB/Storage/test.
Test/produkcija/acceptance nikad nisu restore targeti; nova backup uloga se ne dodaje.

Source ugovor u18:04 i selektori u19:03 CEST potvrđuju stvarnu prepreku dijeljenju
repozitorija: pre/post/final snapshots pozivi nemaju host/tag/path filtera, a Python
validatori zahtijevaju production host/tag za svaki unos. Forget jeste produkcijski
filtriran14/8/6, ali to ne čini novi staging snapshot sigurnim za postojeći posao.
Produkcijska skripta se ne mijenja niti pokreće ručno.

Korisnik je odobrio jedan konačan plan: zaseban restic repo na prefixu
`passvero-staging-recovery-v1/` u istom postojećem B2 bucketu, s istim endpointom,
postojećim kredencijalima i password datotekom. Razlog je potvrđena nekompatibilnost,
ne NOT_PROVEN. Ako već postoji odgovarajući staging skup/prefix, koristi se; konflikt
ili nedostupno pravo znači STOP bez novih kredencijala/promjene produkcije. Izvori su
acceptance DB, cijele dvije privatne Storage kolekcije i minimalni non-secret manifest.
Najviše120s staging write pauze, payload≤1GiB i najmanje4GiB slobodno; bez novog rasporeda.
Restore ide samo u privatni PG16 pod `/var/lib/passvero-staging-recovery`, port-identitet
55434 bez TCP listenera, DB `passvero_staging_recovery`, plus izolovane privatne datoteke.
B2 download, DB/migracije/ACL/brojači, bytes/SHA/reference i aplikacijska čitanja ostaju
za odobreni operativni korak. Filesystem/app-harness proof nije Supabase re-upload ili
potpuni service recovery; nezavisne tajne/scanner trust i buduća staging freshness
ostaju jasno označene zavisnosti.

PENDING_OPERATOR_COMMAND_PREPARATION. Potpun VPS blok i hash-pinned pripremna
skripta su spremni: staging ostaje online, provjeravaju se prefix/prava/identitet,
inventarišu cijele privatne kolekcije, čuvaju bajtovi i mjeri zaseban DB dump.
Deset lokalnih Python testova i sintaksa ugrađenog installera PASS; nisu live dokaz.
Priprema nije konzistentan skup. Jedna pauza s nezavisnim vraćanjem aplikacije,
writer-closure dokazom i limitom120s, pa B2 transfer/preuzimanje/izolovani restore,
ostaju naredni odobreni koraci nakon operatorskog outputa. Nema novog staging
rasporeda/freshness/Telegrama. Nije kreiran repo/restore target ni izvršen operatorski
blok; nema live restic/Storage/restore/email/Telegram poziva od strane Codexa. Nema commita/pusha, forget/prune,
rotacije ili automatskog brisanja. Timer disabled/inactive,kampanje0; četiri potvrđena
primitka,replay bez novih slanja i dvije otkazane poruke ostaju prihvaćeni.
[Objedinjeni nalaz, konačan plan i granice dokaza](EXISTING_BACKUP_COVERAGE_AND_STAGING_RECOVERY_COMPLETION.md).

Dodatni inventory output u20:25 CEST potvrđuje freshness invocation u20:00 exit0,
isti production source hash i retained offsite/restore evidence; marker58629s<26h,
slobodno88658350080B. Nije rezultat pripremne skripte (nema preparation/setId/Storage
bajtova/dump mjere). Ne ponavlja se inventar; isti odobreni pripremni blok i njegov
sanitizovani PASS/STOP ostaju PENDING_OPERATOR_COMMAND_PREPARATION.

Pripremni operator rezultat sada je STOP/FileNotFoundError uB2 read-only fazi:
pauza nije zatražena, B2 upisi0, SMTP0, Telegram0, artefakti zadržani. Ne ponavljati
pripremu. Uska read-only provera utvrđuje prisustvo tri postojeće zaštićene datoteke
i putanju postojećeg restica (skripta trenutno fiksira/usr/bin/restic). Root cause
još nije potvrđen; nema instalacije, promjene prava/tajni ili production validatora.
PENDING_OPERATOR_COMMAND_PREPARATION_DEPENDENCIES; jedna odobrena pauza ostaje
neiskorištena. Bash poruke nakon STOP-a su zasebno kopiranje runbook objašnjenja u
terminal; naredni blok je direktan i bez okolnog dokumentacijskog teksta.

Dependency rezultat potvrđuje uzrok: /usr/bin/restic ne postoji, postojeći
/usr/local/bin/restic je root0755 executable; sva tri secret inputa root0600 i
production source hash nepromijenjeni. Ispravljena samo putanja klijenta u operatorskoj
skripti, bez instalacije/promjene prava/configa. Regresija prvo reproducirana, zatim
11/11 lokalnih testova PASS; pinned one-path transform i handoff fixture PASS.
PENDING_OPERATOR_COMMAND_REPAIR_EXISTING_RESTIC_AND_PREPARATION: nova privatna
verzionirana kopija čuva staru skriptu/artefakte, pa jednom nastavlja pogođenu pripremu.
Live ispravka/priprema i dalje čekaju operatorski output; pauza još neiskorištena.

Ispravljena priprema PASS za20261001T190516Z: staging ONLINE_UNPAUSED, odobreni
B2 prefix prazan/readable,5 Storage objekata6145B i measurement.dump584515B,
slobodno88657485824B; remote writes/email/Telegram0. Pauza nije potrošena i ovo
nije konzistentan recovery skup. Podaci odgovaraju dostupnim PDF-ovima/slikama;
četiri ARCHIVED DB reference moguće su već prihvaćeni exact cleanup3+1. Ne ponavlja
se cleanup: prije pauze provjeravaju se trenutne reference, byte checksums i tačna
povezanost sa tim accepted tombstones. Nepoznat missing/history objekt znači STOP.
PENDING_OPERATOR_COMMAND_REFERENCE_PREFLIGHT;19 lokalnih testova PASS. B2 snapshot,
writer-closed capture, izolovani restore i završno stanje clustera ostaju neizvedeni.

## Aktualizacija 2026-10-01 — podsjetnici i dostava: odobrena staging demonstracija završena

Implementirani su trial/pretplatni pragovi30/7/1/istek, VOLUNTARY javni rok, šest jezika,
provjereni primaoci, trajni outbox, lease/replay, ograničeni sigurni retry i DELIVERY_UNKNOWN.
Billing-only pregled/akcije imaju autorizaciju i audit. Lokalni/disposable dokazi:14 PostgreSQL,
18 app,5 entitlement,10 schema; TypeScript/lint/build PASS uz16 ranijih lint upozorenja.
Pogođene operatorske provjere:9 operator,6 scheduler i1 directory PASS.

Migracija/deploy i svih pet odobrenih staging koraka su potvrđeni: četiri SMTP prihvata,
korisnička potvrda po dvije poruke na obje adrese, replay bez novih slanja, dvije poruke
otkazane obnovom, VOLUNTARY HTTPS/podsjetnici i stvarni timer-triggered IDLE ciklus.
Scheduler nije promijenio campaign/outbox/attempt zapise niti dodao SMTP pozive.
Timer disabled/inactive, servis inactive/success, omogućene kampanje0, obje potrošene2/2.
Fixturei i povijest ostaju. Nema novog operatorskog bloka niti ponavljanja acceptancea.

Primatelji su ostali prodaja@zivic-elektro.com i zivic.darko79@gmail.com. Potvrda primitka
sačuvana je kao korisnički dokaz; DB receiptConfirmedAt nije upisan. Live Chrome pregled
delivery UI-ja PASS: desktop i širine 320/375/390/768/1024/1440, navigacija, čitljivi statusi
i samo očekivani fixture zapisi. Tenant billing prikazuje samo trenutačnu organizaciju;
negativni auth dokazi ostaju zasebni lokalni testovi/pregled koda. UI ispravke nisu potrebne.
Završni neovisni pregled nema neriješenih IMPORTANT/CRITICAL nalaza. Raniji nepovezani scopeovi ostaju.
Fault i concurrency scenariji dokazani su lokalno; nisu simulirani na live provideru.
[Završni izvještaj i granice dokaza](SUBSCRIPTION_REMINDERS_AND_DELIVERY_STAGING_ACCEPTANCE.md).
Odobren je točan pregledani commit `feat(subscriptions): add reminders and delivery tracking`.
Manifest obuhvaća cijeli skup osim vlastitog hasha; identitet commita očitava se iz Gita.
Bez pusha, novih emailova, produkcijskih promjena,
automatskog brisanja, stvarnih uplata ili backup/restore radova. Scheduler nije enforcement.

## Aktualizacija 2026-09-30 — prava, kvote i promjene paketa (staging dokazi i Safari UI ispravka potvrđeni)

Druga pretplatna cjelina ima source enforcement, jednokratni trial, zajedničke CSV/ručne
kvote, vremenske javne zaštite i izvršne upgrade/downgrade/zamjenske ponude. Zasebna
regulatorna ovlast upravlja VOLUNTARY/MANDATORY/UNRESOLVED klasifikacijom uz audit.
Lokalni disposable proof 12 PASS; odvojeno 48 aplikacijskih, 65 mutation regresija
te 18 testova pogođenih UI korekcijom. Završni source review PASS nakon ispravki.
Odobrene staging migracije, ACL, tri enrollmenta, regulatorni grant i deploy potvrđeni;
konačni build nakon Safari UI korekcije `W7mp9vBnQ9juQNqP9tnh6`. Sintetički servisni upgrade/downgrade i javni HTML
HTTPS scenariji PASS; trial create-limit/istek provjereni browserom i završnim DB inventarom.
Samo SIMULATED_PAYMENT; 7 novih perioda i 1 upgrade receipt, bez stvarnih uplata.
Chrome HR/DE mobilna emulacija PASS. Safari desktop jezik/odjava vizuelno PASS prema
korisnikovom screenshotu nakon ispravke native select prikaza; 22 pogođena testa,
TypeScript/lint i čist Webpack build PASS. Novi live PDF/image grace transport
i live konkurentni/CSV proof nisu izvršeni.
[Izvještaj, točni zadržani ID-jevi i odvojeni lokalni/live statusi](SUBSCRIPTION_ENTITLEMENTS_QUOTAS_AND_PLAN_CHANGES_STAGING.md).
Podsjetnici su treća cjelina; backup/retencijski preduslovi produkcije ostaju otvoreni.
Rollback je dokumentiran, live neizvršen. Bez commita/pusha ove cjeline i produkcijskih promjena.
Starije sekcije ispod opisuju tadašnji opseg.

## Aktualizacija 2026-09-30 — ručni komercijalni tok (source/local PASS; početna kupovina staging PASS)

Korisnik je potvrdio ugovor §§3–4 uz stroži downgrade: manji paket se ne aktivira
prije usklađenja kvota; arhiviranje/povlačenje ne oslobađa objavljeno mjesto.
Prva cjelina obuhvaća početnu kupovinu i obnovu istog paketa, vanjsku ponudu,
OWNER prihvat i zasebno ovlaštenu potvrdu uplate. Rana obnova čuva tekući period.
Globalni enforcement, upgrade/downgrade izvršenje, podsjetnici i public expiry ostaju
izvan ove cjeline; backup/retencijske nepoznanice ostaju preduslov produkcije.
[Izvještaj, potvrđeni testni identiteti i status dokaza](SUBSCRIPTION_MANUAL_COMMERCIAL_WORKFLOW_STAGING.md).
Source/local PASS: 28 aplikacijskih/UI/HTTP testova, 19 schema testova, disposable
PostgreSQL s 28 migracija i tri scenarija (uključujući setup regresiju), TypeScript/lint/build prolaze.
Build `2nLJShFD4kXdyT54nYC0Z`; neovisni pregled nakon ispravki nema blokirajućih nalaza.
Staging migracija/deploy/grant i sintetički OWNER → ponuda → prihvat → SIMULATED_PAYMENT tok PASS.
DB potvrđuje jedan zahtjev, jedan plaćeni period, jedan audit, ACTIVE i identičan snapshot ponude.
Desktop HR UI provjeren; ograničeni read-only HR/DE mobilni pregled u Chrome browser
emulaciji 390×844 PASS, bez UI ispravki. Fizički uređaj i puni šest-jezični live sweep
ostaju NOT_PROVEN. Završni objedinjeni skup ima 56 datoteka; commit odobren, bez pusha.
Obnova i konkurentni HTTP replay lokalno PASS, nisu zasebno izvršeni na stagingu.
Persistirani Subscription period ne osvježava se automatski na vremenskoj granici;
komercijalni read izvodi efektivni period iz nepromjenjive povijesti. Budući enforcement
mora koristiti taj resolver ili zasebno provjerenu reconciliaciju, ne sirovi stari period.

## Aktualizacija 2026-09-30 — komercijalni ugovor pretplata i obuhvat backupa

[Autoritativni ugovor i objedinjene potvrde](SUBSCRIPTION_COMMERCIAL_CONTRACT_AND_BACKUP_SCOPE_RECONCILIATION.md)
uskladio je postojeće Plan/Subscription modele s B2B uplatom po ponudi, ručnom
aktivacijom nakon provjere uplate i vanjskim Synesis računom. Paketi Start/Business/Pro
imaju 25/100/500 objavljenih proizvoda i periode 3/12 mjeseci; trial je tri proizvoda
na šest mjeseci. Nema Stripea/kartica ni izdavanja računa u Passveru.
Detalji triala, kvota, javne/privatne retencije i prijelaza staging organizacija
ostaju PROPOSED u jednom popisu od osam poslovnih potvrda; nisu implementirani.

Backblaze: dokumentiran PostgreSQL dump i povijesni B2 restore PASS (2026-08-18),
recovery runtime PASS iz završnog izvještaja 2026-08-24. Aktualni runtime, staging
obuhvat, backup konfiguracije i kopiranje/restore Supabase datoteka NOT_PROVEN.
CSV nije potpuni backup; automatsko trajno brisanje ostaje isključeno.

Nastavak nakon potvrde ugovora: (1) zahtjev/ponuda/ručna aktivacija i kontrolirani
staging prijelaz, (2) prava/trial/kvote i CSV konkurencija, (3) rokovi/podsjetnici i
ograničena recovery/retencijska spremnost. Ovaj korak mijenja samo dokumentaciju;
bez schema/service/data/infra promjena, testova/builda, commita/pusha ili deploya.
Stariji navodi o godišnjoj-only naplati i Stripeu ispod su povijesni, ne novi opseg.

## Aktualizacija 2026-09-29 — Platform Admin (funkcionalni staging PASS; UI deploy i vizualni acceptance PASS)

Zaseban `PlatformGrant` daje samo `PLATFORM_ORGANIZATIONS_READ`; tenant OWNER/ADMIN
ne dobiva platform ovlaštenje. Svaki server read provjerava grant, važeću sesiju i
verificirani auth identitet. Lista/pretraga/keyset paginacija i privatni billing detalj
koriste eksplicitne DTO-e i šest jezika. Tenant izolacija ostaje nepromijenjena.

Staging migracija i deploy su PASS: build `GYvXvPhAmXDRhwUj_u9nm`, 753 potvrđena
artefakta, anonimni pristup odbijen na šest jezika. Nakon ispravke pakiranja Prisma
compilera, eksplicitno odobreni grant je GRANTED: active=true, audit_delta=1,
memberships UNCHANGED. Runtime ima samo SELECT na PlatformGrant.

Autentificirani Chrome acceptance je PASS: prijava → Platform Admin → lista → pretraga
po prikaznom/pravnom nazivu → sintetički billing detalj → povratak → odjava.
Postojeći billing podaci uspoređeni su bez izmjene. Provjereno šest jezika, tipkovnica,
desktop 1280 px i mobilni prikaz 390 px; spremljene su čiste snimke.
Live višestranična paginacija i opoziv nisu ponavljani; ostaju lokalni PostgreSQL dokaz.
[Izvještaj, ograničenja i rollback](PLATFORM_ADMIN_ORGANIZATIONS_AND_BILLING_OVERVIEW_STAGING.md).

UI usklađivanje s dashboardom dovršeno: zajednički navy sidebar/mobilni dijalog,
header kontrole, katalog-tablica/mobilne kartice i odvojene read-only sekcije detalja.
Build `vwSSh_nI3c5X-dORRWq6S`, 758 artefakata, 28 UI testova PASS. Staging UI deploy je PASS;
četiri završne screenshot provjere su PASS. Lista/detalj na šest jezika, širine 320–1440 px,
pretraga/reset, mobilni fokus/Escape/navigacija i povratak u dashboard prolaze.
Funkcionalni PostgreSQL dokazi se ponovno koriste bez grant/audit mutacija.

Bez production promjena, commit/push ili izmjena billing profila, članstva i proizvoda.
Sljedeća cjelina: ugovor i implementacija ručnih godišnjih računa/pretplata;
njihova pravila nisu pretpostavljena. Svi raniji NOT_PROVEN statusi ostaju nepromijenjeni.

## Aktualizacija — billing profil (staging PASS; zasebna ikonica potvrđena)

Privatni profil firme za naplatu: aktivni OWNER/ADMIN, posebne permisije, jedan profil
po organizaciji, CAS i atomski audit. Bez promene prikaznog naziva ili proizvođača.
Ciljani testovi, disposable PostgreSQL sa runtime ACL-om, TypeScript, pogođeni lint i
build prolaze. Migracija i sintetički unos/reload/izmena/reload: PASS. Završni UI build
`kdteiRQIs5u_ZgM79J0WX` deployovan; sidebar ikonica i sr-Latn države potvrđene.
Šest jezika desktop, Tab/fokus i mobilna forma/meni na 390 px: PASS; mobilni dokaz
je browser emulacija. Scanner/producer/runtime konfiguracija nepromenjeni.
[Izveštaj i manifest](ORGANIZATION_BILLING_PROFILE_IMPLEMENTATION_AND_STAGING_ACCEPTANCE.md).
Korisnik je zatim tražio zasebnu ikonicu računa: lokalno proverena, build
`OD9e4NOtu9LlMjE_0U2Dz`; deploy i vizuelna provera ikonice PASS. Završni screenshot
je dodat u izveštaj. Prethodni screenshotovi
prikazuju raniju ikonicu i ostaju istorijski dokaz.
Budući račun dobija sopstveni snapshot. Računi/naplata/pretplate nisu implementirani.
Retencija sintetičkog profila i audita ostaje otvorena pre produkcije. Raniji NOT_PROVEN
statusi ostaju nepromenjeni, uključujući reboot acceptance. Bez commita/pusha.

## Aktualizacija 2026-09-23 — donut, DPP i header (staging PASS)

`DASHBOARD_DONUT_DPP_NAVIGATION_AND_UI_FINISHING_STAGING`: donut, autorizovana
paginirana lista trenutno objavljenih DPP-ova, cover thumbnail i header ikonice
implementirani. Lokalni ciljani testovi, disposable PostgreSQL, TypeScript, lint
(15 ranijih upozorenja) i build `kiXCpv3nqiz1u_K4f8Pbv` prolaze. Staging paket je
prenesen i checksum potvrđen. Prvi deploy je stao pre zamene artefakta zbog
preuskog uslova za aktivirani qpdf socket; read-only potvrđen je ispravan LISTEN
socket uz active/running servis. Ispravljen je samo privremeni deploy preflight,
bez restarta servisa ili promene builda. Operator je potvrdio v2 deploy PASS:
1134 artefakta, HTTPS/TLS 200/0, bez startup grešaka, konfiguracija i scanner/producer
nepromenjeni. Rollback je sačuvan. Computer Use je ponovo povezan: ograničeni UI
acceptance PASS — desktop donut/DPP/javni DPP/Back, šest jezika, mobilni prikaz
390 px, meni/Escape/Tab fokus i završna odjava. Četiri screenshot-a su sačuvana
bez Chrome ličnih podataka. Nulti skup i paginacija ostaju lokalni dokaz; nisu
kreirani novi staging podaci.
Nema promene scanner/producer/qpdf-a, migracija ni poslovnih podataka. Raniji
NOT_PROVEN statusi ostaju nepromenjeni; sledeća poslovna celina su podaci firme
za naplatu. [Izveštaj i granice dokaza](DASHBOARD_DONUT_DPP_NAVIGATION_AND_UI_FINISHING_STAGING.md).

## Aktualizacija 2026-09-23 — signature-health recovery A/B/C PASS

Pokušaj 03 je COMPLETE; reader je prihvatio tri zakazane objave 38169–38171
(initialna + naredne dve) i kasniju 38181. Producer recovery A/B = PASS.
Prethodna dva pokušaja su ROLLED_BACK, uz sačuvane baze/logove.
Privatni autentifikovani PDF upload → eksplicitni CLEAN scan → autorizovano
preuzimanje identičnih 750 bajtova C = PASS. Prilog je odvojen od testnog nacrta,
Document arhiviran i tačan storage objekat uklonjen postojećim cleanup tokom.
Audit je RETAINED; acceptance prozor CLOSED; sesija nije zadržana.
Staging malware-scanning readiness potvrđen je u ovom ograničenom toku.
Dashboard build qwLCXFTd9EEGdvqaB9SZS ostaje prihvaćen i nepromenjen.
Posle sledećeg restarta koristi se dokumentovani eksplicitni operator recovery;
automatski recovery nije uveden. Reboot i dugotrajni unattended kontinuitet ostaju
NOT_PROVEN, kao i raniji nepovezani NOT_PROVEN statusi. Nema commita/pusha.
[Recovery izveštaj i operatorska instrukcija](DOCUMENT_SIGNATURE_HEALTH_POST_RESTART_RECOVERY.md).
Stariji odeljci ispod zadržavaju istorijske statuse u trenutku njihovog acceptancea.

## Aktualizacija 2026-09-23 — korisnički sidebar i pregled

`CUSTOMER_DASHBOARD_SIDEBAR_AND_OVERVIEW_STAGING`: zajednički sidebar i autorizovani
pregled celog kataloga implementirani; lokalni testovi/build i zaseban PostgreSQL
dokaz PASS. Staging build `qwLCXFTd9EEGdvqaB9SZS` deployovan; ograničeni UI
acceptance i nezavisno read-only poređenje 9/5/5 PASS. Postojeća sesija, desktop
sidebar, katalog/editor, refresh/Back, mobilni meni i šest jezika provereni.
Producer recovery = BLOCKED; malware scanning operational readiness = NOT_READY.
Jedno health-reader odbijanje potvrđuje fail-closed zaštitu za trenutno stanje.
Startup servis je aktivan/uključen; reboot acceptance = NOT_PROVEN.

Sledeći zadatak: dokumentovana i implementirana procedura oporavka signature-health
poverenja posle restarta, sa sačuvanim bazama i istorijom. Ne započinje se u ovom koraku.
[Definicije brojeva i izveštaj](CUSTOMER_DASHBOARD_SIDEBAR_AND_OVERVIEW_STAGING.md).
Raniji nepovezani NOT_PROVEN statusi ostaju nepromenjeni.

## Aktualizacija 2026-09-23 — product editor UI polish

`PRODUCT_EDITOR_UI_POLISH_STAGING`: lokalni UI diff/build i ograničeni staging
acceptance završeni. Build `U97P6q7YqVzFHSNqoWAT9`; jedno čuvanje namenskog
nacrta i reload potvrđeni, proizvod ostaje neobjavljen. Ikonice, mirne pozadine,
jasnije sekcije i mobilno prelamanje, bez promene poslovnog ponašanja. Dashboard
postoji sa gornjom navigacijom; sidebar nije prisutan i nije dodat. Raniji
NOT_PROVEN statusi ostaju nepromenjeni. Detalji i izdvojeni raniji testni nalazi:
[izveštaj](PRODUCT_EDITOR_UI_POLISH_STAGING.md).

## Aktualizacija 2026-09-22 — kontrolirani Early Access

`CONTROLLED_EARLY_ACCESS_ONBOARDING_STAGING`: source COMPLETE, staging NOT_PROVEN.
Baza izvornog koda `2cb9d6ec55a48a7efdc55c48e79c18a4202dd744`; diff nije commitovan.
Implementirani su lokalizirana javna forma, minimalna evidencija zahtjeva, operator CLI
pregled/odobrenje/odbijanje, atomski postojeći provisioning i kontrolirana dostava aktivacije.
Lokalni auth testovi i disposable PostgreSQL dokazuju idempotentnost i verified organization
context; stvarni staging email/aktivacija/prijava još nisu izvedeni. Nema otvorenog signup-a,
Platform Admina, billing implementacije ni production promjena.

Detalji, dokazi, retencija i rollout/rollback:
[CONTROLLED_EARLY_ACCESS_ONBOARDING_STAGING](CONTROLLED_EARLY_ACCESS_ONBOARDING_STAGING.md).
Operator preflight je potvrdio staging build `bO73SDxjxPBddEzd4Q2nd`, bazu na portu
5433 i urednu povijest migracija. Pregledani staging paket je pripremljen; sljedeći
migracija `20260922120000_controlled_access_requests` sada je operator-potvrđeni PASS
(0 zahtjeva, postojeći podaci/ACL nepromijenjeni, Prisma UP_TO_DATE). Sljedeći
aplikacijski deploy je također operator-potvrđeni PASS: build
`GSumULnTFFOyxN9Mn6MiK`, 1122 provjerena artefakta, bez startup grešaka.
Sljedeći korak je jedan stvarni onboarding tok na korisnički odobrenoj testnoj adresi. Nakon onboardinga slijede podaci
firme za billing, potom Platform Admin i ručno upravljanje godišnjim pretplatama.
Donji pregled je raniji checkpoint i nije zamjena za ovu aktualizaciju.


Pregled: **2026-09-17**. Source: **`24c07b113d1efa91c284ea8a1868bd625bd2c9e9`**, branch `main`.
Radno stablo i index bili su čisti pre ovog dokumentacionog pregleda. Lokalni
`origin/main` pokazuje isti commit; remote nije kontaktiran. Korisnik navodi da je
push završen. Ovaj dokument ažurira postojeći centralni implementation roadmap;
stariji `ROADMAP.md` ostaje grubi plan, a ne dokaz završenosti.

## Kako čitati stanje

Source, lokalne provere, staging acceptance i unos stvarnih poslovnih podataka
odvojeni su nivoi dokaza. Model u bazi nije završena korisnička funkcionalnost.
Pregled koristi postojeći kod, commitove i sačuvane izveštaje; nije pokrenuo test,
build, live proveru niti pristupio VPS-u, bazi ili storage-u.

**Važna praznina:** završni izveštaj `DOCUMENT_REAL_DATA_STAGING_USER_ACCEPTANCE`
nije pronađen u dostupnim repo dokumentima i lokalnim acceptance artefaktima.
Završetak tog zadatka navodi korisnik, ali njegovi konkretni scenariji, rezultati,
retencija podataka i eventualni nalazi ovde nisu potvrđeni. Ne zamenjujemo ih
ranijim sintetičkim UI testom. Naknadno dostupan izveštaj može dopuniti ovaj pregled;
njegovo odsustvo ne blokira sledeći zadatak niti zahteva novi test.

## Implementirane celine i dokaz

| Celina | Source i lokalni dokaz | Staging / stvarni unos / preostalo |
|---|---|---|
| Aplikacijska i infrastrukturna osnova | Next.js, TypeScript, Prisma/PostgreSQL, šest jezika; odvojeni aplikacijski servisi i persistence. Arhitektura baze ima odobren freeze. | Ranije postavljena staging i production infrastruktura postoji. To nije odobrenje aktivacije novih funkcija u produkciji. Aktuelno live stanje nije ponovo proveravano. |
| Auth, tenant, dozvole, audit | Better Auth, kontrolisana aktivacija/provisioning, sesije, izbor organizacije, server-side context i permission resolution, transakcijska revalidacija i audit. Lokalni testovi postoje. | Realna sesija i PRODUCT_EDIT potvrđeni u staging PDF toku. Kompletan onboarding, upravljanje timom i Platform Admin nisu time završeni. |
| Product list/detail, create/edit | Zaštićena lista/detail, kreiranje i uređivanje nacrta; cursor paginacija po 25. Servisi i testovi implementirani. | Noviji stvarni poslovni unos: završni report nedostaje. Pretraga i dokaz rada sa velikim katalogom nisu izvedeni iz paginacije. |
| Prevodi, materijali, CN | Upravljanje draft prevodima, materijalima i CN klasifikacijom; šest UI jezika; lokalni testovi. | Source završenih sliceova postoji; konkretan obuhvat najnovijeg real-data acceptancea nepoznat. |
| Draft/published lifecycle | Publish, published snapshot, novi privatni draft iz objavljene verzije i ponovno objavljivanje; CAS i tranzicije u servisima/testovima. | Nova poslovna provera nije dostupna. Arhiviranje/brisanje objavljenog Product-a ne smatra se implementiranim zbog lifecycle enum-a. |
| Public DPP, Passport/QR | Javni DTO sa allowlistom, lokalizovani objavljeni sadržaj, materijali/CN; stabilan passport/public code i QR artefakti. | Ranija istorijska staging provera Product/QR je zaseban dokaz; nije novi real-data rezultat. Javni podobni PDF prilozi aktuelne objavljene verzije sada su implementirani i staging-provereni; slike ostaju otvorene. |
| Privatni PDF i veze sa verzijama | Privatni upload/finalizacija, vezivanje/uklanjanje priloga na draftu i očuvanje veza pri verzionisanju; integracioni testovi. | Sintetički upload i uklanjanje priloga na stvarnom staging proizvodu potvrđeni. AVAILABLE sam po sebi ne znači CLEAN. |
| PDF, malware, signature health | qpdf struktura, ClamAV Unix adapter, policy 2 opažena provenijencija, producer/reader, claim/finalization i audit. | Stvarni staging CLEAN i INFECTED potvrđeni; postoje bootstrap/producer dokazi. Bez tvrdnje o tačnoj engine generaciji skena ili novoj runtime izolaciji. |
| Scan/status/privatni download | Eksplicitni scan, ograničeno status polling osvežavanje i server-side kontrola preuzimanja; lokalni auth/integrity/freshness testovi. | Realni staging UI i transport prošli sintetički tok: neproveren odbijen, CLEAN bajtovi podudarni, INFECTED i anoniman download odbijeni. |
| Recovery | Eksplicitni expired-PENDING recovery, bez automatskog rescana; lokalni/disposable testovi idempotentnosti i stale finalizacije. | Live recovery ostaje NOT_PROVEN. |

Reference: [freeze](DATABASE_ARCHITECTURE_FREEZE_v1.0.md),
[auth](AUTHORIZATION_AND_ORGANIZATION_CONTEXT.md),
[draft lifecycle](CREATE_DRAFT_FROM_PUBLISHED_PRODUCT.md),
[prilozi](PRODUCT_DOCUMENT_VERSION_ATTACHMENT.md),
[malware ugovor i staging UI dokaz](DOCUMENT_MALWARE_SCAN_SCHEMA_AND_CONTRACT.md#staging-ui-evidence--2026-09-16).
Source: `src/application/products/`, `src/application/documents/`,
`src/application/public-dpp/contracts.ts`, `src/infrastructure/auth/`.

### Poslednji dostupni konkretni acceptance

Commit `24c07b1` beleži staging build `kIl3Su-7vHXfxCxqtj8Hj` i sintetički run
`80365265-5090-4d8e-88c5-327897caed67`: čist PDF upload → UNSCANNED → eksplicitni
scan → CLEAN → autorizovano identično preuzimanje; ispravljeni EICAR PDF → INFECTED
→ direktni download odbijen. Prvobitni B fixture nije bio validan antivirus test
i njegov CLEAN nije antivirus PASS. Neispravan PDF odbijen je pri uploadu, bez
Document/receipt zapisa; poruka korisniku bila je generička. Nedostupna zavisnost,
cross-tenant i recovery pokriveni su lokalno, ne predstavljeni kao live scenariji.

Sva tri testna Document-a arhivirana su pre uklanjanja njihovih storage objekata;
prilozi uklonjeni, audit zadržan, acceptance prozor zatvoren. To nije potvrda
cleanupa eventualnog kasnijeg real-data zadatka. Postojeći lokalni pregled ima
50 fokusiranih, 35 presentation/locale, 3 boundary i 67 disposable PostgreSQL
provera, TypeScript/build PASS, lint bez grešaka uz 15 postojećih upozorenja;
dodatno broker protokol/setup 15+2 testa. Ništa nije ponavljano u ovom pregledu.
Lokalni dokaz: `/private/tmp/passvero-upload-scan-final-reviewed.json` i
`/private/tmp/passvero-upload-scan-staging-527c832/ui-evidence.json` (privremene
lokalne putanje, nisu trajni repo izvori).

## Preostale funkcionalnosti i preporučeni redosled

Ovo je preporuka za zasebno odobravane sliceove, ne nalog za implementaciju.

| Redosled / stvarno stanje | Konkretan korisnički ishod i zavisnost |
|---|---|
| Završeno na stagingu: Public DPP dokumenti | Javni CLEAN PDF prikaz i identični bajtovi potvrđeni; privatni/nacrtni i stari link posle nove objave odbijeni. Produkcija nije aktivirana. |
| 2. Economic Operator / Manufacturer — nema zasebnog korisničkog toka | Proizvod ima odgovornog proizvođača/operatora, odvojenog od tenant i billing identiteta; prethodi širenju javnog identiteta proizvoda. |
| 3. GTIN / GS1 / barcode — generički identifier model/GTIN enum nisu gotov tok | Korisnik unosi i proverava identifikator i koristi dogovoreni barcode prikaz; ne tvrditi GS1 verifikaciju bez odgovarajućeg izvora. |
| 4. **Slika proizvoda** — ProductImage model postoji, upload/prikaz tok nije završen | Korisnik dodaje sliku; draft izmene ne menjaju objavljenu sliku, a asset/version veze ostaju očuvane pri novoj verziji i objavi. |
| 5. Pretraga / veći katalog — samo cursor lista postoji | Korisnik brzo pronalazi proizvod po dogovorenim poljima uz stabilnu paginaciju i proverene granice upita. |
| 6. **CSV export** — nema implementiranog toka | Korisnik izvozi autorizovani katalog u dokumentovanom formatu pogodnom za Excel; format služi kao osnova importa. |
| 7. **CSV import** — nema implementiranog toka | Excel-origin podaci kroz CSV: mapiranje kolona, preview, validacija, duplikati i razumljiv izveštaj po redu. Nativni XLSX nije automatski odobren; Redis/nova infrastruktura se ne podrazumeva. |
| 8. Kontrolisani Early Access onboarding — operator provisioning je samo osnova | Odobren korisnik prolazi aktivaciju i uspostavljanje odgovarajuće organizacije/članstva bez otvorenog javnog signup-a. Pre Platform Admin-a. |
| 9. Podaci firme za billing — polja/modeli nisu gotov tok | Ovlašćeni korisnik održava podatke za fakturisanje, nezavisno od javnog proizvođača. |
| 10. Platform Admin — nema zasebnog završenog interfejsa | Operator platforme kontrolisano upravlja Early Access nalozima i operativnim statusima; tenant admin nije platform admin. |
| 11. Godišnje fakture/pretplate/rokovi — Plan/Subscription osnova postoji | Ovlašćeni operator ručno evidentira fakturu, period i rok uz audit. Stripe, checkout i automatska naplata dolaze kasnije. |
| Backlog: arhiviranje/brisanje objavljenih proizvoda | Definisati bezbedno povlačenje, očuvanje istorije i ponašanje stabilnog QR-a; ne izjednačiti sa povlačenjem publikacije. |
| Marketing — postoje stranice, usklađenost tek pregledati | Posetilac vidi samo stvarno dostupne funkcije; usklađivati tvrdnje uz svaki završeni slice i pre Early Access poziva. |

Analytics, konektori i šire integracije iz starog plana ostaju kasniji backlog;
schema ih ne čini završenim. Zadržan je raniji redosled, bez novih arhitektonskih
projekata. Završni real-data report može opravdati konkretnu promenu prioriteta.

## Operativna ograničenja za buduću produkciju

| Nedokazano / ograničeno | Posledica |
|---|---|
| Live expired-PENDING recovery — NOT_PROVEN | Lokalni dokaz nije live recovery acceptance. |
| Novi broker→parser handoff — NOT_PROVEN | Uspešan PDF rezultat nije neposredan dokaz executable/UID/AppArmor/cgroup novog deteta; prihvaćeni artefakti i istorijska izolacija ostaju odvojeni. |
| Freshclam restart, rotacija ili izgubljena inicijalna istorija | Kontinuitet poverenja nije automatski očuvan; fail-closed i kontrolisano ponovno uspostavljanje, bez spajanja logova ili automatskog bootstrap-a. |
| Policy 2 opažena provenijencija | Ne dokazuje tačnu engine generaciju svakog skena niti sve neopažene same-version promene. |
| Automatsko alarmiranje / dugoročni nenadzirani rad — NOT_PROVEN | Aktivan timer i kratki uspešni ciklusi nisu dokaz trajne operativne spremnosti. |
| Ograničeni malware potpisi / ranije acceptance granice | Staging allowlist je ograničen na dva EICAR identifikatora; nepoznate detekcije odbijaju pristup. Raniji ClamAV PDF FAIL i limit/queue/reload/build NOT_PROVEN nisu preimenovani u PASS. |

Ova ograničenja ne poništavaju potvrđeni staging UI tok. Razvoj i realni unos ostaju
na stagingu. **Nema production aktivacije dok aplikacija nije završena i proverena;
rollout zahteva zasebno odobrenje.** Ranija production infrastruktura postoji.

## Tada preporučeni sledeći zadatak (istorijski)

**Economic Operator / Manufacturer** — zasebno odobriti minimalan korisnički tok
odgovornog proizvođača/operatora, odvojen od tenant i billing identiteta. Ne započinje
se u ovom zadatku. Slika proizvoda i CSV export/import ostaju u planu.

Korisnik je potvrdio završetak real-data zadatka. Detaljni završni izveštaj nije
dostupan u pregledanim izvorima, pa konkretni scenariji ostaju nepotvrđeni ovim
dokumentom. Ako postojeći izveštaj naknadno postane dostupan, uključiti njegove
nalaze. Njegovo odsustvo samo po sebi ne zahteva ponovno testiranje niti blokira
sledeći zadatak; konkretan korisnički prijavljen problem rešava se prema svom
uticaju.

## Dopuna: Public DPP PDF staging acceptance — 2026-09-17

Prethodni pregled iznad ostaje istorijski kontekst. Ova dopuna beleži novu lokalnu
implementaciju i live staging proveru na bazi `7a24d9b0e0c5f84ff032b341da2fd71153115715`
sa necommitovanim pregledanim diffom. Završni build: `wA5ayzKlxxjctjVWwKVhc`.

Namenski proizvod `DPP-PDF-20260917-01` prošao je UI upload, jedan eksplicitni scan,
objavu v1 i prikaz u anonimnom browseru. Kontrolisani endpoint isporučio je tačnih
629 bajtova čistog PDF-a (SHA-256 i direktno poređenje identični). Privatan nacrt
vratio je 404; v2 bez priloga uklonila je javni prikaz i stari link vraća 404.
Cross-tenant/nepovezani i nepodobni scan statusi dokazani su lokalno/disposable,
ne novim live antivirus testovima. Retencija je eksplicitna: označen sintetički
proizvod, istorija v1/v2, privatni PDF i audit ostaju; PVA-001 nije menjan.

Lokalno: 40 fokusiranih, 29 disposable PostgreSQL, TypeScript, lint bez grešaka
(15 postojećih upozorenja), whitespace i webpack PASS. Posle korekcije zastarele
poruke u šest jezika: 41 relevantnih presentation testova i novi build PASS;
prikaz poruke i prazan anonimni DPP potvrđeni na završnom buildu. Nije ponovljena
nepromenjena infra acceptance serija. Production i svi raniji NOT_PROVEN statusi
ostaju nepromenjeni. Detalji: malware ugovor, odeljak Public DPP staging evidence.

## Dopuna: Manufacturer — staging tok završen (2026-09-17)

Tenant adresar EconomicOperator i eksplicitni ProductVersion manufacturer
snapshot implementirani su i prihvaćeni na staging buildu `SG9637exSQVmIY3ePYVb2`
(baza `880b34501b96830c8d94df601d654949a0512842` plus pregledani diff).
Aditivna migracija i stvarni UI create/select/apply/publish tok prošli su.
Anonimna v1 sa Zagrebom ostala je nepromenjena posle izmene adresara na Split;
novi draft nasledio je stari snapshot, pa je eksplicitno osvežen i objavljen kao
v2 sa Splitom na istom javnom linku. Read-only staging SQL potvrđuje očuvanu v1.
Sintetički `DPP-MFR-20260917-01`, operator, obe verzije i audit namerno ostaju.

Lokalno: 56 fokusiranih i 18 disposable PostgreSQL testova, TypeScript, lint,
whitespace i webpack PASS; dve stare statičke assertion greške reprodukovane su
na čistoj bazi i nisu nov regresijski nalaz. Cross-tenant/CAS dokazi su lokalni.
Detalji i rollback: `codex/MANUFACTURER_IMPLEMENTATION.md`.

Sledeći predlog je zasebno odobren GTIN/GS1 opseg. Slika proizvoda, pretraga i CSV
export/import ostaju u roadmapu; ništa od toga nije započeto. Aplikacijski
signature allowlist ostaje ograničen; svi raniji NOT_PROVEN statusi ostaju.
Production aktivacija nije odobrena. Diff ostaje necommitovan.

## Dopuna: GTIN/barcode — staging tok prihvaćen (2026-09-20)

Na bazi `97199377c07dbe6eff4d2584d6c3be89cdcc9981` implementiran je jedan opcionalni
GTIN po ProductVersion: draft SET/REMOVE, server validacija, CAS/audit, parcijalni
unique indeks samo za GTIN i Public DPP barcode u šest jezika. Migracija staje na
postojećim višestrukim GTIN zapisima bez brisanja. Lokalni PostgreSQL dokaz čuva
objavljenu V1 pri izmeni/objavi V2; nezavisni softverski dekoder čita sve četiri
simbologije. Staging migracija i deploy `wgtuXd933MYwDwiVUjVt4` su PASS.
UI unos, odbijanje neispravnog broja, nasleđivanje, izolacija V1 i objava V2
na istom javnom linku su PASS. Anonimni V1/V2 barkodovi nezavisno dekodirani.
Sintetički proizvod `DPP-GTIN-20260920-01`, obe verzije i audit su zadržani.
Nema GS1 registry verifikacije, fizičkog skeniranja, production promene ili commita/pusha.
Detalji: `PRODUCT_GTIN_VALIDATION_AND_BARCODE_STAGING.md`.
Sledeća celina je slika proizvoda; pretraga,
CSV export i CSV import ostaju u planu i nisu započeti.

## Product image staging work (2026-09-20)

GTIN base `b223b109111f62e5f86ca720b887095ac42b2348` is clean and confirmed.
Main JPEG/PNG upload, immutable assets and version associations, draft/private and
current-public delivery are implemented and locally verified. Operator-reported
staging migration/deployment passed for build `uXHDuXfdNBCLINFdIWQ0m`.
Minimal staging runtime grants resolved the first upload failure. Live A/V1 ->
inherited draft/B -> V2 and invalid upload checks passed. Final historical
asset/reference read-only proof passed: V1/A and V2/B bytes verified, zero
unreferenced assets, two image-set audits. Image staging acceptance is complete.
See PRODUCT_IMAGE_UPLOAD_VERSIONING_AND_PUBLIC_DPP_STAGING.md.
After this slice: product search, CSV export, CSV import; none started here.

## Product catalog search (2026-09-21)

Existing server-side product list now supports literal name/SKU substrings and
whole equivalent GTINs in current draft/published versions, with tenant isolation
and query-bound cursor pagination. Local 5000-product pilot query review passed;
no migration/index required. Staging UI name/SKU/GTIN, no-results/reset and
refresh/back/detail acceptance passed on build `F1RgM647Gr7wlY2TCJpsT`. Live
pagination was not exercised (five products); local three-page integration passed.
See PRODUCT_CATALOG_SEARCH_STAGING.md. Next: CSV export, then CSV import with
preview/validation/duplicates; neither started here.

## Product catalog CSV export (2026-09-21)

CSV v1 source complete from `7af8874c1f38f911938af7b55fe7b39c3a158655`:
read-only whole-catalog/all-search-results export with tenant scope, one current
draft-or-published version per product, snapshot manufacturer and string identifiers.
Local disposable 5,000-product proof passed; local evidence is not live acceptance.
Staging build `1jeAIT6a93SlibJBd8Wm0` deployed and accepted: real UI full export
(5 products), filtered export (1), empty header-only export and anonymous 403 PASS.
All-pages/5,000-product and special-value proofs remain local, not live load evidence.
Spreadsheet UI NOT_PERFORMED. No migration, data mutation or production changes.
See `PRODUCT_CATALOG_CSV_EXPORT_STAGING.md` for column contract, limits, spreadsheet
protection and round-trip limitations. Next: separately authorized CSV import with
mapping, preview, validation and duplicates; no import implementation in this slice.

## Product catalog CSV import (2026-09-21)

Create-only mapping/preview/validation/explicit selection and resumable 25-row
execution implemented from `33adf1cfbc443ad2980df13ead995a27ea00feb5`. Existing
CreateProduct/GTIN/CN services share one transaction per row with audit and receipt.
Local 5,000-row, concurrency/replay, tenant/auth, rollback and cancel proofs PASS;
staging migration/deploy/UI acceptance PASS. Build `bO73SDxjxPBddEzd4Q2nd`.
Live five-row preview wrote nothing; explicit three-row selection created three
HR drafts, two invalid/conflicting rows excluded. Replayed batch kept same IDs
and eight catalog products. Three synthetic drafts/receipts/audits retained; raw
test CSV removed. Large-scale/concurrency/rollback/auth evidence remains local.
Additive receipt tables retain hashes/outcomes, never raw CSV. Apostrophes preserved;
not a full export round-trip (no manufacturer/translations/materials/images/PDF/history).
See PRODUCT_CATALOG_CSV_IMPORT_STAGING.md. No commit/push or production changes.
Controlled onboarding and later features remain separate, unstarted work.

## Controlled early access onboarding (2026-09-22)

Source complete; staging form, explicit approval, email receipt, activation and login
PASS from operator output and user confirmation. Repeated approval returns
ALREADY_APPROVED/SENT with one delivery attempt and retained outcome references.
The user also confirmed the expected authenticated organization display and product
creation availability. CONTROLLED_EARLY_ACCESS_ONBOARDING_STAGING is complete.

Staging build `GSumULnTFFOyxN9Mn6MiK` plus CLI patch
`caac6bbc4fe5604c23837527c65aff1e35717580d7c079f7002f08406c87eda5`.
IPC inheritance and INSERT-only provisioning fixes are installed and verified. Local
PostgreSQL 10/10, focused tests 53/53, TypeScript and targeted lint PASS. Existing ACLs
preserved. Test identities/organization/audit are deliberately retained; see
`CONTROLLED_EARLY_ACCESS_ONBOARDING_STAGING.md` for IDs and evidence limits.

No public self-service signup, Platform Admin, billing, production changes or commit/push.
Retention duration remains a pre-production decision. Next product phases remain billing
company details, then Platform Admin and manual annual subscriptions; not started here.


## SUBSCRIPTION_REMINDERS_FUTURE_ORGANIZATION_ENROLLMENT — 2026-10-08

Business policy confirmed; local implementation and focused PostgreSQL proof complete.
Controlled trial enrollment is atomic, scheduled reconciliation follows authoritative
paid periods, and managed sending preserves exclusions, recipient verification,
finite budgets and DELIVERY_UNKNOWN. Existing trial campaign limit 12 is retained;
new periods use 384 attempts / 32 deduplicated recipients and end+7 calendar days.
See [implementation and evidence](SUBSCRIPTION_REMINDERS_FUTURE_ORGANIZATION_ENROLLMENT.md).
Staging migration/deploy and fresh scope evidence: PENDING_OPERATOR_COMMAND.
Enable/new live identities/periods/recipients or sending require the exact combined
projection and user confirmation. No production change, commit or push.


- 2026-10-08 future reminder enrollment: corrected read-only operator preflight
  PASS (acceptance DB 5433, 32 migrations, 839 canonical artifacts); existing
  Milank campaign retains 12/0 and original deadline. Pinned additive migration
  and deploy/rollback package prepared; 6 local operator guard/rollback tests PASS.
  Staging migration/deploy PENDING_OPERATOR_COMMAND; enrollment enable and exact
  recipient/acceptance proposal remain separately unapproved. No SMTP execution.

- Returned 2026-10-08 enrollment migration/deploy PASS: build mMVPOjFPkw5L42RIqziS4,
  33 migrations/839 artifacts; policy disabled, enrollments 0, managed campaigns 0,
  Milank 12/0. Existing timer restored, installer SMTP 0. Combined enable/recipient
  and ordinary worker idle/replay projection prepared; awaiting user confirmation.

- 2026-10-08 user explicitly approved complete future reminder enrollment/recipient
  rule and future due delivery. Guarded one-shot enable plus two ordinary timer
  idle cycles PENDING_OPERATOR_COMMAND. Current Milank 12/0 retained; no extra
  live activation, identity/period, SMTP-forcing or commercial writes. Successful
  acceptance leaves policy/timer enabled. Four local operator guard tests PASS.

- **SUBSCRIPTION_REMINDERS_FUTURE_ORGANIZATION_ENROLLMENT — accepted staging scope,
  2026-10-08:** enable boundary 2026-10-08T15:22:24.818Z; one EXISTING_APPROVED
  enrollment, legacy current-trial campaign linked without duplicate 384-budget
  campaign; Milank unchanged 12/0. Two ordinary timer invocations COMPLETED with
  zero outbox/SMTP attempt delta, original exclusions (13) and counters retained.
  Policy/timer remain enabled. Future verified OWNER/confirmed billing recipient
  rule and due subscription delivery explicitly approved; operators empty and
  PUBLIC_AVAILABILITY disabled. New controlled activation proved locally, not
  performed live. Final evidence/manifest in codex/evidence/reminder-future-enrollment.
  No further acceptance action pending in this approved scope; no production,
  commercial writes, new live identity/period, commit/push or inbox claim.


### STAGING_RECURRING_DB_STORAGE_BACKUP_AND_MONITORING — 2026-10-12 checkpoint

A PASS: two real scheduled 11/12 October offsite sets, resume/monitor evidence accepted.
B STOP at exact schema-equivalence gate; downloaded bytes valid, independent closure
STOPPED/PRIVATE_0700, no private processes. Eight constraint/six relation shape diffs
reviewed; effective ACL and remaining DB/application checks NOT_PROVEN. One explicitly
approved exact-three-pair continuation of existing cluster prepared locally (10 focused
regressions PASS), PENDING_OPERATOR_COMMAND; no second download/initdb/pg_restore/reset.
C/D NOT_RUN; CONTINUOUS promotion pending, COMPLETE=NO.
See [current report](EXISTING_BACKUP_COVERAGE_AND_STAGING_RECOVERY_COMPLETION.md).
Marketing deploy deferred until separately approved release-pin alignment; legal/marketing
diffs, production, backup release pins and existing disable/rollback remain unchanged.


### 2026-10-12 — recurring B continuation returned PASS

Supersedes prior B STOP/pending checkpoint: A and B PASS. Existing latest cluster
continuation passed effective ACL/DB/Storage/application checks and independent
STOPPED/PRIVATE_0700/staging/writer closure; pins/state unchanged. Full web/auth/scanner
recovery remains NOT_TESTED; Storage provider restore NOT_PERFORMED.
C/D and CONTINUOUS promotion NOT_RUN, COMPLETE=NO. Resolve only the literal
`forget --dry-run` vs earlier “bez forget/prune” boundary before existing C.
No new capture/restore series; marketing deploy and release-pin alignment remain deferred.


### 2026-10-12 — recurring C PASS; D/finalize pending

Supersedes prior C clarification/pending checkpoint: A–C PASS. Exact staging
14/8/6 retention dry-run kept all 3 snapshots, zero deletion/production candidates
and unchanged inventory. One D/no-Telegram plus conditional guarded CONTINUOUS
promotion PENDING_OPERATOR_COMMAND. COMPLETE=NO until returned final output.
No new acceptance series or release-pin/marketing/production changes.


## 2026-10-12 — staging recurring backup slice COMPLETE

A–D returned PASS; regular CONTINUOUS schedule promoted, hold=false, attempts=2,
backup/monitor active/enabled. Next capture 13.10 04:30UTC/06:30CEST; last monitor
HEALTHY 12.10 15:20UTC/17:20CEST. Latest set private restore continuation and
independent STOPPED/PRIVATE_0700/staging/writer closure accepted. C dry-run kept
3 snapshots with zero deletion/production candidates; D classification/dedup PASS
without Telegram test, provider/inbox NOT_PROVEN. Full web/auth/scanner recovery
NOT_TESTED, Storage provider restore NOT_PERFORMED.
Exact IDs, limits and retained non-executed disable/rollback are in
[current report](EXISTING_BACKUP_COVERAGE_AND_STAGING_RECOVERY_COMPLETION.md#staging_recurring_db_storage_backup_and_monitoring--complete-2026-10-12)
and [final output](evidence/backup-recovery/operator-recurring-d-finalize-pass-20261012.json).
No repeated acceptance/tests, source/release pin/production changes, commit or push.
Marketing deploy remains deferred until separately approved release-pin alignment;
legal/marketing diffs retained. This completes only the approved recurring backup
slice and does not declare all production readiness or authorize deployment.

## MARKETING_STAGING_DEPLOY_AND_EXACT_BACKUP_PIN_ALIGNMENT_RESUME — 2026-10-12

Reviewed 12-file source and complete 754-file archive/build `853RYrj-r5cyoSGuJudap`
verified unchanged; no rebuild/test repetition. Backup A–D COMPLETE remains accepted.
Minimal coordinated staging deploy/two-key exact pin alignment is user-authorized.
One fresh read-only operator preflight PENDING_OPERATOR_COMMAND to derive exact
canonical/config candidate hashes and confirm idle capture/restore/current schedule.
[Concrete sequence and paired application/pin rollback](PUBLIC_PRICING_AND_MARKETING_CONTRACT_ALIGNMENT_STAGING.md#marketing_staging_deploy_and_exact_backup_pin_alignment_resume--2026-10-12).
No deploy/pin/timer/runtime mutation yet; six Legal namespaces unchanged and internal
legal/privacy draft excluded from executable package. No production, sending,
backup acceptance replay, deletion, commit or push.


### Marketing resume — preflight dependency STOP

Initial package/lock identity comparison returned STOP before deployment/pins/timer
changes. Historical staging package hashes differ from local build input hashes;
core package metadata matched historical local inputs. One bounded read-only
runtime dependency/lock comparison PENDING_OPERATOR_COMMAND; no deploy retry,
rebuild or backup acceptance repeat. [Current diagnosis](PUBLIC_PRICING_AND_MARKETING_CONTRACT_ALIGNMENT_STAGING.md#returned-preflight-stop--dependency-identity-comparison).


### Marketing resume — dependency baseline reconciled

Returned package/lock matches accepted staging baseline; fifteen installed runtime
metadata pins match local build. Only bwip-js/csv-parse are separately absent, both
bundled in the exact reviewed archive with no external runtime traces/imports.
Minimal preflight guard delta statically verified; no dependency install/new build.
Read-only v2 release/pin derivation PENDING_OPERATOR_COMMAND; deploy not executed,
backup A–D/pins/automation and legal draft preserved.


### Marketing resume — exact candidates PASS; coordinated deploy pending

Returned preflight confirms new canonical `b2a5866a…` and two-key config `c93266b5…`,
unchanged deployed Legal namespaces and CONTINUOUS backup baseline. One bounded
application/exact-pin swap with independent paired rollback/timer closure prepared;
4 new-helper synthetic closure checks PASS, no accepted test/build replay.
[Deploy and retained rollback](PUBLIC_PRICING_AND_MARKETING_CONTRACT_ALIGNMENT_STAGING.md#exact-candidate-accepted--one-deploypaired-close-handoff)
PENDING_OPERATOR_COMMAND. Reminder observed activating: wait naturally up to60s,
then require idle without stopping writer. Backup A–D and legal draft preserved.


### Marketing resume — protective near-term STOP, no coordination

Next timer term <=15min caused STOP before attempt/timer/application/pin changes;
independent closure NOT_STARTED/timerChanges NONE, rollback not needed.
Exact prepared artifacts/pin inputs retained. One guarded existing-preparation
continuation prepared with unchanged timing/identity/closure guards and separate
history, PENDING_OPERATOR_COMMAND; run in ordinary :25–:55 window after monitor,
outside daily04:30UTC capture hour. No blind retry, rebuild or acceptance replay.


### Marketing resume — second near-term STOP, exact timer diagnosis pending

Prepared continuation again stopped before coordination/attempt reservation;
resume closure NOT_STARTED/timerChanges NONE. Original history retained.
No further deploy attempt until one read-only VPS clock/raw typed timer/remaining
margin diagnosis returns. Unchanged900s guard, application/pins/backup acceptance
and legal draft preserved; no timer or runtime changes.


### Marketing resume — exact timer review PASS, one existing-helper continuation

At18:21:29CEST both typed timer margins pass (monitor58m31s, backup12h08m31s);
old pins/state unchanged and services idle, no attempt reservation. Evidence does
not establish a timer-reader bug or identify the timer responsible for prior STOPs.
One existing-helper continuation PENDING_OPERATOR_COMMAND, fresh >20min prelaunch
window and unchanged15min helper guard; archive exact prior resume STOP/closure,
retain initial history, reserve one wrapper marker, preserve independent closure.
No helper/build/source change, backup acceptance replay, legal deploy or commit.


### Marketing deploy — runtime/HTTPS and paired rollback health STOP

New release verification and rollback health both STOP; closure absent. Current
application availability, exact rollback alignment and timer restoration unconfirmed.
One read-only identity/runtime/local-HTTP/public-HTTPS diagnostic pending; no deploy
retry or blind timer start. Backup A–D retained; marketing release not COMPLETE.


### Marketing closure — old release restored, canonical-route guard correction

Old842-file manifest/pins and online runtime confirmed, backup state unchanged.
Both backup/monitor timers inactive/enabled; writer baseline active/enabled.
Helper health incorrectly required200 on /hr, which canonically redirects307 to /;
independent canonical / read returns200/TLS0. One no-PM2/no-deploy old-release
closure with exact identity/state/missed-term guards and timer baseline restoration
PENDING_OPERATOR_COMMAND. Preserve failure history/new artifacts and backup A–D;
marketing deploy/visual acceptance remain incomplete, legal draft excluded.


### Marketing resume — old closure PASS, corrected canonical-health deploy pending

Old exact release healthy; backup/monitor active/enabled and original next terms
restored, state/writer/history unchanged. One corrected helper uses canonical /
(direct200/TLS0), exact retained754 files and separate canonical-deploy-* evidence.
Four local isolated health cases PASS; other helper functions unchanged except
scoped reuse/prerequisite/namespace plumbing. No build or backup acceptance replay.
New operatorski block PENDING_OPERATOR_COMMAND; same two exact staging pins,
independent paired rollback/closure, fresh timer/idle guards. Legal excluded;
marketing deployment and live visual acceptance still pending.


### Marketing staging deploy and exact backup pin alignment — COMPLETE (2026-10-12)

Reviewed build853RYrj-r5cyoSGuJudap deployed,757-file canonical artifact and two
exact staging pin keys aligned; corrected canonical-route health/independent closure
PASS. Backup/monitor active/enabled, next returned regular terms19:20CEST monitor
and2026-10-13 06:30CEST backup; state/writer/history unchanged. Backup A–D retained.
Live hr/sr/en/de/sl/pl desktop/mobile prices/3-and12-month/exVAT/trial/B2B copy,
availability and localized CTA navigation PASS; no browser errors/overflow or forms
submitted. Prior unchanged local evidence reused; no build/backup test replay.
Paired rollback retained under corrected hash-pinned helper; legal draft outside
deploy, production unchanged, marketing/legal worktree preserved, no commit/push.
[Final results and rollback](PUBLIC_PRICING_AND_MARKETING_CONTRACT_ALIGNMENT_STAGING.md#final-staging-marketing-deployment-and-read-only-acceptance--complete).


### Marketing visual identity restoration — USER_VISUAL_APPROVED_LOCAL_ONLY

User rejected the prior illustration replacement; automated marketing visual PASS
was not user approval. Restore passport/phone/QR hero and large laptop composition
with2 new accurate assets based on existing synthetic DPP/dashboard UI. Preserve
confirmed content/prices/quotas/trial/B2B/localized CTAs; only Hero.highlight changes
in6 locales.2 affected components: targeted lint/TypeScript and18 local scoped
viewport checks PASS; desktop/mobile screenshots delivered.
[Local review and exact diff](MARKETING_VISUAL_IDENTITY_RESTORATION.md).
User approved the restored local design on 2026-10-12: “Odobravam dizajn.”
No deploy/repin/backup replay/commit/push; future execution remains a separate phase.
Historical staging technical proof/backup A–D retained; legal/unrelated work preserved.

### Approved restored marketing design — staging deploy pending operator

User approved design and deploy. New isolated build_tkSUOn0PCoHjpx8V7FVr with756
pinned executable members, including2 restored public PNGs; build/TypeScript PASS.
User read-only preflight17:15:38UTC confirms old853RYrj-r5cyoSGuJudap, Legal unchanged,
CONTINUOUS/hold=false/attempts2 and exact two-key pin delta. New canonicale30e2afa…,
configa79c6c85…;759 total canonical members. Six local extraction/partial rollback/
unknown-path checks PASS. Bounded reviewed deploy with independent closure and
paired rollback PENDING_OPERATOR_COMMAND; fresh timer margin required. No runtime
change yet, no backup acceptance replay, commit/push or production operation.
[Plan, exact hashes, operator blocks](MARKETING_VISUAL_IDENTITY_STAGING_DEPLOY.md).

### Approved restored marketing design — staging COMPLETE

Operator deployment/independent closure PASS: build_tkSUOn0PCoHjpx8V7FVr,759 exact
canonical files, canonicale30e2afa…/configa79c6c85…, onlybuildId/canonicalSha256 changed.
Runtime online/HTTPS200 TLS0, failure artifacts null, backup state and writer timer
unchanged. Backup/monitor active/enabled/waiting; closure next terms13.10 06:30CEST
and12.10 20:20CEST respectively (point-in-time evidence). A–D acceptance preserved.
Read-only hero/laptop12 desktop/mobile views across6 locales PASS, no overflow or
console errors;2 image/build-manifest hashes exact and one request-access CTA GET
navigation PASS without form submission. Approved design deployed; unchanged prices/
content proofs reused. Legal excluded/preserved; rollback prepared, not executed;
no production change, acceptance replay, commit/push. Index empty, marketing/legal
worktree intentionally preserved.
[Completion report, exact manifest and rollback](MARKETING_VISUAL_IDENTITY_STAGING_DEPLOY.md).

### STAGING_FULL_SERVICE_RECOVERY_AND_REBOOT_STARTUP_PLAN — PLAN_READY (12.10.2026)

Jedan objedinjeni dokumentacijski plan razdvaja startup sa očuvanim podacima,
prihvaćeni izolovani DB/file restore, auth/provider okruženje i scanner/updater trust.
A–D i B app read ostaju prihvaćeni; nema B2 download/initdb/pg_restore/checksum replay-a.
Dokumentovan je zastareo scanner recovery pin8QNI… naspram prihvaćenog builda
_tkSUOn0PCoHjpx8V7FVr; stvarni installed status čeka jedan budući preflight, bez bypass-a.
Predlog jednog prozora13.10 12:25–12:55UTC: web/auth10min, puni tok20min,
maintenance30min; najviše jedan reboot, jedan uslovni pregledani scanner recovery i
jedan sintetički korisnički tok. Host-wide production prekid/console, timer/sending
pauza, fixture/publish scope, minimalni startup/helper alignment i provider DR granica
čine jedan paket do5 odluka. Bez odobrenog shared-host prekida nema reboot-a;
provider restore ostaje NOT_PERFORMED, dugoročan unattended rad nije dokaz ove serije.
[Plan, acceptance i jedinstveni paket](STAGING_FULL_SERVICE_RECOVERY_AND_REBOOT_STARTUP_PLAN.md).
PLAN_READY / EXECUTION_NOT_STARTED / BACKUP_ACCEPTANCE_NOT_REPEATED.
Samo plan i ovaj append; postojeće readiness/pravne dopune i pravni nacrt sačuvani,
bez VPS/panela, izvršnog source-a, operacija, testova/builda, commita ili pusha.


### STAGING_REBOOT_RECOVERY_OPERATOR_PACKAGE_PREPARATION — PENDING_PREFLIGHT (12.10.2026)

Pripremljen [jedan operatorski paket](STAGING_REBOOT_RECOVERY_OPERATOR_PACKAGE_PREPARATION.md)
i [manifest](evidence/staging-reboot-recovery-20261013/package-manifest.json): kompletan
read-only preflight, zaseban exact-release scanner kandidat (jedan literal, original
sačuvan), pet lokalnih guard regresija i benigni sintetički PDF van Git-a. Potvrđeni
su shared-host prekid/Hostinger console i termin13.10 14:25–14:55CEST; reboot nije
zakazan. Operator prisutan od14:05, P posle redovnog monitora14:20; Q–K ostaju
PENDING_INSTALLED_OUTPUT do pregleda stvarnog startup/production targeta, namenskog
actor ID-ja, scanner consumer/pin i nezavisnog closure/rollback obuhvata. Sintetički
proizvod c1c24c7c-334b-48bf-ba34-ac5fb930f1c2 ima istorijski dokaz namene; nalog nije
proglašen sintetičkim samo po članstvu/nazivu. Ciljevi10/20min,30min eskalacija
(nije garantovani host RTO); jedan reboot/uslovni scanner recovery/korisnički tok.
Backup A–D se ponovo koristi; execution/instalacija/commit/push nisu započeti.
Pravni nacrt i prethodni roadmap prefix sačuvani. Konačni READY nije proglašen dok
kritični installed preduslovi i mutacioni blokovi nisu pregledani.


Reboot paket —13.10 preflight16:12CEST: release759/pins/runtime metadata PASS,
originalni STOP i expired termin sačuvani. Lokalni active.json presence guard
ispravljen uz8-case ciljanu regresiju PASS; runtime backup nije menjan. Actor
synthetic namena i image/public fixture scope nedokazani, Q–K zaključani. Detalji
u §8 operatorskog paketa; nema novog reboot termina ili acceptance tvrdnje.


Saved-file reboot pregled13.10: staging startup unit/dump potvrđeni, oba PG
klastera online; startup diff NONE. Scanner hashes match uz stari installed pin;
rollback metadata match. Novi termin, actor/image, backup reconciliation i konačni
production HTTP/closure scope ostaju pending; bez novih live provera ili mutacija.


Reboot finalization zahtev:14.10 17:00–17:30CEST potvrđen, ali monitor17:20 i45min
guard daju schedule STOP;17:25–17:55 je samo predlog. Odobren existing ADMIN actor
na navedenom synthetic proizvodu i1 benign image upload; te odluke se ne otvaraju
ponovo. Jedan scoped backup/closure/lock + actor/membership read-only blok spreman,
čeka operator output. Dva nova targeted testa PASS; stare provere nisu ponavljane.
Konačni executors/closure i READY pending; nema runtime promene. Detalji §10 paketa.


Reboot paket finalizovan za potvrđeni14.10 17:25–17:55CEST: scoped backup/closure/
lock i ADMIN membership/prava PASS, attempts3/history/freshness samo point-in-time.
Kompletni blokovi00–12, root-private operation journal, separate exact scanner clone,
one-reboot budget i independent partial closure spremni za review. Startup diff NONE.
Novi ops kod8 targeted provera PASS;13 shell/Python/embedded source checks PASS.
Još je potreban00 read-only production mapping/retained rollback readback pre READY;
volatile02 ostaje neposredno predQ. Izvršenje nije počelo, reboot nije zakazan,
backupA–D nije ponavljan. Pravni/odvojeni roadmap prefix sačuvani.

### Reboot paket — ispravka bootstrap registra posle STOP-a

- Sačuvan operatorski `LOAD_00_PREPARATION_READONLY / PACKAGE_MEMBER_CHANGED`; stale hash u blokovima00/01 usklađen sa nepromenjenim pregledanim helperom. Lokalna payload/pins/manifest i negative-guard provera PASS.
- Read-only00 output ostaje jedini pripremni readback. Bez instalacije, runtime promena ili reboot-a; `EXECUTION_NOT_STARTED / REBOOT_NOT_SCHEDULED / BACKUP_ACCEPTANCE_NOT_REPEATED`.

### Reboot operatorski paket — pripremni00 PASS

- Operatorski read-only output00 prihvaćen: production PM2/cwd/HTTPS i local TLS `200 0`, staging `_tkSUOn0PCoHjpx8V7FVr`, exact scanner kandidat i retained rollback757 fajlova potvrđeni. `OPERATOR_PACKAGE_READY`; volatile02/03 gate-ovi ostaju pred izvršenje.
- Bez source instalacije ili runtime mutacija; `EXECUTION_NOT_STARTED / REBOOT_NOT_SCHEDULED / BACKUP_ACCEPTANCE_NOT_REPEATED`. Termin14.10.2026 17:25–17:55 Europe/Zagreb ostaje operatorski prozor, ne automatski zakazan reboot.

### Reboot paket — operatorska source instalacija01

- `INSTALLED_SOURCE_ONLY` prihvaćen; original preserved, exact scanner kandidat podudaran. Backup pinovi i servisi nepromenjeni; scanner recovery nije pokrenut.
- Sledeći02 preflight17:21–pre17:25 Europe/Zagreb posle redovnog monitora; reviewed PASS otključava03. Koordinacija/reboot još nisu započeti ni zakazani; backup acceptance nije ponavljan.

### Reboot paket —02 volatile preflight prihvaćen

- Operatorski `PASS_REVIEW_BEFORE_Q`,14.10.2026 17:21:25 lokalno; backup attempts4, CONTINUOUS/hold=false, današnji completed set i HEALTHY monitor. Tajmeri active/enabled, production TLS200/0; sledeći termini van prozora.
-03 koordinacija PENDING_OPERATOR_COMMAND samo17:25–17:26 uz fresh proof/drift guard. Nema reboot-a ili pauze potvrđene ovim outputom.

### Reboot03 STOP — nezavisno zatvaranje pending

- `QUIESCE / UNREVIEWED_SENDING_TRIGGER`, bez automatskog ponavljanja/reboot-a. Guard je i pre/post pause; delimična pauza nije isključena.09 closure PENDING_OPERATOR_COMMAND; konačno stanje automatizacija još nije potvrđeno. Runtime helperi/pinovi nepromenjeni.

### Reboot abort —09 partial closure

- Backup/monitor redovni termini vraćeni; state/delivery nepromenjeni, production online. Writer timer pending; automatic startup NOT_PROVEN. Zaseban13 guarded pre-reboot abort baseline restore PENDING_OPERATOR_COMMAND, bez reboot/recovery/ručne dispatch komande.

### Reboot pokušaj zatvoren pre reboot-a —13 PASS

- `PASS_ABORTED_BEFORE_REBOOT_BASELINE_RESTORED`: writer timer active/enabled, redovni servis activating/start; bez ručnog worker-a. Backup/monitor vraćeni, state nepromenjen, production online/TLS200/0; failure/partial closure sačuvani.
- Reboot nije zahtevan; automatic startup/full service recovery NOT_PROVEN. Nema retry-ja ni daljeg koraka ovog pokušaja. TriggeredBy pre/post-pause korekcija i novi termin ostaju za zasebnu pripremu; backup A–D nisu ponavljani.

### Lokalna TriggeredBy guard korekcija

- Pre/post-pause guard razdvojen uz exact static unit hashove, bez drop-inova, runtime allowlist samo poznata veza/prazno posle pauze, service inactive/MainPID0 i obavezan disabled/inactive timer. Nezavisni closure nepromenjen; šest focused doubles testova PASS.
- Zatvoreni pokušaj i njegovi outputi netaknuti; prethodni source/blokovi arhivirani. Lokalni payload/manifest kandidati nisu instalirani niti spremni za stari attempt. Bez VPS promena/novog termina/reboot-a, automatic startup NOT_PROVEN, backup acceptance nije ponavljan.

###19.10.2026 — novi staging reboot pokušaj, samo priprema

- Zaseban attempt `recovery-20261019-reboot-01`, state `/var/lib/passvero-reboot-recovery-20261019`, prozor17:25–17:55 Europe/Zagreb; operator od16:45. [Paket](STAGING_REBOOT_RECOVERY_NEW_ATTEMPT_20261019.md).
- Pregledani helper472cb2ed… potvrđen; samo literalne date/identity reference prevezane, novi303c110e…; pet source payload članova,13 blokova. Prethodna istorija/BASELINE_RESTORED i pravni nacrt netaknuti. Bez ponavljanja šest testova/syntax serije/build/A–D.
-00 objedinjeni read-only output i01 readback PENDING_OPERATOR_COMMAND;02 posle redovnog17:20 monitora pre17:25 obavezan. Stari sintetički PDF/image nedostaju u/tmp; originalni prihvaćeni fajlovi pre punog toka su otvoren preduslov. Nema operativne spremnosti ili novog izvršenja.
- `NEW_ATTEMPT_PREPARED / EXECUTION_NOT_STARTED / REBOOT_NOT_SCHEDULED / LOCAL_TESTS_NOT_REPEATED / BACKUP_ACCEPTANCE_NOT_REPEATED`; AUTOMATIC_STARTUP/ FULL_SERVICE_RECOVERY NOT_PROVEN. Bez instalacije/servis promena/commita/pusha.

###19.10 reboot — originalni lokalni fixture-i obnovljeni

- Originalni671B PDF i2059B PNG obnovljeni iz sačuvanih memory-only generatora; oba accepted SHA256 identična. Stabilni private0700/0600 fajlovi u postojećem Git-ignored `.superpowers/brainstorm/staging-reboot-fixtures-20261019/`; bez zamene hashova/flow verifiera.
- Fixture blocker zatvoren, ali00/01/02 operatorski gate-ovi pending. Termin19.10 17:25–17:55 nepromenjen; bez transfera, VPS pristupa, testova/builda/backup acceptance-a, instalacije/reboot-a, commita/pusha.

###19.10 —00 pripremni operatorski PASS pregledan

-16:45:22 lokalno: exact novi helper/attempt/release i prethodni closed installed identitet podudarni; današnji backup attempts9/CONTINUOUS/hold=false i HEALTHY, writer unresolved/leases0; actor ACTIVE org ADMIN/draft očekivan, production TLS200/0. Startup baseline i757 rollback članova potvrđeni.
-01 source-only install otključan, readback pending; reboot i dalje zaključan do02 posle redovnog17:20 monitora i pregledanih03/04 koraka. Bez agentovog VPS pristupa ili ponovljenih testova/acceptance-a.

###19.10 —01 source-only instalacija pregledana

- INSTALLED_SOURCE_ONLY za novi attempt; helper303c110e…/package dd9335c9… podudarni, prethodni helper/manifest i original scanner preserved. Backup pinovi/servisi nepromenjeni; reboot nije zakazan.
-02 PENDING_OPERATOR_COMMAND17:21–pre17:25 nakon redovnog monitora17:20; reviewed PASS pre početka uslov za03. Bez ponavljanja01 ili acceptance-a.

###19.10 —02 finalni preflight prihvaćen

-17:21:17 lokalno PASS_REVIEW_BEFORE_Q: backup attempts9/današnji completed set, isti state/CONTINUOUS/hold=false, monitor17:20 HEALTHY; svi tajmeri active/enabled, actor/draft očekivani i production TLS200/0. Actual termini monitor18:20, staging capture20.10.06:30, production20.10.04:03:58 van prozora.
-03 QUIESCE PENDING_OPERATOR_COMMAND samo17:25–17:26 uz fresh proof/idle/drift gate.04/reboot još nije otključan; nema ponavljanja02/acceptance-a.

###19.10 -03 QUIESCED

- QUIESCED prihvacen, bez reboot/SMTP poziva; jedan04 pending unutar existing deadline-a. Startup NOT_PROVEN.

###19.10 -05 automatic startup PASS

- Novi boot379fc52e-5524-4b93-b6ec-b036d1953db7, startup/AUTOMATIC_STARTUP PASS; production online/TLS200/0.06 auth gate pending, full recovery/closure jos nisu dokazani. Bez drugog reboot-a.

###19.10 -06 AUTH_GATE STOP

- UnsupportedOperation bez retry-ja; scanner/flow nisu otkljucani.09 independent closure pending;05 automatic startup PASS sacuvan, full service recovery NOT_PROVEN. Bez drugog reboot-a ili worker poziva.

###19.10 -09 partial closure / writer pending

- Backup/monitor vraćeni, state/delivery unchanged, production online/TLS200/0 i automatic startup PASS. Samo writer pending; pun flow nije završen.
- Zaseban13 post-startup AUTH_GATE technical-abort baseline restore PENDING_OPERATOR_COMMAND: exact accepted boot/failure/closure, bez auth/scanner retry-ja i bez ručnog worker-a. Normalno odobreno slanje može se nastaviti tek nakon njegovih guardova. Runtime source/pinovi nepromenjeni.

###19.10 — pokušaj zatvoren / post-startup baseline restored

-13 PASS_POST_STARTUP_ABORT_BASELINE_RESTORED: writer timer active/enabled, redovni servis activating/start; backup/monitor vraćeni prema09, state unchanged, production online/TLS200/0. Failure i partial closure retained; nema dodatnog reboot-a ili ručnog worker-a.
-AUTOMATIC_STARTUP PASS za novi boot ostaje prihvaćen; FULL_SERVICE_RECOVERY NOT_PROVEN zbog AUTH_GATE/UnsupportedOperation i nezavršenog scanner/user toka. Nema daljih komandi, retry-ja ili novog termina. Završetak writer posla/inbox receipt nisu dokazani. Bez ponavljanja backup acceptance-a/commita/pusha.


## STAGING_RECOVERY_UI_CONFIRMATION_AND_RELEASE_PREPARATION — 21.10.2026.

**Završeni staging startup i scanner/PDF korisnički tok imaju odvojene prihvaćene dokaze.**
AUTOMATIC_STARTUP=PASS ostaje operatorov dokaz19.10; recovery21.10 je COMPLETE,
reader ACCEPTED i nezavisni closure PASS, sa tri publikacije145729 →145730 →145731.
To su istorijska opažanja, ne današnja nova health provera. Korisnik je naknadno
potvrdio novi proizvod, objavu, PDF preuzimanje, QR link i očekivane DPP elemente:
UI_PDF_ACCEPTANCE=PASS_USER_CONFIRMED. Nisu potvrđeni byte-checksum, tačan scan status
ili konkretan Document ID. [Završni nalaz i granice dokaza](STAGING_REPORTED_PDF_SCAN_FAILURE_TRIAGE.md#korisnička-ui-potvrda-i-završna-release-priprema--21102026).

Stari harness STOP/NOT_RUN ostaju istorijski; ne otvaraju se ponovo.
FULL_SERVICE_RECOVERY=NOT_PROVEN odnosi se na potpuni host-loss/izolovani web/auth/
provider restore, dugoročni continuity i zasebni production rollout/rollback opseg;
završeni staging PDF problem nije otvorena prepreka. Startup i backup A–D se ne ponavljaju.
**Nastavak: UI dorade, zatim konkretna priprema produkcije** — tačan release/config/
DB/auth/Storage/scanner manifest, operativni nadzor i rollback, uz zasebno odobrenje.
[Pregledani release skup i roadmap-only patch](evidence/staging-recovery-release-20261021/README.md).
Sada samo priprema za odluku o commitu/pushu; bez stageovanja, novih testova/builda,
live radnji, production promena ili objave odvojenog pravnog nacrta.


## MARKETING_UI_FINAL_REVIEW_COMMIT_PUSH_AND_STAGING_DEPLOY — 2026-10-21

User accepted the final local marketing design, including glass header, transparent
logo and mobile final-CTA separation, and authorized scoped commit/non-force push
and coordinated staging deployment. Exact source manifest has 23 source/assets;
commercial rules, illustrations, private UI and Legal namespaces remain unchanged.
Latest successful local build: `Edl3N_JJEbBPamNQ84Jxn`; source hashes match.
Existing accepted checks reused; no new build/test or backup acceptance series.

Staging deploy is STOP_CANONICAL_ORIGIN_MISMATCH: accepted local build embeds
`https://passvero-preview.invalid` in static canonical/structured metadata. It must
not be deployed or patched/relabelled. One staging-origin build decision and the
fresh bounded operator preflight are pending; no pin/runtime/scanner/automation
changes made. See [final review and operator handoff](MARKETING_VISUAL_IDENTITY_STAGING_DEPLOY.md#approved-marketing-ui-final-review--2026-10-21).
Preexisting roadmap/readiness/legal changes remain outside this task's Git slice.
