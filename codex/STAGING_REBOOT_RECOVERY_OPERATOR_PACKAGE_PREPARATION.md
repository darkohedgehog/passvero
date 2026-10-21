# Staging reboot recovery — finalizovani operatorski koraci

**LOCAL_TRIGGEREDBY_GUARD_CORRECTION=COMPLETE**

Istorijski pokušaj: **ATTEMPT_ABORTED_BEFORE_REBOOT / BASELINE_RESTORED**

**EXECUTION_NOT_STARTED / REBOOT_NOT_SCHEDULED / BACKUP_ACCEPTANCE_NOT_REPEATED**

Blokovi00 i01 imaju prihvaćen operatorski output: read-only priprema i source-only
instalacija. Preostali koraci tog pokušaja nisu izvršeni. Ažurirani00–12 su samo lokalni kandidati,
ne nalog za izvršenje ili ponovno otvaranje zatvorenog pokušaja. Nema automatskog prelaska između blokova ili zakazivanja reboot-a.
Operator Darko ima Hostinger console i prisutan je14.10.2026 od16:30Europe/Zagreb.
Potvrđeni prozor je **17:25–17:55CEST /15:25–15:55UTC**; shared-host kratki prekid,
uključujući production servise usled jednog reboot-a, ostaje odobren.

Pripremni tehnički preduslovi su razrešeni: [operatorski output00](evidence/staging-reboot-recovery-20261013/operator-00-preparation-accepted.json)
i [pregled](evidence/staging-reboot-recovery-20261013/preparation-00-review.json) potvrđuju
stvarno production PM2→Nginx/HTTPS mapiranje (public i local TLS `200 0`), prihvaćeni
staging release i kompletan retained rollback skup od757 fajlova za prethodni build.
Ovo je dokaz pripreme u trenutku opažanja, ne dokaz startup-a posle reboot-a.

[Operatorski rezultat01](evidence/staging-reboot-recovery-20261013/operator-01-installation-accepted.json)
potvrđuje source-only instalaciju u privatni operativni direktorijum i očuvan
original. Kandidat je instaliran kao zaseban helper; nije izvršen scanner recovery.
Backup pinovi i servisi nisu menjani. Blok01 se ne ponavlja.

[Pregled operatorskog02 outputa](evidence/staging-reboot-recovery-20261013/operator-02-preflight-review.json):
`PASS_REVIEW_BEFORE_Q` prihvaćen u opažanju14.10.2026 17:21:25 Europe/Zagreb.
Backup attempts4/CONTINUOUS/hold=false, današnji set završen, HEALTHY monitor;
svi tri tajmera active/enabled. Monitor next18:20, staging backup sutra06:30,
production backup sutra04:07:59 lokalno. Nema preklapanja potvrđenog prozora.
Sledeći korak je03 samo17:25–17:26, uz neistekli preflight i nove drift/idle provere.
Blok02 neposredno pred izvršenje
zatvara volatile gate-ove i zapisuje privatni baseline. Nijedan PASS ne zakazuje
reboot ili automatski izvršava sledeći blok. Ako priprema/02 nisu završeni pre17:25,
nema reboot-a u tom terminu bez novog dogovora.

## Ispravka bootstrap pakovanja nakon operatorskog STOP-a

Operator je vratio `LOAD_00_PREPARATION_READONLY / PACKAGE_MEMBER_CHANGED`.
U blokovima00 i01 konačni ugrađeni helper imao je ispravan sadržaj, ali zastareo
hash u bootstrap registru: `1c00c41ec6c641cd3900464052be70f5cdddd99f8e73dd7ec3e5062e8ec8ea91`.
Tačan postojeći hash je `e345ff23ad8ec01b80fb35aea12ba4aa6f5cc39b691f7cc42ff270f6a1543ad1`.
Uzrok je zamena generisanog dict literala zavisna od redosleda ključeva; ispravljena
je lokalna generacija i samo pins dodela blokova00/01. Guard nije oslabljen.
Izvršni helperi, instalacioni manifest i blokovi02–12 nisu promenjeni.

