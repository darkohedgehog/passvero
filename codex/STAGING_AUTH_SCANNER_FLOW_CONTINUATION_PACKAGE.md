# Auth → scanner → synthetic flow — jedan continuation paket

**ATTEMPT_CLOSED / PASS_BASELINE_RESTORED / FUNCTIONAL_CONTINUATION=NOT_PROVEN**
**Lokalni dokaz: PASS. Operatorski nastavak zaustavljen na AUTH timeout-u i zatvoren; ne otvarati ponovo.**

Ovo je samo priprema. Ne izvršavati komande sada. Jedini fajlovi namenjeni
copy/paste-u u terminal su jasno označeni `.sh` blokovi; `.json` i `.diff` su
izveštaji za čitanje, **nisu komande**.

## Identitet i dokazni obuhvat

- Continuation ID i zasebni scanner recovery ID: `continuation-20261020-auth-flow-01`.
- Novi budući root-private source/state: `/var/lib/passvero-auth-flow-continuation-20261020-01`.
- Nova lokalna evidencija: `codex/evidence/staging-auth-scanner-continuation-20261020/`.
- Jedina buduća conditional unit: `passvero-auth-flow-scanner-20261020-01.service`.
- [Zatvoreni pokušaj](STAGING_REBOOT_RECOVERY_NEW_ATTEMPT_20261019.md) ostaje
  BASELINE_RESTORED. [Startup PASS dokaz](evidence/staging-reboot-recovery-20261019/operator-05-startup-accepted.json)
  je istorijski prihvaćen rezultat, ne nova startup opservacija ovog nastavka.
  Njegovi failure/closure markeri, budžeti i datumi nisu kopirani kao novi dokazi.
- [Pregledani raw TTY fix](evidence/staging-reboot-recovery-20261019/raw-tty-local-fix-review.json):
  sedam PTY testova PASS, helper SHA256
  `4da924e0640d13fbe9858a7bd6a6899891ebcb43ca4f3e6ae52dc09e388722d1`.
  Ponovo je potvrđen samo hash; testovi nisu ponavljani.
- Istorijska linija AUTH_GATE pada ostaje NOT_RECORDED. Jedna ranija neprivilegovana
  dijagnostika i lokalni PTY test ne pretvaraju je u definitivno dokazan uzrok.

[Manifest](evidence/staging-auth-scanner-continuation-20261020/package-manifest.json),
[exact source package](evidence/staging-auth-scanner-continuation-20261020/source-package.json),
[pregled promena i zavisnosti](evidence/staging-auth-scanner-continuation-20261020/preparation-review.json).

## Nužna nova izvršna putanja — eksplicitno odvojena od prihvaćenog koda

Pregledani raw helper, scoped readers i scanner recovery helper kopirani su bez
izmene bajtova. Raw helper je biblioteka, ne alat koji operator samostalno pokreće.
Stari main/auth/startup/reboot/quiesce/close mode-ovi se ne pozivaju.

Nova putanja je [continuation-reviewed.py](evidence/staging-auth-scanner-continuation-20261020/continuation-reviewed.py).
[Zaseban diff novog adaptera](evidence/staging-auth-scanner-continuation-20261020/continuation-adapter.diff)
pokazuje sve nove izvršne odluke; [scanner binding diff](evidence/staging-auth-scanner-continuation-20261020/scanner-binding.diff)
izdvaja nužno vezivanje starog scanner wrappera na novu jedinicu/ExecStopPost/
monotonični continuation budžet. [Context binding](evidence/staging-auth-scanner-continuation-20261020/context-binding.json)
navodi eksplicitno H.ROOT/H.ATTEMPT/H.END podešavanje biblioteke za stvarni NOVI
baseline. To nije tvrdnja da je kompletan adapter identičan ranije testiranom kodu.

Novi adapter:

- prihvata istorijski startup samo kroz označenu referencu i zahteva aktuelni
  release, proces/DB scope, prava, target i lock/timer/sending preduslove;
- pre browser koraka proverava target draft/publication i image/document reference
  u svim verzijama, plus moguće orphan fixture assete po nazivu/PDF digest-u.
  Ako išta postoji, STOP radi konkretnog pregleda/reuse odluke; nema automatskog
  ponovnog upload-a, brisanja, resetovanja ili objave postojećeg nepoznatog sadržaja;
- nakon jedne browser prijave ne prihvata samo ručni PASS: zahteva ponovo ACTIVE
  membership i tačno jednu novu aktivnu AuthProviderSession za postojećeg actor-a,
  vezanu kroz AuthIdentity i AuthSessionSelection za odobrenu organizaciju;
  query vraća samo brojeve, bez tokena/IP/user-agent vrednosti. Prava i kvote i
  dalje sprovode postojeći server-side application gate-ovi tokom stvarnog toka;
- čuva autentičan novi baseline/t0/startMonotonic/bootId, bez startup-pass fajla
  ili fabriciranja starih state markera. Iste stale T0 gate-ove ne zaobilazi;
- pauzira samo writer timer. Backup/monitor ostaju active/enabled; zahteva≥45min
  rezerve do njihovih i production due termina. Ne preskače ni pokreće scheduled job;
- uvek ima zaseban close/contain put. Na abort pre poslovnih promena i pre scanner
  pokušaja može vratiti isti writer baseline ako su release/state/delivery/idle
  guardovi očuvani. Posle delimičnog flow-a ili neuspelog scanner-a može vratiti
  PARTIAL i zadržati slanje pauzirano; tada nema tvrdnje o uspešnom zatvaranju.

