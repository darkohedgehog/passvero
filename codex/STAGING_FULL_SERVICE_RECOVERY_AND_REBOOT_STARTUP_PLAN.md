# Staging full-service recovery i startup posle reboot-a — plan, 12.10.2026.

**PLAN_READY / EXECUTION_NOT_STARTED / BACKUP_ACCEPTANCE_NOT_REPEATED**

Ovo je jedan dokumentacijski plan i paket za buduće objedinjeno odobrenje. Nisu
izvršeni VPS/panel pristup, sudo, reboot, restart, instalacija, migracija, deploy,
promena pinova, DB/Storage upit, capture/restore, slanje, test/build, commit ili push.
Nije pripremljen izvršni operatorski blok. Produkcijski backup i interni pravni nacrt
ostaju odvojeni. Vlasnik budućeg izvršenja: Darko Živić; stručni/provider review nije
zamenjen operatorskim odobrenjem.

## 1. Polazni dokazi i četiri odvojena obuhvata

Lokalni HEAD je `32fc8302820415725498df9c13f0c0542f1c1491`, index prazan.
Prihvaćeni staging build je `_tkSUOn0PCoHjpx8V7FVr`. Ovo je dokumentovani release,
ne današnja potvrda procesa, servisa, health-a, pružalaca ili timer-a.

| Obuhvat | Prihvaćen dokaz koji se ponovo koristi | Preostala konkretna praznina |
| --- | --- | --- |
| Startup sa očuvanim diskom/podacima | [Post-reboot runtime recovery](STAGING_POST_REBOOT_RECOVERY_AND_DASHBOARD_DEPLOY_RESUME.md): 23.09. ručno vraćen postojeći PM2 dump i dodat staging startup service ENABLED_ACTIVE. Posle instalacije nije izvršen novi reboot acceptance. [Poslednji marketing deploy](MARKETING_VISUAL_IDENTITY_STAGING_DEPLOY.md): novi artifact/pin/runtime/HTTPS i nezavisno zatvaranje PASS. | Da li se baš sadašnji sačuvani runtime automatski podigne posle jednog reboot-a; daemon unit ordering/enablement/dump identitet danas UNKNOWN. |
| DB i sačuvani fajlovi iz backupa | [Recurring izveštaj](EXISTING_BACKUP_COVERAGE_AND_STAGING_RECOVERY_COMPLETION.md): A–D COMPLETE; B poslednjeg seta `20261012T043000Z`, 56 tabela/33 migracije, schema/efektivni ACL/reference i privatni product/PDF/image reader PASS. Restore cluster STOPPED; istorijski schema STOP sačuvan. | Nisu dokazane Supabase provider obnove, web login/session recovery ili puni servisni startup. Izolovani file restore nije live Storage restore. |
| Auth i aplikacijsko okruženje | Postojeći auth/context ugovori i raniji login/onboarding dokazi; sadašnji marketing HTTPS i tačan executable manifest PASS. Lokalni source potvrđuje Better Auth preko PostgreSQL, uz posebnu auth ulogu. | Nova prijava, organizacioni kontekst i dostupnost sačuvanog protected okruženja nakon reboot-a; provider/secret recovery posle gubitka hosta nije PASS. |
| Scanner/updater poverenje | [Signature recovery](DOCUMENT_SIGNATURE_HEALTH_POST_RESTART_RECOVERY.md): 02.10. fresh-base recovery i tri stvarne scheduled reader-prihvaćene publikacije 87498→87499→87500; raniji 23.09. privatni PDF smoke PASS. | Kontinuitet nakon novog boot-a i kompatibilnost recovery exact release pina sa sadašnjim buildom; nema unattended rebootstrap-a. |

Jedan uspešan reboot dokazuje startup sa očuvanim resursima i ograničeni korisnički
tok. Ne dokazuje disaster recovery hosta, povratak spoljnog pružaoca, oporavak
izgubljenih tajni ili kompletan DB/Storage cutover. B2 download, `initdb`, `pg_restore`,
checksum serija, C/D i A–D acceptance se ne ponavljaju radi ovog plana/serije.

## 2. Mapa zavisnosti i očekivani startup

Redosled je readiness redosled za prihvatanje, ne tvrdnja da su sve `After/Requires`
veze već implementirane: host/network/clock i disk → lokalni acceptance PostgreSQL
+ sačuvano protected runtime okruženje → staging PM2/web + proxy/TLS → auth/context i
provider pristup → qpdf socket i scanner/updater → producer/private reader → scan i
kontrolisana isporuka. Timere koji mogu slati/pisati vratiti tek kroz završni gate.