[Sačuvani STOP i stari/novi hashovi blokova](evidence/staging-reboot-recovery-20261013/package-member-failure-review.json).
[Ciljana lokalna provera](evidence/staging-reboot-recovery-20261013/check-bootstrap-package.py)
potvrdila je oba payload/pins/manifest skupa i odbijanje izmenjenog payload-a i
starog hash registra, bez izvršavanja helpera ili mrežnih poziva. Prethodna provera
embedded sadržaja nije proverila sam pins literal; ovaj propust sada je pokriven.

Ispravljeni00 je potom operator izvršio i vratio
`PASS_READ_ONLY_REVIEW_BEFORE_INSTALL`; pregled tog outputa je prihvaćen.
Blok00 se ne ponavlja. Istorija prvog STOP-a ostaje sačuvana.

## Potvrđeni dokazi i identitet

[Sažetak prihvaćenog scoped outputa](evidence/staging-reboot-recovery-20261013/operator-scoped-finalization-accepted.json)
čuva tačan backup/actor rezultat koji je korisnik vratio. To je point-in-time,
ne tvrdnja da broj attempts ili PID mora ostati zamrznut do14.10.

| Preduslov | Potvrđen rezultat |
| --- | --- |
| Actor | `zivic.darko79@gmail.com`; User ID `40e51001-912c-4bcf-aa45-d866632aac85`; verified/password identity i auth email match |
| Organizacija/članstvo | `bdc5aed5-b05a-42e6-895b-9f2f9f8a79a0`; membership `b954c03b-9c81-4760-bd63-83127b56bbb6`; organization i membership ACTIVE, organization role ADMIN |
| Prava | PRODUCT_READ/EDIT/PUBLISH iz organizacionog članstva, ne iz platform granta. Actual session/entitlement/kvote proveravaju se pre upload/publish u istom U toku. |
| Backup dopuna | PASS; attempts3, complete, CONTINUOUS/hold=false/failure=null; valid set `20261013T043001Z`; retained active.json je završeni zapis, ne aktivan capture |
| Closure/writer | pause6.915s, serviceResult success, stagingResumed i timerBaselineRestored true; backup service inactive; writer service inactive/dead, timer active/enabled/waiting; nema relevantnih aktivnih procesa u opažanju |
| Monitoring | HEALTHY u supplied observedEpoch1791901200; nova freshness se revalidira pred izvršenje |
| Startup/scanner | Saved enabled/active staging startup/dump i oba PG klastera online; producer/reader/pins i rollback metadata match. [Saved detalji](evidence/staging-reboot-recovery-20261013/operator-saved-preflight-details-20261013.json). Novi reboot/fresh trust još nisu dokazani. |

Startup korekcija je **NONE**: nema konkretnog nalaza koji je opravdava. Nema
novih grantova, identity-ja, promene uloge/lozinke ili protected env-a. DB/file restore
B i A–D se ponovo koriste. Provider/secret disaster recovery i unattended rad ostaju
NOT_PROVEN; Supabase objekti se ne obnavljaju iz B2 u ovoj seriji.

## Tačan release, source paket i scanner delta

Prihvaćeni staging build: `_tkSUOn0PCoHjpx8V7FVr`.

- Canonical `/var/lib/passvero-onboarding-deploy-2cb9d6e/application/manifest.json`:
  `e30e2afa0dc470b149f94f4437d032603a7cf7cfeb66fdc1a6b39b11fe52f590`.
- Backup config `/usr/local/libexec/passvero-staging-backup/config.json`:
  `a79c6c856d5bb75fe17be7f47ec2e700250a6b9f3d916eed9dc08f76b328c839`.
- Original installed helper `recover-release-8QNIYVVZWEsQaCL9uLZ5Q.py`:
  `3c1f0e5c4a04a57bc52d7e3ad3043f450cc9476a8b649e125354c75ce00f34d0`.
- Zaseban [kandidat](evidence/staging-reboot-recovery-20261013/recover-release-reviewed.py):
  `0e3938d06d6bcbfa9eab0249479bab5e54fe5162a3669a3026a39a0d204c4f44`.

[Ceo scanner diff](evidence/staging-reboot-recovery-20261013/scanner-exact-pin.diff)
menja samo `8QNIYVVZWEsQaCL9uLZ5Q` u `_tkSUOn0PCoHjpx8V7FVr` u postojećem
STAGING_RELEASE_CHANGED guardu. Original i svi drugi provenance/health/privilege/
reader/producer/cooldown/counter/lock guardovi ostaju isti. Nema wildcarda ili backup
repina. Git HEAD nije runtime pin. Stari helper se ne pokreće za novi release.

