# Staging reboot recovery — novi pokušaj 19.10.2026.

**ATTEMPT_CLOSED / BASELINE_RESTORED / AUTOMATIC_STARTUP=PASS / FULL_SERVICE_RECOVERY=NOT_PROVEN**

Ovaj dokument čuva prvobitnu pripremu i naknadne operatorske rezultate. Pokušaj
je sada zatvoren posle jednog reboot-a i tehničkog AUTH_GATE STOP-a; komande se
ne izvršavaju ponovo. Prvobitno je svaki operatorski blok bio zaseban
**VPS TERMINAL / PENDING_OPERATOR_COMMAND**; vratiti output na pregled pre sledećeg.

Termin: **19.10.2026. 17:25–17:55 Europe/Zagreb / 15:25–15:55 UTC**.
Darko je dostupan od16:45, uz SSH i Hostinger konzolu. Jedan shared-host reboot
može kratko prekinuti i poznate production servise; ranije ovlašćenje ostaje.
Nema automatskog zakazivanja.

## Identitet i kontinuitet

- Attempt/scanner recovery ID: `recovery-20261019-reboot-01`.
- Odvojen budući VPS state/source direktorijum:
  `/var/lib/passvero-reboot-recovery-20261019`.
- Odvojena lokalna evidencija: `codex/evidence/staging-reboot-recovery-20261019/`.
- Transient scanner unit: `passvero-reboot-scanner-20261019.service`.
- Prethodni pokušaj `recovery-20261014-reboot-01` ostaje zatvoren kao
  BASELINE_RESTORED, bez reboot-a. Njegov direktorijum, failure/closure, brojači,
  istorijski source/blokovi i rezultati ne menjaju se niti brišu.

[Postojeći plan](STAGING_FULL_SERVICE_RECOVERY_AND_REBOOT_STARTUP_PLAN.md),
[prethodni paket i UI/incidentni postupak](STAGING_REBOOT_RECOVERY_OPERATOR_PACKAGE_PREPARATION.md),
[pregled phase-aware korekcije](evidence/staging-reboot-recovery-20261013/triggeredby-local-correction-review.json).
Za novi pokušaj koriste se samo blokovi iz novog evidence direktorijuma, ne stare
komande i datumi. Detalji guardova, jednog korisničkog toka i console eskalacije
iz prethodnog plana se ponovo koriste; redosled i termin ispod su važeći.

Pregledani lokalni helper ima SHA256
`472cb2edc9516b6e28edda0810faaa26fc6a0f6af3c418b19df588a623bdceec`.
Podudaranje je potvrđeno pre pripreme; stari dokaz nije promovisan u live readiness.
Novi helper je doslovno ista logika uz zamene `20261014→20261019` i
`2026, 10, 14→2026, 10, 19` (ROOT, datum, attempt i transient unit reference).
Njegov SHA256 je
`303c110ea2ff3fa081f53818a27d20238b2621b3b00f444f0b8d5817ab2d87d7`.
Nema verifier/closure/scanner semantičke promene. Preflight/read-only/scanner
source fajlovi preneti su byte-for-byte. Novi preparation-readonly.py samo
objedinjuje postojeće scoped readere i provere identiteta novog/prethodnog paketa.

[Manifest lokalnog paketa](evidence/staging-reboot-recovery-20261019/package-manifest.json),
[manifest budućeg instaliranog source-a](evidence/staging-reboot-recovery-20261019/installed-package-manifest.json),
[doslovni binding diff](evidence/staging-reboot-recovery-20261019/attempt-binding.diff).
Pet tekstualnih Python članova je u bootstrap payloadu; nema build/dump/PDF/image
sadržaja, pravnog nacrta ili kredencijala. Paket nije instaliran.

## Očekivani installed identitet i zasebna instalacija

00 read-only proverava stari `/var/lib/passvero-reboot-recovery-20261014`:
helper `e345ff23ad8ec01b80fb35aea12ba4aa6f5cc39b691f7cc42ff270f6a1543ad1`,
manifest `9d165f83cecc87aa5a3cee557d36fc2c95f043f13bd32d345b5a4cef06eda622`,
četiri člana sa istim hashovima, privatne dozvole i sačuvani
`PASS_ABORTED_BEFORE_REBOOT_BASELINE_RESTORED` bez reboot-intent-a.
To su očekivanja iz prethodnog operatorskog outputa, ne novo VPS opažanje.
Nesklad znači STOP; bez pokušaja popravljanja ili prepisivanja starog source-a.

01 ponovo proverava taj identitet i originalni scanner helper, pa samo u novom
privatnom direktorijumu postavlja tačne payload bajtove/manifest/lock. Sačuva kopije
starog helpera i manifesta kao `preserved-installed-helper.py` i
`preserved-installed-manifest.json`; izvorni stari direktorijum ne dira.
Svaki instalirani član se pročita nazad, porede se bajtovi/hashovi i privatne
dozvole; nesklad je INSTALL_READBACK_MISMATCH/STOP. Nema instalacije preko novog
nepoznatog sadržaja. Čak ni identical ALREADY_INSTALLED ne znači izvršen recovery.
Original scanner helper ostaje na svojoj putanji; kandidat je zaseban private fajl.
Backup executable/runtime pinovi, state, kampanje i policy se ne menjaju.

## Jedan objedinjeni pripremni read-only blok

00 prikuplja samo potreban postojeći scoped obuhvat: exact release/pinove,
backup state/freshness/retained capture closure i postojeći job lock, odsustvo
capture/restore/worker procesa, typed due termine, writer/in-flight, poznati PM2
startup dump/unit, production PM2/Nginx/root+local TLS, postojeće članstvo/prava i
synthetic product/draft, scanner guard/recovery lock i postojeće rollback artefakte.
Nema novog inventara, app/DB upisa, source instalacije, job rezervacije ili slanja.
Postojeći exact release/rollback guardovi ostaju u operatorskom bloku; nisu sada
pokrenuti lokalno niti se priprema nova checksum/capture serija.

