# SUBSCRIPTION_ENTITLEMENTS_QUOTAS_AND_PLAN_CHANGES_STAGING

Izvještaj dokaza, ažuriran 2026-09-30. Baza: `e024dd88894bf2d594f5e3921b84bd12058a519f`.
HEAD, lokalni origin/main i udaljeni main potvrđeni na istoj bazi prije rada; worktree je bio čist.
Nema commita ni pusha ove cjeline. Raniji komercijalni izvještaj i dokazi ostaju povijesno nepromijenjeni.

## Implementacija i inventar write granica

Zajednički entitlement resolver koristi nepromjenjive prihvaćene ponude/plaćene periode,
jednokratni zapis aktivacije triala i postojeću Subscription projekciju. Intervali su
[start, end), kalendarski Europe/Zagreb, pohranjeni u UTC. Provjera vremena ne čeka cron.
Organizacijski advisory lock prethodi product/batch lockovima te serijalizira komercijalne
promjene, potrošnju i odluku o aktivaciji downgradea.

| Putanja | Granica provjere |
| --- | --- |
| Pojedinačno kreiranje i CSV | Ista create transakcija, stored/lifetime brojač; preview bez rezervacije, receipt replay bez nove potrošnje |
| Nacrt, prijevodi, materijali, CN, GTIN, proizvođač | Provjera prava unutar postojeće tenant/autorizirane transakcije prije mutacije |
| Kloniranje i objavljivanje | Prava, PDF limit klona i atomsko zauzimanje prvog objavljenog mjesta |
| Slike i PDF | Rezervacija bajtova prije vanjskog I/O-a; finalizacija ponovno provjerava prava; sigurnosni cleanup ostaje moguć |
| Povezivanje/uklanjanje priloga i QR aktivacija | Provjera write prava; PDF limit po verziji |
| Javna HTML, slika i PDF autorizacija | Regulatorna klasifikacija i vremenska provjera uz postojeće publication/integrity/malware zaštite; no-store |
| Billing profil, privatni read/export, prijava | Postojeća autorizacija, bez sadržajnog entitlement zaključavanja |

Zauzeta objavljena mjesta uključuju arhivirane/povučene proizvode s currentPublishedVersionId.
Storage zbraja jedinstveni provider/bucket/key po organizaciji, uključujući povijest i nerazriješene
rezervacije. Neizvjesno/abandoned uklanjanje bez dokaza i dalje troši kapacitet. Novi release tok nije dodan.

Upgrade je zasebna eksplicitno cijenjena dopunska ponuda, s istim krajem perioda.
Downgrade ponovno provjerava sve kvote na početku; BLOCKED_REQUIRES_OPERATOR ne daje
niža niti produžena stara prava. Povijest i uplata ostaju nepromjenjive. Eksplicitna zamjenska
ponuda dostupna je i nakon isteka blokiranog perioda; nema automatskog kredita/povrata/pomicanja.

VOLUNTARY slijedi trial/plaćeni grace; MANDATORY/UNRESOLVED zahtijevaju zasebno razrješenje.
Klasifikacija je na proizvodu kroz verzije, uz zaseban regulatorni grant, razlog i audit
prije/poslije/actor. Ne daje sadržajna prava. Postojeći i novi proizvodi počinju UNRESOLVED;
povijesni snapshotovi ostaju nepromijenjeni.

## Lokalni dokazi

- Novi disposable PostgreSQL proof: **12 PASS, 0 FAIL**, 30 migracija; samo nova entitlement/plan-change serija.
  `/private/tmp/entitlements-proof.log`; klaster zaustavljen. Pokriveni trial concurrency, storage i publication
  concurrency, CSV partial/replay, direktna zabrana nakon isteka, javne autoritativne granice,
  PDF concurrency/dedup/lock-order, regulatory grant/revocation i audit rollback, upgrade/downgrade/replacement.
- Relevantna aplikacijska/presentation/pure/public serija: **48 PASS, 0 FAIL**.
  `/private/tmp/entitlements-app-tests.log`. Regresije izmijenjenih mutation granica evidentiraju se zasebno.