[Reviewable operations wrapper](evidence/staging-reboot-recovery-20261013/reboot-reviewed.py)
koristi postojeći job.lock, pinned prepare/capture/marketing helpers i originalni
signature recovery. Dnevnik ove jedne operacije je root-private
`/var/lib/passvero-reboot-recovery-20261014` (0700; source/records0600). Nije nova
recovery arhitektura, daemon ili trajni scheduler. Source clone se instalira u taj
nov namespace; original pod `/usr/local/libexec/...` nije prepisan.

[Instalacioni manifest](evidence/staging-reboot-recovery-20261013/installed-package-manifest.json)
i [konačni dokumentacijski manifest](evidence/staging-reboot-recovery-20261013/package-manifest.json)
navode tačne source hashove. Svi13 blokova proveravaju ugrađeni/pinned source;
instalacioni blok sadrži samo kompresovani tekst četiri pregledana Python fajla.
Nema app builda, dump-a, PDF/image bajtova, tajni ili pravnog nacrta u tom payloadu.

## Raspored i gate-ovi

Na17:25 do narednog monitora18:20CEST ostaje55min; to pokriva30min i15min rezerve.
Staging capture je04:30UTC/06:30CEST dnevno; sledeći nominalno15.10.
Production backup istorijski02:00UTC sa≤10min random delay; njegov **stvarni typed
next due** i inactive service proveravaju se u02 i03, bez pomeranja/gašenja.
Svaki stvarni preklop znači STOP pre mutacija, ne preskakanje posla.

| Kada/korak | Potpun blok; rezultat koji otključava sledeći korak |
| --- | --- |
|14.10 od16:30 —00 read-only priprema | [00-PREPARATION-READONLY](evidence/staging-reboot-recovery-20261013/VPS-TERMINAL-00-PREPARATION-READONLY.sh). Potvrđuje repo-anchored production očekivanje: PM2 app passvero/cwd /var/www/passvero, configured darko home/RPC, TLS server passvero.eu/location /→loopback3000, public i local SNI/TLS. Plus retained prethodni artefakt. Output **PASS_READ_ONLY_REVIEW_BEFORE_INSTALL** vratiti na pregled; STOP završava taj korak. Nema source instalacije/service promene. |
| Posle pregledanog00 PASS —01 source install | [01-INSTALL-REVIEWED-SOURCE](evidence/staging-reboot-recovery-20261013/VPS-TERMINAL-01-INSTALL-REVIEWED-SOURCE.sh). Zaseban manuelni instalacioni korak; scoped guards pre write-a, root-private code samo, original preserved. Output INSTALLED_SOURCE_ONLY ili identical ALREADY_INSTALLED_NOT_EXECUTED. Ne ponavljati kao opštu retry seriju. |
|17:21–pre17:25, posle prirodnog monitora17:20 —02 | [02-PREFLIGHT](evidence/staging-reboot-recovery-20261013/VPS-TERMINAL-02-PREFLIGHT.sh). Volatile release drift, backup state/freshness, jobs/locks, writer drain/in-flight, typed timer/prod due; isti known startup hashovi, actor/approved draft, production status/HTTP i source guard. Privatni preflight.json je evidence zapis; nema runtime mutacije. Output PASS_REVIEW_BEFORE_Q mora biti pregledan do17:25. |
|17:25–17:26, reviewed02 PASS —03 koordinacija | [03-QUIESCE](evidence/staging-reboot-recovery-20261013/VPS-TERMINAL-03-QUIESCE.sh). Pod existing job lockom ponovo proveri volatile drift, prirodni writer drain≤210s (bez kill-a), sačuva baseline i prvo disable/stop writer timer, zatim staging backup/monitor. Pauza preživljava boot. Recheck delivery/history/race. **QUIESCED** otključava04; svaki STOP ide na09/10. |
| Odmah posle03,≤120s odT0 —04 | [04-ONE-MANUAL-REBOOT](evidence/staging-reboot-recovery-20261013/VPS-TERMINAL-04-ONE-MANUAL-REBOOT.sh). Jedinstven intent pre jednog systemctl reboot; source/idle/pause guardovi. SSH disconnect nije PASS; **ne ponavljati04**. Novi boot-id u05 jedini je dokaz nove epizode. |
| Reconnect, doT0+5min —05 startup | [05-STARTUP](evidence/staging-reboot-recovery-20261013/VPS-TERMINAL-05-STARTUP.sh). Jedan bounded readiness pregled: novi boot, staging service/PG/qpdf/runtime/HTTPS i isti production PM2/status/public+local HTTPS. PASS i AUTOMATIC_STARTUP=PASS otključavaju06. Failure ostaje AUTOMATIC_STARTUP=FAIL i posle eventualnog11 manual recoveryja. |
| Odmah05 PASS, doT0+10min —U početak/06 | U browseru nova password prijava na staging (bez reset/verification emaila), tačna organizacija/proizvod/draft, proveri entitlement/kvote. [06-AUTH-GATE](evidence/staging-reboot-recovery-20261013/VPS-TERMINAL-06-AUTH-GATE.sh) revalidira identity/membership i uzima vremenski ograničene PASS opservacije sa /dev/tty, bez lozinke/tokene. auth-pass.json otključava07. Ovo je početak **istog jednog** korisničkog toka. |
| Posle06 —07, samo ako je potrebno | [07-CONDITIONAL-SCANNER](evidence/staging-reboot-recovery-20261013/VPS-TERMINAL-07-CONDITIONAL-SCANNER.sh). Do45s prirodnih scheduled reader objava. Ako tri uzastopne sveže prođu: PASS_NATURAL, recovery NOT_REQUIRED. Inače najviše jedan originalni recovery kroz checksum-pinned clone i bounded transient unit sa nezavisnim ExecStopPost containment-om. CVD300s/daemon120s/scheduled100s se ne menjaju. PASS otključava U nastavak/08. |
| U nastavak, doT0+20min —08 | Završiti jedan kontrolisani UI tok ispod, zatim [08-FLOW-PROOF](evidence/staging-reboot-recovery-20261013/VPS-TERMINAL-08-FLOW-PROOF.sh): read-only count/reference/digest/public status/audit + operator opservacije. Jedinstven flow-proof-attempt; PASS vezuje realne retained ID-jeve i unchanged staging delivery/policy/budget evidence. |
| CiljT0+25min, i pri grešci —09 | [09-INDEPENDENT-CLOSE](evidence/staging-reboot-recovery-20261013/VPS-TERMINAL-09-INDEPENDENT-CLOSE.sh) ne zahteva body PASS. Čita baseline, čuva state/hash/pins, vraća bezbedne timere i isti saved regular due; nikad manual job. Sending tek posle flow/app/fresh-reader/production/delivery gate-a. PASS ili tačan PARTIAL_AUTOMATION_RESTORE; sačuvati output. |