00 dopušta redovni monitor pre početka prozora (nominalno17:20), bez pomeranja ili
preskakanja; takav rani due ne proglašava potvrdom narednog termina posle monitora.
02 nakon17:20 mora ponovo pročitati actual next due i zahtevati postojeću≥45min
rezervu. Capture/prod due koji ulazi u rezervu znači STOP. Za stari raspored
nominalno ostaje monitor18:20, capture20.10.06:30 i production backup20.10.oko04:00
lokalno sa svojim postojećim jitter-om. Ovo nije aktuelni VPS dokaz; stvarne typed
vrednosti iz00/02 imaju prednost. Ne pomerati produkcijski posao.

## Operatorski raspored — lokalno vreme 19.10.

| Kada | Potpun VPS TERMINAL / PENDING_OPERATOR_COMMAND blok | Rezultat koji otključava sledeći korak |
| --- | --- | --- |
| Od16:45, dovoljno rano za pregled | [00-PREPARATION-READONLY](evidence/staging-reboot-recovery-20261019/VPS-TERMINAL-00-PREPARATION-READONLY.sh) | Pregledan `PASS_NEW_ATTEMPT_READ_ONLY_REVIEW_BEFORE_INSTALL`; executionUnlocked ostaje false. STOP: ništa ne instalirati. |
| Posle pregledanog00, pre završnog gate-a | [01-INSTALL-REVIEWED-SOURCE](evidence/staging-reboot-recovery-20261019/VPS-TERMINAL-01-INSTALL-REVIEWED-SOURCE.sh) | Pregledan INSTALLED_SOURCE_ONLY i exact helper/package readback; tek tada02. |
|17:21–pre17:25, nakon redovnog monitora17:20 | [02-PREFLIGHT](evidence/staging-reboot-recovery-20261019/VPS-TERMINAL-02-PREFLIGHT.sh) | Pregledan PASS_REVIEW_BEFORE_Q do17:25; fresh proof≤300s. Bez toga nema03/reboot-a u ovom terminu. |
|17:25–17:26 | [03-QUIESCE](evidence/staging-reboot-recovery-20261019/VPS-TERMINAL-03-QUIESCE.sh) | QUIESCED: baseline sačuvan, writer→backup/monitor pauzirani; phase-aware post-pause idle guard. STOP:09/10, bez ponavljanja. |
| Odmah posle pregledanog03,≤120s odT0 | [04-ONE-MANUAL-REBOOT](evidence/staging-reboot-recovery-20261019/VPS-TERMINAL-04-ONE-MANUAL-REBOOT.sh) | Jedan intent/request. SSH disconnect nije PASS; ne ponavljati. Reconnect vodi05. |
| Po reconnect-u, doT0+5min | [05-STARTUP](evidence/staging-reboot-recovery-20261019/VPS-TERMINAL-05-STARTUP.sh) | Novi boot-id, staging runtime/PG/qpdf/TLS i poznati production servisi/PM2/TLS; PASS otključava06. |
| Odmah, web/prijava cilj≤T0+10min | [06-AUTH-GATE](evidence/staging-reboot-recovery-20261019/VPS-TERMINAL-06-AUTH-GATE.sh) | Jedna password prijava i pravi tenant/context/entitlement; auth-pass otključava07. Bez resetovanja lozinke ili email verification poruke. |
| Posle06, samo po potrebi | [07-CONDITIONAL-SCANNER](evidence/staging-reboot-recovery-20261019/VPS-TERMINAL-07-CONDITIONAL-SCANNER.sh) | PASS_NATURAL ili najviše jedan recovery PASS. Isto ograničenje≥560s preostalog C budžeta; nema drugog pokušaja. |
| Isti jedan tok, cilj≤T0+20min | [08-FLOW-PROOF](evidence/staging-reboot-recovery-20261019/VPS-TERMINAL-08-FLOW-PROOF.sh) | Posle jednog image/PDF upload/scan/auth download/synthetic publish toka: PASS vezuje retained asset/document/version/audit ID-jeve. |
| Cilj≤T0+25min, i pri grešci | [09-INDEPENDENT-CLOSE](evidence/staging-reboot-recovery-20261019/VPS-TERMINAL-09-INDEPENDENT-CLOSE.sh) | Nezavisno vraća bezbedne automatizacije/baseline. PASS ili tačan PARTIAL; output obavezno pregledati. |
| Scanner/containment incident | [10-CONTAIN](evidence/staging-reboot-recovery-20261019/VPS-TERMINAL-10-CONTAIN.sh) | Samo transient unit novog pokušaja; fail-closed containment pa09. Bez novog recovery-ja. |
| Dokazan startup failure, uslovno | [11-MANUAL-STAGING-RUNTIME](evidence/staging-reboot-recovery-20261019/VPS-TERMINAL-11-MANUAL-STAGING-RUNTIME.sh) | Najviše jedan manual staging povratak; automatic startup ostaje FAIL. Zatim09, ne nova05 serija. |
| Samo pregledan executable artifact incident | [12-PAIRED-ARTIFACT-ROLLBACK](evidence/staging-reboot-recovery-20261019/VPS-TERMINAL-12-PAIRED-ARTIFACT-ROLLBACK.sh) | Existing exact app/pin rollback pair, uz incident pregled; zdrav artefakt/provider kvar se ne rollback-uje. Zatim09. |

T0 je baseline/pause, ne dolazak operatora. Web/prijava≤10min i tok≤20min su ciljevi;
17:55/T0+30min je granica eskalacije, ne garantovani maksimalni prekid. Ako priprema
ili02 nisu pregledani pre17:25, nema reboot-a bez novog dogovora. Svaki STOP se
čuva; bez automatskih pokušaja, drugog reboot-a ili resetovanja markera/brojača.
Ručni povratak ne pretvara failed automatic startup u PASS.

09 ostaje nezavisan i ne pretpostavlja puni tok. PARTIAL može ostaviti writer
pauziran. Stari13 je istorijski closure samo starog pokušaja; ne prevezivati ga
ili pokretati naslepo. Eventualni abort novog pokušaja zahteva pregled tačnog
closure outputa i konkretan baseline restore, bez otvaranja starog dnevnika.

## Jedan korisnički tok i preostali preduslovi