| Komponenta i dokumentovani identitet/pokretanje | Zavisnosti i postojeći dokaz | Šta proveriti/korigovati samo uz konkretan nalaz | Automatski ili operator |
| --- | --- | --- | --- |
| Staging web: `pm2-passvero-staging.service`, nalog `passvero-staging`, PM2 home `/home/passvero-staging/.pm2`, app `passvero-acceptance`, cwd `/var/www/passvero-acceptance`, Node/Next na `127.0.0.1:3001` | Sačuvani dump i ENABLED_ACTIVE iz 23.09; 12.10. PM2 id0/runtime/HTTPS PASS. Procesni PID je prolazan, ne pin. | Jedan tačan app/dump/service/interpreter identitet, unit/drop-in hash, protected env posture i staging DB endpoint. Stvarni ordering/network/DB readiness danas UNKNOWN. Ne regenerisati dump iz proizvoljnog aktuelnog procesa. Ako nedostaje minimalna zavisnost/enablement, navesti tačan diff u execution paketu pre reboot-a. | Očekivan systemd→PM2 resurrect ako preflight potvrdi postojeću konfiguraciju. Ručni resurrect je oporavak, ne dokaz automatskog startup-a. |
| Lokalni PG16 acceptance: `/var/lib/postgresql/16/acceptance`, DB `passvero_acceptance`, loopback port5433; business `passvero_app`, auth `passvero_auth` | Poslednji restore/reference dokaz; [DB endpoint parser](../src/infrastructure/config/runtime-environment.ts) i [runtime DB guard](../src/infrastructure/config/runtime-database-config.ts). PG16 main5432/production je drugi obuhvat. | Stvarna acceptance systemd unit/start.conf i enablement UNKNOWN: identifikovati, ne pogoditi unit. Read-only readiness, port/data-dir/name/role i postojeći HBA/global role posture; nema migracije, grants/password izmene ili kreiranja klastera. | Automatski samo ako postojeći acceptance cluster startup to potvrđuje; inače gate pre reboot-a. |
| Reverse proxy/HTTPS za `staging.passvero.eu` | Canonical `/` je200/TLS0; `/hr` može legitimno preusmeriti na `/`. | Identifikovati postojeći proxy unit i mapiranje3001; proveriti boot enablement, sertifikat/DNS i canonical root. Aktuelni unit/ordering UNKNOWN; ne menjati production vhost. | Očekivan postojeći host startup; nema novog proxy servisa. |
| Auth: lokalni Better Auth + PostgreSQL adapter; spoljni Turnstile i SMTP gde ih konkretan auth tok zahteva | [Better Auth runtime](../src/infrastructure/auth/better-auth-server.ts), odvojena auth DB uloga; isti acceptance endpoint za auth/business. Nije dokumentovan Supabase Auth kao trenutni login backend. | Prisustvo/identitet postojećih protected tajni i canonical auth URL bez njihovog ispisa; read-only dostupnost potrebnih pružalaca. Ako instalacija odstupa od ovog source-a, STOP. Ne praviti korisnike, grantove, reset lozinke, aktivacioni ili verification email. | Lokalni auth ide sa aplikacijom. Spoljni servisi nemaju lokalni startup; kvar je zavisnost, ne razlog za njihovo „pokretanje“. |
| Supabase Storage, postojeći staging private PDF/image buckets | [Document adapter](../src/infrastructure/storage/supabase-document-storage.ts), [image adapter](../src/infrastructure/storage/supabase-image-storage.ts); DB reference + izolovani bytes/app reads PASS. | Projekt/bucket identitet i server-only credential posture, dostupnost reprezentativnih odobrenih objekata. Postojeći region je korisnički potvrđena Irska, ne provider DR ili EU-only obrada. | Spoljni provider; operator reaguje na kvar. Bez lokalnog startup unit-a ili automatskog provider restore-a. |
| qpdf: `passvero-qpdf-broker.socket`, `/run/passvero-qpdf-broker/validate.sock`, root/staging group0660 → `passvero-qpdf-acceptance.service` | [Socket](../scripts/document-scan-boundary/passvero-qpdf-broker.socket) i [broker service](../scripts/document-scan-boundary/passvero-qpdf-acceptance.service); ranije active/listening PASS. Socket aktivira confined broker; service inactive pre zahteva može biti normalno. | Socket enablement/listener/ACL i ista ograničenja/identity. Ne tražiti stalno active service i ne startovati ga radi lažnog health PASS-a. Jedan dozvoljeni PDF upload proverava ovaj put. | Socket očekivano automatski; broker na zahtev. Root broker spušta child identitet prema postojećem ugovoru; nema dodavanja capabilities/relaksacije. |
| `clamav-daemon.socket` + `clamav-daemon.service`, clamd UID108, `/run/clamav/clamd.ctl` | Prihvaćena confinement i VERSION/loaded readiness u signature recoveryju. | Installed binaries/config paths/owner/modes, AppArmor/cgroup/consumer scope i readiness. Aktivni daemon ili PING nisu trusted signatures. | Postojeći boot/socket način proveriti; ako nema trusted reader-a, operatorov jedini uslovni recovery. |
| `clamav-freshclam.service`, UID108; `/etc/clamav/freshclam.conf`, root-owned ugovor | Prihvaćen fresh CVD download/isti updater PID u jednoj evidencijskoj epohi. Istorijski ownership108 i višestruki init su izazvali STOP. | Config/binary hash, ownership, cooldown, log/DB epoha i init kontinuitet. Ne ispravljati samo timestamp/chown pa proglasiti HEALTHY. Ne restartovati još jednom radi pokušaja. | Postojeći servis se može podići automatski, ali novo poverenje nije automatski dokazano. |
| `passvero-signature-health.timer`/`.service`; postojeći producer `/usr/local/libexec/passvero-signature-health.cjs`, health `/var/lib/passvero-signature-health/health.json` | 15-second scheduled producer; accepted fresh snapshot expires observedAt+60s. Reader iz stvarnog staging UID1001/socket grupe. | Tačan producer/config/reader bundle i protected pins, counter/locks/history, scheduled publication i reader acceptance. Stvarni enablement danas UNKNOWN. Oneshot inactive između poziva nije kvar. | Zakazane objave ako sve provenance premise važe; inače fail-closed i pregledani operator recovery. Nema ručnog producer poziva. |
| Reminders: `passvero-subscription-reminders.timer`/`.service`, launcher `/usr/local/libexec/passvero-subscription-reminders/launch.py` | [Timer](../scripts/subscription-reminders/passvero-subscription-reminders.timer): OnBootSec5min, OnUnitInactiveSec5min, Accuracy15s; [future enrollment](SUBSCRIPTION_REMINDERS_FUTURE_ORGANIZATION_ENROLLMENT.md) prihvaćen. | Installed launcher/worker/ACL i enablement/source hash, SENDING/UNKNOWN/in-flight i due metadata. Servis poziva postojeći staging worker kroz launcher; stvarni worker UID proveriti iz installed identity, ne izostaviti zbog systemd wrappera. | Normalno automatski; tokom demonstracije privremeno zaustavljen persistent-across-boot timer i drain pre reboot-a. Nema manuelnog worker poziva. |
| Staging backup/monitor: root oneshots `/usr/local/libexec/passvero-staging-backup/recurring.py`, odgovarajuće `.service`/`.timer` | [Unit definitions](../scripts/staging-recovery/recurring_package.py): daily04:30UTC; monitor hourly:20UTC; oba Persistent=false/Restart=no. A–D COMPLETE, CONTINUOUS/hold=false. | Tačni config/helper/canonical/build pinovi, last-valid freshness i aktivni recovery/job lock; nikakva promena repo/selector/retention/history. | Normalno zakazano, bez boot catch-up. Operator koordinira samo privremenu pauzu/povratak; ne poziva capture/monitor da „dokaže“ startup. |