- TypeScript, scoped lint i whitespace PASS. Mutation regresije: **65 PASS, 0 FAIL**, `/private/tmp/entitlements-mutation-regression.log`.
- Raniji lokalni build PASS: `D-h1eFygqeslYX22S2HL4`. Build prije Safari korekcije: `l-JG1xiXsl1bSbQauDDCf`, `/private/tmp/entitlements-ui-fix-build.log`; nakon ograničene UI korekcije 18 relevantnih testova, TypeScript i lint PASS. Ove prethodno izvršene provjere nisu ponavljane pri dokumentacijskom zatvaranju.
- Završni review integracijskih granica pronašao je P2 lock-order problem PDF veza; ispravljen i ponovni review PASS. Novi PostgreSQL concurrency test potvrđuje ispravku.
- UI komponente imaju šest prijevoda. Ograničena Chrome emulacija 390×844 HR/DE korisničkih i operator ekrana PASS; fizički mobilni uređaj nije dokazan; Safari desktop zaglavlje potvrđeno korisnikovim screenshotom nakon ispravke.

Lokalni proof koristi sintetičke datume i podatke, ne mijenja server sat. Simulirana uplata
nije stvarna uplata. Staging servisni scenariji također koriste isključivo SIMULATED_PAYMENT; live browser i HTTP dokazi navedeni su odvojeno ispod.

## Staging gate i rollback

Read-only inventar postojećih organizacija, potrošnje, perioda, proizvoda i potvrđenih identiteta:
**PASS, writes NONE** prema dostavljenom operatorskom outputu. [Objedinjeni prijedlog](SUBSCRIPTION_ENTITLEMENTS_STAGING_TRANSITION_PROPOSAL.md) izričito je odobren i izvršen za tri navedene organizacije i zasebni regulatorni grant.
Ne izvodi se trial iz createdAt; postojeći billing grant ne daje regulatornu ovlast.

Aditivne migracije `20260930130000_subscription_entitlements` i
`20260930140000_subscription_plan_changes`, minimalni runtime ACL i staging deploy
potvrđeni su operatorskim outputom. Završni read-only inventar potvrđuje bazu
passvero_acceptance:5433, podatkovni direktorij i build `l-JG1xiXsl1bSbQauDDCf`.

Rollback je **dokumentiran, live NEIZVRŠEN**: prije deploya zadržati prethodni build/runtime manifest;
u slučaju neuspjeha zaustaviti novi acceptance i usporediti DB stanje prije retryja. Ne brisati komercijalnu
povijest, trial enrollment, grant audit ili novu migraciju. Povratak na stari runtime nije bezuvjetno siguran
nakon novih upgrade/downgrade zapisa jer stari kod nema enforcement; tada je potreban pregled konkretnih
zapisa i kontroliran fix-forward ili odobreni read-only režim. Ne provoditi rollback radi formalnog PASS-a.

## Statusi ove cjeline

| Stavka | Lokalno/source | Staging |
| --- | --- | --- |
| TRIAL_LIFECYCLE | PASS | PASS: 3 UI kreiranja; četvrto odbijeno; DB 3 proizvoda/3 nacrta |
| PRODUCT_PUBLICATION_AND_STORAGE_QUOTAS | PASS uključujući konkurenciju | Create limit PASS; puni storage/publication race nije ponavljan live |
| CSV_QUOTA_ENFORCEMENT | PASS partial/replay/shared quota | Nije ponavljano live |
| EXPIRED_CONTENT_WRITE_DENIAL | PASS direktni handler/tenant | PASS: create i otvaranje nacrta odbijeni; privatni pregled radi; DB bez novih nacrta |
| PUBLIC_AVAILABILITY_ENFORCEMENT | PASS autoritativne HTML/image/PDF granice | HTML HTTPS 200/404/404 PASS; novi live image/PDF grace transport NOT_PROVEN |
| EXECUTABLE_UPGRADE | PASS | Runtime-role service + DB PASS; kraj nepromijenjen; kontrolisani datumi |
| EXECUTABLE_DOWNGRADE | PASS | Runtime-role service + DB PASS; ACTIVE odnosno BLOCKED_REQUIRES_OPERATOR |
| EXISTING_STAGING_ORGANIZATION_TRANSITION | Odobreni inventar/plan | PASS prema operatorskom prijelazu; originalni period i 9 UNRESOLVED proizvoda potvrđeni završnim inventarom |
| STAGING_ACCEPTANCE | Lokalni dokazi odvojeni od live | Navedeni servisni, browser i HTML scenariji PASS; Safari header screenshot nakon ispravke PASS |