Postojeći nalog `zivic.darko79@gmail.com`; organizacija
`bdc5aed5-b05a-42e6-895b-9f2f9f8a79a0`; synthetic product
`c1c24c7c-334b-48bf-ba34-ac5fb930f1c2`, očekivani draft
`a2e0ebe2-8305-4975-84f2-83b16d505536`, bez published verzije.
Raniji ACTIVE org ADMIN nije zamena za svež00/02 membership readback ili realnu
session/entitlement/quota proveru u jednom toku. Nema novih identiteta/grantova/
role promena, komercijalnih akcija ili privatnih podataka u fixture-u.

Najviše jedan benigni512×256 image i jedan benigni PDF, jedan scan/autorizovano
preuzimanje i jedna kontrolisana sintetička objava. Pratiti već pregledani UI tok
prethodnog paketa; ovaj pokušaj koristi isti očekivani PDF digest:
`fb914f8e768c1d5708f3bb3e2cd0c18ffd43095b235e06d8920f4f8445c245ec`.
Nisu menjane fixture/hash ili image normalization provere.

Konkretni preostali preduslovi:
1. Operatorski00 read-only output, pregled installed/release/rights/state/due i
   source-only01 readback. Sadašnja priprema ih ne predstavlja kao izvršene.
2. Oba fixture-a su lokalno obnovljena iz originalnih sačuvanih generatora sa
   **identičnim potvrđenim hashovima**. [Novi lokalni scope](evidence/staging-reboot-recovery-20261019/fixture-scope.json)
   i [dokaz obnove](evidence/staging-reboot-recovery-20261019/fixture-recovery-review.json)
   zatvaraju raniji fixture blocker. Izvršni PDF digest i image identitet nisu menjani.
3. Pregledani02 neposredno pre početka, realna prijava/kvote u dozvoljenom toku i
   stvarna dostupnost operatora/Hostinger konzole u potvrđenom prozoru.

Tokom verification prozora nema SMTP slanja/testnih Telegram poruka. Posle finalnog
gate-a vratiti ranije odobrene automatizacije; normalno ranije odobreno slanje
može se nastaviti timerom, bez ručnog worker poziva/promene kampanja, primalaca,
budžeta ili policy-ja. Čuvaju se backup state/pinovi/istorija i delivery/audit.

Sada nisu izvršeni testovi, syntax serija, build, backup A–D/capture/restore/B2
operacije, checksum serije ili AV/EICAR/OOM matrica. Proverene su samo izmenjene
literalne reference, payload hashovi, manifest/linkovi/whitespace. Nema VPS/panel/
sudo izvršavanja, instalacije, restarta, reboot-a/deploya/migracije, slanja,
production promena, commita ili pusha. Pravni nacrt i stari roadmap sadržaj su
sačuvani. AUTOMATIC_STARTUP i FULL_SERVICE_RECOVERY ostaju NOT_PROVEN.

`NEW_ATTEMPT_PREPARED`
`EXECUTION_NOT_STARTED`
`REBOOT_NOT_SCHEDULED`
`LOCAL_TESTS_NOT_REPEATED`
`BACKUP_ACCEPTANCE_NOT_REPEATED`

## Obnovljeni originalni fixture-i i budući transfer

Originalni generatori pronađeni su u dokumentovanom session command arhivu:
PDF linija2749, image linija3013, session01a12637-4b19-7483-918c-a7bdacd5aff0.
Izdvojeno je samo sastavljanje bajtova u memoriji, bez izvršavanja ostalih komandi
iz zapisa. [Sačuvani generatori](evidence/staging-reboot-recovery-20261019/original-fixture-generators.py)
nemaju mrežu/subprocess/slanje ili operativne side-effect-e. Oba izlaza su hash i
byte-count identična starom fixture manifestu. Nema zamenskog kandidata.

Stabilni lokalni direktorijum (0700; oba fajla0600), van/tmp i isključen iz Gita
postojećim pravilom `.superpowers/brainstorm/`:
`/Users/darkozivic/Desktop/Programiranje/passvero/.superpowers/brainstorm/staging-reboot-fixtures-20261019/`.

- `SYNTHETIC-STAGING-REBOOT-20261013.pdf`:671B,
  `fb914f8e768c1d5708f3bb3e2cd0c18ffd43095b235e06d8920f4f8445c245ec`.
- `SYNTHETIC-STAGING-REBOOT-20261014.png`:2059B,512×256,
  `1ed5c1e5d6eff56de570af9a250598b0b7cd6547a1ce8c1634982918ed6a334d`.

Binarni fajlovi nisu Git/deploy payload. Nisu transferovani ni uploadovani.
U budućem već odobrenom jednom korisničkom toku, nakon06/07 gate-ova, u browser
file chooser-u koristiti navedene stabilne lokalne fajlove i uploadovati svaki
najviše jednom na tačan synthetic product. Za ovaj UI tok nije potreban SCP na
server. Ako se browser koristi na drugom operatorskom računaru, pre prozora
preneti samo ova dva fajla privatnim lokalnim putem i uporediti iste hashove na
odredištu; sada nije izvršen nikakav transfer niti server komanda.

Prvi operatorski korak ostaje isti00 read-only blok19.10 od16:45; vratiti output
pre01. Termin17:25–17:55 ostaje nepromenjen. FIXTURES_READY=YES označava samo
lokalnu dostupnost identičnih fixture-a, ne realni upload/scan/startup acceptance.
Preostali00/01/02 i stvarni session/entitlement gate-ovi ostaju obavezni.

`CONFIRMED_PDF_HASH_PRESERVED=YES`
`FIXTURES_READY=YES`
`VPS_ACCESS=NO`
`TESTS_REPEATED=NO`
`BACKUP_ACCEPTANCE_REPEATED=NO`
`NEW_WINDOW_SCHEDULED=NO`

##19.10 operatorski00 readback prihvaćen