T0 je prvi baseline/pause, ne dolazak operatora. Source ograničava početak Q,
preostali prozor posle drain-a i deadline-ove; zakasnelost ne produžava prozor.
Za puni uslovni recovery potrebno je≥560s do C deadline-aT0+15min: posle normalnog
reader čekanja C ne kreće ako je proteklo≥340s odT0. Zato login/context proveriti
odmah posle05. Ako nema dovoljnog budžeta, STOP/partial, ne ubrzavati trust proceduru.
Web/auth10min i full20min su ciljevi, ne garancija. **17:55/T0+30min je eskalacija,
ne garantovani maksimalni prekid host incidenta.**

Dok02 nije pregledan do17:25, nema03/04. Ako dan/termin prođe ili operator nije
prisutan, novi dogovor; nema at/cron/autoreboot niti resetovanja neuspelog dnevnika.
Svaki blok se izvršava samo jednom u ovoj seriji; nema automatskog retry-ja.

## Jedan korisnički tok i lokalni fixture-i

[Tačan fixture scope](evidence/staging-reboot-recovery-20261013/fixture-scope.json):

- postojeći proizvod `c1c24c7c-334b-48bf-ba34-ac5fb930f1c2`, retained draft
  `a2e0ebe2-8305-4975-84f2-83b16d505536`, dedicated synthetic UI/PDF provenance;
- jedan PNG `/tmp/passvero-reboot-recovery-20261014/SYNTHETIC-STAGING-REBOOT-20261014.png`,
  blue checkerboard512×256, bez privatnih podataka;