**Lokalna zavisnost je zatvorena:** [fokusirani test](evidence/staging-auth-scanner-continuation-20261020/test_continuation_local.py)
i [zabeleženi rezultat](evidence/staging-auth-scanner-continuation-20261020/local-continuation-proof.json)
potvrđuju tačno dve putanje sa lokalnim doubles, bez učitavanja operativnih helpera:

- uspešna: novi baseline → auth/context sa novom session/org selekcijom → već
  spreman reader → jedan flow intent → sintetički rezultat postojećeg flow proof-a
  → nezavisno učitan close vraća writer baseline;
- odbijena: oba ručna odgovora su PASS, ali nova session bira drugu organizaciju;
  CONTINUATION_AUTH odbija FRESH_SERVER_SESSION_AND_ORG_SELECTION_NOT_PROVEN,
  scanner/flow ne kreću; nezavisno učitan close vraća writer baseline i čuva
  first-failure i baseline bajtove.

U oba slučaja backup state i backup/monitor baseline ostaju nepromenjeni.
Nije pronađen propust koji je zahtevao promenu guard semantike; jedina promena
adaptera je status lokalnog dokaza i `LOCAL_CONTINUATION_PROOF_ACCEPTED=True`.
Tačan candidate/test SHA256 nalazi se u lokalnom dokazu i manifestu. Instalacioni
blok i payload/hash veze obnovljeni su za taj kandidat; flag se ne menja na VPS-u.

Doubles ne dokazuju stvarni SQL, live systemd, browser/auth, scanner recovery ili
slanje. Testirana je natural-ready reader grana; conditional recovery nije pozivan,
ni stvarno ni kao operativni helper. Njegov postojeći exact helper ostaje neizmenjen.
Nisu ponavljani PTY testovi, startup ili backup acceptance. Lokalni PASS nije
instalacija ili live acceptance. Prvi read-only00 ostaje PENDING_OPERATOR_COMMAND;
njegov aktuelni rezultat, lokalni fixture rezultat i pregled otključavaju01.
Ovaj zadatak ne daje nalog za izvršavanje tih blokova sada.

## Aktuelni identitet, instalacija i rollback

Prvi VPS preflight očekuje stari installed helper:
`303c110ea2ff3fa081f53818a27d20238b2621b3b00f444f0b8d5817ab2d87d7`
i source manifest:
`dd9335c96a78f61341b99a5600b251fc95e55e7ceaf390bbc0e46a997dc842aa`
u `/var/lib/passvero-reboot-recovery-20261019`.
Očekivanje nije nova live potvrda; svaki nesklad ili nov/unknown root znači STOP.

Posle pregleda00 i fixture rezultata, uz sada sačuvan lokalni executable dokaz, zaseban01
instalira **tačne neizmenjene raw helper4da… bajtove** i zasebni adapter u novi
root0700/source0600, proverava svaki readback i source-package hash. Originalni
helper i manifest kopiraju se kao preserved-installed-helper.py i
preserved-installed-manifest.json; stari direktorijum se ne prepisuje.
Nema promene runtime application/backup release pinova niti globalnog alias-a.

Source rollback znači odustajanje od korišćenja novog zasebnog direktorijuma uz
čuvanje svih njegovih fajlova; prethodni helper/manifest su ostali netaknuti.
To **ne znači pokretanje starih zatvorenih mode-ova**. Runtime automatizacije
vraća nezavisni07. Postojeći app rollback artefakti se samo read-only proveravaju
pre početka; nisu pripremljen nalog za app deploy/rollback u ovom nastavku.

## Jedan preflight, odvojeni lokalni/VPS konteksti

[LOCAL MAC00 — fixture integrity](evidence/staging-auth-scanner-continuation-20261020/LOCAL-MAC-00-FIXTURE-INTEGRITY.sh)
je samo za postojeći lokalni Mac direktorijum. Daje FIXTURES_MATCH za PDF i PNG
sa potvrđenim digestima. Agent je tokom pripreme proverio sadašnje hashove;
taj dokaz nije garant njihove kasnije dostupnosti kod browser upload-a.

**Prvi kompletan VPS TERMINAL / PENDING_OPERATOR_COMMAND blok:**
[00-READONLY-PREFLIGHT](evidence/staging-auth-scanner-continuation-20261020/VPS-TERMINAL-00-READONLY-PREFLIGHT.sh).
Jedan rezultat ograničen je na trenutne release/pin/helper identitete i rollback,
actor/product/artefact state, scanner guard/reader readiness, postojeće active
poslove/lockove i actual typed due vrednosti, writer/in-flight i unresolved access
notification sending stanje. Nema startup acceptance/infrastructure inventara.
Nema lozinke ili auth sesije u terminalu. Lokalne fixture-e VPS ne može da pročita
sa Mac putanje: rezultat tu eksplicitno zahteva zaseban LOCAL MAC FIXTURES_MATCH,
ne predstavlja ga kao server opažanje. To je jedan preflight korak sa dve jasno
razdvojene lokacije, ne niz alternativnih VPS dijagnostika.

Pošto browser koristi lokalne fajlove, transfer fixture-a na VPS **nije potreban**.
Ako je browser na drugom operatorskom računaru, potrebna je samo privatna kopija
ista dva fajla na taj računar uz iste hashove; odredište se ne izmišlja i nema
pripremljenog ad-hoc server transfera. Izvršni helper se prenosi kroz pregledani
self-contained01 payload; sada nije izvršen nikakav transfer ili instalacija.