[Sačuvani output](evidence/staging-reboot-recovery-20261019/operator-00-preparation-accepted.json)
i [pregled](evidence/staging-reboot-recovery-20261019/preparation-00-review.json):
PASS_NEW_ATTEMPT_READ_ONLY_REVIEW_BEFORE_INSTALL u16:45:22 Europe/Zagreb.
Exact attempt/helper/release, prethodni closed installed identitet, actor/draft,
startup baseline i757 rollback fajlova podudarni. Backup attempts9, completed
set20261019T043000Z, CONTINUOUS/hold=false/failure=null, monitor HEALTHY.
Writer unresolved0/activeLeases0/pendingCandidates0, safeToFinalizePause=true.
Sva tri tajmera active/enabled, production PM2/public+local TLS200/0.
Actual monitor due17:20, staging capture20.10.06:30, production backup20.10.04:03:58.
Ovaj rani monitor termin pre prozora nije dokaz sledećeg due nakon17:20.

Pregledani00 otključava samo01 source-only instalaciju u novi direktorijum;
operator treba vratiti helper/package readback pre02. Nema nove dozvole za
reboot iz samog00 PASS-a.02 ostaje17:21–pre17:25 nakon redovnog monitora,
zatim zasebni03/04 gate-ovi. Fixture preduslov je lokalno zatvoren; actual session/
entitlement/quota ostaju u budućem dozvoljenom toku. Nema ponavljanja00 bez nalaza.

##19.10 operatorski01 source-only readback prihvaćen

[Sačuvani01 rezultat](evidence/staging-reboot-recovery-20261019/operator-01-installation-accepted.json):
INSTALLED_SOURCE_ONLY za recovery-20261019-reboot-01. Helper303c110e… i
package dd9335c9… tačno odgovaraju manifestu; prethodni helper/manifest i originalni
scanner helper sačuvani. Backup pinovi/servisi nisu menjani, reboot nije zakazan.
Ovo nije scanner recovery niti startup dokaz.01 se ne ponavlja.

Sledeći korak02 **PENDING_OPERATOR_COMMAND**,19.10.17:21–pre17:25 Europe/Zagreb,
posle redovnog monitora17:20. Output PASS_REVIEW_BEFORE_Q mora se vratiti i biti
pregledan pre17:25; tek tada03. Bez prihvaćenog02 nema koordinacije/reboot-a u tom
terminu. STOP bez automatskog retry-ja, sa pregledom outputa/nezavisnim closure-om.

##19.10 operatorski02 finalni preflight prihvaćen

[Output02](evidence/staging-reboot-recovery-20261019/operator-02-preflight-accepted.json)
i [pregled](evidence/staging-reboot-recovery-20261019/preflight-02-review.json):
PASS_REVIEW_BEFORE_Q u17:21:17.457482 Europe/Zagreb. Backup attempts9,
completed set20261019T043000Z, CONTINUOUS/hold=false/failure=null, isti state SHA
kao00. Monitor17:20 HEALTHY; svi tri tajmera active/waiting/enabled. Actor/draft
isti, production public/local TLS200/0. Actual monitor next18:20, staging capture
20.10.06:30, production backup20.10.04:03:58 — van odobrenog prozora/rezerve.

Sledeći03 samo17:25–17:26, uz≤300s preflight proof i fresh drift/idle/lock provere.
Vratiti QUIESCED output na pregled pre04. Ovaj PASS nije reboot zahtev. STOP ne
ponavljati; pregledati output i sprovesti nezavisni09/10 prema stvarnom stanju.

##19.10 operatorski03 QUIESCED prihvacen

[Rezultat03](evidence/staging-reboot-recovery-20261019/operator-03-quiesced-accepted.json): QUIESCED, rebootRequested=false, smtpEntryCalls=0. PASS otkljucava samo jedan04 u source deadline-u do120s odT0.04 ne ponavljati; SSH prekid nije startup PASS. Posle reconnect-a05; pri STOP-u nezavisni09/10.

##19.10 operatorski05 startup PASS

[Output05](evidence/staging-reboot-recovery-20261019/operator-05-startup-accepted.json): startup PASS/AUTOMATIC_STARTUP PASS, novi boot379fc52e-5524-4b93-b6ec-b036d1953db7; production PM2/servisi online i public/local TLS200/0. Dokaz bounded automatic startup-a, ne punog scanner/auth/user-flow recovery-ja. Slede jedan novi password login i exact context/quota provera, zatim06 gate; pre07 nema upload/publish. Automatizacije i dalje pauzirane do finalnog closure gate-a.

##19.10 AUTH_GATE STOP - nezavisni closure

[Output06](evidence/staging-reboot-recovery-20261019/operator-06-auth-stop.json): AUTH_GATE/UnsupportedOperation, bez automatic retry-ja. Ovo je tehnicki izuzetak, ne dokaz neuspele prijave ili prava. Tacna izvorna poruka/stek nisu dostavljeni, pa uzrok nije potvrden.06 se ne ponavlja;07/upload/publish ne pokretati. Sledeci09 nezavisni closure PENDING_OPERATOR_COMMAND. Ako prijavi partial writer pause, vratiti output radi konkretnog pregleda; ne proglasavati baseline restored. Prihvaceni05 automatic startup PASS ostaje, puni recovery NOT_PROVEN.

##19.10 —09 partial closure i zaseban baseline restore

[Sačuvani09 output](evidence/staging-reboot-recovery-20261019/operator-09-partial-closure-accepted.json)
potvrđuje backup/monitor restored na iste due termine, state/delivery unchanged,
production online/public+local TLS200/0, automatic startup PASS. Samo writer timer
pending jer auth/scanner/full flow nisu završeni; to još nije BASELINE_RESTORED.

[13-POST-STARTUP-ABORT-WRITER-RESTORE](evidence/staging-reboot-recovery-20261019/VPS-TERMINAL-13-POST-STARTUP-ABORT-WRITER-RESTORE.sh)
je **VPS TERMINAL / PENDING_OPERATOR_COMMAND** zaseban završni gate samo za ovaj
AUTH_GATE/UnsupportedOperation abort, uz tačan prihvaćeni novi boot/startup PASS,
jedan reboot intent, odsustvo auth-pass/scanner/flow/manual-recovery markera i
poznat partial closure. Proverava exact installed manifest/source, originalne writer
unit hashove/drop-inove, phase-aware paused guard/MainPID0, odsustvo poslova,
release/state, redovne backup/monitor termine i nepromenjenu delivery evidenciju
bez unresolved/leases. Pod lockovima beleži jedan intent i enable --now vraća
samo prethodno enabled writer timer; nema ručnog worker/SMTP/scanner poziva.
**Redovno ranije odobreno slanje time ponovo može krenuti.**