- jedan671B PDF `/tmp/passvero-reboot-recovery-20261013/SYNTHETIC-STAGING-REBOOT-20261013.pdf`,
  SHA256 `fb914f8e768c1d5708f3bb3e2cd0c18ffd43095b235e06d8920f4f8445c245ec`;
- source bajtovi su lokalni, van Git-a; SHA/size PNG-a u scope-u. Proveriti prisustvo/
  hash pre termina; ne praviti novi identitet ili drugi proizvod ako nedostaje fixture.

Posle06 i07: otvoriti baš taj draft, proveriti sve postojeće sadržaje/preview kao
sintetičke, najviše jedan image upload i jedan PDF upload, jedan explicit scan,
authorized CLEAN download i jedna objava. Ne koristiti postojeći archived PDF
`fb953a8d-5f0b-4677-8330-fd3004533013`; nema ponavljanja cleanup-a. Bez billing,
offer/payment/activation/reclassification/role/recipient upisa. Ako app quota,
validation ili prava ne dozvoljavaju korak, STOP; bez zaobilaženja ili druge probe.

Autorizovani browser download sačuvati na LOCAL MAC kao
`/tmp/PASSVERO_REBOOT_AUTH_DOWNLOAD_20261014.pdf`, pa jednom:

```bash
shasum -a 256 /tmp/PASSVERO_REBOOT_AUTH_DOWNLOAD_20261014.pdf
```

Digest mora odgovarati odobrenom PDF-u. Zatim kontrolisano objaviti draft i otvoriti
javni DPP bez auth sesije, sa image/PDF pristupom. Terminal08 ne konstruiše user
context iz zadatog actor ID-ja i ne uploaduje/publish-uje iz root shell-a. CLI traži
PASS samo za stvarno uočene UI rezultate, sa timeout-om. Inputom se ne prenose
credentials ili tokens. Dokaz izDB/public HTTP i operator observations su odvojeni.

Image se normalizuje/metadata strip-uju: njegov stored checksum može se razlikovati
od ulaznog PNG-a.08 proverava READY/policy1,512×256 i stvarni stored digest/reference,
PDF AVAILABLE/CLEAN/policy2 sa istim upload/scan digestom, jednu published verziju,
tačno1 linked i novo-created image/PDF, audit ID-jeve i stvarni public code/HTTPS.
Višak ili orphan upload znači STOP, ne implicitni cleanup. Svi stvarni asset/document/
version/scan-attempt/audit ID-jevi ostaju u flow-pass.json; ne izmišljaju se unapred.

## Failure, containment, rollback i konzola

| Pogođeni slučaj | Ručan blok/preduslov i ishod |
| --- | --- |
| Glavni tok STOP, scanner unit još aktivan/failed ili interrupted | [10-CONTAIN](evidence/staging-reboot-recovery-20261013/VPS-TERMINAL-10-CONTAIN.sh). Zaustavlja samo transient conditional unit ove operacije ako postoji njegov intent; originalni scanner containment čuva journal/old bytes i fail-closed trust. Ne kreira drugi recovery attempt. Posle containment-a09. |
| Automatic startup failed, poznat staging runtime treba jedan manual povratak | [11-MANUAL-STAGING-RUNTIME](evidence/staging-reboot-recovery-20261013/VPS-TERMINAL-11-MANUAL-STAGING-RUNTIME.sh). Samo uz startup-fail marker, jednom restart postojećeg pm2-passvero-staging.service; nema dump/env/grant izmene. AUTOMATIC_STARTUP ostaje FAIL. Uraditi pre završnog09; nema ponavljanja05 ili novog user flow-a. |
| Dokazan executable artifact fault, ne provider/auth/scanner kvar | [12-PAIRED-ARTIFACT-ROLLBACK](evidence/staging-reboot-recovery-20261013/VPS-TERMINAL-12-PAIRED-ARTIFACT-ROLLBACK.sh), **PREPARED_ROLLBACK_ONLY**, uz incident pregled. Zahteva first-failure, known unchanged canonical/config metadata, paused automation i stvarni artefakt fault; zdrav artefakt se ne vraća radi provider kvara. Reuses postojeći paired rollback helper i retained old artifacts; jedan pokušaj. |
| SSH ne dođe doT0+5min ili host incident | Darko otvara potvrđenu Hostinger console, proverava boot/disk/network i source/package/known unit statuse, zatim odgovarajući10/11/09. Ne reboot-uje ponovo. Ako host ne može čitati disk/baseline, incident, tačan NOT_PROVEN/partial; nema root reinstall/pin/grant improvizacije. |