## Budući redosled i gate-ovi — bez novog maintenance termina

Potreban je prisutan operator sa browserom i SSH-om do30min od stvarne koordinacije,
uz aktuelnu≥45min rezervu prema stvarnim job/timer terminima. Ne predlaže se datum
ili sat. Ne zaustavlja se web i nema reboot/startup koraka. Ako conditional scanner
recovery bude potreban, scanner/doc scan spremnost privremeno je fail-closed u
obimu već pregledanog recovery helpera; nema ad-hoc restarta ili production zahvata.

Sve sledeće komande su **VPS TERMINAL / PENDING_OPERATOR_COMMAND**. Lokalni dokaz
je prihvaćen; stvarni rezultati prethodnih operatorskih gate-ova obavezni su pre nastavka.

| Korak | Kompletan blok / browser radnja | Šta otključava sledeći korak |
| --- | --- | --- |
|P | LOCAL MAC FIXTURES_MATCH + [00 read-only](evidence/staging-auth-scanner-continuation-20261020/VPS-TERMINAL-00-READONLY-PREFLIGHT.sh) | Pregled aktuelnih činjenica, odsustvo prethodnih asseta i FIXTURES_MATCH, uz lokalni adapter proof PASS; tek tada01. |
|I | [01 instalacija](evidence/staging-auth-scanner-continuation-20261020/VPS-TERMINAL-01-INSTALL-RAW-HELPER-AND-ADAPTER.sh) | INSTALLED_SOURCE_ONLY, puni installed candidate/source-package readback, prethodni helper/manifest preserved. |
|Q | [02 writer-only koordinacija](evidence/staging-auth-scanner-continuation-20261020/VPS-TERMINAL-02-COORDINATE-WRITER-ONLY.sh) | WRITER_PAUSED_BACKUP_MONITOR_UNCHANGED, stvarni novi baseline. T0 počinje ovde; svi fresh guardovi ponovljeni pre pauze. |
|A | Nova browser password prijava u odvojenom svežem browser kontekstu, tačna organizacija/proizvod/draft, entitlement/kvote; zatim [03 auth/context](evidence/staging-auth-scanner-continuation-20261020/VPS-TERMINAL-03-AUTH-CONTEXT.sh) | Dve stvarne opservacije + server session/selection/membership proof u auth-pass. Lozinka isključivo browseru, nikad terminalu/chatu. Jedna prijava; bez reset/verification emaila. |
|S | [04 fresh reader ili jedan recovery](evidence/staging-auth-scanner-continuation-20261020/VPS-TERMINAL-04-FRESH-READER-OR-ONE-RECOVERY.sh) | Tri prihvaćene prirodne scheduled reader publikacije → PASS_NATURAL_SCHEDULED_READER/recovery NOT_REQUIRED. Inače samo jedan exact scoped recovery, ako ima preostalog budžeta. |
|U-start | [05 jedan flow intent](evidence/staging-auth-scanner-continuation-20261020/VPS-TERMINAL-05-ONE-FLOW-INTENT.sh) | Ponovo prazan ciljni proizvod, fresh accepted reader i jedan zabeležen budžet upload/scan/publish. Tek tada UI mutacije. |
|U | Jedan image/PDF/CLEAN/download/publish tok ispod, zatim [06 flow-proof](evidence/staging-auth-scanner-continuation-20261020/VPS-TERMINAL-06-FLOW-PROOF.sh) | Zasebne stavke login/context, scanner, image, PDF CLEAN, download, anonymous DPP/prilog i retained audit; baseline restore još PENDING. |
|Z | [07 nezavisni close](evidence/staging-auth-scanner-continuation-20261020/VPS-TERMINAL-07-INDEPENDENT-CLOSE.sh), i pri grešci | PASS_BASELINE_RESTORED ili tačan PARTIAL/pending. Samo complete items + safe restore daje PASS_CURRENT_STATE_ONLY. Nije retroaktivni reboot FULL_PASS niti provider DR. |
|Incident scanner | [08 own recovery contain](evidence/staging-auth-scanner-continuation-20261020/VPS-TERMINAL-08-OWN-RECOVERY-CONTAIN.sh), zatim07 | Samo ovaj novi transient unit/attempt, nezavisno od parent lock-a; artefakti retained, bez novog recovery-ja. |

Svaki output vratiti na pregled. STOP ne ponavljati i ne nastavljati preostale
mode-ove. Deadline: auth≤T0+10min, scanner≤T0+15min, flow≤T0+20min, close cilj≤25min,
30min eskalacija. Ako treba conditional recovery, početak mora ostaviti postojeći
≥560s budžet do scanner deadline-a: posle≤45s natural reader čekanja ne kreće
recovery ako je proteklo≥340s odT0. Zato spora prijava ne daje automatsko produženje;
STOP/close umesto drugog pokušaja ili promene limita.

## Exact scanner alat i budžet

Raw TTY helper4da… **nije scanner recovery alat**. Zasebni recovery fajl:
`recover-release-reviewed.py`, SHA256
`0e3938d06d6bcbfa9eab0249479bab5e54fe5162a3669a3026a39a0d204c4f44`.
Njegovi byte-for-byte guardovi čuvaju `_tkSUOn0PCoHjpx8V7FVr`, postojeće config/
producer/reader pinove, provenance, consumer i disk/scope provere. Ne menjaju se
updater/producer/qpdf/reminder konfiguracije, primaoci ili budžeti.