PRODUCTION_CHANGES=NONE; REMINDERS_IMPLEMENTED=NO; AUTOMATIC_DATA_DELETION=NO; COMMIT_CREATED=NO.
Podsjetnici ostaju treća cjelina. Backup/retencijski produkcijski preduslovi iz ugovora ostaju otvoreni;
ovaj rad ne dokazuje backup/restore niti mijenja scanner servise.

## Povijesni operatorski koraci (statusi u trenutku izvršenja)

### Operatorski dokaz migracije

Operator je dostavio `VERIFIED_ENTITLEMENTS_PACKAGE=PASS` i `STAGING_MIGRATION=PASS`.
Dvije aditivne migracije i minimalni ACL korak su staging PASS; enrollment,
regulatorni grant, deploy i novi acceptance još nisu dokazani.

## Operatorski dokaz prijelaza i priprema deploya

Operator: transition PASS, approvedEnrollments=3, regulatoryGrant ACTIVE za
40e51001-912c-4bcf-aa45-d866632aac85. Postojeći proizvodi UNRESOLVED,
commercialHistory UNCHANGED, trialCreated=false, paymentRecorded=false.
Prvi SQL pokušaj imao je koliziju PL/pgSQL varijable `n` s aliasom kolone;
read-only provjera potvrdila je nula upisa. Izolovana lokalna reprodukcija i
ispravka `max(a.n)` PASS; korigovani atomski operatorski prijelaz PASS.

Deploy paket: `/private/tmp/passvero-entitlements-deploy.tar.gz`;
SHA-256 `594219e0281aaecfc5361e1f1d2ce06fe608092d8c170c25138b4c49b8085d92`.
Deploy manifest SHA-256 `bae51b03ed0c0ae09b3fbd50223859f1d12ce98d1cb48609daf6d736159d73fd`.
813 application datoteka, postojeći build D-h1eFygqeslYX22S2HL4; source hashovi
odgovaraju pregledanom buildu. Python syntax i ograničeni diff deploy/rollback
skripti pregledani. Deploy PENDING_OPERATOR_COMMAND; acceptance NOT_PROVEN.
Rollback čuva `.next.before-entitlements`, `messages.before-entitlements` i
prethodni runtime manifest; odbija automatski povrat nakon novih komercijalnih
perioda/aktivacija/upgradeova/enrollmenta. Nije izvršen.

## Deploy i prvi autentifikovani prikaz

Operator: VERIFIED_ENTITLEMENTS_DEPLOY_PACKAGE=PASS;
STAGING_ARTIFACT_AND_HTTPS=PASS; AUTHENTICATED_ACCEPTANCE=NOT_PROVEN.
OWNER prodaja prijavljen kroz normalni Chrome login; postojeća sintetička komercijalna
organizacija prikazuje Start period, kvote i eksplicitnu oznaku simulirane uplate.
Ograničena HR/DE mobilna browser emulacija 390×844: čitljiv prikaz, menu dostupan,
documentElement.scrollWidth=innerWidth=390. Nema funkcionalne mutacije komercijalnih podataka.
Ovo nije fizički mobilni uređaj niti još dokaz novih trial/downgrade scenarija ili regulatornog UI-a.

Fixture setup source scripts/subscription-entitlements-staging-fixtures.ts: TypeScript/lint PASS;
sedam jasno označenih sintetičkih organizacija, samo potvrđeni OWNER, bez novih auth sesija,
bez uplata i bez izmjene postojećih organizacija. Atomski setup i replay po stalnim slugovima.
Bundle SHA-256 4d4123737e913650e6e2839cc264b482620bce5b1ff5023d8da3b3db430b70d2.
Setup PENDING_OPERATOR_COMMAND; ID-jevi će biti evidentirani iz outputa.