12 je pripremljeni incidentni fallback, **nije deo normalne serije niti nalog da se
sada pokrene**. Vraća reviewed prethodni build `853RYrj-r5cyoSGuJudap` i njegov tačan
canonical `b2a5866a532ecc9912fae5ebeb83086ff0a5f2d162b40a5c031723471ab898e9` /
config `c93266b5d07a7afcfb97ab9ebbbac49dc342348ec61344dc1e9d53f1e8ea1f9a` kao jedan
upareni povratak. To nije normalni backup repin za scanner/reboot ili Git HEAD.
Ne pozivati istorijski marketing --rollback wrapper koji pretpostavlja active timere;
novi wrapper koristi njegov pregledani paired_rollback primitive pod sačuvanom novom
koordinacijom. Source i current/failed artifacts, PNG assets, DB i audit se čuvaju.
Startup configuration diff jeNONE, zato nema config fajlova za „vraćanje“.

09 je nezavisan od body success-a i može vratiti monitoring i kadaDB/app/scanner
nisu spremni. Backup/writer koje nije bezbedno vratiti ostaju eksplicitno pending;
Darko je odgovoran za incident. Disabled calendar NextElapse=0 se ne tumači kao due:
koristi se saved typed calendar, posle enable se proverava isti normalni termin.
Ako je saved due već preblizu/prošao, nema ručnog catch-up-a; partial i pregled.
Ako je09 već zaključen partial, dalji incident oporavak nije prećutno nova serija.
Reboot se ne poništava; rollback artefakta nije host recovery.

## Očuvanje i završni acceptance

Tokom verification-a tri staging timer-a su persistent-across-boot disabled;
writer se prirodno drenira bez kill/retry. Source ne poziva capture/monitor/reminder/
SMTP/Telegram entrypoint. Staging delivery/attempt/campaign budget-recipient-policy/
enrollment metadata se hash-uje uDB i proverava nepromenjeno pre sending-resume;
email/token vrednosti se ne ispisuju. Ovo je dokaz za kontrolisanu staging seriju,
ne tvrdnja da je posmatran sav SMTP saobraćaj zajedničkog produkcijskog hosta.
Nema testne Telegram poruke; normalni kasniji monitor može poslati stvarni odobreni
alarm. Inbox receipt nije potvrđen tim signalom.

Backup state, valid set, complete/failure/hold/mode/attempts/history i tačni pinovi
se ne menjaju. Q usvaja tadašnji current normalni state (npr. novi redovni14.10 set),
ne forsira attempts3 ili poslednji13.10 set. Z ne poziva jobove radi PASS-a; nakon
završnog safety gate-a vraća approved ordinary automatizacije/slanje bez politike,
primalaca, budžeta ili UNKNOWN retry promene. Objekti i audit se ne brišu.

| Acceptance | Konačni dokaz iz jedne serije |
| --- | --- |
| Automatic startup |05 novi boot + stvarni services/runtime/TLS; bez manual recoveryja |
| Nova prijava/kontekst |06 stvarne bounded operator observations i fresh membership gate |
| Product/image/PDF |08 reference/version/normalized image/CLEAN digest + authed download |
| Scanner |07 tri natural scheduled reader objave ili jedan guarded fresh-base recovery |
| Public DPP |08 public HTTPS i operator bez-sesije image/PDF opservacija |
| Production/automatizacije |05/09 known production status/public+local TLS i timer/state/delivery/pin baseline |

PARTIAL/FAIL/NOT_PROVEN se ne pretvara u FULL_PASS. B/A–D ostaju prihvaćeni;
provider/secret DR, full host disaster recovery i unattended rad nisu dokazani.

## Pregled i trenutni status

Osam ciljanih lokalnih provera novog operatorskog koda: tačan start/deadline, same
TLS server/root proxy binding, production timer conflict read-only, immutable
records, one-reboot intent, partial independent closure sa disabled-zero due,
strict budget/ExecStopPost/no forbidden job calls i odbijanje healthy-artifact
rollbacka. Unmocked subprocess je zabranjen u testovima. Prethodni prihvaćeni app/
backup testovi/build/A–D nisu ponavljani. Svi13 blokova imaju shell/Python syntax i
embedded source/pin podudaranje; manifest/linkovi/whitespace provereni.