Output mora biti pregledan. STOP se ne ponavlja; istorijski failure/partial closure
se ne menjaju. Zaseban PASS beleži baseline restore posle prekinutog toka, ne
FULL_SERVICE_RECOVERY PASS. Nema auth retry-ja, scanner pokretanja ili drugog
reboot-a. [Pregled bloka](evidence/staging-reboot-recovery-20261019/post-startup-abort-writer-review.json).

##19.10 završni closure — pokušaj zatvoren

[Operatorski13 rezultat](evidence/staging-reboot-recovery-20261019/operator-13-baseline-restored-accepted.json)
i [završni pregled](evidence/staging-reboot-recovery-20261019/final-attempt-closure-review.json):
PASS_POST_STARTUP_ABORT_BASELINE_RESTORED. Backup/monitor su vraćeni prema09 dokazu;
writer timer active/enabled, servis activating/start preko tačnog timer triggera.
Redovno ranije odobreno slanje je nastavljeno, bez ručnog worker poziva. Ovo ne
dokazuje završetak posla ili prijem poruke. Backup state nepromenjen; production
PM2/poznati servisi online, public/local TLS200/0.

Novi boot379fc52e-5524-4b93-b6ec-b036d1953db7 i AUTOMATIC_STARTUP PASS ostaju
prihvaćeni. AUTH_GATE/UnsupportedOperation i partial closure ostaju sačuvani.
Auth/scanner/korisnički tok nisu završeni; FULL_SERVICE_RECOVERY NOT_PROVEN.
Nije zahtevan dodatni reboot. Attempt je zatvoren bez daljih operatorskih koraka,
retry-ja, brisanja markera ili novog termina. Eventualna buduća lokalna analiza
tehničkog auth izuzetka zahteva zaseban zadatak; ovde nije izvršena korekcija/replay.

**ATTEMPT_CLOSED / BASELINE_RESTORED / AUTOMATIC_STARTUP=PASS / FULL_SERVICE_RECOVERY=NOT_PROVEN / BACKUP_ACCEPTANCE_NOT_REPEATED**

## Post-reboot auth/scanner STOP — dispozicija sačuvanih dokaza

Obuhvat ovog pregleda je samo05→06→09→13 zatvorenog pokušaja
`recovery-20261019-reboot-01`. Startup nije ponovo proveravan; nema novih live
opažanja ili izvršenih testova. Pregledani su [startup05 output](evidence/staging-reboot-recovery-20261019/operator-05-startup-accepted.json),
[prvi vraćeni failure06](evidence/staging-reboot-recovery-20261019/operator-06-auth-stop.json),
[partial closure09](evidence/staging-reboot-recovery-20261019/operator-09-partial-closure-accepted.json)
i [baseline restore13](evidence/staging-reboot-recovery-20261019/operator-13-baseline-restored-accepted.json).
Izvorni VPS first-failure.json nije zasebno eksportovan u lokalni paket; sadržaj
vraćenog STOP-a je sačuvan. Blok13 eksplicitno je proverio first-failure CHECK_ID i
reason pre prihvaćenog restore-a. Taj kasniji PASS potvrđuje te proverene podatke
i closure, ne dokazuje uzrok ranijeg izuzetka ili uspešnu prijavu.

| Izvršena/planirana tačka | Očekivano | Sačuvani rezultat i granica zaključka |
| --- | --- | --- |
|05 startup | Novi boot i poznati servisi/HTTP | PASS, AUTOMATIC_STARTUP PASS. Ostaje prihvaćeno. |
|06 AUTH_GATE | Fresh actor validation, dve stvarne operatorove auth/context opservacije, auth-pass.json | Prvi STOP: CHECK_ID=AUTH_GATE, reason=UnsupportedOperation, automaticRetry=false. Gate nije završen. |
|06 unutrašnji korak | Zabeležen tačan checkpoint/izuzetak | Exception message, traceback, izvorna linija, broj postavljenih promptova i auth-attempt sadržaj: NOT_RECORDED. Login UI uspeh i konačan rezultat06 actor validation: NOT_RECORDED. |
|07 scanner acceptance/recovery | Tek nakon auth-pass | NOT_RUN u zabeleženom operatorskom toku; nije SCANNER FAIL.13 eksplicitno je proverio odsustvo scanner-attempt markera. Stanje/trust samog scanner-a iz ovoga se ne zaključuje. |
|08 završni flow-proof | Posle06/07 i odobrenog jednog toka | NOT_RUN u zabeleženom toku;13 proverio odsustvo flow-pass. Pojedinačne browser radnje nisu ovim outputima zabeležene, ne pretpostavljaju se. |
|09 pa13 closure | Bezbedan povratak automatizacija i istorije | PARTIAL pa PASS_POST_STARTUP_ABORT_BASELINE_RESTORED; backup state/delivery očuvani. Writer aktiviran redovnim tajmerom, završetak posla/isporuka nisu dokazani. |

**Dokazan razlog zaustavljanja:** neobrađeni UnsupportedOperation pre završetka
AUTH_GATE, nakon čega je prema STOP instrukciji sproveden closure umesto07/08.
To nije sačuvani auth rejection, scanner failure ili dokaz pogrešnog operatorskog
redosleda. AUTH_GATE označava celu fazu, ne mesto izuzetka. Tačna klasifikacija
između harness I/O-a i drugog unutrašnjeg preduslova ostaje nepotvrđena.

Relevantan [helper source](evidence/staging-reboot-recovery-20261019/reboot-reviewed.py):
`auth_gate()` poziva actor validation i record pre `ask()` poziva; `ask()` koristi
`open('/dev/tty', 'r+')`, zatim write/flush/select/read. `main()` za nesanitizovane
poruke izuzetka beleži samo `type(error).__name__`; zato se iz UnsupportedOperation
ne može utvrditi izvorna operacija. R+ buffered terminal open je konkretna sumnja
na harness/TTY kompatibilnost, **hipoteza, ne potvrđen uzrok**. Nije sada lokalno
reprodukovana niti se predlaže ponovno pozivanje06.