Fixture setup operator PASS: sedam CREATED; paymentRecorded=false, existingOrganizations=UNCHANGED.
Točni zadržani ID-jevi: [staging-fixture-ids.json](evidence/subscription-entitlements/staging-fixture-ids.json).
Trial UI acceptance čeka izbor nove trial-active organizacije u normalnoj OWNER sesiji.

## Trial browser acceptance i ograničena UI korekcija

OWNER Chrome, fixture 2f6ef99e-4cc9-4127-8562-ab7d3ea2e622:
tri stvarna UI create zahtjeva uspjela; četvrti odbijen, pregled pretplate ostao 3/3.
Zadržani product ID-jevi: 03cf2023-be8a-4f58-b19b-c120cf0080f6,
16e71add-be55-45ee-b341-dddbf9cddd4e, 237e51ee-b501-4d33-93d3-6db701889e72.
Nema četvrtog kreiranog proizvoda prema ponovo pročitanom UI brojaču.

Otkrivena UI greška: forma je SUBSCRIPTION_DENIED pretvarala u generičko
Pokušajte ponovno. Ispravka prenosi allowlisted razlog i postojeći lokalizirani
Subscription tekst; trial header više nije označen kao plaćeni period i trial naziv
je lokaliziran. Relevantnih 18 app/presentation testova PASS; TypeScript/lint/build PASS.
Novi build l-JG1xiXsl1bSbQauDDCf još nije deployovan. Ne ponavljati PostgreSQL proof
za ovu poruku. Scoped review korekcije i staging scenario runnera PASS.

Pripremljeni acceptance paket /private/tmp/passvero-entitlements-acceptance.tar.gz:
SHA-256 55ce872761d9737657b8586f87b2fcf357171a452eb471a76b776e9b9357642d;
manifest 9583c56281b76ddcd08debf2ccd2aaeb4265b6193b4781e3b0ec0caaaebd3f5b.
Sadrži UI redeploy i odvojeno označen service proof sa stvarnim runtime DB ulogama
passvero_app/passvero_auth i migratorom samo za izričite sintetičke fixturee.
Kontrolisani datumi nisu pomicanje server sata. Ne kreira auth sesije/tokene i
ne bilježi stvarne uplate. Čeka postojeću važeću operator sesiju uz OWNER sesiju.
Service proof i HTTP/browser acceptance nisu isto i izvještavaju se odvojeno.

## Aktualni servisni i javni HTTP staging dokazi

UI korekcija deploy PASS: build l-JG1xiXsl1bSbQauDDCf. Operatorov service proof PASS:
[rezultati i request/product ID-jevi](evidence/subscription-entitlements/staging-service-result.json).
Samo SIMULATED_PAYMENT, actualPayment=false. Upgrade kraj ostao 2026-12-31T13:00:00Z;
blocked downgrade EXPIRED/STORED_PRODUCT_LIMIT, allowed downgrade PAID.
Datumi su kontrolisani fixture datumi; to nije čekanje stvarnog kalendarskog isteka.

Stvarni javni HTTPS GET: paid-grace-active 200, paid-grace-expired 404,
trial-expired 404; sva tri Cache-Control no-store. [Sanitizirani dokaz](evidence/subscription-entitlements/staging-public-http.json).
Ovo dokazuje javni HTML. Novi live PDF/image transport grace test nije izvršen;
njihove autoritativne granice i postojeće sigurnosne zaštite imaju lokalni dokaz.
Ponovljeni browser četvrti create nakon UI ispravke sada prikazuje
Prekoračen limit sačuvanih proizvoda. Nema potrebe ponavljati prva tri uspješna unosa.
Safari native kontrola dvaput timeout; autentifikacija operatora je potvrđena
servisnim proofom, ali taj rezultat nije zamjena za vizuelni operator UI pregled.

## Live istek kroz autentifikovani OWNER browser

Fixture trial-expired: login i dashboard rade; globalni banner jasno prikazuje
Istek: izmjene sadržaja blokirane. Slanje create forme odbijeno s istim jasnim
razlogom. Privatni detalj objavljenog fixture proizvoda je čitljiv i pokazuje
VOLUNTARY te DPP nije javan. Klik Uredi proizvod / pokušaj otvaranja novog nacrta
odbijen; nije otvorena edit stranica. Ovo je live browser zahtjev kroz postojeći
endpoint; zaseban ručno konstruiran autentifikovani HTTP replay nije izvršen.
Puni direktni HTTP handler/tenant/konkurentni dokazi ostaju lokalni iz prethodnih testova.