Najviše jedan conditional recovery kroz Restart=no, bounded RuntimeMax/stop,
novi zaseban ID/unit i nezavisan ExecStopPost scanner-close. Failure čuva tačan
scanner phase/reason; nema resetovanja starog pokušaja, lažnog health JSON-a,
preskakanja trust pravila, EICAR/OOM matrice ili ručnog pokretanja reader/producer
oneshot-a. Provera fresh reader-a je read-only korišćenje postojećeg reader-a,
ne proizveden testni health dokaz.

## Jedan sintetički korisnički tok

Postojeći `zivic.darko79@gmail.com`, org `bdc5aed5-b05a-42e6-895b-9f2f9f8a79a0`,
product `c1c24c7c-334b-48bf-ba34-ac5fb930f1c2`, draft `a2e0ebe2-8305-4975-84f2-83b16d505536`.
[Fixture reference](evidence/staging-auth-scanner-continuation-20261020/fixture-reference.json)
vezuje postojeći Git-ignored lokalni direktorijum:
`.superpowers/brainstorm/staging-reboot-fixtures-20261019/`.

1. Posle A/S/U-start, jednom uploadovati SYNTHETIC-STAGING-REBOOT-20261014.png i
   potvrditi image prikaz. Originalni SHA256:
   `1ed5c1e5d6eff56de570af9a250598b0b7cd6547a1ce8c1634982918ed6a334d`.
   Aplikacijska normalizacija menja stored bytes: zadržane su postojeće READY,
   policy1 i512×256 provere, ne lažno poređenje stored image sa originalnim SHA.
2. Jednom uploadovati SYNTHETIC-STAGING-REBOOT-20261013.pdf, jednom explicit SCAN,
   sačekati CLEAN i AVAILABLE za isti digest/scan attempt/policy2. Ne kliknuti
   ponovo ako je spor/unknown rezultat. Ne koristiti stari arhivirani smoke PDF.
3. Autorizovano browser preuzimanje sačuvati na lokalnom Mac-u u privatni fixture
   direktorijum kao AUTH-DOWNLOAD-continuation-20261020-auth-flow-01.pdf. Jednom
   pokrenuti [LOCAL MAC06 integrity blok](evidence/staging-auth-scanner-continuation-20261020/LOCAL-MAC-06-AUTH-DOWNLOAD-INTEGRITY.sh); SHA256 mora biti tačno
   `fb914f8e768c1d5708f3bb3e2cd0c18ffd43095b235e06d8920f4f8445c245ec`.
   Ne slati PDF bajtove/lozinke/tokene u chat ili terminal.
4. Jednom kontrolisano objaviti isti draft. U zasebnom anonymous browser kontekstu
   otvoriti stvarni javni DPP i njegov approved image/PDF prilog. Bez izmišljanja
   publicCode putanje; koristiti aplikacijski link.
5.06 read-only proverava retained DB asset/document/version/digest/scan/audit
   i opservacije. Ne uploaduje, ne skenira i ne publish-uje iz root shell-a.
   Ako gate/kvota/prava odbiju korak, STOP, bez grants/role/identity/plan promene.

Budžet je jedan budući tok: nova prijava, image1, PDF1, explicit scan1,
authorized download1, kontrolisana objava1, conditional recovery0ili1, reboot0.
Operator se uzdržava od onboarding/access-request/approval/reset/password email,
ponuda/uplata ili drugih send-producing staging tokova tokom verifikacije.
Ne tvrdi se globalni SMTP kill switch: poznati reminder/notice in-flight gate-ovi
moraju biti prazni, writer je pauziran, a svaka delivery/policy/budget promena
poništava acceptance. Ako nema kontrolisanog staging konteksta bez konkurentnih
send-producing radnji, STOP pre koordinacije; ne menjati globalni email config.

07 vraća samo sačuvani writer baseline nakon bezbednosnog gate-a. Redovno ranije
odobreno slanje tada može ponovo krenuti; nema testnih Telegram poruka, manual
SMTP/worker poziva, promene kampanja/primalaca/budžeta. PARTIAL se ne proglašava
FULL_PASS; ne brisati podatke ili audit da bi closure postao zelen.

## Samo konkretne preostale zavisnosti

1. Pregled svežeg00 + LOCAL MAC fixture rezultata; zatim zaseban01 readback.
   Lokalni dokaz adaptera je PASS, ali aktuelni release/installed scope, prazan
   target i scanner readiness se ne pretpostavljaju iz istorije.
2. Stvarna dostupnost operatora/browsera i dovoljno slobodan prozor prema actual
   typed due terminima; nema novog maintenance termina ili automatskog zakazivanja.

Pokrenut je samo novi fokusirani lokalni test: dve putanje, obe PASS.
Nisu ponavljani PTY testovi, syntax serija, build, startup/backup acceptance,
VPS/panel/sudo/auth/scanner komande ili browser tok. Nema transfera, instalacije,
servisnih promena, poslovnih upisa, slanja, runtime repina, commita ili pusha.
Pravni nacrt, prethodni roadmap i svi istorijski source/evidence fajlovi sačuvani.