Pravni nacrt i prethodni odvojeni roadmap prefix sačuvani. Bez agentovog VPS/panel/
sudo/live pristupa, instalacije, restarta/reboot-a, app ili production konfiguracijskih
izmena, commita/pusha. Source aktuelnog zadatka nije imao mrežni poziv. Raniji
preflight presence bug i jedna failed unmocked curl provera ostaju u istorijskim
review JSON-ovima; nisu izbrisani ni promovisani u live dokaz.

**EXECUTION_STOPPED / PENDING_INDEPENDENT_CLOSURE** —03 je vratio STOP.
Pripremni00/01 i02 dokazi ostaju prihvaćeni; nisu odobrenje nastavka nakon STOP-a.
Otvorenih pripremnih tehničkih preduslova nema. Zadržani su obavezni volatile02/03
gate-ovi, provera stvarne prijave/kvota u budućem toku i zasebno operatorsko
izvršavanje. Source-only instalacija01 je potvrđena; nema runtime koordinacije, reboot-a
niti dokaza punog service recovery-ja.

**EXECUTION_NOT_STARTED / REBOOT_NOT_SCHEDULED / BACKUP_ACCEPTANCE_NOT_REPEATED**

## Operatorski03 STOP — bez nastavka reboot-a

[Sačuvani nalaz](evidence/staging-reboot-recovery-20261013/operator-03-quiesce-stop-review.json):
`QUIESCE / UNREVIEWED_SENDING_TRIGGER`. Guard `TriggeredBy` se proverava pre
i posle disable tajmera; post-pause systemd vrednost može nestati. Output ne
dokazuje da nije bilo delimične pauze. Ne ponavljati03, ne pokretati04/reboot/worker.
Sledeći je postojeći09 **PENDING_OPERATOR_COMMAND**, nezavisno zatvaranje.
Ako nema baseline-a očekuje se NOT_STARTED_NO_TIMER_CHANGE; ako postoji,
rezultat navodi restored/pending. Bez flow PASS-a writer može ostati pauziran;
to se ne proglašava punim vraćanjem. Output09 vratiti pre bilo kog daljeg koraka.
Uzrok i konačno stanje zahtevaju closure output; helper/pinovi se sada ne menjaju.

##09 delimično zatvaranje i abort baseline restore

[Pregled09 outputa](evidence/staging-reboot-recovery-20261013/operator-09-partial-closure-review.json):
backup/monitor vraćeni na sačuvane due termine, backup state i delivery nepromenjeni,
production online/TLS200/0. Writer ostaje pauziran; automatic startup NOT_PROVEN.
Ne ponavljati09 (čita sačuvani closure),03 ili reboot.

[13-ABORT-WRITER-BASELINE-RESTORE](evidence/staging-reboot-recovery-20261013/VPS-TERMINAL-13-ABORT-WRITER-BASELINE-RESTORE.sh)
— **VPS TERMINAL / PENDING_OPERATOR_COMMAND** — poseban završni gate nakon abort-a
pre reboot-a. Proverava isti boot, odsustvo reboot/scanner/user-flow koraka, exact
failure/closure, release/state, writer unit hashove i bez drop-inova, saved timer
baseline, idle poslove i nepromenjenu delivery evidenciju. Vraća samo ranije
enabled/active reminder timer (`enable --now`), bez ručnog worker/SMTP poziva.
Redovno ranije odobreno slanje time ponovo može krenuti. Čuva intent/PASS, originalni
STOP i partial closure; nema automatskog retry-ja. STOP vratiti, bez ponavljanja.
[Pregled novog bloka](evidence/staging-reboot-recovery-20261013/abort-writer-block-review.json).
Rezultat13 je neophodan za tvrdnju o punom vraćanju baseline-a; reboot tok ostaje
prekinut i zahteva zaseban dogovor, bez resetovanja istorije.

## Završetak prekinutog pokušaja —13 PASS