## Autentifikovani operator UI i Safari ograničenje

Chrome operator zivic.darko79@gmail.com: Platform Admin billing i regulatorna
navigacija dostupne. Billing lista trenutno nema otvorenih zahtjeva; pregled nije
stvarao novi zahtjev radi prikaza. Regulatorni pregled učitava proizvode,
klasifikaciju i obrazloženje; nijedna forma nije poslana.

Ograničena Chrome browser emulacija 390 × 844: HR billing prazno stanje i HR/DE
regulatorni ekran vizuelno čitljivi, dugmad dostupna, mobilni izbornik otvara
regulatorni ekran. documentElement.scrollWidth = innerWidth = 390 u sva tri
pregledana prikaza. Jezik i Odjava/Abmelden vidljivi i razdvojeni. Vraćeni HR i
normalni viewport. Ovo nije fizički mobilni uređaj niti Safari dokaz; odjava nije
izvršena i nije potvrđen prikaz detalja otvorene ponude jer otvorenih ponuda nema.

Na korisnikov zahtjev ponovo pokušan native Safari pregled jezika/odjave;
alat je istekao prije dostupnog prikaza prozora. SAFARI_HEADER_VISUAL=NOT_PROVEN,
potreban korisnikov screenshot za pregled prijavljenog problema. Nema source
izmjene, novog builda/deploya ili izmjene grantova/komercijalnih podataka u ovom
UI pregledu. Završni read-only DB inventar iz ranije dostavljenog operator bloka
još čeka output; završni manifest nije proglašen konačnim.

## Završni read-only inventar — 2026-09-30

[Potpuni operatorski inventar i svi zadržani ID-jevi](evidence/subscription-entitlements/staging-final-inventory.json)
provjereni su lokalnim assertionima prema odobrenim fixture ID-jevima i scenarijima:
7 organizacija, 107 sintetičkih proizvoda (101 za blokirani downgrade), 7 novih
SIMULATED_PAYMENT perioda i 1 SIMULATED_PAYMENT upgrade receipt. Svi snapshotovi
odgovaraju ponudama; broj payment audita odgovara broju pripadajućih zapisa.
To nije dokaz nove live konkurentne potvrde: konkurencija/idempotencija imaju raniji lokalni proof.

Trial-active ima točno 3 proizvoda/3 nacrta i lifetime=3. Trial-expired ima samo
raniji javni fixture i 0 nacrta. Blokirani downgrade ima BLOCKED_REQUIRES_OPERATOR
sa STORED_PRODUCT_LIMIT; dozvoljeni ima ACTIVE. Upgrade end=baseEnd=
2026-12-31T13:00:00 UTC. Tri klasifikacijska audita imaju potvrđenog operatora,
UNRESOLVED→VOLUNTARY i obrazloženje, isključivo za nove sintetičke proizvode.
Devet ranijih proizvoda ostaje UNRESOLVED; originalni simulirani period ostaje
2026-09-30T13:22:05.515 do 2026-12-31T14:22:05.515 UTC.

Inventar: writes=NONE, baza passvero_acceptance, port 5433,
direktorij /var/lib/postgresql/16/acceptance, build l-JG1xiXsl1bSbQauDDCf.
Ovo zatvara prethodno čekanje DB outputa. Safari header pregled i dalje čeka
screenshot zbog timeouta native alata; nije označen PASS. Manifest predstavlja
aktualni pregledani skup i izričito zadržava ovu otvorenu vizuelnu stavku.
Live rollback nije izvršen; zadržani novi financijski zapisi zahtijevaju pregled
prije povratka starog runtimea. Podsjetnici i backup/retencijski preduslovi produkcije
ostaju zasebni. Bez produkcijskih promjena, automatskog brisanja, commita ili pusha.

## Safari screenshot — potvrđena UI greška i ograničena ispravka