`EXECUTION_NOT_STARTED`
`REBOOT_REQUIRED=NO`
`LOCAL_TESTS_REPEATED=NO`
`BACKUP_ACCEPTANCE_REPEATED=NO`
`AUTOMATIC_STARTUP=PASS`
`FULL_SERVICE_RECOVERY=NOT_PROVEN`

## Dostavljeni read-only00 — pregled operatorskog outputa

[Pregled dostavljenog rezultata](evidence/staging-auth-scanner-continuation-20261020/operator-00-preflight-review.json)
je označena projekcija korisnikovog outputa, ne novi live poziv niti sirovi terminalski
transkript. Opažanje: 2026-10-20 15:25:05 UTC. Backup set20261020T043000Z je završen,
attempts10, CONTINUOUS/hold=false, HEALTHY; capture closure potvrđuje resume i vraćen
writer baseline. Sva tri tajmera su active/enabled/waiting. Do monitora je tada
ostalo približno54min54s, pa je45min rezerva prošla u trenutku opažanja; instalacija
i koordinacija ponovo proveravaju aktuelne termine, bez ponavljanja backup acceptance-a.

Actor ima ACTIVE ADMIN članstvo u tačnoj ACTIVE organizaciji i prava READ/EDIT/PUBLISH.
Ciljni draft postoji, nema objavljene verzije ni prethodnih fixture asseta.
Browser session, entitlement i kvote i dalje čekaju svoje aplikacijske gate-ove.
`reader=null` znači da fresh scanner readiness nije potvrđen ovim opažanjem;
uzrok nije dijagnostikovan. Nema scanner recovery-ja pre auth-a; budući04 ponovo
čita reader i tek uslovno koristi jedan pregledani recovery.

`executionUnlocked=false` je očekivan preflight rezultat. Sledeći jedini korak je
**LOCAL MAC TERMINAL / PENDING_OPERATOR_COMMAND**:
[LOCAL-MAC-00-FIXTURE-INTEGRITY.sh](evidence/staging-auth-scanner-continuation-20261020/LOCAL-MAC-00-FIXTURE-INTEGRITY.sh).
Vratiti njegov FIXTURES_MATCH/STOP output i stati pre01. Preflight ne dokazuje
lokalne browser fajlove, instalaciju, auth, scanner ili korisnički tok.

## Dostavljeni LOCAL MAC00 — fixture preduslov zatvoren

[Operatorski FIXTURES_MATCH](evidence/staging-auth-scanner-continuation-20261020/operator-local-00-fixtures-match.json)
potvrđuje originalni PDF i PNG na odobrenim stabilnim lokalnim putanjama, sa istim
hashovima iz fixture manifesta. Rezultat je dostavio operator; agent nije ponavljao
integrity blok niti pristupao VPS-u. Vreme lokalnog opažanja nije navedeno u outputu.
Nema potrebe za server transferom fixture-a.

Pripremljen je sledeći zaseban korak01 INSTALLED_SOURCE_ONLY, ali sadašnje odobrenje
je samo priprema i lokalni dokaz, uz izričito bez instalacije.01 ostaje
PENDING_OPERATOR_COMMAND do odvojene potvrde izvršenja instalacije. On ponavlja
promenljive preflight gate-ove pre prvog upisa; prethodni VPS rezultat ne garantuje
kasniji timer gap. Posle01 vratiti output i stati pre02 koordinacije.
Fixture rezultat ne predstavlja auth, scanner, korisnički tok ili dozvolu njihovog
izvršavanja. AUTOMATIC_STARTUP ostaje istorijski PASS; FULL_SERVICE_RECOVERY nije dokazan.

## Jednokratno odobrenje instalacije01

[Izričito operatorsko odobrenje](evidence/staging-auth-scanner-continuation-20261020/operator-01-install-authorization.json)
razrešava prethodnu zabranu instalacije samo za jedan pregledani blok01.
Operator izvršava njegov puni sadržaj na VPS-u, sa aktuelnim preflight/hash guardovima,
očuvanjem originala i readback-om. STOP znači vratiti ceo output bez ponavljanja
ili zaobilaženja. Odobrenje nije dokaz izvršenja. Posle outputa stati pre02;
koordinacija, auth/scanner i korisnički tok nisu odobreni ovim korakom.
Nema reboot-a, testova/builda ili backup acceptance-a.

## Dostavljeni01 — instalacija izvora potvrđena

[Operatorski INSTALLED_SOURCE_ONLY output](evidence/staging-auth-scanner-continuation-20261020/operator-01-installed-source-only.json)
podudara se sa očekivanim raw helper4da… i source package3035df… hashovima,
kao i prethodnim helper303c… i manifestdd933… hashovima. Blok01 proverava pune
bajtove/readback svih članova i čuvanje prethodnih verzija pre emitovanja ovog
rezultata. Ovo je pregled operatorskog dokaza, ne nezavisna agentska VPS provera.
Operator potvrđuje servicesChanged=false i backupPinsChanged=false.
Vreme instalacije nije navedeno u outputu.

Jednokratno odobrenje01 je iskorišćeno; blok se ne ponavlja. Novi root sada postoji.
Koordinacija02, nova auth prijava, scanner i korisnički tok nisu pokrenuti niti
odobreni instalacionim odobrenjem. Sledeći pripremljeni korak02 ostaje
PENDING_OPERATOR_COMMAND do odvojenog odobrenja svog opsega; ne izvršavati ga sada.
Baseline continuation-a još nije uspostavljen. Startup PASS i FULL_SERVICE_RECOVERY
NOT_PROVEN ostaju nepromenjeni; nema novog reboot-a ili acceptance serije.