### Jedna preporučena naredna radnja — izolovan TTY I/O probe

Predlog, nije implementiran niti izvršen: jedan operatorski **neprivilegovani**
probe u istom SSH/PTY kontekstu i istom `/usr/bin/python3` interpreteru na kojem
je pokrenut06. Ne učitavati recovery helper i ne pozivati njegove mode-ove.
Jednom pokušati samo otvaranje i zatvaranje `/dev/tty` sa identičnim `r+` režimom,
bez čitanja korisničkog unosa ili pisanja na terminal. Dobiti jedan sanitizovani
rezultat: Python verzija, stdin/stdout isatty vrednosti, oznaka operacije
TTY_OPEN_RPLUS, OPEN_OK ili exception class i tačna poruka izuzetka, uz samo
basename/liniju te izolovane probe ako postoji traceback. Bez raw okruženja,
kredencijala, istorije terminala ili app podataka. Ako nema controlling TTY-a,
prijaviti NO_CONTROLLING_TTY i STOP; ne menjati SSH/servis konfiguraciju.

Potrebno je zasebno ovlašćenje za taj jedan operatorski read-only VPS probe,
bez sudo/root-a, instalacije ili servisnih promena. Predlog ne daje nalog za
izvršavanje sada. Jedine I/O radnje su otvaranje/zatvaranje sopstvenog TTY fd-a i
sanitizovani dijagnostički stdout; nema source/state/DB/policy poslovnih mutacija,
auth opservacija, scanner/worker/SMTP/Telegram poziva ili reboot-a.

**Konačni acceptance ove jedne dijagnostike:** jedan sačuvan rezultat veže tačnu
operaciju, interpreter/TTY kontekst i exception class/message. Ako identičan
open reprodukuje UnsupportedOperation sa porukom o nepodržanom/nesekabilnom
stream-u, potvrđen je konkretan harness I/O problem koji objašnjava sačuvani tip
STOP-a; originalna tačna failing linija i dalje nije retroaktivno zabeležena.
Ako je OPEN_OK, drugi izuzetak ili nema controlling TTY-a, hipoteza nije potvrđena;
sačuvati rezultat i stati. Bez druge probe, automatske korekcije ili auth retry-ja.
Ovo nije acceptance auth/scanner/korisničkog toka.

Za izolovani probe nije potreban novi reboot. Eventualni budući nastavak preostalih
funkcionalnih provera takođe nema dokazan zahtev za novim reboot-om:05 startup
PASS je već prihvaćen. Međutim, stari06/07/08 imaju elapsed gate-ove vezane za
zatvoreni baseline/T0 i ne mogu se ponovo koristiti ili zaobići. Ovde se ne priprema
novi operativni plan; ne otvaraju se markeri i ne zakazuje novi termin.

`AUTOMATIC_STARTUP=PASS`
`FULL_SERVICE_RECOVERY=NOT_PROVEN`
`LIVE_ACTIONS_PERFORMED=NO`
`REBOOT_REPEATED=NO`
`BACKUP_ACCEPTANCE_REPEATED=NO`

### Ponovni lokalni pregled dispozicije —20.10.2026.

Ponovljen je samo pregled istih sačuvanih05/06/09/13 dokaza i relevantnih
`ask()/auth_gate()/main()` izvora; nema novog operatorskog ili live dokaza.
Nalaz ostaje isti: [06 AUTH_GATE STOP](evidence/staging-reboot-recovery-20261019/operator-06-auth-stop.json),
očekivane dve auth/context opservacije i auth-pass nisu završene; stvarni
exception message, podfaza/linija i browser login rezultat su NOT_RECORDED.
Ne zaključuje se auth/scanner kvar iz tipa izuzetka ili kasnijeg closure PASS-a.
Precizan neposredni STOP razlog je UnsupportedOperation; njegov izvor ostaje
neutvrđen.07/08 su NOT_RUN u zabeleženom toku, ne FAIL. Nezavršeni auth gate
jeste stvarni neuspeh harness faze; `open('/dev/tty','r+')` ostaje hipoteza.

Jedina naredna preporuka ostaje gore specificirani jedan neprivilegovani
operatorski TTY_OPEN_RPLUS probe, bez učitavanja starog helpera. Uz Python verziju,
stdin/stdout isatty i OPEN_OK ili exception class/message, zabeležiti i euid da se
ne izjednači budući neprivilegovani kontekst sa prvobitnim sudo pozivom. Završni
kriterijum je jedan sanitizovani rezultat koji potvrđuje ili ne potvrđuje tu
hipotezu; ako se tip/poruka ne reprodukuju ili nema controlling TTY-a, STOP bez
druge probe. Dijagnostički rezultat ne dokazuje retroaktivno originalnu failing
liniju niti predstavlja auth/scanner acceptance. Potrebno je zasebno odobrenje
za ovu jednu read-only operatorsku dijagnostiku; nema sudo/root potrebe, mutacije
servisa/state-a ili novog reboot-a. Ovde nije implementirana ni izvršena.
Zatvoreni pokušaj i njegovi istekli T0 gate-ovi ne otvaraju se ponovo.

`AUTOMATIC_STARTUP=PASS`
`FULL_SERVICE_RECOVERY=NOT_PROVEN`
`LIVE_ACTIONS_PERFORMED=NO`
`REBOOT_REPEATED=NO`
`BACKUP_ACCEPTANCE_REPEATED=NO`

## Jednokratna neprivilegovana TTY dijagnostika — pripremljeno, nije izvršeno

[Kompletan operatorski blok14](evidence/staging-reboot-recovery-20261019/VPS-TERMINAL-14-SINGLE-TTY-DIAGNOSTIC.sh)
je **VPS TERMINAL / PENDING_OPERATOR_COMMAND**, zasebna dijagnostika, ne nastavak
zatvorenog pokušaja ili mode starog harness-a. Samo operator izvršava blok jednom.