**Host-wide granica:** dokumentacija identifikuje isti VPS `srv1834647` i lokalni
production main cluster pored acceptance klastera. Reboot celog hosta prekida sve
njegove procese, čak i bez izmene production konfiguracije. Aktuelni production
servisi/korisnici i njihov maintenance prozor su UNKNOWN. Ako „production netaknuta“
znači i bez prekida, ovaj host se ne reboot-uje: potreban je izolovan staging host
ili odlaganje. Običan restart staging servisa nije zamena za reboot acceptance.
Scanner recovery takođe zahteva potvrdu trenutnih clamd/Freshclam consumers; istorijski
staging-only consumer dokaz ne daje pravo na prekid novog production consumer-a.

## 3. Scanner: najmanji put do svežeg poverenja

Pre boot-a proveriti tačan executable manifest sadašnjeg builda i relevantne
nepromenjene reader/producer/scan ugovore. Dokumentovani marketing pinovi:

| Ulaz | Tačan dokumentovani identitet |
| --- | --- |
| build | `_tkSUOn0PCoHjpx8V7FVr` |
| canonical manifest `/var/lib/passvero-onboarding-deploy-2cb9d6e/application/manifest.json` | `e30e2afa0dc470b149f94f4437d032603a7cf7cfeb66fdc1a6b39b11fe52f590` |
| backup config `/usr/local/libexec/passvero-staging-backup/config.json` | `a79c6c856d5bb75fe17be7f47ec2e700250a6b9f3d916eed9dc08f76b328c839` |

Provera potrebnog deployed executable identiteta nije nova DB/Storage checksum
serija. Backup release pinovi ostaju tačno ovi ako nema zasebno odobrenog artifact
rollbacka. Git HEAD nije runtime pin i ne usklađuje se samo radi novog commita.