## Odobren nastavak02 kroz nezavisni close

[Izričito odobrenje preostalih koraka](evidence/staging-auth-scanner-continuation-20261020/operator-02-through-close-authorization.json)
obuhvata02, jednu novu prijavu i serverski auth/context, fresh reader/≤1 pregledani
conditional recovery, postojeći sintetički tok i nezavisni close/containment.
Raniji tekst o potrebi dodatnog odobrenja02 predstavlja istorijski gate, sada razrešen.
Ne traži se novo odobrenje za uključene korake; isporučuje se samo sledeći tačan
blok nakon pregleda prethodnog outputa. Odobrenje samo nije dokaz izvršenja.
Na neuspeh STOP funkcionalni nastavak, primeniti samo pregledani closure/containment,
bez retry-ja ili radnje izvan paketa. Instalacija se ne ponavlja. Tokom verification
prozora nema novog slanja; close vraća ranije odobreni baseline uz postojeće gate-ove.
Sada je na redu samo02; vratiti output pre nove prijave ili scanner poziva.

## Dostavljeni02 — writer pauziran

[Operatorski rezultat02](evidence/staging-auth-scanner-continuation-20261020/operator-02-coordinated.json)
potvrđuje WRITER_PAUSED_BACKUP_MONITOR_UNCHANGED. Timestamp i puni baseline hashovi
nisu prikazani u ovom kratkom outputu; ne izmišljaju se. Pregledani helper čuva novi
baseline na VPS-u pre pauze. Funkcionalni continuation je započeo; ukupni budžeti
teku od tog baseline-a.02 se ne ponavlja. Sledeći03 obuhvata jednu novu browser
password prijavu i postojeći serverski session/organization gate. PASS na dva TTY
prompta unosi se samo posle stvarnih opservacija; lozinka nikada u terminal/chatu.
Auth/context mora proći doT0+600s. Na STOP nema retry-ja, ide nezavisni close.
Scanner i upload/publish nisu još pokrenuti.

## Dostavljeni03 — STOP na vremenskom limitu, nezavisni close na redu

[Tačan operatorski STOP](evidence/staging-auth-scanner-continuation-20261020/operator-03-auth-stop.json):
CHECK_ID=CONTINUATION_AUTH, reason=OPERATOR_OBSERVATION_TIMEOUT, automaticRetry=false.
Raniji prikaz malog `pass` nije dokaz da ga je harness primio: novodostavljeni output
pokazuje `darko@srv1834647:~$ pass` i shell Command not found posle STOP-a.
Ne klasifikovati sačuvani neuspeh kao OPERATOR_OBSERVATION_NOT_PASS. Tačna istorija
TTY unosa i vreme unosa nisu zabeleženi. Ne instalirati shell alat pass.

Serverski auth/context rezultat nije potvrđen; scanner i korisnički tok ne nastavljaju.
Blok03 se ne ponavlja. Sledeći je postojeći07 nezavisni close, bez nove koordinacije,
recovery-ja ili drugih funkcionalnih koraka. Writer restore još nije potvrđen;
07 mora vratiti PASS_BASELINE_RESTORED ili tačan PARTIAL/STOP radi pregleda.
AUTOMATIC_STARTUP ostaje istorijski PASS, FULL_SERVICE_RECOVERY=NOT_PROVEN.

## Konačni operatorski rezultat — pokušaj zatvoren

[Nezavisni close07](evidence/staging-auth-scanner-continuation-20261020/operator-07-baseline-restored.json)
potvrđuje PASS_BASELINE_RESTORED, pending={}, artifactsRetained=true i automaticRetry=false.
Vraćen je passvero-subscription-reminders.timer. Backup/monitor nisu menjani ovim
nastavkom; backupStateUnchanged=true i deliveryUnchangedBeforeSendingResume=true.
Redovno ranije odobreno slanje nastavljeno je sačuvanim timerom. Završetak redovnog
writer posla i prijem/isporuka poruka ovim close outputom nisu dokazani.

Konačni statusi: lokalna priprema i instalacija izvora potvrđene; koordinacija PASS;
auth/context NOT_PROVEN nakon CONTINUATION_AUTH / OPERATOR_OBSERVATION_TIMEOUT;
scanner readiness/recovery i image/PDF/scan/download/publish/anonymous tok NOT_RUN;
nezavisno vraćanje baseline-a PASS. Nepokrenute provere nisu FAIL. Pokušaj je
zatvoren, bez ponavljanja03, instalacije, recovery-ja, reboot-a ili drugih blokova.
Raniji odeljci sa EXECUTION_NOT_STARTED/PENDING predstavljaju faze pre izvršenja,
ne trenutno stanje. Prethodni recovery-20261019-reboot-01 i njegovi dokazi netaknuti.

AUTOMATIC_STARTUP=PASS ostaje prihvaćena istorijska referenca.
FULL_SERVICE_RECOVERY=NOT_PROVEN; ovaj rezultat nije FULL_PASS.
Ovo je pregled korisnikovog operatorskog outputa, bez agentskog VPS pristupa.
Nema novih testova/builda, backup acceptance-a, commita ili pusha.

## AUTH timeout disposition i jedan predlog ručne prijave — samo pregled

Ovaj odeljak je lokalni pregled sačuvanih dokaza. Ne otvara zatvoreni pokušaj,
ne priprema izvršne komande i ne implementira novi nastavak.