Iz [postojećeg06 source-a](evidence/staging-reboot-recovery-20261019/VPS-TERMINAL-06-AUTH-GATE.sh)
rekonstruisano je `sudo /usr/bin/python3 -I -B -` sa quoted here-document stdin-om,
bez eksplicitne stdout/stderr redirekcije.06 sadrži euid==0 guard; neprivilegovani
operatorov shell nalog nije isto što i euid istorijskog Python procesa.
Tačna Python verzija i stvarna isatty/PTY svojstva te stare sesije su NOT_RECORDED.
Nema tvrdnje da je sadašnja sesija identična istorijskoj ili da je uzrok dokazan.

14 koristi isti eksplicitni interpreter/flagove i here-document, ali **bez sudo**,
kao darko u interaktivnom SSH terminalu na srv1834647. Ne pipovati/redirektovati
blok ili menjati korisnika. Očekuje se stdin isatty=false zbog here-document-a,
stdout/stderr isatty=true; pogrešan kontekst se beleži bez TTY otvaranja. Ako je
pokrenut kao root ili evidence direktorijum nije privatan, odbija se bez probe
ili pisanja evidence fajla. Nema automatskog popravljanja konteksta ili druge kombinacije.

Blok beleži Python verziju/euid/tri isatty vrednosti. U prihvaćenom kontekstu
izvršava tačno jedno `open('/dev/tty','r+')`; pri uspehu odmah close, bez TTY
read/write/unosa. Tačan exception class/module/message ostaje u rezultatu.
Nema controlling TTY-a znači sačuvani OPEN_EXCEPTION sa stvarnom OS porukom;
bez ponovnog otvaranja ili alternativnog režima. Eventualni close izuzetak ostaje
zasebno označen OPEN_OK_CLOSE_EXCEPTION, bez ponavljanja.

Jedan JSON piše se u privatni0700 direktorijum trenutnog naloga
`~/.passvero-auth-gate-diagnostics/`, fajl0600
`recovery-20261019-reboot-01-single-tty.json`, uz O_EXCL/O_NOFOLLOW i flush/fsync.
Postojeći fajl se ne prepisuje: EVIDENCE_EXISTS_NO_RETRY/STOP, openAttempts0.
Ne brisati ga radi ponavljanja. Ako postoji greška pisanja/zatvaranja evidencije,
ne pretpostavljati da je rezultat sačuvan i ne ponavljati probe. U očekivanom
neprivilegovanom kontekstu i uhvaćen izuzetak ostaje sačuvan, a isti JSON se
prikazuje stdout-u. Prikazani evidenceFile daje tačnu operatorsku putanju.

Acceptance: jedan sačuvan JSON sa kontekstom i OPEN_OK ili exact exception class/
message, pa STOP i vraćanje tog outputa. Isti UnsupportedOperation potvrđuje samo
reprodukciju za taj poziv/kontekst, ne istorijsku failing liniju; OPEN_OK ne dokazuje
auth/harness ispravnost. CONTEXT_REJECTED znači da probe nije izveden, ne FAIL
auth-a. Tek nakon jednog operatorskog outputa upisati relevantan nalaz i jednu
narednu preporuku; bez automatskog nastavka ili implementacije.

Nema environment vrednosti, terminal history/session sadržaja, lozinki/tokena,
auth/scanner/browser/worker/service poziva, instalacije, restarta ili reboot-a.
Jedine pripremljene mutacije budućeg bloka su privatni direktorijum/jedan JSON
u nalogu operatora. Ovaj blok sada nije izvršen; nema testova/syntax serije/builda
ili ponavljanja backup acceptance-a, novih termina, commita ili pusha.

`DIAGNOSTIC_PREPARED`
`DIAGNOSTIC_EXECUTED=NO`
`AUTH_CALLS=0`
`SCANNER_CALLS=0`
`SERVICE_CHANGES=NO`
`REBOOT_REPEATED=NO`
`BACKUP_ACCEPTANCE_REPEATED=NO`

## Jedan TTY rezultat pregledan —20.10.2026.16:46:49 Europe/Zagreb

[Sačuvani operatorski14 rezultat](evidence/staging-reboot-recovery-20261019/operator-14-single-tty-result.json):
DIAGNOSTIC_EXECUTED, openAttempts1, evidenceSaved=true, bez automatic retry-ja.
Python3.12.3, euid1000, stdin isatty=false, stdout/stderr=true.
Tačno `open('/dev/tty','r+')` vratio je OPEN_EXCEPTION,
`io.UnsupportedOperation: File or stream is not seekable.`
Privatni operatorski JSON ostaje na navedenoj evidenceFile putanji; nije bilo
agentovog VPS pristupa niti nove probe.

**Dokazano:** konkretan R+ TTY poziv nije podržan u ovom zabeleženom neprivilegovanom
Python/SSH kontekstu. Reprodukovan je isti exception class kao u istorijskom
AUTH_GATE STOP-u, sada sa tačnom porukom/operacijom. To potvrđuje stvaran problem
kompatibilnosti ove harness I/O konstrukcije, ne autentičnost istorijske failing
linije: stari Python poziv koristio je sudo/euid0 guard, dok ova proba ima euid1000;
stara stvarna TTY svojstva i exception stack/poruka ostaju NOT_RECORDED.
Nema dokaza auth rejection-a ili scanner kvara. Auth/scanner/user flow nisu ovim
probe-om provereni i nisu promenili svoje prethodne statuse. Diagnostic acceptance
je zatvoren jednim sačuvanim rezultatom; nema druge kombinacije ili ponavljanja.

**Jedna preporuka za nastavak (nije implementirana):** uska lokalna korekcija
`ask()` koja zamenjuje buffered tekstualni `open('/dev/tty','r+')` jednim raw
`os.open('/dev/tty', os.O_RDWR | os.O_NOCTTY)` deskriptorom, sa bounded prompt
pisanjem preko os.write, postojećim select/deadline i bounded os.read, i obaveznim
os.close u finally. Sačuvati tačan PASS kriterijum, timeout, budžete i fail-closed
ponašanje; bez fallback režima, čitanja stdin here-document-a ili beleženja unosa.
Predlog je samo lokalna source priprema uz zasebno ovlašćenje; nije nova VPS
instalacija ili nastavak zatvorenog pokušaja.