[Operatorski13 dokaz](evidence/staging-reboot-recovery-20261013/operator-13-abort-closure-accepted.json):
`PASS_ABORTED_BEFORE_REBOOT_BASELINE_RESTORED` prihvaćen. Backup/monitor su
vraćeni prema09 dokazu; writer timer active/enabled i servis activating/start,
TriggeredBy tačan timer. To dokazuje vraćen redovni trigger, ne završetak worker-a
ili potvrđenu isporuku. Normalno ranije odobreno slanje je nastavljeno.
Backup state nepromenjen, production PM2/servisi online, public/local TLS200/0.
Prvi failure i partial closure ostaju sačuvani. Reboot nije zahtevan; automatic
startup i puni service recovery ostaju NOT_PROVEN.

Ovaj pokušaj je zatvoren, bez daljih operatorskih komandi, resetovanja evidencije
ili automatskog retry-ja. Postojeći03 nije spreman za ponavljanje: TriggeredBy
proveru treba u zasebno odobrenoj pripremi razdvojiti na pre-pause i post-pause
stanje, uz očuvanje guardova, pregled nove verzije i novog termina. Nema nastavka
u ovom pokušaju niti tvrdnje FULL_SERVICE_RECOVERY=COMPLETE.

**ATTEMPT_ABORTED_BEFORE_REBOOT / BASELINE_RESTORED / AUTOMATIC_STARTUP_NOT_PROVEN / BACKUP_ACCEPTANCE_NOT_REPEATED**

## Lokalna phase-aware TriggeredBy korekcija — nije novi operativni pokušaj

[Pregled i tačni promenjeni fajlovi](evidence/staging-reboot-recovery-20261013/triggeredby-local-correction-review.json)
i [uzak helper diff](evidence/staging-reboot-recovery-20261013/triggeredby-local-correction.diff).
Dokazi i reprodukcija potvrđuju pogrešnu upotrebu istog pre-pause guard-a posle
`disable --now`; tačna raw TriggeredBy vrednost tada nije zabeležena. Ne tvrdi se
live dokaz da se statička veza uklanja pauzom.

Novi writer_guard odvaja exact service/timer konfiguraciju i odsustvo drop-inova
od runtime TriggeredBy/Triggers, enabled/active tajmera i inactive/dead/MainPID0
servisa. Pre pauze zahteva exact reviewed timer target/trigger i active/waiting/
enabled. Posle pauze zahteva inactive/dead/disabled i prihvata samo praznu ili
istu poznatu runtime vezu uz nepromenjene statičke hashove. Neočekivan trigger/
target, aktivan worker, nepotpuni podaci ili failed pause ostaju STOP. Existing
jobs/locks/delivery guardovi ostaju. TriggeredBy ne dokazuje odsustvo ručnog root
ili eksternog pokretanja; ne tvrdi se takva zaštita.

Paused varijanta se koristi posle quiesce pauze i u pre-reboot idle proveri.
Nezavisni close ostaje AST identičan. Šest fokusiranih testova sa lokalnim doubles
proverava pre/post stanje, retained static vezu, negativne slučajeve i dva closure
ishoda. To ne dokazuje live systemd/startup/recovery. Stari testovi/build/A–D se
ne ponavljaju.13 pogođenih blokova je syntax/hash provereno;02–12 imaju samo
nužno lokalno manifest vezivanje,00/01 novi helper payload i hash. Backup runtime
release/config pinovi i scanner kandidat nisu menjani.

[Istorijski helper](evidence/staging-reboot-recovery-20261013/historical-aborted-package/reboot-reviewed.py)
i prethodni blokovi/manifesti sačuvani su byte-for-byte u historical-aborted-package.
Operatorski JSON dokazi nisu menjani.13 abort restore ostaje istorijski vezan za
stari instalirani manifest; nije deo novog kandidata. Novi lokalni manifest ne
opisuje trenutno instalirani source: on je i dalje stara prihvaćena verzija.

Pre budućeg live pokušaja potreban je zaseban pregled novog identiteta/direktorijuma
pokušaja i termina, operator-managed instalacija i sveži volatile gate-ovi.
Stari datum/ATTEMPT/ROOT ostaju istorijski; ove blokove sada ne izvršavati.
Nema resetovanja istorije, instalacije, novog termina ili ponovnog otvaranja pokušaja.

`LOCAL_TRIGGEREDBY_GUARD_CORRECTION=COMPLETE`
`VPS_CHANGES=NO`
`REBOOT_EXECUTED=NO`
`BACKUP_ACCEPTANCE_REPEATED=NO`
`AUTOMATIC_STARTUP=NOT_PROVEN`