### Tačan nalaz i granice dokaza

Prva konkretna blokada je blok03 / `CONTINUATION_AUTH` sa
[`OPERATOR_OBSERVATION_TIMEOUT`](evidence/staging-auth-scanner-continuation-20261020/operator-03-auth-stop.json).
[Nezavisni close](evidence/staging-auth-scanner-continuation-20261020/operator-07-baseline-restored.json)
potvrđuje PASS_BASELINE_RESTORED, pending={}, očuvan backup state/delivery pre
nastavka slanja i vraćen writer timer. Pokušaj ostaje zatvoren.

| Faza | Sačuvan dokaz / zaključak iz pregledanog source-a |
| --- | --- |
| Početni actor pregled | [auth()](evidence/staging-auth-scanner-continuation-20261020/continuation-reviewed.py#L136) prvo prolazi budget/coordinated/no-failure gate, zatim scoped.actor()/validate_actor(), pa tek ask(). Putanja je stigla do ask(); početni read-only DB pregled identiteta, membership-a i target-a prethodio mu je. Njegov zaseban rezultat iz ovog izvršenja nije sačuvan lokalno. To nije session dokaz. |
| Interaktivni gate | [ask()](evidence/staging-auth-scanner-continuation-20261020/reboot-reviewed.py#L444) je jedino mesto pregledane putanje koje emituje ovaj razlog. Četiri moguća mesta: već potrošen remaining pri ulasku; provera roka u wait(); istekao select() za TTY read/write; provera roka nakon read(). Tačan call-site/linija i koji od dva prompta: NOT_RECORDED. Ranije je operator prikazao prvi prompt, ali nema potpunog vremenski označenog TTY transkripta. |
| Browser prijava | auth() je ne izvršava. Obavljena je ili pokušavana van harness-a; HTTP zahtev, odgovor, tačan trenutak, uspešna sesija i organization UI rezultat: NOT_RECORDED. Odsustvo dokaza nije auth odbijanje. |
| Konačna serverska session/org provera | NIJE DOSTIGNUTA u ovoj izvršenoj putanji: auth() poziva oba ask() pre drugog actor pregleda i SQL-a za freshActiveSessions/freshSelectedOrganizationSessions. ask() je prekinuo funkciju. Početni actor query ipak jeste prethodio interaktivnom gate-u; ne tvrditi da nije bilo nikakvog DB upita. |
| Spoljni proces / wrapper | [Blok03](evidence/staging-auth-scanner-continuation-20261020/VPS-TERMINAL-03-AUTH-CONTEXT.sh) direktno pokreće sudo /usr/bin/python3 -I -B - sa heredoc-om, bez systemd-run/timeout wrappera. Postojeći SQL reader ima DB statement_timeout5s i subprocess timeout10s; taj tip isteka nije zabeleženi razlog. Nema dokaza serverskog ili spoljnog procesnog timeout-a. |

Rok je **doT0+600s od koordinacije**, ne novih600s za svaki prompt. configure()
postavlja END=T0+1800, a ask(limit=600) računa
`remaining=min(END,T0+600)-time.time()` i prenosi preostalo vreme u monotonični
deadline. Parcijalni unos/prekid ga ne produžava. budget(600) zasebno proverava
monotonično vreme od koordinacije i emitovao bi CONTINUATION_BUDGET_EXPIRED.
Stvarni T0, vreme početka ask(), remaining, trajanje čekanja, stanje sata i trenutak
unosa u poslednjem pokušaju: **NOT_RECORDED** u dostavljenim lokalnim dokazima.
Nije opravdano tvrditi da je harness čekao punih10min ili da je baš mala slova odbio.
Shell `pass` posle STOP-a nije odgovor harness-u; nema razloga za instaliranje alata.

Dokazano je iscrpljenje vremenskog gate-a operatorske opservacije u harness-u.
Nije dokazano zašto pravovremeni odgovor nije prihvaćen, niti da je browser auth
ispravan ili neispravan. Nema sačuvanog auth odbijanja, serverskog session timeout-a
ili scanner pada. Scanner/flow ostaju NOT_RUN; FULL_SERVICE_RECOVERY=NOT_PROVEN.

### Jedna preporučena naredna celina — browser prijava pa read-only server proof pre pauze

Predložiti zaseban, usko odvojen manual-login continuation gate u novom privatnom
namespace-u/evidenciji; **nije implementiran, instaliran ili pokrenut**. Ne koristi
baseline ili failure markere zatvorenog pokušaja i ne poziva ponovo njegov auth().

1. Dok writer i ostale automatizacije rade u ranije odobrenom baseline-u, zabeležiti
   novi server-side login-intent timestamp u zasebnu evidenciju, bez pauze servisa.
   On zamenjuje samo granicu svežine prijave; stari T0 se ne prenosi niti resetuje.
2. Korisnik se jednom prijavi kroz postojeći browser login kao
   `zivic.darko79@gmail.com`, izabere organizaciju
   `bdc5aed5-b05a-42e6-895b-9f2f9f8a79a0` i porukom potvrdi da vidi očekivani kontekst.
   Bez terminalskog PASS prompta, povećanja timeout-a, resetovanja lozinke, novih
   identiteta/grantova ili slanja. Lozinka ostaje browseru; ne traže se cookie/tokeni
   ili kopiranje kredencijala u chat/terminal. Korisnička poruka je opservacija,
   nije serverska autorizacija.
3. Jedan bounded read-only server check ponovo koristi postojeći scoped.actor()/
   validate_actor() i postojeći SQL AuthIdentity→AuthProviderSession→AuthSessionSelection.
   Zahteva tačan interni user40e51001-912c-4bcf-aa45-d866632aac85, nerevoked identity,
   ACTIVE ADMIN membership u odobrenoj ACTIVE organizaciji i tačno jednu novu,
   neisteklu sesiju od novog login-intent-a sa odabranom tom organizacijom.
   Query ne zahteva pauzu writera: postojeća implementacija koristi BEGIN READ ONLY
   na staging DB-u. Potreba za coordinated.json i dva ask() je ograničenje adaptera,
   ne tehnička potreba browsera ili ovog DB upita. Stvarni pristup DB-u ostaje
   postojeći operatorski privilegovani kontekst, ne novi aplikacijski grant.
4. Sačuvati privatno vezivanje na upravo potvrđenu serversku sesiju, actor/membership
   i izabranu organizaciju, uz vreme/expiry; u izlazu samo bezbedan fingerprint/
   rezultat, bez session tokena, cookie-ja ili sirovih identifikatora sesije.
   Bez ovog vezivanja postojeći agregatni brojevi1/1 sami ne mogu dokazati da je
   kasniji check video istu sesiju. Više kandidata ili nejasna veza znači STOP.
5. Tek nakon tog PASS-a razmatrati budući funkcionalni prozor. Neposredno pre
   koordinacije, i pre prvog scanner/upload/publish koraka, kratak read-only recheck
   potvrđuje da ista vezana sesija nije istekla, da membership nije opozvan i da
   organization selection nije promenjen. Nema nove prijave ni ponovnog ručnog
   potvrđivanja. Promena sesije/org-a, nejednoznačnost ili istek → STOP. Pauzu i njen
   funkcionalni budžet započeti tek nakon spremnog korisnika, uz sve postojeće
   release/lock/freshness/sending/timer guardove. Time čekanje korisnika ne drži
   writer pauziranim. Aplikacijska autorizacija, entitlement i kvote ostaju obavezni.

**Tačan uski budući code scope:** novi orchestration adapter/mode-ovi za
login-intent, neinteraktivni session/org proof i bounded recheck; ponovno korišćenje
neizmenjenih scoped actor/SQL provera, uz fresh-boundary vezan za novi login-intent,
privatno session vezivanje i minimalno povezivanje odloženog coordinate()/begin_flow()
precondition-a. Ne menjati raw ask(), produkcijski login/auth implementaciju,
verifier/scanner/backup semantiku ili instalirani paket zatvorenog pokušaja.
Potrebni su zaseban pregled tog izvršnog diffa i payload/hash vezivanja pre upotrebe;
u ovom zadatku nisu pripremljeni niti testirani.

**Konačan acceptance ove preporučene celine:** korisnička browser opservacija plus
jedan sačuvan serverski PASS za tačan actor/ACTIVE membership, jednu novu važeću
sesiju i odobrenu selekciju, uz privatno vezivanje za neposredni recheck; sve završeno
pre pause-a, bez terminalskog PASS čekanja. To je auth/context gate, ne FULL_PASS.
Ako se budući server check odbije ili istekne, sačuvati tačan novi CHECK_ID/uzrok i
stati pre pauze; bez automatskog retry-ja. Dalji scanner/flow nije deo ovog pregleda.

Potrebno buduće ovlašćenje obuhvata taj uski code diff, zasebnu lokalnu intent/proof
evidenciju i jednu browser prijavu/read-only serversku potvrdu; browser login stvara
normalnu auth sesiju, a helper samo privatne dokazne zapise. Nema poslovnih upisa,
novih grantova ili promene automatizacija u ovoj predloženoj auth celini.

LIVE_ACTIONS_PERFORMED=NO; REBOOT_REPEATED=NO; BACKUP_ACCEPTANCE_REPEATED=NO;
AUTOMATIC_STARTUP=PASS; FULL_SERVICE_RECOVERY=NOT_PROVEN.


## Završna granica dokaza — naknadni recovery i korisnički UI tok,21.10.2026

Ovaj continuation ostaje zatvoren PASS_BASELINE_RESTORED, sa istorijskim
CONTINUATION_AUTH/OPERATOR_OBSERVATION_TIMEOUT i neizvršenim scanner/flow koracima.
Ne otvara se ponovo. Naknadni nezavisni signature recovery COMPLETE/reader/closure
PASS i korisnički novi proizvod/objava/PDF/DPP/QR USER_CONFIRMED nalaze se u
[završnom PDF/recovery izveštaju](STAGING_REPORTED_PDF_SCAN_FAILURE_TRIAGE.md#korisnička-ui-potvrda-i-završna-release-priprema--21102026).
UI_PDF_ACCEPTANCE=PASS_USER_CONFIRMED nije sačuvani server-session/context PASS
ovog harness-a. Takva harness provera ostaje NOT_PROVEN u ovom zatvorenom pokušaju;
PDF korisnički problem se time ne smatra otvorenim. AUTOMATIC_STARTUP=PASS;
FULL_SERVICE_RECOVERY=NOT_PROVEN zbog šireg izolovanog host-loss/provider/service
restore opsega. [Release skup](evidence/staging-recovery-release-20261021/README.md)
čuva istoriju i tačne hashove. Bez ponavljanja testova/live radnji ili commita/pusha.