Korisnikov Safari screenshot od 2026-09-30 19:11:41 pokazuje preklapanje globusa
s tekstom Hrvatski i native select niži od Odjava dugmeta. Raniji Chrome dokaz
ne pokriva ovaj Safari problem. Zajednički LanguageSwitcher dashboard variant
sada koristi appearance-none, eksplicitnu visinu 44 px, desni padding i dekorativnu
strelicu. Native select, label, šest jezika i navigacijska logika ostaju isti.
Marketing variant nije promijenjen. Funkcija odjave nije mijenjana.

Pogođeni postojeći selector/navigation testovi: 22 PASS; scoped ESLint i TypeScript
PASS. Sandbox TSX IPC zaobiđen pokretanjem node --import tsx; Turbopack sandbox
port nije dostupan, pa se koristi isti Webpack build kao prethodni deploy.
Build zahtijeva javni BETTER_AUTH_URL=https://staging.passvero.eu (bez env izmjene).
Staging UI deploy i nova Safari screenshot provjera ispravke još PENDING.
Deploy skripta safari-header-deploy.py izvodi samo postojeći scoped artifact deploy,
read-only DB preflight i restart staging aplikacije; nema service proofa, grantova,
migracije, komercijalnih mutacija ili ponovnog acceptance toka. Čuva posebne
.before-entitlements-safari-header artefakte i prethodni runtime manifest.

Čist lokalni Webpack build PASS: W7mp9vBnQ9juQNqP9tnh6; 811 artefakata.
Safari UI paket SHA-256: 9af54855b69383dce50de467010a43dd990db3d7b6225bd8a25e3eaa2f87c537.
Deploy manifest SHA-256: d23556abcb6b319edb6394a6f468f2186abf1c305437f17abbca8d4f13951756.
Prethodni live build l-JG1xiXsl1bSbQauDDCf ostaje očekivani preflight.

Safari UI deploy: operator dostavio VERIFIED_SAFARI_UI_PACKAGE=PASS i
STAGING_ARTIFACT_AND_HTTPS=PASS; AUTHENTICATED_ACCEPTANCE=NOT_PROVEN.
Deployovani build W7mp9vBnQ9juQNqP9tnh6 prema pinovanom paketu.
Post-deploy Safari screenshot provjera ostaje PENDING; HTTPS/artifact PASS nije
dokaz da je Safari vizuelni problem otklonjen. Komercijalni acceptance nije ponavljan.

## Završno stanje nakon Safari ispravke

Korisnikov Safari screenshot „Slika zaslona 2026-09-30 u 19.20.01.png” nakon
deploya potvrđuje vizuelnu ispravku: globus, Hrvatski i strelica ne preklapaju se;
birač i Odjava imaju usklađenu visinu i poravnanje. SAFARI_HEADER_VISUAL=PASS
(user-provided desktop screenshot, nije automatizovani Safari test). Korisnik
je dodatno potvrdio da je Chrome prikaz u redu. Screenshot ne dokazuje klik odjave
ili promjenu jezika u Safariju; te akcije nisu ponavljane radi vizuelnog pregleda.

Konačni deployovani build: W7mp9vBnQ9juQNqP9tnh6. Pogođene lokalne provjere:
22 selector/navigation testa, TypeScript, scoped lint i čist Webpack build PASS.
Prethodni entitlement/komercijalni PostgreSQL i acceptance dokazi ostaju važeći
za nepromijenjenu poslovnu logiku; nisu ponavljani nakon CSS/UI korekcije.
Prethodne PENDING/NOT_PROVEN Safari stavke iz kronoloških koraka iznad time su zatvorene.

Završni objedinjeni diff i SHA-256 inventar nalaze se u
/private/tmp/passvero-subscription-entitlements-review/combined.diff i manifest.json.
Manifest uključuje source, dokumentaciju i operatorske dokaze, bez screenshotova
ostatka korisnikove radne površine. Nema commita/pusha; index ostaje prazan.
Ograničenja dokaza ostaju izričita: lokalna konkurencija/CSV, live HTML naspram
neizvršenog novog live image/PDF grace testa, isključivo simulirane uplate te
neizvršen live rollback. Podsjetnici i backup/retencijski preduslovi produkcije
nisu završeni ovom cjelinom.