Konkretan source nalaz: [recovery script](../scripts/recover-document-signature-health.py)
u `guard()` još zahteva `8QNIYVVZWEsQaCL9uLZ5Q`; poslednji dokumentovani installed
aligned helper je `/usr/local/libexec/passvero-signature-recovery-v3/recover-release-8QNIYVVZWEsQaCL9uLZ5Q.py`.
Današnji installed helper je UNKNOWN. Ne izvršavati taj istorijski blok na novom
build-u. Budući paket prvo mora potvrditi installed source/zaštićene hashove i
kompatibilnost nepromenjenih reader/producer/scanner ulaza; ako je samo literal pina
zastareo, predlog je jedan novi zaseban checksum-pinned helper sa tačnim sadašnjim
literalom, uz očuvan original i uske guard provere. Nije izmenjen u ovom zadatku.
Svaki drugi nesklad je STOP, a ne dozvola za wildcard, proizvoljni HEAD ili širi patch.

Posle boot-a:

1. U startup pregledu čekati prirodne producer objave. Ako stvarni privatni reader
   prihvati tri uzastopne scheduled publikacije sa rastućim sequence/observedAt,
   validnim expiresAt i potvrđenom aktuelnom updater epohom, recovery nije potreban.
2. Ako ima kontinuitet/ownership/fresh-base nedostatak, sačuvati normalizovan CHECK_ID
   i uzrok, te izvršiti **najviše jedan** prethodno pregledan recovery iz
   [postojeće procedure](DOCUMENT_SIGNATURE_HEALTH_POST_RESTART_RECOVERY.md#recovery-contract-and-operator-entry-point).
   Root recovery lock/inode i sequence se čuvaju. Timer se zatvara, snapshot arhivira,
   stara konfiguracija/DB/logovi/metadata zadržavaju; novi official CVD period ide u
   zaseban recovery direktorijum sa očuvanim Freshclam cooldown-om. Nema brisanja.
3. Postojeći limiti ostaju: isti confined updater PID + successful fresh CVD completion
   ≤300s; daemon readiness ≤120s; tri consecutive scheduled reader-prihvaćene
   objave ≤100s. Health max60s/updater freshness24h i fail-closed bez izmene.
4. Tek zatim jedan benigni PDF scan. Nema nove EICAR/OOM/antivirusne matrice, lažne
   HEALTHY datoteke, timestamp pomeranja, ručnog producer-a ili uklanjanja lock-a.

Prekid/recovery failure → postojeća containment/rollback pravila, snapshot nije
validan, scanner ostaje NOT_READY. Rollback stare scanner konfiguracije ne vraća
stari TRUSTED snapshot: producer timer ostaje disabled prema ugovoru dok novi
validni period nije prihvaćen. Nema drugog recovery pokušaja ili reboot-a u seriji.

## 4. Auth, DB i Storage recovery granice

**Sa očuvanim podacima:** aplikacija i Better Auth koriste isti staging PostgreSQL
endpoint, sa odvojenim business/auth ulogama. Proveriti postojeći verified nalog i
prijavu lozinkom, novu sesiju i organizacioni kontekst; ne koristiti reset/activation
kao prečicu. Očuvana stara browser sesija može biti dodatno opažanje, ne zamena za
novu prijavu. Public landing200 ne dokazuje DB, auth ili tenant context.

**Posle gubitka DB/hosta:** prihvaćeni dump javnih tabela obuhvata aplikacijske
identitete/članstva i lokalne Better Auth tabele `AuthProviderUser`,
`AuthProviderAccount`, `AuthProviderSession` i verification podatke ako su prisutni
u tom setu, uključujući zaštićene password/session podatke; vrednosti se ne ispisuju.
Podatak o toj tabeli nije dokaz uspešne prijave. [PG DR granica](../docs/superpowers/runbooks/passvero-postgresql-disaster-recovery.md#recovery-boundary)
isključuje cluster-global uloge/password verifiers, HBA/server config, protected
runtime/Better Auth tajne, provider/backup/alert credentials i spoljni provider state.
Sačuvani/restore-ovani session token nije novo ovlašćenje: validnost/istek/opoziv i
odluke o uklanjanju moraju se ponovo primeniti pre otvaranja pristupa/slanja.

U trenutnom source-u auth provider je lokalni Better Auth; **Supabase Auth nije
pretpostavljen** samo zato što se koristi Supabase Storage. Turnstile/SMTP i svaki
stvarno konfigurisan spoljni identity provider ostaju zavisnosti van application
DB dokaza. Za takav provider nema PASS dok njegov konkretan state/secret/access
recovery nije zasebno utvrđen. Bez novih naloga, grants ili promene kredencijala.

**Storage:** DB sadrži provider/bucket/key/reference/status podatke; B je dokazao
lokalne obnovljene PDF/image bajtove i application reader nad tim fajlovima. To ne
obnavlja Supabase project/bucket konfiguraciju, dostupnost API-ja, access pravila ili
objekte na provider-u. Sa očuvanim provider-om jedan odobreni existing image/PDF read
u korisničkom toku zatvara dostupnost za taj tok, ne provider disaster recovery.

**Minimalni budući provider restore predlog, odvojen od reboot serije:** samo ako
je potreban provider DR dokaz, iz postojećih zadržanih restore fajlova odabrati po
jedan sintetički image i PDF, bez novog B2 downloada/DB restore-a. U novom praznom
isključivo staging recovery bucket/namespace-u, nakon zasebnog scoped odobrenja,
create-only vratiti ta dva objekta (`upsert=false` ili jednako strogi postojeći guard),
proveriti pristup i reference kroz izolovan reader. Ne menjati live bucket/ključeve,
postojeće identitete, DB reference ili tajne; ako adapter ne podržava bezbedno izdvojeno
mapiranje, prvo konkretan uski predlog, ne ad-hoc live kod. Zadržati dokaz i objekte
bez implicitnog cleanup-a. To dokazuje restore uz dostupnog providera, ne obnovu
celog Supabase projekta posle provider outage-a. Nije uslov niti operacija ove
startup demonstracije; status ostaje PROVIDER_RESTORE_NOT_PERFORMED.

## 5. Jedna buduća execution serija i rokovi

Predlog termina: **13.10.2026. 12:25UTC / 14:25CEST**, ukupno do12:55UTC /14:55CEST,
ili jedan drugi izričito izabran isti :25–:55 prozor. Sledeći dokumentovani monitor
je :20 narednog sata; staging capture je dnevno04:30UTC. To nije rezervisan termin:
jedan budući preflight potvrđuje typed D-Bus uint64 due vrednosti, aktuelan čas,
production/shared-host jobove i console pristup. Ako se prozori preklapaju, STOP
pre quiesce-a; ne preskakati/pomerati capture ili gasiti production posao.

Operativni ciljevi za odobrenje: **web i nova prijava ≤10min**, **ceo tok sa trusted
scan-om ≤20min**, **maksimalni maintenance prekid/oporavak sa rezervom ≤30min** od T0
(prvog privremenog zatvaranja automatizacije). Rokovi su predlog, ne dokazan RTO.
Na prekoračenje nema novog pokušaja; ostaje konkretan degraded status i operator
prelazi na incident/console pristup. Provider download cooldown/outage ne produžava
sam od sebe rok. Najviše **1 reboot + 1 uslovni scanner recovery + 1 korisnički tok**.

| Korak | Granica i očekivani ishod |
| --- | --- |
| P — jedan objedinjeni preflight neposredno pre T0 | Jedan sanitizovani paket: host/shared production consumers i jobs; out-of-band console; disk/network/clock; startup unit/dump/protected config identiteti; acceptance endpoint/DB read-only readiness; trenutni release/artifact i odvojeni scanner/helper pinovi; provider reference/prisustvo secrets bez vrednosti; unit enablement/dependencies i typed due; backup state/latest valid freshness; recovery/capture/worker active/locks; reminder due/in-flight/UNKNOWN metadata; konkretni sintetički nalog/proizvod/PDF i rollback lokacije. UNKNOWN koji utiče na bezbedan korak = STOP pre reboot-a, ne dodatna probe serija. |
| Q — jedna kratka koordinacija pre reboot-a | Pod postojećim job-lock ugovorom potvrditi da nijedan capture/restore/recovery nije aktivan. Worker mora biti inactive nakon prirodnog drain-a (najviše postojeći210s limit, bez kill/retry); nerazrešeni SENDING/UNKNOWN = STOP. Sačuvati baseline u root-private zapisu. Privremeno disable/stop samo tri staging timer-a backup/monitor/reminder, tako da sending ne krene na boot-u; bez promene campaigns/policy/recipients. Nije `--runtime` mask/pauza koja nestaje na boot-u. Pregledani konkretan mehanizam zavisi od preflight unit identiteta; nema ga sada. |
| R — najviše jedan reboot | Operator potvrđuje početak i T0/boot-id; nema instalacije, migracije, drugog reboot-a, resetovanja state-a ili production job operacije. Sistem podiže postojeći PG/network/proxy/PM2/qpdf/clam services prema potvrđenim pravilima. |
| S — jedan bounded startup pregled, T0+0–5min | SSH/console, novi boot-id, stvarni unit/PM2 identitet, loopback3001/acceptance5433, canonical HTTPS/TLS, qpdf socket; prirodne scheduled producer objave/private reader. Jedan pregled sa bounded readiness čekanjem, ne neograničeno polling. Nedostajući PM2 auto-start → STARTUP_FAIL čak i ako operator kasnije ručno vrati app. Web/auth rok10min ostaje. |
| C — samo po potrebi, do T0+15min | Najviše jedan pregledani fresh-base scanner recovery; očekivani300/120/100s unutrašnji limiti ostaju. Ako reader već prihvata valjan novi period, preskočiti recovery. Ako tačan helper/pin nije odobren pre reboot-a, ne improvizovati. |
| U — jedan kratak korisnički tok, do T0+20min | Postojeći verified synthetic nalog/organizacija, nova prijava → odabrani postojeći sintetički proizvod i slika → najviše jedan draft/benigni sintetički PDF upload, jedan explicit scan→CLEAN → authorized private download → najviše jedno odobreno publish tog draft-a i javni DPP/objekt pristup bez sesije. Sačuvati minimalne status/reference/digest dokaze, ne sadržaj/token. Ako javno publish nije odobreno, proveriti postojeću objavljenu verziju odvojeno i rezultat jasno ograničiti; ne tvrditi da je novi PDF javno isporučen. |
| Z — nezavisno zatvaranje, cilj T0+25min; rezerva do30min | Potvrditi release/pin/helper/backup-state/history identitete, health i stvarni timer baseline. Restore saved staging timer enablement/activity tek kad su artifact/DB/scanner/sending gate-ovi jasni i sledeći redovni termin bezbedan. Bez manuelnog backup/monitor/reminder poziva, bez catch-up-a. Vrati planirani prozor ili STOP/incident do30min; ponavljanje serije nije automatski odobreno. |

Kratki user tok je funkcionalno specifičan, bez nove testne matrice, performance
merenja ili višednevnog soak-a. Jedan benigni PDF nosi oznaku
`SYNTHETIC — STAGING RECOVERY DEMO`, bez privatnih podataka. Odabrani nalog i postojeći
proizvod moraju biti sintetički i obuhvat korisničkog ovlašćenja potvrđen u paketu;
nisu dati u ovom planu. Nema novih identiteta, aktivacije, pretplate, ponude/uplate,
emailova, broad backfill-a ili implicitnog brisanja demo dokaza.

## 6. Očuvanje automatizacija i zabrana slučajnog slanja

Sačuvati **tada aktuelne**, ne oktobarske fiksne brojače: state hash i
attempts/completed/failure/hold/mode/valid identitete, adapter/helper/config/worker
pinove, protected repo/selector, producer counter/epoch i reminder timer/worker/
enrollment/campaign/attempt/outbox/delivery history. A–D ostaje prihvaćen.
Priprema ne uvodi `hold=true`, reset brojača, catch-up capture ili novu backup politiku.
Backup disable/rollback iz starog runbooka koji menja hold nije zamena za ovu
kratku startup koordinaciju.

Preflight proverava da latest valid set neće preći stale>25h tokom prozora i da
sledeći capture/monitor imaju ceo30min prozor +15min rezerve. Izabrani :25 prozor
daje55min do narednog :20; kod skraćenog/nesigurnog prozora ne započeti. Prethodni
backup rezultat nije nova freshness potvrda. Ako je scheduled capture nekompletan,
job/restore aktivan ili postoji unresolved durable attempt, STOP; ništa se ne ubija.

Reminder OnBootSec5min znači da samo stop pre reboot-a nije dovoljan. Temporary
persistent-across-boot disable sa saved baseline mora biti spreman pre reboot-a,
bez uklanjanja unit datoteke ili trajne policy promene. Potvrditi da nema drugih
triggers koji mogu pokrenuti sending service. Nijedan recovery/smoke helper ne sme
pozvati worker, SMTP ili lifecycle email putanju; provereni nalog se prijavljuje
lozinkom, bez reset/verification email-a. UNTRUSTED scanner ostaje fail-closed.

Pre vraćanja reminder timer-a uraditi jedan minimalni read-only due/in-flight/UNKNOWN
pregled kao deo Z, bez slanja. Predlog za demonstraciju je **SMTP0 u celom verification
prozoru**. Ako postoji eligible/due poruka pri povratku, ne pretvarati je u „idle“:
STOP sending-resume, sačuvati queued stanje i prijaviti PARTIAL_AUTOMATION_RESTORE.
Normalno ranije odobreno slanje tek posle završnog gate-a ili izričito odobrene
varijante u paketu; činjenica da enabling OnBoot timer-a može odmah pokrenuti cycle
mora biti navedena, ne skrivena. Bez budžet reset-a, ponovnog slanja UNKNOWN-a ili
brisanja outbox-a; nema novih/trajnih recipients ili politike.

Backup/monitor se vraćaju na baseline i **isti naredni redovni due**, ne na ručni job.
Nema testne Telegram poruke ni signal testa. Normalan kasniji monitor može poslati
stvarni odobreni incidentni alarm; to nije dokaz inbox receipt-a niti implicitna
dozvola za testno slanje. Ako zatvaranje mora ostaviti neki staging timer pauziran,
tačno navesti koji, zašto i odgovornog operatora; acceptance tog kriterijuma nije PASS.

## 7. STOP, rollback i console pristup

STOP pre reboot-a: shared-host/production prekid nije odobren; console/rescue pristup
nije raspoloživ; nepoznat kritičan target/secret posture; release/pin/config mismatch;
aktivni job/worker ili unresolved state; nesiguran due/freshness; neodređen sintetički
scope; neodgovarajući scanner recovery guard. Bez promene granice ili retry-ja.

Ako SSH ne dođe do T0+5min, Darko preko prethodno potvrđene provider console/rescue
ulazi na VPS, proverava boot/disk/network i staging startup stanje uz zaštitu
production resursa. Console način/ovlašćenje sada UNKNOWN: to je preflight gate,
ne plan da se tek u incidentu otkrije lozinka. Do T0+10min neuspešan web/auth =
STOP; sačuvati boot-id, tačan CHECK_ID/normalizovan razlog i minimalan status.
Ne raditi drugi reboot, SSH reboot loop ili ad-hoc reinstalaciju.

Prethodni aplikacijski rollback za trenutni release je
[tačan upareni marketing rollback](evidence/marketing-visual-deploy-20261012/VPS-TERMINAL-ROLLBACK.sh),
sa retained artefaktima/root evidence namespace-om
`/var/lib/passvero-marketing-visual-deploy-20261012`. On vraća prethodni build
`853RYrj-r5cyoSGuJudap`, canonical
`b2a5866a532ecc9912fae5ebeb83086ff0a5f2d162b40a5c031723471ab898e9` i config
`c93266b5d07a7afcfb97ab9ebbbac49dc342348ec61344dc1e9d53f1e8ea1f9a`, uz sačuvane
nove slike i istoriju. To je referenca, **ne blok za automatsko pokretanje** u novoj
startup pauzi: postojeći wrapper očekuje svoj tačan active timer baseline i health.
Budući paket mora proveriti sačuvane artefakte i dati jedan uski operator rollback
redosled kompatibilan sa novom koordinacijom; ne prepisivati istorijski attempt.
Bez artifact kvara nema deploy rollbacka samo zato što je auth/scanner provider pao.

Startup konfiguracija ima nezavisni preflight snapshot unit/drop-in/enablement i
protected PM2 dump/metadata. Ako je budući paket odobrio minimalnu korekciju,
vratiti samo taj konkretan diff na sačuvano stanje i izvršiti najviše jedan pregledani
manual staging runtime recovery; AUTOMATIC_STARTUP ostaje FAIL/NOT_PROVEN za ovaj
reboot ako je ručna intervencija bila potrebna. Stari23.09 rollback vraća tadašnji
stopped runtime i uklanja dodati startup unit — nije opšti današnji rollback.
Ne prepisivati protected environment, menjati tajne ili vraćati dump druge aplikacije.

Scanner failure rollback je postojeći exact attempt rollback/containment: stare
konfiguracije/DB/logovi sačuvani, producer disabled i scanning NOT_READY ako novi
period nije validan. Ne vraćati expired HEALTHY. Jedan rollback/containment po
authorized component, bez drugog recovery pokušaja i bez DB/Storage restore-a.
Ako se server ne podigne, to je host incident/rescue izvan dokazanog startup RTO;
30min je eskalaciona granica, ne garantovani popravak. **Reboot se ne poništava**:
artifact/config rollback i host recovery su različite radnje.

## 8. Kratak završni acceptance

| Kriterijum | Postojeći dokaz | Nedostajući dokaz | Jedna predložena provera |
| --- | --- | --- | --- |
| Staging automatski posle reboot-a |23.09 startup service installed/enabled;12.10 marketing runtime/HTTPS PASS | Novi boot sa istim sadašnjim artefaktom bez ručnog resurrect-a | Jedan S pregled boot-id/unit/PM2/canonical HTTPS/PG readiness do5min; ručni recovery ne daje automatski PASS |
| Prijava i organizacioni kontekst | Raniji auth/onboarding/session/tenant ugovori; lokalni Better Auth DB scope | Funkcionalna nova prijava posle boot-a | Jedan verified synthetic login + očekivano članstvo/context u U; bez emaila/grant-a |
| Proizvod, slika i PDF reference/pristup | B DB/file/reference + privatni app reads PASS | Web/live provider access nakon boot-a | Jedan odabrani existing synthetic proizvod/slika i scoped PDF put u U; bez nove checksum serije |
| Bezbedan scanner ponovo spreman |02.10 recovery/trust/readers PASS;23.09 PDF smoke | Nova updater epoha i fresh private reader posle reboot-a | Tri prirodne scheduled reader prihvaćene objave + jedan benigni scan; najviše jedan uslovni C |
| CLEAN download i javni DPP | Raniji private/public DPP/malware i B byte-reader dokazi | Sadašnji session/public transport nakon boot-a | Jedan authorized CLEAN download i odobreni synthetic public DPP u U; verzija/reference potvrđene; ograničiti rezultat ako novi PDF nije publish-ovan |
| Backup/monitor/odobrene automatizacije vraćeni | A–D COMPLETE, CONTINUOUS/hold=false; poslednji closure timer/state/writer PASS | Sadašnje očuvanje/povratak nakon boot-a/pauze | Jedan Z uporedni state/pins/enablement/due i reminder queued/UNKNOWN pregled; bez pokretanja jobova/slanja |

Završni zbir daje zasebne statuse AUTOMATIC_STARTUP, AUTH_CONTEXT, DB_FILE_RESTORE_REUSED,
PROVIDER_ACCESS, SCANNER_FRESH_READER, CLEAN_DELIVERY_PUBLIC_DPP i AUTOMATION_BASELINE.
Ne agregirati PARTIAL/NOT_PROVEN u FULL_PASS. Provider disaster restore ostaje
NOT_PERFORMED, reboot ne dokazuje taj obuhvat. Unattended/dugoročni rad, production
ready, inbox receipt i nova AV coverage matrica ostaju zasebni statusi.

## 9. Jedan paket za odobrenje — najviše pet odluka

1. **Host/termin i dopušten prekid:** odabrati13.10 12:25–12:55UTC ili drugi jedan
   :25–:55 termin; prihvatiti ciljeve web/auth10min, full flow20min, maintenance30min,
   potvrditi console i da li je host-wide prekid co-hosted production dozvoljen.
   Ako nije, odložiti host reboot ili tražiti izolovanu staging infrastrukturu bez
   tvrdnje da je njen provisioning deo ovog plana.
2. **Automatizacije/slanje:** odobriti kratko persistent-across-boot staging timer
   zatvaranje i nezavisni baseline povratak bez policy/budget/recipient promena;
   birati SMTP0 verification window sa sending-resume STOP ako je due/UNKNOWN,
   ili izričito dozvoliti ranije odobreno redovno slanje tek po završnom gate-u.
3. **Sintetički scenario i javni scope:** odrediti jedan postojeći verified test
   nalog/organizaciju/proizvod i odobriti najviše jedan draft/PDF/scan/publish i
   javno prikazivanje sintetičkog sadržaja. Bez novih identiteta ili implicitnog cleanup-a.
4. **Minimalni startup/scanner korektivni obuhvat:** odobriti da budući pregledani
   paket, nakon jednog preflight-a, može sadržati samo tačno obrazloženu startup
   config korekciju ako je potrebna i jedan exact scanner recovery release-pin
   alignment/helper (bez backup repina). Svaki drugi nesklad zaustavlja paket;
   jedan recovery samo ako prirodni reader nije prihvaćen, bez dodatnog pokušaja.
5. **Granica disaster recoveryja:** potvrditi da ova serija prihvata startup sa
   očuvanim DB/provider-om i reuse B, dok Supabase/provider/secret disaster recovery
   ostaje NOT_PERFORMED/NOT_PROVEN; odabrati da li je izdvojeni create-only predlog
   iz §4 potreban kasnije. Njegovo izvršenje nije uključeno u reboot seriju.

Buduće jedno odobrenje odnosi se na konkretne odluke1–5 i jedan pregledani operatorski
paket P→Q→R→S→uslovni C→U→Z sa nezavisnim closure/rollbackom, tačnim installed hashovima,
fixture scope-om, timer baseline-om i console odgovornosti. Ovaj plan ne traži pet
pojedinačnih izvršnih odobrenja niti smatra UNKNOWN potvrđenim. Izvršne copy/paste
blokove pripremiti tek u zasebno odobrenoj execution pripremi; operator ih izvršava,
output zatvara gate i STOP zabranjuje automatsko ponavljanje.

## 10. Dokumentacijski skup i očuvanje

Ova celina menja samo ovaj novi plan i append u `codex/IMPLEMENTATION_ROADMAP.md`.
Pravni nacrt nije menjan; njegov početni SHA256 je
`b07e0fe8f187f40326741faa9bbb54ed13a20517a8f7a31c55510da9223c94e1`.
Puna početna radna roadmap verzija SHA256:
`747dca5aebd78e9ae69dd513fe06a3478a2aa878e8e586f3d0d522b17d0ef646`.
Readiness/pravni i ranije commitovani marketing/backup sadržaj se čuvaju kao tačan
prefix; nema ponovnog stagingovanja, istorijske hash normalizacije ili promene
starih acceptance/manifesta radi ove dokumentacijske dopune. Veze, ograničen diff i
whitespace proveravaju se lokalno; runtime UNKNOWN ostaje UNKNOWN.

**PLAN_READY / EXECUTION_NOT_STARTED / BACKUP_ACCEPTANCE_NOT_REPEATED**