Konačni acceptance te jedne korekcije: jedan fokusirani lokalni PTY regresijski
scenario pokaže da nova putanja može pročitati kontrolisani PASS bez seek-a,
odbija EOF/nevažeći odgovor/istek roka i u svakom ishodu zatvara deskriptor, uz
nepromenjene deadline/guardove. Ne izvršavati sada. To ne dodeljuje auth/scanner/
FULL_SERVICE_RECOVERY PASS. Nema dokazanog zahteva za novim reboot-om; postojeći
AUTOMATIC_STARTUP PASS i zatvoreni baseline ostaju. Eventualni funkcionalni nastavak
ne sme koristiti stare expired T0 gate-ove ili brisati stare markere.

`DIAGNOSTIC_EXECUTED_ONCE_AND_REVIEWED`
`AUTH_CALLS=0`
`SCANNER_CALLS=0`
`SERVICE_CHANGES=NO`
`REBOOT_REPEATED=NO`
`BACKUP_ACCEPTANCE_REPEATED=NO`
`AUTOMATIC_STARTUP=PASS`
`FULL_SERVICE_RECOVERY=NOT_PROVEN`

## Lokalna raw TTY korekcija — završena, nije instalirana

[Pregled svih promenjenih fajlova i rezultata](evidence/staging-reboot-recovery-20261019/raw-tty-local-fix-review.json),
[uzak diff](evidence/staging-reboot-recovery-20261019/raw-tty-local-fix.diff),
[fokusirani PTY test](evidence/staging-reboot-recovery-20261019/check-raw-tty-ask.py).
Promenjena je samo `ask()` u lokalnom helperu. AST ostatka modula, uključujući
serverski `auth_gate()` actor validation i `flow_proof()` provere, ostao je isti.
Ručni PASS nije zamena za server-side auth/context/entitlement dokaz.

Novi kod jednom otvara `/dev/tty` sa O_RDWR|O_NOCTTY|O_NONBLOCK. Koristi os.write,
select i os.read bez buffered r+ wrappera/seek-a; ne menja echo/canonical režim.
Postojeći prompt i production limit argumenti600/1200 nisu menjani. Preostali
existing baseline/T0/END budžet se jednom prevede u monotonični deadline koji
pokriva prompt, partial write/read, EINTR i EAGAIN. Nema obnavljanja roka po unosu.
Prihvata samo bajtove PASS+LF ili PASS+CRLF. Nema .strip, case-insensitive ili
alternativnih odgovora; leading/trailing razmaci/tab, EOF, timeout i I/O greška
odbijaju nastavak. Deskriptor se zatvara u finally.

Sedam novih fokusiranih lokalnih PTY testova PASS: tačni LF/CRLF i očuvan prompt
sa partial write; nevažeći case/razmaci/tab/extra; disconnect; no-input timeout;
partial input/EINTR/EAGAIN bez produženja roka; fragmentisan PASS uz wall-clock
skok; read/write I/O failure. Zatvaranje FD-a provereno je na success/failure
putanjama i terminal attributes se nisu promenili. Test izdvaja samo AST funkcije
ask, bez importa/pokretanja operativnog harness-a; /dev/tty se vezuje isključivo
na lokalni PTY. Kratki rokovi su samo testni argumenti. Test-only PTY je pre poziva
podešen za fragmentisane bajtove; aplikacijski kod ne podešava terminalski režim.
Početni lokalni fixture sa starim text open dobio je SIGHUP129; zamenjen je fail-fast
zabranom tog wrappera. Nakon toga red→green i svih sedam novih testova PASS.
To nije ponovljena VPS dijagnostika niti dokaz istorijske failing linije.

Installed helper ostaje303c110ea2ff3fa081f53818a27d20238b2621b3b00f444f0b8d5817ab2d87d7,
a installed source manifest dd9335c96a78f61341b99a5600b251fc95e55e7ceaf390bbc0e46a997dc842aa.
Sačuvani su [stari helper](evidence/staging-reboot-recovery-20261019/historical-installed-pre-raw-tty/reboot-reviewed.py)
i [stari installed manifest](evidence/staging-reboot-recovery-20261019/historical-installed-pre-raw-tty/installed-package-manifest.json).
Lokalni kandidat ima SHA256:
`4da924e0640d13fbe9858a7bd6a6899891ebcb43ca4f3e6ae52dc09e388722d1`.
[Zasebni lokalni source manifest](evidence/staging-reboot-recovery-20261019/local-raw-tty-source-manifest.json)
razlikuje novi worktree helper od prethodne installed verzije. Postojeći00–14
operatorski blokovi/payloadi i installed-package-manifest nisu menjani: ostaju
istorijski vezani za installed303c110e… snapshot, ne za novi worktree helper.
Nije pripremljena nova operativna serija niti instalacioni blok za novu verziju.

Proverena je syntax samo dva pogođena Python fajla, ne serija nepromenjenih
blokova. Hash/payload vezivanja starih00/01 potvrđena su prema sačuvanom installed
source-u; lokalni candidate manifest prema novom helperu. Linkovi/manifest i
whitespace provereni. Prethodni testovi/build/backup A–D nisu ponavljani.

Ovo je samo lokalni dokaz TTY korekcije. Buduća zasebno odobrena live provera
nedovršenog auth/scanner/user toka ostaje otvorena; sada nema instalacije,
AUTH_GATE/scanner poziva ili korišćenja zatvorenih T0 gate-ova. Istorijska linija
pada sudo koraka06 ostaje NOT_RECORDED; jedna neprivilegovana dijagnostika potvrđuje
samo svoj zabeleženi kontekst. AUTOMATIC_STARTUP PASS i closed baseline ostaju
netaknuti; pravni nacrt, roadmap, failure/closure dokazi i runtime pinovi sačuvani.

`LOCAL_RAW_TTY_FIX=COMPLETE`
`VPS_CHANGES=NO`
`AUTH_CALLS=0`
`SCANNER_CALLS=0`
`REBOOT_REPEATED=NO`
`BACKUP_ACCEPTANCE_REPEATED=NO`
`AUTOMATIC_STARTUP=PASS`
`FULL_SERVICE_RECOVERY=NOT_PROVEN`
