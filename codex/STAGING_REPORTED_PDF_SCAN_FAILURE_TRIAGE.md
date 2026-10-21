# Staging — PDF triage, recovery i korisnička UI potvrda

**Završni status — 21.10.2026: UI_PDF_ACCEPTANCE=PASS — USER_CONFIRMED.**
Korisnik je naknadno potvrdio novi proizvod, objavu, PDF preuzimanje, QR link i
prikaz očekivanih DPP elemenata. [Zaseban korisnički dokaz](evidence/staging-reported-pdf-scan-failure-20261020/user-12-ui-confirmation.json).
Recovery COMPLETE/reader ACCEPTED/nezavisni closure PASS ostaju sačuvani operatorski
rezultati. Nema nove runtime provere. PDF problem je zatvoren u korisnički potvrđenom
staging toku; istorijski harness rezultati nisu preimenovani u PASS.
FULL_SERVICE_RECOVERY=NOT_PROVEN ima šire granice navedene u završnoj dopuni.
Sve ranije PENDING/STOP sekcije ispod predstavljaju tadašnji checkpoint.

Istorijski početni status: `LOCK_RELEASE_STOPPED_BEFORE_PAUSE / NO_LOCK_REMOVAL / NO_RETRY`.

Proizvod je isključivo `10813121-1ffa-4c94-91d4-82b2a9ee6757`; očekivani UI naziv
organizacije `SYNTHETIC — Subscription commercial acceptance`. Organization ID se
izvodi iz veze ovog proizvoda sa Organization, ne iz prethodnog continuation-a.
Naziv mora biti podudaran; stvarni organization ID i veze vraćaju se u outputu.
Dokument je prijavljen kao „Izjava o sukladnosti“, datum opažanja20.10.2026.
Ručni pristup editoru je korisnički dokaz; nije serverska session potvrda.
GTIN nije predmet pregleda i ne čita se niti menja. Stari pokušaji ostaju zatvoreni.

[Kompletan VPS TERMINAL / PENDING_OPERATOR_COMMAND blok](evidence/staging-reported-pdf-scan-failure-20261020/VPS-TERMINAL-01-READONLY-PDF-TRIAGE.sh)
ima [manifest](evidence/staging-reported-pdf-scan-failure-20261020/manifest.json).
Agent ga nije izvršio. Operator je dostavio jedan rezultat; blok se ne ponavlja. Nema instalacije ili pokretanja postojećeg auth/recovery harness-a.

## Najmanji skup činjenica i poreklo

- [UI lokalizacija](../messages/hr.json): „Izjava o sukladnosti“ je i kategorija
  DECLARATION; nije dovoljno nagađati document ID po naslovu. SQL povezuje sve
  verzije samo tog proizvoda, ProductDocument i Document; vraća odgovarajuću
  kategoriju ili exact displayLabel/displayName podudaranje. Maksimalno8 kandidata;
  više kandidata se ne svodi automatski na jedan. Current draft/published pointeri,
  version/document/attempt ID-jevi i org consistency odvajaju isti dokument kroz
  više verzija od različitih upload-a. Nema preuzimanja PDF-a ili čitanja Storage-a.
- [Schema](../prisma/schema.prisma),
  [scan persistence](../src/infrastructure/persistence/prisma/prisma-document-scan.ts):
  Document čuva trenutni/poslednji attempt, status, malwareFailureCode, startedAt,
  scannedAt, digest/policy/provenance i lifecycle vremena. ERROR finalize obično
  ostavlja scannedAt/provenance null. Za stvarno vreme terminalnog događaja čita se
  do6 poslednjih DOCUMENT_MALWARE_SCAN_ERROR/CLEAN/INFECTED audit događaja po
  kandidatu, uz attemptId match i samo allowlisted polja. Sažetak se ne ispisuje;
  poređenje sa dve fiksne source vrednosti razlikuje SCAN_FINALIZE i
  LEASE_EXPIRY_RECOVERY kada je zabeleženo. Nema actor-a, emaila, correlation tokena
  ili drugih audit/DB tabela. Nema pretraživanja širokih logova.
- [Scan pipeline](../src/application/documents/scan-document.ts) obrađuje storage
  integrity → PDF validaciju → health before → clamd → health after/provenance →
  finalize. [Normalizovani kodovi](../src/application/documents/document-security-policy.ts)
  omogućavaju razdvajanje PDF_ENCRYPTED/INVALID/UNSUPPORTED/VALIDATION_FAILED,
  integrity, SIGNATURES_UNTRUSTED i scanner grešaka. Kod se ne zamenjuje nagađanjem.
  TIMEOUT sam ne razlikuje PDF validator od scanner timeout-a; audit može pokazati
  lease recovery, ali ne daje izgubljeni stage traceback. SIGNATURES_UNTRUSTED sam
  ne razlikuje before/after health i njegove unutrašnje razloge.
- Aktuelni health je zasebna opservacija: jedan postojeći
  [private reader CLI](../scripts/read-document-signature-health.ts),
  `/usr/local/libexec/passvero-signature-recovery-v3/reader.cjs`, pregledani hash
  `877c9bed25e195479d28dcad7e5ff506798a09b6b2edfe93c92691e228f97e62`
  iz [sačuvanog instalacionog dokaza](DOCUMENT_SIGNATURE_HEALTH_POST_RESTART_RECOVERY.md).
  Pre poziva proverava se tačan hash i private root-owned posture; izvršava se kao
  postojeći passvero-staging UID1001. Nema producer-a, recovery-ja ili scan poziva.
  Pin mismatch/reader exception je UNAVAILABLE sa normalizovanim razlogom, bez
  bypass-a ili pokušaja drugog reader-a. accepted=false ne utvrđuje unutrašnji uzrok.
- Jedan systemctl show čita samo property-je clamd/socket, freshclam, qpdf
  broker/socket i signature-health timer/service. Nema povezivanja na socket koji
  bi mogao aktivirati servis, nema PING/SCAN, qpdf izvršavanja ili systemctl start.
  Inactive socket-activated qpdf service sam po sebi nije dokaz kvara. Aktuelna
  stanja i timestampi ne dokazuju stanje pri prijavljenom pokušaju.

SQL je jedan repeatable-read READ ONLY snapshot na lokalnom staging PostgreSQL-u,
port5433/database passvero_acceptance, uz statement timeout5s/lock timeout2s i
subprocess limit10s. Ukupan dijagnostički budžet40s, reader≤10s, units≤8s;
output je ograničen. Nema env čitanja, sirovog stderr-a, PDF bytes, storage ključeva,
originalFilename, lozinki, session tokena ili raw health JSON-a. JSON ide samo u
operatorski terminal; blok ne pravi fajlove na VPS-u. Ne menja servise, DB ili Storage.

## Šta se može zaključiti sada

Tačan sačuvani failureCode, document ID i attempt sada su dostavljeni; nalaz i
granice dokaza zapisani su u konačnom pregledu ispod. Raniji reader=null iz drugog pokušaja
nije dokaz ovog uzroka. „Provjera nije uspjela“ je lokalizovan ERROR scan status,
ne detaljan razlog i ne dokaz infekcije.

[Access policy](../src/application/documents/access-policy.ts) dopušta preuzimanje
samo za AVAILABLE + CLEAN, aktuelnu policy2, isti digest i validan CLEAN verdict
ne stariji od7 dana. [UI controls](../src/components/application/products/document-scan-controls.tsx)
prikazuju download samo za cleanEligible. Ako ovaj dokument ima ERROR, zabrana
preuzimanja jeste očekivano fail-closed ponašanje; nije predlog uklanjanja guarda.
Persisted status ERROR potvrđen je dostavljenom dijagnostikom.

Posle jednog outputa sačuvati konkretni razlog i odabrati samo jednu najmanju
korekciju/radnju prema njemu. Ako razlog nema potrebnu granularnost ili je attempt
već zamenjen, navesti tačno NOT_RECORDED; ne izvoditi istorijski uzrok iz sadašnjeg
HEALTHY/unhealthy. Ne pokretati drugi scan, recovery ili novu dijagnostičku seriju.
Ovim pregledom nikakva korekcija, objava ili poslovna mutacija nisu odobrene.

`DIAGNOSTIC_EXECUTED=YES_BY_OPERATOR_ONLY`
`VPS_ACCESS=NO`
`AUTH_SCANNER_CALLS=0`
`SERVICE_CHANGES=NO`
`BACKUP_ACCEPTANCE_REPEATED=NO`
`AUTOMATIC_STARTUP=PASS`
`FULL_SERVICE_RECOVERY=NOT_PROVEN`

## Jedan dostavljeni rezultat — dokazani scan razlog i preporuka

[Sačuvani operatorski JSON](evidence/staging-reported-pdf-scan-failure-20261020/operator-01-readonly-result.json)
primljen je jednom; agent nije pristupao VPS-u niti ponavljao dijagnostiku.

**Tačan scope:** org `ffe171d1-b6a6-43d5-83bb-890e2fa23c9f`, proizvod
`10813121-1ffa-4c94-91d4-82b2a9ee6757`, dokument
`4cf09f57-bddd-4073-b2ea-cb643f70de41`. Tri kandidata su TRI VEZE ISTOG dokumenta:
current draft70164221-7d8f-402d-ab93-4719f5d18ac8,
current published1e234758-af8c-44a1-9491-7f9756605bc7 i
supersededbad150a4-2ba5-4556-b18b-feccb164d735; nije reč o tri PDF-a ili
neodređenom izboru dokumenta. Sve veze su organizationConsistent=true.
Ovo nije organizacija/proizvod prethodnog continuation fixture-a i ne nasleđuje
njegove dozvole za mutacije. Pristup editoru ostaje korisnički dokaz, ne server session PASS.

**Sačuvani neuspeh:** lifecycle AVAILABLE, uploadFailureCode=null; scan ERROR,
policy2, attempt1693ba1c-8b86-4b11-aaae-9c55f02c54ae,
startedAt2026-10-20T16:02:56.991, terminal audit
3c6d1a24-5f67-4ecd-afa2-d0a0b6124be2 u2026-10-20T16:02:57.440,
action DOCUMENT_MALWARE_SCAN_ERROR, recordedTerminalPath=SCAN_FINALIZE,
`failureCode=SIGNATURES_UNTRUSTED`, matchesCurrentAttempt=true.
DB attempt/audit timestamp stringovi nemaju offset; ne izmišljati dodatni offset.
Prethodni terminal event u15:56:38.765 pripada drugom attempt-u
ff497719-2f0c-4e11-a0d5-9845a285d830 i beleži isti kod; nije novi run ovog pregleda.
scannedAt/digest/provenance=null u ERROR stanju očekivano ne predstavljaju CLEAN verdict.

**Značenje:** aplikacija nije prihvatila trusted signature-health/provenance dokaz.
Po pregledanoj [scan putanji](../src/application/documents/scan-document.ts#L57),
SIGNATURES_UNTRUSTED nastaje kada before health nije trusted ili after health nije
trusted/provenance se promenio. Storage integrity i strukturna PDF validacija u tom
source redosledu prethode gate-u. Ne predstavljati ovo kao PDF_INVALID, zarazu,
clamd outage ili auth kvar. Ovaj output nema runtime artifact pin/source dokaz;
mapiranje grana je zaključak iz pregledanog lokalnog koda, dok persisted failure
code i audit predstavljaju direktan dokaz konkretne aplikacijske odluke.
Da li je clamd SCAN uopšte dostignut i da li je odbijen before/after health:
NOT_RECORDED. Fajl nema prihvaćen CLEAN rezultat.

**Aktuelna opservacija odvojeno:** 2026-10-20T16:14:12.396185+00:00 reader
accepted=false/returnCode1. Signature-health timer active/waiting, ali
passvero-signature-health.service failed/exit-code1; datum izlaska prikazan je kao
20.10.18:13:58CEST. clamd/freshclam i qpdf broker su active/running u tom opažanju.
Samo aktivan daemon nije trusted-signatures dokaz. Kasniji failed producer/reader
nije sam po sebi dokaz njegovog stanja pri attempt-u oko16:02:57, niti objašnjava
unutrašnji root cause. Reader reason (absent/expired/posture/evidence/provenance),
producer phase/reason i njegov tadašnji zapis nisu prikupljeni: NOT_RECORDED.

**Zabrana preuzimanja je očekivana:** AVAILABLE ne zamenjuje CLEAN. ERROR pada na
postojećem [cleanDocumentEligible](../src/application/documents/access-policy.ts#L14)
i privatni/javni attachment ne sme dobiti download pravo samo zato što je veza
isPublic ili verzija PUBLISHED. Ne uklanjati gate i ne menjati status ručno.

**Jedna najmanja preporučena naredna radnja, neizvršena:** pregledati JEDAN već
sačuvani normalizovani ProducerReport neuspele signature-health službe, vezan za
njen prikazani neuspeh oko16:13:58UTC (18:13:58CEST): samo timestamp, result,
phase, reason i durationMs. [Postojeći producer CLI](../scripts/produce-document-signature-health.ts)
već emituje takav JSON; ne pokretati producer da bi se dobio novi zapis, ne
ispisivati široke logove i ne pokretati recovery/rescan. Cilj je objasniti zašto
producer sada ne objavljuje prihvatljiv dokaz i izabrati ciljanu korekciju umesto
slepog restarta. Acceptance te jedne predložene radnje: konkretan postojeći
phase/reason sa vremenom; ako zapis nije sačuvan, označiti baš njega NOT_RECORDED
i stati. Taj kasniji zapis ne predstavljati kao dokaz istorijske before/after
scan grane. Ovo je samo predlog buduće zasebno odobrene read-only radnje, bez
pripreme novog operatorskog bloka ili nastavka serije u ovom zadatku.

Tačan dublji root cause nije dovoljno zabeležen za opravdanu runtime korekciju.
GTIN, pravni nacrt, istorijski recovery pokušaji, runtime pinovi i servisi nisu menjani.
Nema novog skeniranja, testa/builda, reboot-a, recovery-ja, commita ili pusha.
AUTOMATIC_STARTUP=PASS; FULL_SERVICE_RECOVERY=NOT_PROVEN.

## Postojeći ProducerReport — jedna invokacija BUSY pri ACQUIRE

[Jedan operatorski rezultat](evidence/staging-reported-pdf-scan-failure-20261020/operator-02-existing-producer-report.json)
vezan je za passvero-signature-health.service, invocation
`c2e7fae26fd04da4935ff4d79fe9352c`, journal timestamp
`2026-10-20T16:21:55.282823+00:00`. Report: result=BUSY, phase=ACQUIRE,
reason=null, durationMs=0.8007139999999993 (oko0.8ms). Nije timeout, qpdf/PDF
validacija ili novi dokaz o zarazi. reason=null je ugovoreni BUSY zapis, ne
izgubljeni exception string. [Read-only blok](evidence/staging-reported-pdf-scan-failure-20261020/VPS-TERMINAL-02-EXISTING-PRODUCER-REPORT.sh)
povezao ga je sa stabilnim failed/exit1 stanjem iste invokacije, proverio journal
stdout i ograničio čitanje na njene≤32 postojeće stavke. Producer nije pokrenut
ovom dijagnostikom; timer mogao je redovno izvršavati svoje ranije odobrene poslove.

### Šta je dokazano i šta ostaje nepoznato

Prema [producer kodu](../src/infrastructure/documents/signature-health-producer.ts#L52),
BUSY sa izmerenim pozitivnim durationMs nastaje kada io.acquire() vrati false.
Poseban in-process reentry BUSY ima durationMs=0. U
[IO acquire/release implementaciji](../src/infrastructure/documents/signature-health-producer-io.ts#L90)
lock je `${outputPath}.lock`: acquire pokušava mkdir(mode0700), a samo EEXIST vraća
false. Release uklanja taj direktorijum samo ako ga je ova invokacija stekla.
Ovo je directory-existence lock, ne dokaz OS flock holder-a. EEXIST može značiti
postojeći direktorijum, ali sam report ne potvrđuje tip postojećeg objekta, PID,
owner, vreme nastanka, napuštenost ili legitimnog drugog producer-a.
Runtime source/pin nije ponovno meren ovim čitanjem; EEXIST mapiranje je zaključak
iz pregledanog source ugovora, BUSY/ACQUIRE i invocation ID su direktan dokaz report-a.

Ta invokacija nije dostigla SEQUENCE/COLLECT/VERSION/VALIDATE/PUBLISH i nije objavila
novi health snapshot. Nije menjala snapshot kroz invalidate niti uklanjala tuđi lock.
[CLI](../scripts/produce-document-signature-health.ts) za BUSY završava exit1, jer
samo PUBLISHED daje exit0. To objašnjava failed/exit1 konkretne invokacije i zašto
ona ne osvežava dokaz. Ne dokazuje da su potpisi zastareli, da daemon ne radi ili da
je lock napušten. Ne resetovati sequence counter.

Aktuelni report je od16:21:55UTC, dakle kasniji od reader accepted=false u16:14:12UTC
i PDF audit-a oko16:02:57. Nepublikovanje je saglasno problemu reader spremnosti,
ali jedan BUSY report ne dokazuje zašto je reader ranije odbio dokaz ili da je lock
postojao tokom PDF attempt-a. Health snapshot može uopšteno biti absent/expired ili
odbijen drugim proverama; njegov tačan istorijski razlog je NOT_RECORDED. Before/
after scan health grana takođe je NOT_RECORDED. Na osnovu ovog zapisa nema dokaza
koja bi prethodna VPS intervencija napravila lock; ne pripisivati uzrok reboot-u,
instalaciji helpera ili drugim ranijim radnjama.

### Jedna najmanja preporučena korekcija — samo predlog za zasebno odobrenje

Predložiti **jedno kontrolisano oslobađanje napuštenog praznog producer lock
DIREKTORIJUMA**, ali samo pod uslovima koji se prvo moraju potvrditi u toj zasebno
odobrenoj serverskoj radnji: tačna lock putanja iz postojećeg installed outputPath
ugovora, očekivani regularni direktorijum (bez symlink-a), pouzdano odsustvo bilo kog
živog producer izvršenja i kratka koordinacija samo njegovog postojećeg timer-a da
nema race-a. Ne zaključivati stale samo iz trenutnog failed stanja ili starosti.
Ako tip/identitet/owner/odsustvo writer-a nisu dokazivi ili direktorijum nije prazan,
STOP bez uklanjanja. Ovo sada nije nalog niti pripremljen operatorski blok.

Korekcija bi uklonila samo dokazano napušten directory lock; bez rm-rf, brisanja
health/sequence fajla, promene provenance/policy/pinova ili restarta clamd/freshclam.
Raniji timer baseline mora se vratiti i producer se ne startuje ručno: naredna
redovna scheduled invokacija koristi isti ugovor. To uklanja eventualni stale-lock
BUSY blok, ali ne obećava da nema drugih health gate-ova. Ako je lock aktivan ili
nije direktorijum, predlog nije primenjiv i ne improvizuje se druga mutacija.

Serverska intervencija je potrebna samo ako je napušten lock potvrđen: aplikacijski
UI opravdano nema ovlašćenje da ukloni privileged writer lock. Dok to nije potvrđeno,
nema dovoljno dokaza za bezuslovno uklanjanje ili recovery. Posle eventualne zasebno
odobrene korekcije korisnik proverava funkcionalni rezultat kroz postojeću aplikaciju:
upload → scan → CLEAN/status → dozvoljeno preuzimanje; nema novog terminalskog
acceptance harness-a ili recovery serije. Obuhvat/prethodno sačuvani dokument čuvaju
se bez automatskog dupliranja ili ponavljanja poslovnih mutacija.

Izveštaj i manifest su dopunjeni; ne radi se nova live provera. Jedan producer report
je pregledan i dijagnostika se završava. Istorijski pokušaji i pravni nacrt sačuvani.
SERVICE_MUTATIONS=NO; PRODUCER_EXECUTED_BY_DIAGNOSTIC=NO; SCAN_CALLS=0;
REBOOT_REPEATED=NO; BACKUP_ACCEPTANCE_REPEATED=NO;
AUTOMATIC_STARTUP=PASS; FULL_SERVICE_RECOVERY=NOT_PROVEN.

## Uslovno oslobađanje napuštenog locka — jedan odobren operatorski postupak

Status: PREPARED / PENDING_OPERATOR_COMMAND / NOT_EXECUTED_BY_AGENT.
[Kompletan blok03](evidence/staging-reported-pdf-scan-failure-20261020/VPS-TERMINAL-03-CONDITIONAL-EMPTY-LOCK-RELEASE.sh)
sadrži exact compressed payload [jednokratnog maintenance koda](evidence/staging-reported-pdf-scan-failure-20261020/conditional-lock-release.py).
Nije novi auth/scan acceptance harness i nema funkcionalnih aplikacijskih poziva.
Nema globalne instalacije helpera: blok jednom kreira zasebni root0700/source0600
operacijski direktorijum `/var/lib/passvero-signature-lock-release-20261020-01`
za taj payload i novu sanitizovanu evidenciju. Postojeći direktorijum znači STOP,
ne ponavljanje ili prepisivanje. Istorijski record-i se ne menjaju.

### Operaterski uslov i konkretne launch putanje

Operator mora obezbediti isključiv administratorski prozor: tokom ovog bloka nema
paralelne root/admin sesije koja ručno startuje producer/recovery ili menja njegov
unit/config. Ako to nije moguće garantovati, **ne izvršavati blok**. Ne uvodi se
lažna pretpostavka da process scan ili directory lock sprečava budući nekoordinarani
root start. Takav nezavisan root pristup ne može biti atomarno blokiran postojećim
producer ugovorom bez šire promene launch/privilege mehanizma, koja nije odobrena.

Poznate putanje su scheduled signature-health timer→oneshot service, ručni root
CLI/node entrypoint i postojeći root recovery kontroleri. Prve dve proveravaju se
kroz installed unit ExecStart/Type/User/Group/Triggers/TriggeredBy i odsustvo drugih
dependency/Exec* pokretača. Drop-in ili drugačiji launcher znači STOP radi pregleda.
Postojeći recovery alat i wrapper-i koriste
`/var/lib/passvero-signature-trust/records/recovery/operator.lock`; blok stiče taj
isti postojeći inode kroz flock EX|NB bez pisanja/brisanja. Ako ga drži kontroler
ili je recovery state nerešen, STOP pre pauze. Originalni factory/CLI može se ručno
pokrenuti van tog flock-a; zato je isključivi operatorski prozor obavezan dodatni
preduslov, ne tvrdnja da je timer pause univerzalna zabrana pokretanja.

### Tačan scope i provere pre mutacije

Installed `/etc/passvero-signature-health.json` čita se privatno, bounded/NOFOLLOW,
i zahteva outputPath baš `/var/lib/passvero-signature-health/health.json`.
Pregledani `mkdir(outputPath+'.lock',0700)` ugovor određuje jedini cilj:
`/var/lib/passvero-signature-health/health.json.lock`.
Nema wildcard mutation putanja. Producer i reader moraju odgovarati postojećim
punim pinovima725d3494… i877c9bed…; konfiguracija i unit fajlovi dobijaju početne
hashove koji se moraju ponovo podudarati pre rmdir-a i pri closure-u. Ne menjaju se.

Postupak zahteva početni timer active/enabled, jer samo takav sačuvani baseline
omogućava posmatranje redovnog ciklusa bez uvođenja novog enablement-a. Drugo početno
stanje znači STOP bez mutacije. Početno stanje, exact lock metadata i config/unit
hashovi se čuvaju pre disable--now tajmera, prema postojećem pregledanom recovery
koordinacionom obrascu. Ne poziva se recovery.quiesce/contain: oni bi menjali daemon,
updater ili snapshot, što ovde nije dozvoljeno.

Posle pauze proverava se stvarni MainPID/ControlPID/state servisa i /proc identiteti:
PID startTicks, izvršni fajl, UID, cmdline samo interno i cgroup, uz stabilnost
opažanja. Nema env ili raw command line ispisa. Provera se ponavlja neposredno pre
rmdir-a pod istim recovery flock-om. Poznati producer/recovery proces ili nepoznat
root Node/Python interpreter znači STOP, bez ubijanja procesa. Samo tačno postojeći
qpdf broker/ setup entrypoint-i i ovaj identifikovani controller/maintenance proces
su izuzeti; druge root interpretere ne proglašavati automatski bezopasnim.
Za već aktivnu producer službu dozvoljen je postojeći najviše20s drain, ne novi run.

Lock mora biti stvarni root:root direktorijum0700, prazan, bez symlink-a, ispod
root-owned nezapisivih roditelja. Drži se fd za provereni roditelj. Device/inode,
ctime/mtime, mode i vlasništvo locka porede se sa početnim opažanjem neposredno pre
jedinog `os.rmdir(LOCK.name, dir_fd=fd)`. Parent identity takođe se proverava.
Nestanak, zamena, sadržaj ili nepouzdana opažanja znače STOP; nema adaptacije,
rm-rf, rekurzije ili uklanjanja drugih lockova. Starost locka se ne koristi kao dokaz.

### Nezavisni closure i jedno posmatranje normalnog ciklusa

Maintenance body pokreće se kroz transient Type=exec/Restart=no jedinicu
`passvero-signature-lock-release-20261020-01.service`, RuntimeMax65s, stop30s.
ExecStopPost pokreće samo zaseban **close** iz istog pregledanog privatnog payload-a,
ne producer. Tako neuspeh/prekid body-a ne preskače pokušaj vraćanja timer baseline-a.
Close ponovo uzima postojeći recovery flock i proverava unit/config, odsustvo
writera i poznato lock stanje. Ako je bezbedno, vraća prethodni active/enabled
baseline, bez manual producer starta i bez diranja reminder/backup tajmera.
Ako ne može, beleži PARTIAL_TIMER_RESTORE_REQUIRES_OPERATOR_REVIEW i konkretan
pending razlog; ne ponavljati, ne improvizovati force-resume. Potrebna operatorska
radnja je pregled tog konkretnog pending razloga pre bezbednog vraćanja samo
producer tajmera; ne menjati druge servise. Ako terminal nestane, transient
ExecStopPost i privatni dokazni fajlovi ostaju nezavisni od terminala.

Posle normalnog closure-a, samo ako je rmdir potvrđen, najviše35s posmatra se prvi
novi redovni scheduled ciklus po promeni service start identiteta, bez tumačenja
formatiranih monotoničnih trajanja. Jedno bounded journal čitanje od resume-intent
vremena (≤16 stavki te jedinice) mora dati tačno jedan normalizovan ProducerReport
sa invocation ID vezom; zatim jedan existing pinned reader kao UID1001.
Ne pokreće se producer, timer se ne ubrzava, ne čeka se drugi prihvaćeni ciklus.
Obično dalje redovno zakazivanje ostaje u svom vraćenom baseline-u. Nepodudaranje,
odbijanje ili manjkav zapis znači STOP/NOT_RECORDED, bez novog lock uklanjanja.

Direktni kod ne piše health, sequence/counter, signature DB ili istorijske evidencije.
Normalna, ranije odobrena scheduled producer invokacija može po sopstvenom ugovoru
objaviti health/sequence; to nije ručna izmena dijagnostikom. Povratak tajmera nije
uslovljen time da sledeći producer mora uspeti: neuspeh se beleži bez recovery-ja.

Sanitizovani output sadrži baseline, identitet i odsustvo writer-a, rmdir ishod,
closure i jedan cycle/reader rezultat. Ako bi proces bio prekinut između rmdir-a i
zapisivanja njegovog uspeha, rezultat ostaje UNCONFIRMED_REQUIRES_OPERATOR_REVIEW,
ne izmišlja se PERFORMED/NOT_PERFORMED. To je STOP bez ponavljanja. U redovnom
završetku LOCK_REMOVAL je PERFORMED ili NOT_PERFORMED.

Tek nakon pregleda jednog outputa, ako scheduled producer/reader prođu, korisnik
u aplikaciji bira postojeći PDF → „Skeniraj dokument“ → osveži status → preuzmi
ako je CLEAN. Nema automatskog browser/terminal scan-a, novog upload-a ili nove
terminalske acceptance serije. Producer/reader PASS nije PDF acceptance.
Ako novi normalni ciklus ili reader ne prođu, vrati razlog i stani pre UI scan-a.

Ovim postupkom ne utvrđuju se tvorac locka ili istorijski uzrok ranijeg PDF scan-a.
Sada su pripremljeni samo blok i lokalni source, nisu izvršeni VPS/sudo/syscall koraci.
LOCK_REMOVAL=NOT_PERFORMED; PRODUCER_MANUAL_RUN=NO; SCAN_CALLS=0;
REBOOT_REPEATED=NO; BACKUP_ACCEPTANCE_REPEATED=NO.

## Lock-release rezultat — STOP pre pauze, bez uklanjanja

[Tačan operatorski output03](evidence/staging-reported-pdf-scan-failure-20261020/operator-03-entrypoint-stop-no-timer-change.json)
potvrđuje LOCK_RELEASE_BODY / PRODUCER_ENTRYPOINT_DRIFT, maintenance unit exit1.
Nezavisni closure u2026-10-20T16:35:35.589226+00:00 je
NO_TIMER_CHANGE_STARTED, partial=false, pending=[]. timerRestored=true ovde znači
**nije bilo započete promene tajmera**, ne novu live potvrdu njegovog active/enabled
stanja niti izvršavanje enable/resume komande.

Napuštenost locka NIJE POTVRĐENA. Rmdir NIJE IZVRŠEN. Redovni ciklus/reader nisu
posmatrani posle intervencije: NOT_OBSERVED_OPERATION_STOPPED. Producer, scanner,
clamd, Freshclam, reminder i backup nisu ručno pokretani ili menjani. Nema novog
PDF acceptance-a ili razloga da se UI scan ponavlja radi ove neuspele intervencije.

[contracts() guard](evidence/staging-reported-pdf-scan-failure-20261020/conditional-lock-release.py#L94)
poredi formatirani systemctl ExecStart tekst sa podstringom `path=/usr/bin/node ;`
i tačnim argv prikazom `/usr/bin/node /usr/local/libexec/passvero-signature-health.cjs
--config /etc/passvero-signature-health.json ;`. Ovo očekivanje je pripremljen guard,
ne sačuvan dokaz stvarnog installed argv. Stvarna očitana ExecStart vrednost nije
ispisana/sačuvana u operatorskom outputu: NOT_RECORDED. Bez nje se ne može razlikovati
stvarni drugi interpreter/launcher/argument od neslaganja tekstualnog formatiranja.
Naziv PRODUCER_ENTRYPOINT_DRIFT zato NE dokazuje promenu binarnih bajtova, konfiguracije,
komande ili incident, niti vezu sa prethodnim intervencijama. Producer/config hash
provere koje slede iza ovog guarda takođe nisu dostignute ovom putanjom.

Blok je stao u početnom contracts(), pre čuvanja baseline-a, pause-intent-a,
provera napuštenosti i rmdir-a. Postojeći privatni operation direktorijum i sve
stop/closure/source datoteke ostaju sačuvani; ne brisati ih, ne ponavljati blok03,
ne menjati payload na VPS-u i ne otvarati ovaj pokušaj ponovo. Raniji
BUSY/ACQUIRE i PDF SIGNATURES_UNTRUSTED zaključci ostaju nepromenjeni.

**Jedna najmanja preporučena naredna radnja, samo predlog:** jedno ciljano read-only
čitanje stvarnog producer ExecStart executable/argv kao strukturiranog systemd/D-Bus
podatka, sa bezbednim normalizovanim prikazom ili mismatch klasifikacijom, bez
konfiguracionih sadržaja/sekreta i bez pokretanja jedinice. Dobiti tačan interpreter,
script i argument shape potreban da se utvrdi semantički ili samo formatni nesklad.
Ako su vrednosti neočekivane, ne širiti allowlist i ne popravljati service bez pregleda.
Ako je razlika samo format, buduća lokalna korekcija treba da poredi strukturirani
executable/argv, uz očuvanje istog exact scope-a. Sada ne implementirati ni jednu
od tih mogućih korekcija i ne pripremati novi pokušaj. Acceptance predložene jedne
read-only radnje je objašnjen konkretan nesklad, ne uspešan lock release.

LOCK_REMOVAL=NOT_PERFORMED; PRODUCER_MANUAL_RUN=NO; SCAN_CALLS=0;
REBOOT_REPEATED=NO; BACKUP_ACCEPTANCE_REPEATED=NO;
AUTOMATIC_STARTUP=PASS; FULL_SERVICE_RECOVERY=NOT_PROVEN.

## Structured ExecStart disposition — jedno čitanje pripremljeno

[Kompletan read-only blok04](evidence/staging-reported-pdf-scan-failure-20261020/VPS-TERMINAL-04-STRUCTURED-PRODUCER-EXECSTART.sh)
čita isključivo D-Bus Unit.Id/FragmentPath/DropInPaths i Service.ExecStart za
passvero-signature-health.service. Nema systemctl formatiranog ExecStart parsera,
status/journal/env/config sadržaja, instalacije ili producer starta. Unit metadata
se proverava pre/posle istog ciljanog čitanja; promena znači DATA_UNAVAILABLE, bez retry-ja.

Očekivanje postojećeg lokalnog guarda je jedna stavka:
executable `/usr/bin/node`; argv tačno
`["/usr/bin/node", "/usr/local/libexec/passvero-signature-health.cjs", "--config", "/etc/passvero-signature-health.json"]`.
Lokalni CLI source potvrđuje --config ugovor; raniji runbook potvrđuje producer/config
putanje. Potpuna installed service ExecStart definicija nije lokalno sačuvana;
interpreter/tačan argv navode se kao očekivanje guarda, NE potvrđen installed podatak.
Ne popunjavati taj jaz pretpostavkom da drugačiji interpreter treba dozvoliti.

[systemd255 D-Bus ugovor](https://www.freedesktop.org/software/systemd/man/255/org.freedesktop.systemd1.html)
definiše ExecStart kao `a(sasbttttuii)` sa zasebnim binary path i argv uključujući argv0.
[busctl255](https://www.freedesktop.org/software/systemd/man/255/busctl.html) podržava
JSON bez gubitka tipova; [v255 implementacija](https://github.com/systemd/systemd/blob/v255/src/busctl/busctl.c)
get-property koristi json_transform_variant, sa type/data čvorom čiji data je vrednost
property-ja, bez nagađanja ljudskog prikaza ili dodatnog spoljnog message-array nivoa.
Blok prihvata samo taj dokumentovani typed oblik. Ako alat/podatak nije dostupan,
vraća jasno ograničenje, ne instalira zavisnost i ne pokušava drugi transport.

Redosled i broj argv/stavki su sačuvani. Poznate statične putanje/flagovi prikazuju
se; nepoznati argumenti rediguju se bez hashovanja potencijalnih tajni. Takva polja
imaju NOT_CONFIRMED poređenje. Nema sirovog stderr-a. ignoreFailure se čuva radi
razlikovanja semantičkih promena koje nije dozvoljeno izgubiti pri budućem guard fix-u.

Posle jednog operatorskog outputa: samo tačno jedan identičan executable/argv i
ignoreFailure=false bez redakcije opravdavaju pripremu uske lokalne zamene tekstualnog
guarda strukturiranim poređenjem. Odsustvo starog tekstualnog outputa ostaje zabeleženo;
identičan sadašnji typed ugovor opravdava taj candidate bez tvrdnje o nepostojećem
istorijskom sirovom zapisu. Drugi launcher/argv/stavka ili nepouzdan/redigovan podatak
znači STOP bez širenja allowlist-a. Sada guard/worker nisu menjani i nastavak lock
postupka nije prevezan. Zatvoreni03 i njegov operacijski direktorijum ostaju netaknuti.
Nema nove testne serije, builda, termina, live probe ili funcionalnog scan-a.

VPS_MUTATIONS=NO; LOCK_REMOVAL=NOT_PERFORMED; PRODUCER_MANUAL_RUN=NO;
SCAN_CALLS=0; REBOOT_REPEATED=NO; BACKUP_ACCEPTANCE_REPEATED=NO;
NEW_WINDOW_SCHEDULED=NO. Opaženi executable/argv: AWAITING_ONE_OPERATOR_OUTPUT.

## Structured ExecStart output — stvarni wrapper nesklad, priprema korekcije zaustavljena

[Jedan sačuvani typed rezultat04](evidence/staging-reported-pdf-scan-failure-20261020/operator-04-structured-execstart-env-wrapper.json)
u2026-10-20T16:43:05.516685+00:00 potvrđuje tačan unit, fragment
`/etc/systemd/system/passvero-signature-health.service`, DropInPaths=[] i jednu
ExecStart stavku sa ignoreFailure=false.

| Polje | Postojeće očekivanje guarda | Opaženi typed podatak |
| --- | --- | --- |
| executable | /usr/bin/node | /usr/bin/env |
| argv dužina | 4 | 8 |
| argv[0] | /usr/bin/node | /usr/bin/env |
| argv[1..3] | producer path, --config, config path | tri REDACTED_UNREVIEWED_ARGUMENT vrednosti; sadržaj nije potvrđen |
| završni argv[4..7] | nema dodatnih argumenata | /usr/bin/node, /usr/local/libexec/passvero-signature-health.cjs, --config, /etc/passvero-signature-health.json |

Dakle, **nije samo tekstualno formatiranje**. Tačan executable preduslov i broj/
redosled argumenata očekivani u guardu nisu jednaki učitanom ugovoru. To dovoljno
objašnjava PRODUCER_ENTRYPOINT_DRIFT odbijanje tog očekivanja. Ne tvrditi da je
service u međuvremenu promenjen: prethodni stvarni argv nije sačuvan za poređenje.
Ne tvrditi da je env wrapper nelegitiman ili zlonameran. Lokalno očekivanje direktnog
node entrypoint-a nije bilo nezavisno potvrđena installed service definicija.
Nepoznato je da li su tri redigovana argumenta flagovi, environment assignments ili
drugi parametri; ne popunjavati ih pretpostavljenim PATH/LANG/TZ vrednostima.
Nisu prikupljane Environment vrednosti niti sadržaj konfiguracije.

Prema korisnikovoj grani „stvarno drugačiji launcher ili nepouzdani podaci“, ovde se
**staje**. Nije pripremljen guard diff, payload update ili nastavak izvršenja.
Ne skraćivati argv na node suffix, ne ignorisati prva tri argumenta, ne prihvatati
proizvoljni env wrapper i ne dodavati ga automatski u allowlist. Postojeći blok03,
njegov stopped operation direktorijum, historical source i hashovi ostaju netaknuti.
Napuštenost locka i dalje nije potvrđena i rmdir nije izvršen.

**Jedna jasna preporučena naredna radnja, samo za zaseban ciljano odobren pregled:**
usaglasiti kompletan postojeći /usr/bin/env launch ugovor sa izvornom service
definicijom, uključujući identitet i semantiku sva tri redigovana argumenta, uz
zadržavanje tajni van outputa. Konačan kriterijum je objašnjen i pregledan svaki
argument u svom redosledu; dok su delovi redigovani/nepotvrđeni, korekcija ne može
biti exact-reviewed kandidat. Ovo nije predlog opšte dijagnostike, novog harness-a,
service izmene ili ponavljanja lock pokušaja. Sada nisu pripremljene dodatne
operatorske komande i nije pokrenuta nikakva nova live provera.

VPS_MUTATIONS=NO; LOCK_REMOVAL=NOT_PERFORMED; PRODUCER_MANUAL_RUN=NO;
SCAN_CALLS=0; REBOOT_REPEATED=NO; BACKUP_ACCEPTANCE_REPEATED=NO;
NEW_WINDOW_SCHEDULED=NO; AUTOMATIC_STARTUP=PASS; FULL_SERVICE_RECOVERY=NOT_PROVEN.

## Objedinjeni env launch pregled — jedan privatni read-only blok pripremljen

Zadatak SIGNATURE_PRODUCER_ENV_LAUNCH_CONTRACT_AND_LOCK_CONTINUATION.
Lokalni pregled obuhvatio je postojeći recovery source, producer CLI/IO, ranije
service opservacije, protected deploy liste i release-alignment manifest.
Ti izvori potvrđuju producer/config putanje, bundle pin725d3494… i kontrolisano
recovery.run() okruženje, ali ne sadrže kompletnu originalnu producer service
definiciju/installer koja dokazuje tri konkretna env argumenta. Dokumentovani VPS
installer arhivi su odvojeni istorijski izvori; ne nagađati njihove interne nazive
ili tretirati sadašnji guard kao originalni autoritet. Originalni pun launch intent
ostaje UNVERIFIED dok nema odgovarajućeg izvora; instalirano stanje beleži se odvojeno.

[Jedan kompletan privatni read-only blok05](evidence/staging-reported-pdf-scan-failure-20261020/VPS-TERMINAL-05-PRIVATE-ENV-LAUNCH-CONTRACT.sh)
čita typed D-Bus ExecStart i samo relevantne postojeće zaštićene ulaze:
root-owned fragment `/etc/systemd/system/passvero-signature-health.service`,
postojeći config `/etc/passvero-signature-health.json` (samo privatno za timeZone
poređenje) i tačno pinovan installed producer bundle. Nema Environment property-ja,
env iz procesa, raw service/config sadržaja, logova ili izvršavanja tih fajlova.
Fragment je autoritet za **trenutnu deklarisanu installed konfiguraciju**, ne dokaz
prvobitnog odobrenja ili istorije promena. Drop-in ili NeedDaemonReload=true vodi
STOP/ograničenju, bez drugog načina čitanja i bez promene servisa.

Privatno poređenje razlikuje env opcije i NAME=VALUE argumente na svakom indeksu1–3;
prikazuje samo bezbedan naziv, poziciju, vrstu i MATCH/MISMATCH/UNVERIFIED, nikad
vrednost niti hash pojedinačne vrednosti. Ostatak lanca mora biti tačno node →
producer → --config → postojeći config, jedna ExecStart stavka/osam argumenata,
ignoreFailure=false. Nepoznata env kontrola ostaje UNVERIFIED; nema pokušaja da se
-S/shell/chdir/unset gramatika naslepo prihvati. Dodatni argumenti/launcher/target
znače STOP. Poznate -i/--ignore-environment opcije samo se klasifikuju i porede
sa fragmentom; nisu automatski odobreni budući guard.

Poređenje sa installed fragmentom radi se samo za jednu jednostavnu, neinterpoliranu
ExecStart liniju. Quoting, escape, $/specifier expansion ili složeniji grammar
znači UNVERIFIED, ne ad-hoc shell parsiranje. Service fragment čita se kroz bounded
NOFOLLOW fd sa ownership/parent/stability proverama pre/posle typed čitanja.
Ispisuje se identitet celog zaštićenog unit fajla i njegov whole-file SHA256 radi
budućeg protected-source vezivanja; to nije zamena tajne hashom. Nijedna tajna
ili njena pojedinačna hash vrednost ne ulazi u source/payload/izveštaj.

Za LANG/LC_ALL/TZ/PATH postoji dodatno privatno poređenje sa već pregledanim
[recovery.run() intent-om](evidence/staging-auth-scanner-continuation-20261020/recover-release-reviewed.py#L153).
To je dokumentovana nonsecret operativna namera, jasno označena kao takva, ne
izmišljena originalna service baseline vrednost. Nepoznat naziv nema izmišljeno
očekivanje i dobija UNVERIFIED. Ako je prisutan TZ, zasebno se poredi sa postojećim
producer config timeZone bez ispisa vrednosti. Svaki rezultat poređenja beleži izvor.
[Release-alignment manifest](evidence/signature-recovery/release-alignment-source-manifest.json)
i [operatorski rezultat](evidence/signature-recovery/release-alignment-recovery-result.json)
potvrđuju postojeći bundle pin; novi blok samo poredi baš taj artifact, ne ponavlja
deploy/build/backup checksum seriju.

Ako jedan output pruži ceo sadašnji protected launch ugovor i dovoljne potvrđene
vrednosne izvore, u istom zadatku sledi lokalni exact structured guard kandidat i
payload/hash vezivanje nastavka. Ako ostane UNVERIFIED/MISMATCH, nema nastavka.
Nije dozvoljeno zaključiti da loaded argv odgovara istorijskom installeru samo
zato što odgovara trenutnom unit fajlu. Nisu promenjeni stari guard, helper,
lock/pause/closure proces ili installed pinovi. Istorijski03 nije ponovo otvoren.
Napuštenost locka ostaje NOT_PROVEN. Ovaj read-only blok nije nalog za rmdir ili
mutaciju; buduće izvršenje lock nastavka ostaje zasebno odobreno i uslovno.

Sadašnje MATCH činjenice: postojeći typed output potvrđuje /usr/bin/env, jednu
stavku, argvCount8 i poznati node/producer/config suffix. UNVERIFIED: tri prefix
argumenta i njihova poređenja; awaiting ONE private operator output. Nema uskog
guard diffa ili izvršivog lock nastavka pre tog rezultata.

VPS_MUTATIONS=NO; LOCK_REMOVAL=NOT_PERFORMED; PRODUCER_MANUAL_RUN=NO;
SCAN_CALLS=0; REBOOT_REPEATED=NO; BACKUP_ACCEPTANCE_REPEATED=NO;
NEW_WINDOW_SCHEDULED=NO. Nema nove testne serije ili aplikacijskog builda.

## Privatni rezultat05 — sadašnji launch potvrđen, lokalni kandidat bez izvršavanja

[Sačuvani neizmenjeni operatorski rezultat05](evidence/staging-reported-pdf-scan-failure-20261020/operator-05-private-env-contract.json)
opažen je 2026-10-20T16:52:19.707629+00:00. To je read-only operatorovo opažanje,
ne agentov VPS pristup. Jedina ExecStart stavka ima executable /usr/bin/env,
ignoreFailure=false i tačno osam argumenata, ovim redom:

`/usr/bin/env → -i → PATH=<privatno> → LANG=<privatno> → /usr/bin/node → /usr/local/libexec/passvero-signature-health.cjs → --config → /etc/passvero-signature-health.json`.

| Poređenje | Nalaz i granica |
| --- | --- |
| Učitani kompletan argv prema zaštićenoj installed service deklaraciji | MATCH; uključuje privatne vrednosti PATH i LANG, bez njihovog ispisa |
| Prefix struktura, opcija -i, imena i položaji PATH/LANG | MATCH_SUPPORTED_STRUCTURE |
| Installed producer prema ranije pregledanom bundle pinu | MATCH |
| LANG prema okruženju odvojenog recovery.run() helpera | MATCH |
| PATH prema okruženju odvojenog recovery.run() helpera | MISMATCH; to su dva različita launch konteksta, ne installed-vs-declared producer nesklad |
| Originalni installer, prvobitno odobrenje i istorija promena | UNVERIFIED; nisu rekonstruisani iz sadašnjeg stanja |

**Lokalna odluka i ograničenje:** zbirni disposition iz dijagnostike05 ostaje
sačuvan kao STOP. Njegov `documented` uslov zahteva jednakost producer assignments
sa okruženjem drugog programa, recovery.run(). [Relevantni lokalni source](evidence/staging-auth-scanner-continuation-20261020/recover-release-reviewed.py#L153)
izričito postavlja svoje scrubbed subprocess okruženje; on ne definiše service
ExecStart. Zato taj PATH MISMATCH nije dokaz neodobrenog producer argumenta i nije
razlog da menjamo producer PATH. Ovo je obrazložena lokalna klasifikacija različitih
izvora, ne izmena istorijskog outputa niti zaobilaženje stvarnog vrednosnog nesklada.
Sadašnji kompletan declared/loaded launch ima nezavisan privatni MATCH prema
root-owned zaštićenoj deklaraciji, što je osnov kandidata. Ne proglašava se
potvrđenom originalna installer istorija. Ako se sadašnja pinovana deklaracija ili
bilo koji učitani argument promeni, kandidat mora stati; nije dozvoljen fallback
na recovery PATH, node suffix ili proizvoljni /usr/bin/env.

Autoritet kandidata je **isključivo tačno opaženi sadašnji protected unit**:
`/etc/systemd/system/passvero-signature-health.service`, root:root, mode0644,
whole-file SHA256 `5becee91793921e6bae866b3c2f9523e4dfa2208b9709c2413191f38b7c31afe`.
To je pin celog unit fajla, ne pojedinačne tajne. Privatne PATH/LANG vrednosti nisu
kopirane u repo/payload, nagađane niti objavljene kroz pojedinačne hashove.

### Tačan lokalni kandidat i pripremljeni nastavak

[Pregledni diff prema očuvanom originalu](evidence/staging-reported-pdf-scan-failure-20261020/env-launch-guard-candidate.diff)
i [novi lokalni helper kandidat](evidence/staging-reported-pdf-scan-failure-20261020/conditional-lock-release-env-candidate.py)
menjaju samo launch proveru, dodaju whole-unit pin i odvajaju evidence putanju.
Tekstualni ExecStart izlazi iz poređenja. Typed D-Bus proverava jednu stavku,
executable, kompletan argv, tačan -i, PATH/LANG pozicije i pun node/producer/config
suffix. Sve vrednosti privatno moraju biti jednake jednostavnoj ExecStart liniji
iz tačno pinovanog fajla. Podržana je samo već opažena plain gramatika, bez shell
wrappera, quoting/escape ili promenljivih/specifier ekspanzija. Id/FragmentPath,
DropInPaths=[] i NeedDaemonReload=false proveravaju se pre/posle; neispravan tip,
novi argument ili drift znače STOP. Hash source-a kandidata:
`c6d2d1b153920872aba24e17a47fa26ec601e41cf717a7dad957f2dd57af3a13`.

**VPS TERMINAL / PENDING_OPERATOR_COMMAND — LOKALNI KANDIDAT, SADA NE IZVRŠAVATI:**
[Kompletan blok06](evidence/staging-reported-pdf-scan-failure-20261020/VPS-TERMINAL-06-ENV-CONTRACT-LOCK-CONTINUATION-CANDIDATE.sh),
SHA256 `9178650ecb5f7579d141f4e9a3ccedfb6208510b3175cc5dd243353fecc112bb`.
To je priprema nastavka istog uslovnog lock postupka, bez novog termina ili nove
acceptance serije. Blok03 se ne ponavlja. Prethodni helper ostaje
`92c739870e077d7e6998e583176bf188103dca3c6a5646c5437100e51b177322`.

Blok prvo privatno proverava njegov identitet, originalni stop.json sa
LOCK_RELEASE_BODY/PRODUCER_ENTRYPOINT_DRIFT i closure.json sa
NO_TIMER_CHANGE_STARTED, bez pending stavki. Odbija tragove prethodne pauze ili
uklanjanja. Originalne fajlove ne prepisuje. Aditivni dokazi i privatna kopija
kandidata idu isključivo u novi poddirektorijum postojećeg postupka
`/var/lib/passvero-signature-lock-release-20261020-01/env-launch-continuation`;
ako on već postoji, STOP bez retry-ja. Zaseban transient unit ima suffix
`-env-continuation`; to nije ponovno otvaranje ili preimenovanje starog pokušaja.
Originalni stop/closure/helper hashovi čuvaju se u prior-history.json novog poddirektorijuma.

Svi raniji guardovi ostaju: tačan config/output/lock i producer/reader pin,
known-trigger/ExecStartPre/Post/ExecStop provere, recovery controller flock,
zaštićeni recovery zapisi, systemd stanje plus dve provere stvarnih procesa,
fail-closed za nepoznati root interpreter, tačan prazan root-owned direktorijum bez
symlink-a, zaštićen roditelj i neposredna potvrda identiteta pre jednog rmdir.
Nema ubijanja procesa, rekurzije, brisanja sadržaja ili ručnog producer poziva.
Napuštenost locka i dalje je NOT_PROVEN dok ove buduće provere ne prođu.

**Obavezan uslov budućeg izvršenja:** operator isključivo kontroliše prozor i nema
paralelnih root/admin/manual producer radnji. Timer pauza i recovery flock ne
sprečavaju proizvoljan novi root exec. Ako taj uslov nije pouzdan, ne izvršavati.
Kandidat čuva prethodno active/enabled stanje samo producer tajmera, kratko ga
pauzira i koristi nezavisni ExecStopPost closure sa istim proverama za bezbedan
povratak. Pri nebezbednom povratku prijavljuje PARTIAL/pending; ništa ne forsira.
Backup/reminder tajmeri nisu predmet postupka. Posle eventualnog rmdir i uspešnog
closure-a ostaje samo jedno ograničeno opažanje redovnog scheduled ciklusa i jedno
postojeće reader čitanje. Neuspeh ili NOT_RECORDED znači STOP bez drugog uklanjanja,
retry-ja, recoveryja ili nove dijagnostičke serije.

**Jedna konkretna naredna radnja:** zasebno odobreno operatorsko izvršenje celog
pregledanog kandidata06, pod navedenim uslovom isključivog pristupa, uz vraćanje
jednog sanitizovanog outputa. U ovom zadatku izvršenje nije započeto. Konačan
operativni kriterijum je uslovno dokazana napuštenost i jedan rmdir, potvrđen povratak
tajmera, jedan redovni PUBLISHED izveštaj i reader accepted=true. To ne dokazuje
istorijskog tvorca locka niti uzrok starog PDF attempt-a. Potom korisnik kroz UI radi
„Skeniraj dokument“ → osveži status → preuzmi samo ako CLEAN; terminal ne pokreće scan.

Lokalno provereni samo source/outer payload syntax bez izvršavanja, tačan diff,
embedded payload/hash veze, manifest, reference i whitespace. Nema lokalnih testova,
builda, nove matrice ili live prihvatanja kandidata. Pravni nacrt, roadmap,
nepovezane izmene i prethodni dokazi ostaju neizmenjeni.

VPS_MUTATIONS=NO; LOCK_REMOVAL=NOT_PERFORMED; PRODUCER_MANUAL_RUN=NO;
SCAN_CALLS=0; REBOOT_REPEATED=NO; BACKUP_ACCEPTANCE_REPEATED=NO;
NEW_WINDOW_SCHEDULED=NO; AUTOMATIC_STARTUP=PASS; FULL_SERVICE_RECOVERY=NOT_PROVEN.

## Rezultat06 — procesni STOP posle pauze; nezavisni closure PARTIAL

[Tačan operatorski output06](evidence/staging-reported-pdf-scan-failure-20261020/operator-06-process-guard-stop-partial-closure.json)
od 2026-10-21 beleži LOCK_RELEASE_BODY /
PRODUCER_RECOVERY_OR_UNREVIEWED_ROOT_INTERPRETER_ACTIVE, exit1. Prethodno odobreno
jednokratno izvršenje kandidata06 je potrošeno; blok se ne ponavlja. Originalni03
ostaje zatvoren, bez izmene njegovog rezultata. Ovaj novi rezultat nije BASELINE_RESTORED.

Iz [tačnog izvršenog lokalnog source-a](evidence/staging-reported-pdf-scan-failure-20261020/conditional-lock-release-env-candidate.py)
sledi da je launch guard prošao, baseline sačuvan u11:35:28.393974 UTC, a
producer timer namerno pauziran i inactive/disabled provera prošla pre poziva idle().
Odbijanje u idle() dolazi posle uspešne provere da je producer service inactive/failed
sa MainPID=ControlPID=0: procesna enumeracija vratila je najmanje jedno poklapanje.
To nije dokaz da je producer service radio. Poklapanje može biti poznati
producer/recovery ili nepregledani root Node/Python interpreter. Ne zaključivati
koji od njih bez identiteta procesa.

**Nedostajući podatak:** PID/startTicks, executable, cgroup/unit i konkretna
klasifikacija poklapanja su NOT_RECORDED u ovom sanitizovanom rezultatu. Funkcija
processes() ih delimično formira lokalno, ali idle() pri odbijanju čuva samo zbirni
kod; lista nije sačuvana. Nije dokazano da je to vlastiti maintenance/closure
proces, legitiman nepovezani servis ili stvarni recovery. Ne dodavati izuzetke i ne
uklanjati guard na osnovu pretpostavke.

Nezavisni ExecStopPost closure je zaista pokušao povratak i u11:35:29.547419 UTC
odbio nastavak zbog istog procesnog guarda, pre enable --now. Rezultat je
PARTIAL_TIMER_RESTORE_REQUIRES_OPERATOR_REVIEW, timerRestored=false, pending sa
istim kodom. Po izvornoj putanji namerna pauza jeste nastupila; konačno sveže
ActiveState/UnitFileState tajmera nije zasebno sačuvano. **Povratak nije potvrđen;
tajmer treba tretirati kao pauziran dok se ne dokaže bezbedan povratak.** Ne navoditi
da je aktivan samo zato što baseline sadrži active/enabled.

Lock je u početnom opažanju bio root:root0700 prazan direktorijum, dev2049,
inode2161968, pod roditeljem dev2049/inode1573155. To nije potvrda napuštenosti:
procesna zaštita nije prošla i neposredna završna potvrda/rmdir nisu izvršeni.
LOCK_REMOVAL=NOT_PERFORMED. Scheduled ciklus i reader nisu pokrenuti/
posmatrani zbog neuspešnog closure-a; nema novog producer/reader health rezultata.
Nema osnova za korisničku PDF acceptance tvrdnju ili terminalski scan.

**Jedna najmanja naredna radnja, za zasebno odobreni ograničeni pregled:** jedno
read-only identifikovanje procesa koji danas odgovaraju istom guardu, uz aktuelno
stanje samo producer servisa/tajmera. Sačuvati PID, startTicks, UID, executable,
cgroup/unit i klasifikaciju, bez sirovog argv/environment ili širokih logova;
pouzdano razlikovati sopstveni dijagnostički proces. To novo opažanje ne sme se
predstaviti kao rekonstrukcija istorijskog PID-a. Kriterijum je objašnjeno svako
aktuelno poklapanje i tačan timer state, dovoljan za odluku o bezbednom završetku
closure-a. Sada nisu pripremljeni niti izvršeni novi VPS blokovi. Ne pokretati
kandidat06/producer, ne ubijati procese, ne uklanjati lock i ne forsirati enable
ili closure preko nepregledanog procesa. Prioritet je razrešavanje pending
povratka tajmera, a ne drugi pokušaj rmdir.

Izveštaj/manifest dopunjeni samo ovim nalazom. Helperi, payload i istorijski outputi
nisu menjani. Agent nije pristupao VPS-u; operatorov timer pause je stvarna mutacija
ovog izvršenja i zato se ceo postupak ne označava VPS_MUTATIONS=NO. Nema novih
testova/builda, live proba ili promene roadmapa/pravnog nacrta.

LOCK_REMOVAL=NOT_PERFORMED; PRODUCER_MANUAL_RUN=NO; SCAN_CALLS=0;
REBOOT_REPEATED=NO; BACKUP_ACCEPTANCE_REPEATED=NO;
TIMER_RESTORE=PARTIAL_PENDING; AUTOMATIC_STARTUP=PASS;
FULL_SERVICE_RECOVERY=NOT_PROVEN; AGENT_VPS_ACCESS=NO.

## Pending closure — jedan read-only procesni pregled07 pripremljen

Zadatak SIGNATURE_PRODUCER_PENDING_CLOSURE_PROCESS_IDENTIFICATION.
[Kompletan VPS TERMINAL / PENDING_OPERATOR_COMMAND blok07](evidence/staging-reported-pdf-scan-failure-20261020/VPS-TERMINAL-07-PENDING-CLOSURE-PROCESS-IDENTIFICATION.sh)
pripremljen je samo za jedno operatorsko čitanje. Ne izvršava se kandidat06 niti
njegova body/close/final funkcija. Nema server-side evidence upisa, privremenog
helpera, start/stop/enable operacije ili promene guarda. Sanitizovani JSON izlaz
operator vraća u chat; zatim se sačuva kao novi dokaz, bez prepisivanja06.

Kriterijumi su preuzeti iz tačnog izvršenog helpera sa pinom
c6d2d1b153920872aba24e17a47fa26ec601e41cf717a7dad957f2dd57af3a13:
poznati substring tokeni u argumentima/cgroup-u ili root UID uz executable basename
node/nodejs/python[0-9.]*, osim postojećeg tačnog qpdf izuzetka. Blok ih ne proširuje.
Skenira jedan ograničeni /proc popis (najviše4096 PID-ova,25s ukupan rok), sa
pre/posle proverom PID/startTicks/executable i PPID. Ne ispisuje ostale procese.
Najviše64 poklapanja i64 izlaska tokom čitanja; prekoračenje ili nepotpun pristup
znači INCOMPLETE/STOP, ne tvrdnju da su svi procesi provereni. Ovo nije atomski
snapshot i ne sprečava budući paralelni root exec.

Za svako poklapanje prikazuje PID/PPID, UID niz, startTicks, clock-tick skalu/bootId,
bezbedan executable i redigovani cgroup/unit, konkretne poznate kriterijume i
argumente isključivo iz eksplicitnog bezbednog skupa. Ostali argumenti su REDACTED;
poznati substring se navodi samo kao fiksni token, nikad okolni sirovi sadržaj.
Nema environment/lozinki/tokena, širokog ps/journal ispisa ili sadržaja config-a.
Nepodržana executable/cgroup putanja se rediguje, bez nagađanja identiteta.

Dijagnostički Python proces se **ne krije**: prikazuje se u matches ako ispunjava
kriterijume, sa tačnim self PID/startTicks identitetom i razlogom SELF izuzeća koje
bi stari guard inače primenio. Isto važi za pretke i, samo ako se sve vrednosti
poklope, sačuvani controller PID/startTicks/executable/UID. Predicate podudaranje
se razdvaja od wouldBlockOriginalGuardAtThisObservation; postojeći guard ostaje
neizmenjen. Poznati token znači KNOWN_PRODUCER_OR_RECOVERY prema guardu, ne nezavisan
dokaz funkcije procesa ili korišćenja locka. Tu klasifikaciju tek treba pregledati.
Nestanak tokom čitanja beleži PROCESS_EXITED_DURING_READ bez pretpostavljene uloge;
proces bez čitljivog exe koji još ima /proc ulaz broji se odvojeno kao izvorni
skip, ne predstavlja se kao potvrđeno ugašen ili potvrđeno nebitan.

Aktuelni producer/timer Id, stanje, MainPID/ControlPID, veze i structured Unit.Job
čitaju se pre/posle iste procesne enumeracije. Job je typed (uo), bez parsiranja
human ExecStart stringa ili pokretanja servisa. Iz tačnog privatnog operation
poddirektorijuma čitaju se sačuvani timer baseline i partial/pending closure;
privatno se proverava identitet izvršenog helpera i stabilnost postojećih zapisa.
Na bilo koji nesklad blok vraća sanitizovano ograničenje, bez drugog pokušaja.

**Sadašnji opaženi identiteti i aktuelno stanje:** AWAITING_ONE_OPERATOR_OUTPUT.
Istorijski blokirajući PID ostaje NOT_RECORDED. Odsustvo današnjih poklapanja ne
može dokazati koji je proces aktivirao raniji STOP. Prethodni baseline je
active/enabled; povratak i dalje PARTIAL_PENDING. Nema pripremljenog izvršivog
closure bloka pre pregleda ovog rezultata; nerazrešeni preduslov je konkretan
identitet i uloga aktuelnih blokirajućih procesa plus sveže timer/service/Job
stanje. Jedina naredna radnja sada je operatorovo jednokratno izvršenje07 i
vraćanje JSON-a, bez ponavljanja06 ili dodatne funkcionalne serije.

Posle jednog outputa odlučuje se da li su uslovi jasni za zaseban minimalni
closure kandidat koji vraća samo sačuvani producer timer baseline, uz sveže
promenljive provere i readback. Taj blok neće biti izvršen bez zasebnog odobrenja.
Enable/start tajmera može odmah aktivirati redovni producer ciklus; to bi bila
stvarna mutacija i moguće izvršavanje producer-a, ne read-only korak. Nije sada
odobreno niti pripremljeno kao zaobilaženje procesnog guarda. Ako uloge ostanu
nepoznate, navodi se tačno nerazjašnjeno poklapanje, bez nove allowlist pretpostavke.

Lokalna provera obuhvata samo novi blok kao podatak, reference, source/pin vezivanje,
manifest i whitespace; nema operativnog izvršavanja, testne matrice, builda ili
ponavljanja ranijih testova. Stari helperi, blokovi i outputi ostaju neizmenjeni;
pravni nacrt, roadmap i nepovezane izmene nisu predmet rada. Koristi se postojeći
systematic-debugging postupak: identitet i dokaz pre predloga mutacije.

PROCESS_KILL=NO; LOCK_REMOVAL=NOT_PERFORMED; SERVICE_TIMER_MUTATIONS=NO;
REBOOT_REPEATED=NO; BACKUP_ACCEPTANCE_REPEATED=NO;
TIMER_RESTORE=PARTIAL_PENDING; DIAGNOSTIC_PREPARED; DIAGNOSTIC_EXECUTED=NO.

## Rezultat07 — tri sistemska root interpretera; konkretan blocker za closure

[Sačuvani operatorski rezultat07](evidence/staging-reported-pdf-scan-failure-20261020/operator-07-current-process-identities.json)
opažen je 2026-10-21T11:44:36.074205 UTC. Read-only pregled je završen; nema
izlazaka procesa tokom čitanja ni prijavljenih ograničenja. To je ograničena,
neatomska enumeracija, ne dokaz odsustva budućeg ili paralelnog pokretanja.

| PID / PPID | UID niz | startTicks | executable | Opažena systemd/cgroup pripadnost | Razlog predicate poklapanja |
| --- | --- | --- | --- | --- | --- |
| 1300 / 1 | 0/0/0/0 | 1104 | /usr/bin/python3.12 | /system.slice/networkd-dispatcher.service | samo root Python interpreter |
| 1353 / 1 | 0/0/0/0 | 1158 | /usr/bin/python3.12 | /system.slice/unattended-upgrades.service | samo root Python interpreter |
| 172899 / 1 | 0/0/0/0 | 13295055 | /usr/bin/python3.12 | /system.slice/fail2ban.service | samo root Python interpreter |
| 204632 / 204631 | 0/0/0/0 | 15945728 | /usr/bin/python3.12 | /user.slice/user-1000.slice/session-346.scope | dijagnostički SELF, tačan PID/startTicks; izvorni guard bi ga izuzeo |

BootId je 379fc52e-5524-4b93-b6ec-b036d1953db7,100 clock ticks/s. Sva tri stvarna
blokirajuća poklapanja imaju prazne knownArgumentTokens/knownCgroupTokens i nisu
qpdf izuzeci. Njihova identifikovana pripadnost drugim sistemskim servisima objašnjava
**današnje** generičko root-interpreter odbijanje; nisu identifikovani kao signature
producer/recovery. Script putanje i opcije tih procesa su redigovane, nisu nezavisno
potvrđene prema executable/unit MainPID ugovoru tih servisa. Ne zaključivati da
koriste signature lock, niti da je samo njihovo postojanje dokaz opasnosti.
Dijagnostički SELF je vidljiv i nije jedno od tri blokirajuća poklapanja.

Pre/posle pregled pokazuje isto stanje: producer service failed/failed, static,
MainPID=0,ControlPID=0, bez pending systemd posla (Job id0). Producer timer je
inactive/dead,disabled, takođe bez posla. Sačuvani početni baseline je
active/enabled; originalni partial closure i pending razlog su nepromenjeni.
**Povratak nije izvršen niti dokazan: TIMER_RESTORE=PARTIAL_PENDING.** Nije nastao
novi scheduled ciklus ili reader rezultat. Zaključak o istorijskom PDF-u nije menjan.

Istorijski blokirajući PID iz pokušaja06 ostaje NOT_RECORDED. Ovo opažanje ne dokazuje
koje je poklapanje ili koja kombinacija poklapanja uzrokovala prethodni STOP.
Osamdeset /proc ulaza bez čitljivog exe preskočeno je kao u izvornom guardu; nisu
proglašeni ugašenim, producer-free ili pregledanim korisničkim procesima.

**Konkretan preostali blocker i odluka:** izvršeni closure pre enable --now poziva
isti idle()/processes() guard, pa bi uz ovakvo stanje odbio sva tri navedena PID-a.
Ponovno pozivanje tog closure-a ne rešava pending. Korisnik je u ovom zadatku
izričito zabranio proširenje allowlist-a i promenu procesnog guarda; zato se ne
priprema izvršiv blok koji ove procese izuzima ili preskače postojeći guard.
Ne ubijati/zaustavljati networkd-dispatcher, unattended-upgrades ili fail2ban.
Nije opravdano ponovno uklanjanje locka ili nova opšta dijagnostika svih procesa.

**Jedna konkretna naredna radnja:** zasebno odobriti usku, closure-only korekciju
uslova za vraćanje prethodnog producer timer baseline-a. Predmet tog odobrenja bio
bi razdvajanje pravila za povratak automatizacije od strožeg pravila koje odbija
bilo koji nepregledani root interpreter pre rmdir: zadržati proveru stvarnog
producer/recovery pokretanja, zaštićenih/pinovanih ulaza, sačuvanog baseline-a i
aktuelnih systemd poslova; bez promene pravila za uklanjanje locka, bez allowlist
opšteg root Python/Node izvršavanja i bez ponavljanja06. Ta korekcija nije sada
implementirana niti postoji novi executable closure payload. Potrebno je odobrenje
za tu konkretnu promenu closure ugovora, ne novo opšte odobrenje acceptance serije.

Budući zaseban minimalni closure blok mora neposredno ponovo proveriti promenljive
činjenice, vratiti isključivo tačan sačuvani producer timer active/enabled baseline,
sačuvati novi rezultat bez prepisivanja istorijskog PARTIAL i izvršiti tačan readback.
Enable/start tajmera može odmah aktivirati njegov redovni producer ciklus; taj korak
nije read-only i ne može biti izvršen pod sadašnjim odobrenjem za pregled. Dok se
korekcija i izvršenje zasebno ne odobre i readback ne uspe, status ostaje pending.

Sada su promenjeni samo novi sanitizovani operator07 dokaz, postojeći izveštaj i
manifest. Reference/hashovi/whitespace provereni; nema novih testova/builda, VPS
pristupa agenta, closure/pause/resume poziva ili izmene helpera. Pravni nacrt,
roadmap, istorijski neuspehi i nepovezane izmene su sačuvani.

PROCESS_KILL=NO; LOCK_REMOVAL=NOT_PERFORMED; SERVICE_TIMER_MUTATIONS=NO;
REBOOT_REPEATED=NO; BACKUP_ACCEPTANCE_REPEATED=NO;
TIMER_RESTORE=PARTIAL_PENDING; AUTOMATIC_STARTUP=PASS;
FULL_SERVICE_RECOVERY=NOT_PROVEN; DIAGNOSTIC_EXECUTED_BY_OPERATOR=YES.

## Closure-only korekcija08 — pripremljena za pregled, nije izvršena

Korisnik je zasebno odobrio **pripremu** closure-only korekcije, ne njeno izvršenje.
[Čitljiv source kandidata08](evidence/staging-reported-pdf-scan-failure-20261020/producer-timer-closure-only.py)
i [kompletan VPS TERMINAL / PENDING_OPERATOR_COMMAND blok08](evidence/staging-reported-pdf-scan-failure-20261020/VPS-TERMINAL-08-CLOSURE-ONLY-TIMER-RETURN.sh)
pripremljeni su lokalno. Source SHA256:
`acd74b41720bb59a1bd22a896a310fa70b3f4ba182fef6de1f623acf54f9562b`;
block SHA256:
`23ae0c49313503002b02fdda2d71b954c3959f785141571da20bbc3394b9cc81`.
Wrapper izvršava samo embedded source sa tačnim hashom; ne instalira globalni
helper i ne poziva stari operativni harness/body/close/final.

**Tačna razlika ugovora:** guard processes()/idle() za uklanjanje locka nije menjan,
niti mu je dodata bilo kakva allowlist iznimka. Odvojena closure-only funkcija
proverava poznate producer/recovery/maintenance markere u stvarnim procesima i
cgroup-ovima, producer MainPID/ControlPID i systemd poslove. Ne odbija ostale root
interpretere samo zbog interpretera; njihov broj se beleži bez zaključka o korišćenju
locka. To je odobreno razdvajanje pravila za povratak baseline-a od pravila pre
rmdir, ne opšta dozvola root Node/Python procesa za buduće lock uklanjanje.
networkd-dispatcher, unattended-upgrades i fail2ban se ne zaustavljaju niti menjaju.

Pre bilo kakve timer mutacije blok proverava:

- Tačan host/root kontekst, zaštićene roditelje i originalni helper pin; sačuvani
  baseline active/enabled, identitet config/timer/service fajlova i originalni
  PARTIAL/pending stop/closure zapisi moraju odgovarati prihvaćenim dokazima.
- Tačni hashovi config-a28df856a…, timer unit-a5db45222… i service unit-a5becee91…,
  plus nepromenjeni producer/reader artifact pinovi i privatni kompletan typed
  env launch ugovor iz pinovanog unit fajla, bez ispisa env vrednosti.
- Postojeći recovery controller flock mora se ekskluzivno steći bez čekanja;
  zaštićeni recovery zapisi moraju biti COMPLETE/ROLLED_BACK. Poznati procesni
  markeri uključuju i ostatke lock-maintenance postupka. Prethodni maintenance
  unit-i ne smeju imati aktivan proces ili pending posao.
- Producer je inactive/failed sa MainPID=ControlPID=0, producer timer je
  inactive/disabled bez pending systemd posla; dve neposredne procesne provere i
  ponovna provera stabilnosti istorijskih zapisa prolaze. Aktivan proces se ne
  ubija. Pri poklapanju se čuvaju PID/startTicks u novom blocked-known-processes.json
  i sanitizovanom izlazu, bez gubitka konkretnog blokirajućeg identiteta.

Ostaje obavezan uslov isključive operatorske koordinacije bez paralelnog root/admin
manual producer/recovery pokretanja. Flock i procesno opažanje nisu globalni fence
za proizvoljan root exec. Ako operator ne može obezbediti taj uslov, blok se ne
izvršava. Ovaj zadatak ne tvrdi da je napuštenost signature locka potvrđena.

**Jedina service/timer mutacija je**
`systemctl enable --now passvero-signature-health.timer`.
To može **odmah pokrenuti redovni producer ciklus**, sa njegovim uobičajenim
posledicama; nije read-only korak. Ne poziva se producer direktno, ne resetuje se
failed stanje, ne ponavlja enable, ne dira se reminder/backup automatizacija.
Nema rmdir/unlink/kill operacije ni direktnog pisanja health snapshota/counter-a;
postojeći signature lock ostaje netaknut od strane ovog postupka. Sama redovna
producer invokacija i dalje koristi svoj postojeći lock mehanizam.

Aditivni privatni dokazi idu samo u
`/var/lib/passvero-signature-lock-release-20261020-01/env-launch-continuation/timer-baseline-closure-only`.
Ako taj poddirektorijum već postoji, STOP bez retry-ja. Originalni PARTIAL i ostali
istorijski zapisi ostaju neizmenjeni. Novi preparation/intent/timer-readback/result
zapisi vezuju se za njihove hashove, bez prepisivanja istorije.

Posle enable --now čuva se tačan timer readback i oslobađa recovery flock, a zatim
se samo posmatra jedan redovni producer ciklus, najviše35s. Jedno usko journal
čitanje prihvata tačno jedan normalizovani ProducerReport vezan za novu invokaciju;
nema širokog log ispisa ili sirovog exception-a. BUSY se zabeleži kao BUSY uz
NO_SECOND_INTERVENTION, bez lock uklanjanja, recoveryja ili ponavljanja. Nedostajući/
nejedinstven zapis je NOT_RECORDED, ne uspeh producer-a. Reader se u ovom uskom
closure-only bloku ne pokreće; vraćanje tajmera i rezultat ciklusa nisu reader/PDF
acceptance. Korisnički PDF tok nije pokrenut.

Završni finally pokušava nezavisan timer readback i pri exception-u/grešci enable
komande, bez dodatne mutacije. TIMER_RESTORE može biti PASS samo posle stvarnog
active/enabled readbacka, a ne zbog pripremljenog koda ili ProducerReport ishoda.
Ako readback nije dostupan ili ne odgovara baseline-u, ostaje PARTIAL_PENDING.
Ovo je best-effort zatvaranje Python izuzetaka, ne garancija rezultata pri SIGKILL,
gubitku VPS-a ili prekidu pre upisa; tada nema automatskog pokušaja i rezultat je
nepotvrđen do operatorskog outputa. BUSY ne menja uspešno potvrđeni timer baseline
u health PASS: timer povratak i producer ishod beleže se odvojeno.

**Naredna radnja sada:** pregled kandidata08 i zasebno odobrenje operatorskog
izvršenja. Blok je PENDING_OPERATOR_COMMAND i nije izvršen. Nije zakazan novi
termin. Ova priprema ne menja postojeći TIMER_RESTORE=PARTIAL_PENDING.

Lokalno provereni samo reference, AST/payload kao podaci, tačno preuzete zaštitne
funkcije, hash/payload veze, jedini mutating system() poziv, manifest i whitespace.
Nema novih testova, builda, VPS pristupa agenta, producer/scanner poziva ili
backup acceptance-a. Stari lock-removal guard, raniji payloadi/outputi, pravni
nacrt, roadmap i nepovezane izmene ostaju sačuvani.

CLOSURE_ONLY_PREPARED=YES; CLOSURE_ONLY_EXECUTED=NO;
PROCESS_KILL=NO; LOCK_REMOVAL=NOT_PERFORMED; SERVICE_TIMER_MUTATIONS=NO;
PRODUCER_MANUAL_RUN=NO; REBOOT_REPEATED=NO; BACKUP_ACCEPTANCE_REPEATED=NO;
TIMER_RESTORE=PARTIAL_PENDING; AUTOMATIC_STARTUP=PASS;
FULL_SERVICE_RECOVERY=NOT_PROVEN.

## Rezultat08 — timer baseline vraćen; jedan redovni ciklus BUSY, bez druge intervencije

[Tačan dostavljeni operatorski rezultat08](evidence/staging-reported-pdf-scan-failure-20261020/operator-08-timer-restored-natural-cycle-busy.json)
potvrđuje izvršenje closure-only bloka od strane operatora. Agent nije pristupao
VPS-u. Ovaj rezultat razrešava **pending povratak tajmera**, bez retroaktivnog
menjanja originalnog PARTIAL zapisa ili ranijeg lock-removal STOP-a.

TIMER_RESTORE=PASS je zasnovan na stvarnim readback podacima, ne na pripremi:
`passvero-signature-health.timer` je loaded,active,enabled, Triggers tačno
passvero-signature-health.service. Prvi readback imao je SubState=running, a
završni SubState=waiting. Producer timer baseline active/enabled je vraćen;
nema preostalog pending zahteva za njegovo vraćanje u ovom postupku. Zasebno
vreme samog readbacka nije u outputu; timestampUs u nastavku pripada ciklusu.

Obe neposredne closure-only provere imale su knownProducerRecoveryMatches=0 i
otherRootInterpreterCount=5. To nije opšta root-interpreter allowlist niti dokaz
napuštenosti signature locka. Guard za uklanjanje locka ostao je neizmenjen.
Nema process kill-a, ručnog producer poziva ili ponavljanja kandidata06.

Jedan prirodni scheduled ciklus je zabeležen: invocationId
`2bc2556429a34f5998904577f3a7ae4f`, timestampUs `1792583617582900`, result=BUSY,
phase=ACQUIRE, reason=null, durationMs=0.7159339999999901. To potvrđuje da taj
konkretni producer pokušaj nije stekao lock i nije objavio novi health dokaz;
ne potvrđuje ko drži/ko je napravio lock ili da je napušten. Nije dokaz istorijskog
unutrašnjeg uzroka PDF attempt-a. BUSY je zabeležen bez druge intervencije,
uklanjanja locka, recoveryja ili ručnog ponavljanja producer-a.

Reader je NOT_RUN_IN_THIS_CLOSURE_ONLY_SCOPE. Nema novog reader accepted rezultata,
nema osnova da se health proglasi oporavljenim ili da se PDF funkcionalna provera
proglasi uspešnom. Razdvajaju se **uspešan povratak timer baseline-a** i **neuspeh
sticanja locka u prirodnom producer ciklusu**. FULL_SERVICE_RECOVERY ostaje NOT_PROVEN.
Redovni tajmer ostaje vraćen; u ovom zadatku nisu pripremljene nove komande,
dijagnostika ili dodatna intervencija.

Sačuvani su samo novi sanitizovani output08 i relevantna dopuna izveštaja/manifesta;
reference/hashovi i whitespace provereni. Istorijski PARTIAL/STOP dokazi, helperi,
payloadi, pravni nacrt, roadmap i nepovezane izmene ostali su netaknuti. Nema novih
testova/builda, restarta/reboot-a, scan-a ili backup acceptance-a.

TIMER_RESTORE=PASS; TIMER_BASELINE_PENDING=NONE;
PRODUCER_CYCLE=BUSY_ACQUIRE; READER=NOT_RUN;
PROCESS_KILL=NO; LOCK_REMOVAL=NOT_PERFORMED; PRODUCER_MANUAL_RUN=NO;
SCAN_CALLS=0; REBOOT_REPEATED=NO; BACKUP_ACCEPTANCE_REPEATED=NO;
SECOND_INTERVENTION=NO; AUTOMATIC_STARTUP=PASS; FULL_SERVICE_RECOVERY=NOT_PROVEN.
SERVICE_TIMER_MUTATIONS=PERFORMED_BY_OPERATOR_TIMER_BASELINE_RETURN_ONLY;
AGENT_VPS_ACCESS=NO.

## Precizan owner guard i uslovni lock postupak09 — odobren opseg, pripremljen za operatora

Zadatak SIGNATURE_HEALTH_PRECISE_OWNER_CHECK_AND_CONDITIONAL_LOCK_RELEASE.
Korisnik je odobrio ovu jednu ograničenu intervenciju, uključujući eventualni
rmdir i nezavisni povratak producer tajmera. Izvršava je operator; agent nije
pristupao VPS-u. Ne traži se novo odobrenje za taj već odobreni opseg.

Pregledani lokalni skup:

- [Minimalni diff prema očuvanom env kandidatu06](evidence/staging-reported-pdf-scan-failure-20261020/precise-owner-local.diff).
- [Čitljiv helper09](evidence/staging-reported-pdf-scan-failure-20261020/precise-owner-lock-release.py),
  SHA256 `2cac1aee2fdc2bd12a72fa3a59c8a9c0d38ed239a8da5ce32b0cabcab5338b5b`.
- [Kompletan VPS TERMINAL / PENDING_OPERATOR_COMMAND blok09](evidence/staging-reported-pdf-scan-failure-20261020/VPS-TERMINAL-09-PRECISE-OWNER-CONDITIONAL-LOCK-RELEASE.sh),
  SHA256 `05e01426f14dcf01a758254ff1decec157e8bc4954ad633882c176f6e5f72ad0`.
- [Jedna ciljana lokalna fixture provera](evidence/staging-reported-pdf-scan-failure-20261020/check_precise_owner_local.py)
  i [njen sačuvani rezultat](evidence/staging-reported-pdf-scan-failure-20261020/precise-owner-local-proof.json).

### Šta je usko promenjeno

Novi procesni guard zamenjuje kriterijum „root + Node/Python“ referencama na
konkretne producer/recovery/maintenance putanje, tačnim producer executable/argv
ugovorom, poznatim systemd cgroup-ovima i poreklom potomaka relevantnih procesa.
Direktni producer mora biti prepoznat preko pregledanog node executable-a i punog
node/producer/--config/config argv-a. Drugi relevantni argv/launcher/reference ili
nepotpuni relevantni identitet takođe blokiraju uklanjanje, bez zaključka da je
njihova uloga potpuno potvrđena. Raw argv i environment se ne ispisuju; za blocker
se čuvaju PID/PPID, startTicks, UID, bezbedan executable/unit, fiksni razlozi i samo
bezbedni argumenti, ostalo REDACTED. Nepovezani interpreter sam po sebi nije blocker.
Nema posebne allowlist-e za networkd-dispatcher, unattended-upgrades ili fail2ban.

Sopstveni worker se eksplicitno identifikuje preko PID-a, root UID niza, stvarnog
Python executable-a i tačnog argv/mode-a. Sačuvani operatorski controller zahteva
isti PID/startTicks/executable/UID i tačan stdin Python argv. Jedini koordinisani
systemd-run wrapper prepoznaje se preko root identiteta, PPID-a tog controller-a,
executable-a i kompletnog tačno pregledanog systemd-run argv-a. Ti izuzeci se
prikazuju u process evidence-u; nema prikrivenog izuzimanja svih predaka ili svih
interpretera. Ostali relevantni procesi i njihovi potomci ostaju blocker-i.
Ako identitet relevantnog procesa nije potpun/stabilan ili pristup nije pouzdan,
sledi STOP sa PID-om i zasebnim konkretnim razlogom.

Pending start/recovery putanje proveravaju se preko typed Unit.Job za producer/
timer i Manager.ListJobs, uz izdvajanje samo relevantnih producer/recovery/
maintenance naziva. Jedini izuzeti job pripada tačno ovom novom maintenance unit-u.
[systemd255 D-Bus ugovor](https://www.freedesktop.org/software/systemd/man/255/org.freedesktop.systemd1.html)
definiše ListJobs `a(usssoo)`; [busctl255 source](https://github.com/systemd/systemd/blob/v255/src/busctl/busctl.c)
json_transform_message objašnjava message-array data[0], za razliku od ranije
korišćenog get-property direktnog data oblika. Nepodržan format se odbija; nema
fallback parsiranja ljudskog ExecStart teksta ili instaliranja novih alata.

**Granica lokalnog dokaza pre upotrebe:** novi /proc, ancestry i typed pending-job
transport nisu live prihvaćeni ovom pripremom. Jedna konačna lokalna provera učitava
samo dve čiste funkcije preko AST-a: koristi sačuvani07 primer OS interpretera i
jedan složeni sintetički fixture za producer, potomka i nepoznatu producer referencu.
Rezultat je PASS, bez mreže, /proc, stvarnog terminala, sudo ili starog harness-a.
To nije nova testna matrica niti dokaz live systemd ponašanja. Nova read-only
provera guarda, sopstvenog identiteta i pending-job transporta zato ide **pre prve
pauze tajmera** u istom operatorskom bloku; nepotpun podatak tada znači STOP bez
mutacije. Post-pause provere se ponavljaju u istom kontrolisanom postupku.

### Koordinacija, pause i jedini uslovni rmdir

Installed producer/reader pinovi i puni protected env launch ugovor ostaju isti.
Tačni config/timer/service hashovi moraju odgovarati potvrđenom baseline-u iz06/08,
bez preuzimanja novih proizvoljnih vrednosti. Čuva se tada opaženi active/enabled
timer baseline. Drugo početno stanje ili drift znači STOP, bez usklađivanja pinova.
Novi privatni operation direktorijum je
`/var/lib/passvero-signature-lock-release-20261020-01/precise-owner-release`;
ako postoji, nema retry-ja. Originalni03/06/08 zapisi se ne prepisuju.

**Obavezan izvršni preduslov:** operator mora isključivo kontrolisati ručna root/
admin pokretanja producer/recovery komandi tokom celog postupka, bez paralelne
intervencije. Ako to nije pouzdano, STOP i ne izvršavati blok. Scheduled producer
se koordinira preko samo njegovog timer pause-a i service/job provera; poznati
recovery controller-i koriste postojeći ekskluzivni flock na
`/var/lib/passvero-signature-trust/records/recovery/operator.lock`, uz pregled
postojećih recovery state zapisa. Producer acquire() koristi mkdir lock i ne
uzima taj recovery flock: [producer IO source](../src/infrastructure/documents/signature-health-producer-io.ts#L109)
i [recovery source](../scripts/recover-document-signature-health.py#L500) potvrđuju
razliku. Zato se ne tvrdi da sam flock tehnički blokira raw manual producer launch
ili proizvoljan novi root kod/alias. Te ručne putanje pokriva izričita operatorska
isključivost i neposredne procesne provere, ne izmišljena zajednička kernel brava.
Ako je poznato dodatno nekontrolisano pokretanje, ono je blocker, ne dozvola za rmdir.

Posle čuvanja baseline-a pauzira se samo producer timer, proverava inactive/disabled
i najviše20s čeka eventualno već aktivan service da prirodno završi. Nema kill-a,
ručnog producer starta ili recoveryja. Aktivni relevantni proces otkriven pre
pauze može dovesti do ranog STOP-a bez ikakve promene; nakon ograničenog drain-a
svaki preostali proces, nepotpuna identifikacija ili pending pokretanje znači STOP.

Tačna putanja je `/var/lib/passvero-signature-health/health.json.lock`. Pored
zaštićenog roditelja i root:root0700 praznog direktorijuma bez symlink-a, početni
identitet mora odgovarati sačuvanom06 cilju: parent dev2049/inode1573155; lock
dev2049/inode2161968 i ostala sačuvana metadata. To je drift provera tačnog cilja,
ne dokaz napuštenosti iz starosti. U samom postupku potvrđuje se nepromenjen
identitet preko parent fd-a, procesnih/job provera i završnog parent path readbacka.
Nestanak, zamena, ne-prazan target ili drugi identitet znače STOP bez prilagođavanja.
Nema oslanjanja na odsustvo otvorenog direktorijumskog fd-a ili starost locka.

Tek ako svi uslovi prođu, izvršava se **jedan** fd-relative rmdir baš tog praznog
direktorijuma. Rmdir izuzetak čuva se kao removal-rejected, bez drugog pokušaja.
LOCK_ABANDONMENT=CONFIRMED/LOCK_REMOVAL=PERFORMED smeju se iskazati samo iz stvarnog
uspešnog rezultata pod navedenom koordinacijom. Istorijski tvorac i prvobitni uzrok
napuštanja i dalje nisu predmet tvrdnje. Prekid između rmdir i upisa dokaza ima
UNCONFIRMED_REQUIRES_OPERATOR_REVIEW, bez izmišljene potvrde ili automatskog retry-ja.

### Nezavisni closure, jedan redovni ciklus i reader

Privatni helper se izvršava u posebnom pregledanom transient unit-u
`passvero-signature-lock-release-20261021-precise`, Restart=no. Nezavisni
ExecStopPost poziva samo novi close mode, i pri uspehu i pri grešci/kraju budžeta.
Ne pokreće se ponovo stari operativni blok. Body i close čuvaju odvojene konkretne
procesne/job blocker dokaze; prvi body STOP ostaje sačuvan u finalnom izveštaju.

Close sada koristi baseline-only povratak: zaštićeni unit/config identitet,
recovery isključivost, relevantni procesi/jobovi i bezbedno service stanje.
Za povratak **ne zahteva** uspešan rmdir, odsustvo health locka ili staru lock
identičnost, niti generičko odsustvo svih root interpretera. Ne menja lock da bi
vratio timer. Ako je timer već na sačuvanom baseline-u, samo beleži rezultat.
Inače jedan enable --now vraća prethodno stanje kada guardovi prođu; može odmah
pokrenuti normalni producer ciklus. Poseban timer readback u finally se čuva i pri
grešci komande. Nebezbedan/nedokazan povratak ostaje PARTIAL_PENDING sa tačnim
pending razlogom, bez forsiranog resume-a. Ako pauza nije počela, čita se stvarno
active/enabled stanje pre iskazivanja da je baseline očuvan.

Posle stvarnog resume-a i uspešnog closure-a posmatra se jedan prirodni ciklus,
najviše35s, i čita jedan uski normalizovani ProducerReport sa invokacijskim
vezivanjem. Zatim se jednom izvršava već pinovani reader pod postojećim staging
UID1001. Nema ručnog producer poziva, scan-a ili automatizovanog browsera. BUSY,
UNTRUSTED, OPERATIONAL_FAILURE, reader odbijanje ili NOT_RECORDED znači kraj bez
nove intervencije. Ako je body prethodno odbijen, kasniji PUBLISHED/reader PASS ne
pretvara taj pokušaj u ukupni PASS. Ako closure nije uspeo ili resume nije ni
nastupio, ciklus/reader su eksplicitno NOT_RUN/NOT_OBSERVED, ne izmišljeni FAIL.

Tek **uspešan body/closure + PUBLISHED + reader accepted=true** otključavaju korisniku
UI korak „Skeniraj dokument“ → osveži status → CLEAN → preuzimanje. To i dalje nije
PDF acceptance niti puni service recovery bez stvarnog korisničkog rezultata.

### Lokalni završetak i status pre operatorskog outputa

Pregledani su uski diff, nova syntax/payload/hash vezivanja, identičnost preuzetih
protected launch/recovery/lock funkcija, tačan argv koordinisanog systemd-run procesa,
reference, manifest i whitespace. Pokrenuta je samo jedna ciljana lokalna fixture
provera; nisu ponovljeni PTY/continuation testovi, build, startup ili backup A–D.
Helperi i istorijski dokazi03/06/08 ostaju neizmenjeni, pravni nacrt, roadmap i sve
nepovezane izmene sačuvani. Nijedan blok nije agent izvršio na VPS-u.

**Operator sada jednom izvršava ceo blok09 samo uz pouzdanu isključivu koordinaciju
i vraća kompletan sanitizovani JSON.** Nema novog kruga odobravanja unutar već
odobrenog opsega. Na STOP/PARTIAL ne ponavljati blok ni rmdir i ne improvizovati
resume/recovery; pregledati sačuvani prvi blocker i odvojeni closure rezultat.

Trenutno za ovaj novi postupak: LOCK_ABANDONMENT=NOT_CONFIRMED;
LOCK_REMOVAL=NOT_PERFORMED; PRODUCER_MANUAL_RUN=NO; SCAN_CALLS=0;
REBOOT_REPEATED=NO; BACKUP_ACCEPTANCE_REPEATED=NO; OPERATOR09_EXECUTED=NO.
Poslednji sačuvani timer rezultat08 je TIMER_RESTORE=PASS; novi closure/cycle/reader
rezultati09 još ne postoje. UI_PROBE_UNLOCKED=NO.

## Rezultat09 — potvrđen rmdir i closure; prirodni ciklus odbijen u UPDATER kontinuitetu

[Tačan operatorski output09](evidence/staging-reported-pdf-scan-failure-20261020/operator-09-lock-removed-timer-restored-updater-untrusted.json)
potvrđuje uspešan maintenance body (unitReturnCode0), stvarno uklanjanje tačnog
praznog direktorijuma dev2049/inode2161968 u2026-10-21T12:09:40.753619 UTC i
nezavisni closure PASS_TIMER_BASELINE_RESTORED u12:09:40.816098 UTC, pending=[].
Pre rmdir su prošle dve relevantne procesne provere i ekskluzivni recovery flock.
LOCK_ABANDONMENT=CONFIRMED odnosi se na ovaj provereni cilj pod isključivom
operatorskom koordinacijom i poznatim launch gate-ovima, ne na naknadno utvrđenog
istorijskog tvorca locka. Parent root:gid1001 mode0750 i lock root:root0700 su
sačuvani kao opažena metadata. Kasnije prirodno pravljenje/uobičajeno oslobađanje
novog producer locka nije predmet ovog rmdir dokaza.

Timer readback je loaded,active,waiting,enabled sa tačnim Triggers service-om.
TIMER_RESTORE=PASS; nema pending timer closure-a. Istorijski PARTIAL06 i ostali
raniji rezultati ostaju neizmenjeni. Uspešan maintenance unit ne znači producer/
reader niti PDF PASS.

Jedan redovni ciklus, invocationId `6ddfa4ae552d49c98b11afe13cadd5e1`,
timestampUs `1792584586803972`, završio je:
**UNTRUSTED / UPDATER / EVIDENCE_CONTINUITY_REQUIRED**, durationMs3732.5936580000002.
Za razliku od ranijeg BUSY/ACQUIRE, ovaj konkretni pokušaj je stekao lock i stigao
do updater evidence parsiranja. Novi blocker zato nije isti ACQUIRE neuspeh.
Reader je stvarno pokrenut jednom: returnCode1,accepted=false; njegov zaseban
unutrašnji razlog nije sačuvan u ovom outputu. UI tok nije pokrenut i nije otključan.

[Producer source](../src/infrastructure/documents/signature-health-producer.ts#L77)
povezuje phase=UPDATER sa parseFreshclamEvidence() i normalizovanim UNTRUSTED
rezultatom pri odbijanju. [Tačan parser](../src/infrastructure/documents/freshclam-evidence.ts#L44)
isti EVIDENCE_CONTINUITY_REQUIRED kod koristi za više slučajeva: drugi initialization
separator posle već započete evidencije; unos pre zadržane initialization granice;
ili up-to-date rezultat bez odgovarajuće prethodno potvrđene verzije/uz nerešenu
najavu. **Tačan podslučaj i offending log red nisu sačuvani: NOT_RECORDED.**
Nije opravdano iz ovog koda zaključiti tačan restart/rotaciju, datum gubitka istorije,
promenu baze potpisa ili vezu sa ranijim VPS intervencijama. Raniji runbook sa istim
kodom nije dokaz identičnog uzroka sada. Nema potvrde zaraze.

Ovaj output ne objavljuje novi prihvaćeni health dokaz. Lokalni source pokazuje da
normalni producer posle acquire-a vodi sequence i pri UNTRUSTED invalidira izlaz;
ne tvrditi da su counter/health fajlovi ostali isti samo zato što ih maintenance
kod nije direktno menjao. Njihove stvarne vrednosti/stanje nisu dodatno čitani.
Reader odbijanje je saglasno ne-prihvaćenom health dokazu, ali konkretna reader
unutrašnja grana ostaje NOT_RECORDED. Kontinuitet updater dokaza je sada potvrđena
kategorija blokade; konkretna linija/uzrok tek treba zaseban ciljano odobren pregled.

**Ovde se postupak završava:** nema drugog uklanjanja locka, ručnog producer poziva,
restarta, automatskog recoveryja ili nove live dijagnostike. Ne prelaziti na novu
PDF scan/preuzimanje proveru pod pretpostavkom da su producer i reader PASS.
Nisu pripremljene nove VPS komande. Eventualna sledeća celina mora biti zasebno
ograničena na updater evidence kontinuitet, a ne ponavljanje uspešnog rmdir-a ili
closure-a. FULL_SERVICE_RECOVERY ostaje NOT_PROVEN; AUTOMATIC_STARTUP=PASS se čuva.

Sačuvani su novi output09, relevantna dopuna postojećeg izveštaja i manifest.
Reference/hashovi/whitespace provereni; bez novih testova/builda ili agentovog
VPS pristupa. Helperi/payloadi i istorijski dokazi, pravni nacrt, roadmap i
nepovezane izmene nisu menjani.

LOCK_ABANDONMENT=CONFIRMED; LOCK_REMOVAL=PERFORMED; TIMER_RESTORE=PASS;
PRODUCER_CYCLE=UNTRUSTED_UPDATER_EVIDENCE_CONTINUITY_REQUIRED;
READER_ACCEPTED=NO; UI_PROBE_UNLOCKED=NO;
PRODUCER_MANUAL_RUN=NO; SCAN_CALLS=0; REBOOT_REPEATED=NO;
BACKUP_ACCEPTANCE_REPEATED=NO; SECOND_INTERVENTION=NO;
AUTOMATIC_STARTUP=PASS; FULL_SERVICE_RECOVERY=NOT_PROVEN.

## Updater continuity i postojeći recovery — objedinjeni lokalni pregled, jedan read-only blok10

Zadatak SIGNATURE_UPDATER_CONTINUITY_AND_EXISTING_RECOVERY_DISPOSITION.
Sada je odobren samo pregled/priprema. Uspešan rmdir09 i timer baseline ostaju
prihvaćeni; nema ponovnog lock postupka ili tvrdnje da je reboot uzrok kontinuiteta.
Dokaz09 je UNTRUSTED/UPDATER/EVIDENCE_CONTINUITY_REQUIRED, reader accepted=false.
Tačan istorijski parser podslučaj/linija i tadašnji input hash ostaju NOT_RECORDED.

### Potvrđeno lokalno, bez ponavljanja testova/builda

[Objedinjeni lokalni review zapis](evidence/staging-reported-pdf-scan-failure-20261020/updater-continuity-local-review.json)
potvrđuje da su freshclam-evidence.ts, signature-health-producer.ts i
signature-health-producer-io.ts byte-identični prihvaćenoj osnovi
1fc84aa8ccc3118f8158029e8edf99275c8f7f6e. Prihvaćeni producer/reader bundle pinovi
ostaju725d3494…/877c9bed…; ne gradi se novi bundle niti menja provenance/expiry.
Ponovo se koriste ranije prihvaćenih13 Python i61 relevantnih TS dokaza iz
[postojećeg recovery runbooka](DOCUMENT_SIGNATURE_HEALTH_POST_RESTART_RECOVERY.md).
Nije pokrenuta nova testna matrica, niti bilo koji od tih testova ponovo.

Tačne continuity grane postojećeg parsera su:

- ponovni initialization separator nakon već započete istorije;
- zapis pre zadržane initialization granice;
- up-to-date rezultat bez ranije validirane iste verzije ili uz nerešenu download/
  update najavu. To poslednje su dva normalizovana podslučaja iste source grane.

Sačuvani normalized report ne bira granu. Sam EVIDENCE_CONTINUITY_REQUIRED ne
potvrđuje konkretan restart/rotation događaj, CLD/CVD stanje, datum gubitka dokaza
ili istorijsku vezu sa VPS promenama. Dosadašnji runbook sa istim kodom nije
zamena za aktuelni dokaz.

Postojeći reviewed recovery helper ima SHA256
`0e3938d06d6bcbfa9eab0249479bab5e54fe5162a3669a3026a39a0d204c4f44`
i već proverava tačan build `_tkSUOn0PCoHjpx8V7FVr`. [Prikazan istorijski exact-pin diff](evidence/staging-reported-pdf-scan-failure-20261020/existing-recovery-exact-pin-history.diff)
prema starijem helperu3c1f0e5c… sadrži samo jednu ranije pregledanu zamenu
8QNIYVVZWEsQaCL9uLZ5Q → _tkSUOn0PCoHjpx8V7FVr. To nije nova dopuna za primenu.
Originalni source i installed stare kopije ostaju sačuvani. Ne koristi se generički
recover.py sa zastarelim literalom, niti proizvoljan Git HEAD/wildcard.

### Jedina sledeća operatorska radnja sada

**VPS TERMINAL / PENDING_OPERATOR_COMMAND — READ-ONLY:**
[Kompletan blok10](evidence/staging-reported-pdf-scan-failure-20261020/VPS-TERMINAL-10-UPDATER-CONTINUITY-RECOVERY-READONLY.sh),
SHA256 `46d1c10747d8ce6389b5c650bc16493f0412f23b3c0e8fb2fcdf8da4954e232a`.
Operator ga izvršava jednom i vraća ceo sanitizovani JSON; agent ga ne izvršava.
Nema producer/Freshclam/reader starta, scan-a, socket probe, auth-a, DB pristupa,
servisne promene ili VPS evidence upisa. Ne poziva se stari continuation/reboot
main niti se otvara zatvoreni pokušaj.

Blok objedinjuje baš nedostajuće podatke:

- Stabilno, privatno čita samo aktivni updater log iz tačno pinovanog config-a,
  najviše1MiB/10000 redova. Izlaz je prva normalizovana continuity grana sa rednim
  brojem, vremenom, potrebnim verzijama/validacijskim stanjem i relevantnim
  initialization granicama; nikad log tekst. Odvojeni marker count beleži moguće
  warning/error/cooldown tragove, bez njihovih sirovih poruka.
- Trace je dijagnostičko praćenje navedenih postojećih gate-ova, ne zamena za
  authoritative parser, disk-authenticity ili novi health acceptance. Raniji
  drugačiji parsing/input gate daje NOT_DETERMINED sa konkretnim ograničenjem.
  Trenutni log hash/inode čuvaju se radi identiteta pročitanog inputa; ne izmišlja
  se hash inputa istorijske invokacije. Sadašnji prefix i najnoviji report ne
  proglašavaju se identičnim ranijem opažanju bez dokaza.
- Jedan uski journal read po sačuvanom09 invocation ID-u i jedan po poslednjem
  postojećem reportu razdvajaju istorijski rezultat od sadašnjeg. Ispisuje se samo
  normalizovani ProducerReport, vreme i invokacijski identitet; nema log dumpa.
- Čita tačan installed source na dokumentovanoj putanji
  `/var/lib/passvero-auth-flow-continuation-20261020-01/recover-release-reviewed.py`,
  protected pins.json, producer i reader artifact identitete i male producer
  service/timer fajlove. Nepoznati helper se ne učitava. Iz poznatog pinovanog
  modula poziva se **samo LinuxHost.guard()** u odvojenom read-only namespace-u;
  subprocess hook dopušta isključivo systemctl show/is-active. Ne poziva se main,
  execute(), accepted(), contain(), reader() ili recovery faze.
- Potvrđuje BUILD_ID/canonical manifest identitet; ne ponavlja759-artifact ili
  drugu punu deployment checksum seriju. Existing guard proverava konfiguracijski
  identitet i normalizovane Freshclam/clamd direktive/pinove, trenutni startup
  unit i postojeći consumer permission ugovor.
- Ispisuje samo metadata i verzijska header polja aktivnih main/daily/bytecode
  datoteka; nema signature payload-a, pune hash serije baza ili zaključka da CVD/
  CLD header dokazuje autentičnost. freshclam.dat je metadata/presence/ownership
  zapis, ne interpretacija binarnog cooldown-a; ništa se ne kreira ili resetuje.
- Čita postojeće recovery state zapise, proverava budući ID nije već korišćen i
  kratko proba postojeći root0600 operator.lock preko O_RDONLY/NOFOLLOW i
  nonblocking flock-a, bez kreiranja/brisanju inode-a. Availability je samo
  trenutna, ne rezervacija za budući recovery; BUSY se prijavi, ne čeka/retry-ja.
  Trenutno prisustvo producer mkdir locka ne predstavlja dokaz napuštenosti i
  ne uzrokuje rmdir u ovom bloku.
- Čita producer/timer/updater/clamd/socket/startup unit stanje i potencijalne
  consumers po postojećem GID988/scanner UID108 ugovoru, bez argv/env ili imena
  identiteta. Za stvarne updater/clamd PID-ove poredi executable/UID i postojeći
  enforced AppArmor/cgroup ugovor. To je permission-scope, ne iscrpan dokaz svih
  root ili svih stvarno povezanih socket klijenata. Neočekivan consumer/confinement
  je konkretan blocker za odobrenje, ne razlog za širenje prava.

Read-only sekcije imaju nezavisna NOT_DETERMINED ograničenja, tako da neuspeh jednog
compatibility uslova ne prikriva kontinuitet iz ostalih dostupnih podataka. Nema
ponovnog čitanja/auto retry-ja neuspele sekcije ili proširene dijagnostičke matrice.

### Primenljivost i konkretan obuhvat budućeg zahteva za odobrenje

**Postojeća fresh-base procedura je odgovarajući već prihvaćeni put za izgubljenu
validacijsku epohu; live primenljivost još nije potvrđena.** Nisu dovoljni samo kod
UPDATER ili stari oktobarski PASS. Nedostaje upravo jedan aktuelni output10 sa
podslučajem, installed identitetima, consumer/confinement stanjem, bazama/cooldown
metapodacima i recovery record/lock stanjem. Zato mutativni operatorski paket još
nije označen READY niti se izvršni recovery blok preuranjeno dostavlja kao nalog.
Ako se pojavi stvarna contract/pin/consumer razlika, staje se na tom konkretnom
blocker-u; nije odobrena nova arhitektura ili menjanje provenance pravila.

Ako taj jedini output potvrdi primenljivost, u istom zadatku finalizuje se jedan
paket za zasebno odobrenje, direktno nad postojećim helperom, sa ovim već određenim
obuhvatom i bez novih testova:

1. Jedan novi ID `recovery-20261021-continuity-01`, samo ako ne postoji; nikakav
   reset/replay prethodnog pokušaja. Tačne archive/db/updater/daemon putanje
   izvode se iz postojećeg LinuxHost konstruktora i izlaze u bloku10; ne skraćivati
   njegov postojeći recovery-<id> naming ugovor i ne praviti direktorijume sada.
2. Ponovna neposredna provera promenljivih preduslova, existing recovery flock,
   producer timer pause/drain i kontrolisani zastoj samo Freshclam, clamd i clamd
   socket-a, prema prihvaćenom source-u. Svi tada dokazani scanner consumers ulaze
   u isti zahtev za odobrenje uticaja/prestanka skeniranja. PM2/app/qpdf i reminder/
   backup tajmeri nisu predmet restarta ili konfiguracijskih promena.
3. Privatno arhiviranje starih config/artifact/databases/log bytes i metadata;
   zadržavanje svih starih epoha i freshclam.dat cooldown sadržaja; nema brisanja
   istorije, izmišljanja update poruka, counter/sequence reset-a ili lažne HEALTHY
   publikacije. Samo postojeći helper kreira novu izolovanu epohu i menja već
   pregledane database/log direktive i njihov exact config hash. To bi bile
   stvarne konfiguracijske/service mutacije i mrežni official CVD download,
   predmet zasebnog odobrenja, ne deo sadašnjeg read-only bloka.
4. Postojeći rokovi: producer drain20s, Type=simple identity wait5s, isti updater
   PID/fresh CVD completion300s, daemon readiness120s, tri uzastopne scheduled
   reader-prihvaćene publikacije100s. Poslednji pregledani continuation wrapper
   koristi RuntimeMaxSec9min/TimeoutStopSec20s; ne produžavati te granice naslepo
   niti obećavati njihov zbir kao garantovani prekid. Stvarno potreban prekid
   odnosi se na scanner dostupnost od quiesce-a do daemon/reader prihvatanja;
   novi maintenance termin nije zakazan.
5. Jedno izvršenje postojeće recover CLI putanje, sa odvojenim prvim failure i
   nezavisnim existing containment/closure pozivom vezanim samo za novi ID.
   Ordinary exception koristi postojeći contain(); prekid/SIGKILL i durable
   nekompletna faza ostaju fail-closed, uz eksplicitan rollback za pregled,
   bez automatskog novog recovery pokušaja. Rollback čuva arhive/cooldown i
   producer timer ostaje disabled po postojećem ugovoru; ne forsirati PASS
   baseline iz lock-maintenance procedure preko failed recovery epohe.
6. Prihvatanje ostaje ista tri redovna sequence+1/rastuća observedAt opažanja i
   postojeći stvarni staging reader, bez ručnog producer-a. Tek nakon odobrenog
   izvršenja i uspešnog reader-a korisnik kroz UI radi postojeći PDF scan →
   osvežen status → CLEAN → preuzimanje. Nema terminalskog/browser-automatizovanog
   scan-a; recovery PASS nije PDF acceptance ili FULL_SERVICE_RECOVERY PASS.

Ovo je objedinjeni approval scope postojećeg postupka, ne paralelni recovery
runbook ili novi harness. **Jedina naredna operatorska radnja sada je blok10.**
Po njegovom jednom rezultatu utvrđuje se grana i finalizuju tačni izvršni/containment
blokovi za odobrenje, ili se navodi jedan konkretan preostali blocker. Stari
continuation/reboot/auth blokovi se ne otvaraju i ne izvršavaju.

Lokalna provera: uski istorijski literal diff, AST/Bash syntax novog read-only
bloka, ograničenje na read-only guard pozive, source/hash veze, reference, manifest
i whitespace. Nema testova/builda/recoveryja ili agentovog VPS pristupa. Pravni
nacrt, roadmap, stari failure/closure zapisi i nepovezane izmene su sačuvani.

RECOVERY_EXECUTED=NO; LOCK_REMOVAL_REPEATED=NO; SCAN_CALLS=0;
REBOOT_REPEATED=NO; BACKUP_ACCEPTANCE_REPEATED=NO;
AUTOMATIC_STARTUP=PASS; FULL_SERVICE_RECOVERY=NOT_PROVEN;
READONLY_DIAGNOSTIC_PREPARED=YES; READONLY_DIAGNOSTIC_EXECUTED=NO.


## Output10 disposition i paket za odobrenje — 2026-10-21

Ovaj nalaz dopunjuje prethodnu pripremu; njeni AWAIT/PREPARED statusi iznad ostaju
istorijski. [Jedini operatorski output10](evidence/staging-reported-pdf-scan-failure-20261020/operator-10-updater-continuity-recovery-readonly.json)
sačuvan je iz dostavljenog JSON-a, bez terminalskog prompta. Opažanje je
2026-10-21T12:27:19.663708+00:00. Nema dodatne live dijagnostike u ovoj dopuni.

**Dokazana grana za sada sačuvane bajtove: REPEATED_INITIALIZATION_BOUNDARY,
linija501.** Parser je već video initialization na liniji1, a druga granica na
liniji501 krši jednu neprekinutu validacijsku epohu. Timestamp granica je
1790970875000 / 1791555625000 ms; sačuvana validacijska istorija do odbijanja je
daily28148/main63/bytecode339, expectedComponent=daily. Ukupno je7 initialization
granica; hash sada pročitanog celog loga je
5fead88032fd99cf295276b6c3cc7b8c07dd7d104722c1da1dd9d632688c03c9.
Nije dokazano da je reboot, rotacija ili neka intervencija stvorila te granice.
Input hash istorijske invokacije ostaje NOT_RECORDED. Ovo objašnjava odbijanje
sadašnjeg retained prefix-a; ne predstavlja dokaz identičnih bajtova pri ranijem
PDF pokušaju. Saved09 invokacija6ddfa4ae552d49c98b11afe13cadd5e1 i najnovija
aedc2305a1594ec29523312e3b09b518 zasebno beleže isti normalizovani UPDATER razlog.
Nema dokaza zaraze; zabrana PDF preuzimanja ostaje očekivana fail-closed zaštita.

### Primenljivost postojeće procedure

**Primenljiva je postojeća fresh-base procedura, uz neposredne execution guardove i
zasebno odobrenje.** LinuxHost.guard() je prošao neizmenjen; installed helper,
producer/reader/pins.json i producer unit/timer identiteti se podudaraju. Build je
_tkSUOn0PCoHjpx8V7FVr, canonical e30e2afa0dc470b149f94f4437d032603a7cf7cfeb66fdc1a6b39b11fe52f590,
config28df856a3a8516f8c33d35bc652b5358dd0dcdd49d185be01a64eb1264a22593.
Helper0e3938d06d6bcbfa9eab0249479bab5e54fe5162a3669a3026a39a0d204c4f44
već ima taj exact release literal: **nema nove source/pin korekcije ili instalacije**.
Raniji exact-literal diff ostaje sačuvan; ne prihvata se wildcard ili Git HEAD.

Nema unresolved recovery zapisa; operator flock je bio dostupan samo tokom probe,
a producer mkdir lock odsutan. To nije rezervacija za kasnije niti nova potvrda
napuštenosti. Stari lock se ne uklanja ponovo. Aktivna epoha je
recovery-recovery-20261002-release-8qni-01; main63/bytecode339 CVD i daily28160 CLD
header verzije nisu dokaz autentičnosti. freshclam.dat postoji, regular/root-protected
UID108/0600; njegov binarni cooldown **nije interpretiran** i mora ostati sačuvan.
Nova procedura ga kopira u novu epohu, bez resetovanja; cooldown/warning/error pri
fresh-base postupku izaziva STOP, ne brisanje ili ponovni pokušaj.

Posmatrani potencijalni socket consumers su staging PM2 procesi1551 i173622
(UID1001/GID988, pm2-passvero-staging.service). Freshclam172889 i clamd172970 imaju
UID108 i očekivani executable, enforcing profil i cgroup. Ovo je permission-scope,
ne iscrpan dokaz svih root klijenata ili aktivnih socket konekcija. Njihovi PID-ovi
nisu trajni pinovi. Scanner drop-in putanje/sadržaj nisu ispisani: PRESENT_OR_UNVERIFIED
nije nova tvrdnja o njihovim bajtovima; postojeći protected-pin/config guard i
opaženi confinement su prošli. Ne menja se allowlist niti tvrdi da je odsustvo
svakog drugog consumer-a dokazano. Jedinstveno odobrenje mora obuhvatiti zajednički
scanner prekid i isključiv operatorski prozor bez paralelnog root recoveryja.

### Jedan konkretan paket — VPS TERMINAL / PENDING_OPERATOR_COMMAND

1. Posle zasebnog odobrenja kopirati **ceo**
   [blok11 — jedno izvršenje postojećeg recoveryja](evidence/staging-reported-pdf-scan-failure-20261020/VPS-TERMINAL-11-EXISTING-CONTINUITY-RECOVERY.sh)
   u VPS terminal. Ne izvršavati stare continuation/auth/reboot blokove ili blok10
   ponovo. ID je recovery-20261021-continuity-01; ekskluzivni root operator prozor
   je preduslov, novi termin nije zakazan.
2. Blok11 ponovo proverava host, protected helper i tačne pinove, build/canonical,
   postojeći guard, unresolved zapise, nove putanje, baseline timera i pending
   systemd job/reload. Postojeći helper pod flock-om ponavlja svoje guardove pre
   prve faze. Preflight flock nije rezervacija; nema paralelnih ručnih launcher-a.
   Nesklad => STOP bez zaobilaženja ili novog ID-a. Po jednom submission-u nema retry-ja.
3. Sačuvati **ceo sanitizovani rezultat**. Otključavanje UI provere zahteva
   unitReturnCode0, phase COMPLETE, nezavisni closure PASS_COMPLETE_EXISTING_READER_ACCEPTED,
   reader ACCEPTED i tri postojeće scheduled publikacije sequence+1/rastući observedAt.
   Timer/service readback se čuva uz rezultat. Sve drugo zaustavlja funkcionalni tok.

Blok11 je samo operatorsko vezivanje neizmenjenog recover CLI poziva i nezavisnog
ExecStopPost-a; ne uvodi novi recovery harness, faze, parser ili acceptance ugovor.
[Čitljiv izvor istog inline stoppost-a](evidence/staging-reported-pdf-scan-failure-20261020/recovery-11-stoppost-source.py.txt)
je radi pregleda; ne instalira se dodatni helper. Normalni exception već poziva
postojeći contain(); systemd-owned ExecStopPost ponovo nezavisno koristi isti
contain() za započetu/neprihvaćenu epohu i ostaje vezan za novi ID pri gubitku
terminala ili ubijanju glavnog procesa. Bez durable state-a nema recovery service
akcije. Ako containment, lock ili njegov rok ne prođu, rezultat je PARTIAL i nema
izmišljene baseline potvrde; odsutan closure zapis takođe nije PASS.

**Mutacije i prekid:** producer timer disable/pause/drain, invalidacija/arhiviranje
starog health dokaza, stop Freshclam/clamd/socket, privatna kopija starih config,
producer, baza i logova sa metadata, novi odvojeni database/updater/daemon epoch
paths, promena samo postojećih database/log direktiva i njihovog config hash-a,
postojeći reviewed producer bundle, official CVD preuzimanje, start istih confined
scanner servisa i enable producer timera za redovne publikacije. Postojeći
scheduled() resetuje samo failed status producer servisa, ne sequence/counter.
Producer sam redovno ažurira sequence/health; ne tvrdi se da prirodni ciklusi nemaju
upise. Stari logovi, baze, freshclam.dat, evidencija i counter istorija se ne brišu
ili popravljaju. Nema aplikacijskog/PM2/qpdf restarta, backup/reminder pause-a ili
promene njihovih pinova, politika i budžeta.

Scanner nije dostupan od quiesce-a do daemon/reader prihvatanja: isti shared scanner
može uticati na druge potrošače, ne samo prijavljeni PDF. Nema obećanja neprekinutog
production skeniranja. Prekid se ne predstavlja kao prekid weba ili odobrenje za
production konfiguracijske promene. Bez slanja poruka ili PDF scan-a u ovim blokovima.
Rokovi ostaju20s drain,5s identity,300s updater,120s daemon,100s scheduled;
RuntimeMaxSec9min, TimeoutStopSec20s. Spoljno čekanje590s obuhvata systemd završetak,
ne povećava fazne/runtime rokove. Ti limiti nisu garantovani maksimalni outage.
SIGKILL/stoppost timeout može ostaviti PARTIAL koji zahteva operatorov pregled.

Privatno operatorsko evidence mesto:
/var/lib/passvero-signature-continuity-20261021-01. Recovery archive:
/var/lib/passvero-signature-trust/records/recovery/recovery-20261021-continuity-01.
Database i log nazivi zadržavaju postojeći konstruktor recovery-<id>, dakle
recovery-recovery-20261021-continuity-01; to nije greška za preimenovanje.
Ne kreiraju se sada. Baseline/submission/raw-private recovery stdout/normalizovani
rezultat i odvojeni closure ostaju na serveru; u chat se vraća samo završni JSON.

**Neuspeh/rollback:** nema automatskog drugog recoveryja ili vraćanja timera preko
failed epohe. Containment ostavlja producer disabled i scanner zaustavljen prema
postojećem ugovoru. Posle pregleda prvog failure/closure outputa, samo ako je to
zasebno odobreno, postoji kompletan
[blok12 — eksplicitni rollback istog nepotpunog ID-a](evidence/staging-reported-pdf-scan-failure-20261020/VPS-TERMINAL-12-EXPLICIT-ROLLBACK-ONLY-IF-APPROVED.sh).
On koristi postojeći rollback CLI i zasebni
[inline rollback stoppost](evidence/staging-reported-pdf-scan-failure-20261020/recovery-12-stoppost-source.py.txt),
proverava backup hashove kroz postojeći restore(), vraća samo arhivirane config/
producer bajtove i startuje stare scanner servise. Producer ostaje disabled;
rollback **ne vraća poverenje stare epohe**, ne vraća stale HEALTHY snapshot i
ne uklanja nove/stare baze ili logove. COMPLETE recovery se ovim blokom ne ruši.
Nedostajući/izmenjeni backup ili neuspešan closure => STOP/partial, bez drugog pokušaja.
Blok12 nije normalan sledeći korak posle PASS-a, nije unapred odobreno izvršavanje.

### Konačan acceptance i jedna naredna radnja

Sada je paket **PREPARED_FOR_SEPARATE_RECOVERY_APPROVAL / NOT_EXECUTED**. Jedina
preporučena radnja je odobrenje jednog bloka11 sa navedenim zajedničkim scanner
prekidom i nezavisnim containment-om, pa operatorsko izvršavanje i vraćanje JSON-a.
Nije potrebna nova opšta dijagnostička/testna serija ili instalacija helpera.
Tek nakon recovery/reader PASS korisnik kroz UI na prijavljenom proizvodu
10813121-1ffa-4c94-91d4-82b2a9ee6757 bira „Skeniraj dokument“, osvežava status,
potvrđuje CLEAN i omogućeno uspešno preuzimanje „Izjave o sukladnosti“.
To nije raniji continuation fixture i ne daje odobrenje za druge poslovne mutacije.
UI rezultat ostaje PENDING_USER; infrastrukturalni PASS nije FULL_SERVICE_RECOVERY.

Lokalno su proverene samo nove payload/reference/hash veze, manifest i whitespace;
syntax je statički proverena bez pokretanja recoveryja ili simulacije VPS-a.
Prihvaćene nepromenjene testove/build/startup/backup dokaze ponovo koristimo.
Pravni nacrt, roadmap i prethodni source/failure/closure evidence nisu menjani.

RECOVERY_EXECUTED=NO; LOCK_REMOVAL_REPEATED=NO; SCAN_CALLS=0;
REBOOT_REPEATED=NO; BACKUP_ACCEPTANCE_REPEATED=NO;
AUTOMATIC_STARTUP=PASS; FULL_SERVICE_RECOVERY=NOT_PROVEN.


## Output11 — recovery COMPLETE, korisnički PDF acceptance ostaje pending

[Operatorski rezultat11](evidence/staging-reported-pdf-scan-failure-20261020/operator-11-continuity-recovery-result.json)
potvrđuje jedno izvršenje recovery-20261021-continuity-01: unitReturnCode0,
Result=success, phase COMPLETE, reader ACCEPTED i nezavisni
PASS_COMPLETE_EXISTING_READER_ACCEPTED. closure-failure.json=null. Nema retry-ja,
ponovnog uklanjanja locka, ručnog PDF scan-a ili reboot-a. Ovaj novi rezultat
zamenjuje raniji NOT_EXECUTED/PENDING status pripreme za ovaj ID; istorijski
failure/closure dokazi i tadašnji zaključci ostaju netaknuti.

Tri redovne prihvaćene publikacije:145729 →145730 →145731, od
2026-10-21T12:40:22.711000+00:00 do 2026-10-21T12:40:53.910000+00:00, raspon 31.199s.
Svaki expiresAt je observedAt+60s. Ispunjeni su sequence+1 i rastući observedAt;
reader/closure potvrđuju važeći ugovor za završno opažanje. To nije trajna freshness
ili unattended garancija. Existing helper COMPLETE uključuje njegove postojeće
updater/daemon/provenance gate-ove; nema tvrdnje da je izvršena nova nezavisna
checksum serija ili da su detaljni fazni timestamp-i dostavljeni u ovom JSON-u.
firstFailure=NOT_RECORDED je prenet doslovno; nije izmišljena ranija greška.

Producer timer je active/waiting/enabled; oneshot inactive/dead/static je očekivan
između publikacija. Freshclam, clamd i socket su active/running/enabled.
Transient recovery unit je not-found/inactive/dead uz sačuvan Result=success,
exit0, COMPLETE i nezavisni closure PASS: to nije zabeleženi recovery neuspeh;
unit više nije učitan. Nema potrebe za restartom, novim recoveryjem ili blokom12.

Prethodno odbijanje sadašnje stare epohe ostaje REPEATED_INITIALIZATION_BOUNDARY;
uspeh nove epohe ne dokazuje istorijski uzrok granice ili identične bajtove ranijeg
PDF pokušaja. Ne tvrdi se da je PDF sada CLEAN ili da je preuzet.
**Jedina sledeća radnja je korisnička UI provera** za proizvod
10813121-1ffa-4c94-91d4-82b2a9ee6757, dokument „Izjava o sukladnosti“:
„Skeniraj dokument“ → osveži status → CLEAN → preuzmi. Ako status opet odbije,
sačuvati prikazani razlog/vreme i stati, bez automatskog recoveryja ili druge
terminalske serije. Raniji continuation fixture nije predmet ove UI provere.

Evidencija je preneta iz korisnikovog operatorskog outputa; agent nije pristupao
VPS-u ili pokretao recovery/reader/scan. Provereni su novi JSON i acceptance
vrednosti, izmenjene reference, manifest/hashovi i whitespace. Nema ponavljanja
syntax/test/build/startup/backup provera. Pravni nacrt, roadmap i stari izvori/
dokazi sačuvani su; bez commita/pusha.

RECOVERY_EXECUTED=YES; RECOVERY_RESULT=PASS; UI_PDF_ACCEPTANCE=PENDING_USER;
LOCK_REMOVAL_REPEATED=NO; SCAN_CALLS=0; REBOOT_REPEATED=NO;
BACKUP_ACCEPTANCE_REPEATED=NO; AUTOMATIC_STARTUP=PASS;
FULL_SERVICE_RECOVERY=NOT_PROVEN.


## Korisnička UI potvrda i završna release priprema — 21.10.2026.

**UI_PDF_ACCEPTANCE=PASS — USER_CONFIRMED**
(mašinski status: UI_PDF_ACCEPTANCE=PASS_USER_CONFIRMED).
[Sačuvana eksplicitna korisnička potvrda](evidence/staging-reported-pdf-scan-failure-20261020/user-12-ui-confirmation.json)
beleži: kreiranje novog proizvoda, uspešnu objavu, uspešno PDF preuzimanje,
učitavanje QR linka i sve očekivane DPP elemente; provereni tok sada radi.
Ovo zamenjuje poslednji UI_PDF_ACCEPTANCE=PENDING_USER status. Istorijski PENDING
checkpoint-i ostaju doslovno sačuvani kao hronologija, ne aktuelna blokada.

Korisnik nije naveo tačan scan status, Document ID, ID novog proizvoda ili
byte-checksum poređenje. Ne vezujemo novi proizvod/preuzeti PDF za ID ranije
prijavljenog dokumenta bez dokaza. Ne izvodimo CLEAN, byte equality, server-side
session proveru ili novu runtime freshness iz korisničkog opažanja.

| Prihvaćen obuhvat | Vrsta dokaza i granica |
| --- | --- |
| Automatski startup nakon jednog reboot-a19.10 | Sačuvani operator-05 startup PASS; nije ponovljen ili proširen na host-loss restore. |
| Signature recovery21.10 | Sačuvani operator-11: COMPLETE, reader ACCEPTED, nezavisni closure PASS, publikacije145729 →145730 →145731; timer active/enabled i Freshclam/clamd rade u zabeleženom trenutku. Nema nove live provere. |
| Proizvod/objava/PDF/DPP/QR | USER_CONFIRMED; odvojeno od automatizovanog i operatorskog dokaza, bez nenavedenih identifikatora/statusa/checksum-a. |
| Zatvoreni reboot/auth continuation harness pokušaji | AUTH_GATE/UnsupportedOperation i CONTINUATION_AUTH/OPERATOR_OBSERVATION_TIMEOUT ostaju istorijski STOP; u tim pokušajima server session/context nije potvrđen, scanner/flow nisu pokrenuti. Kasniji recovery i ručni UI uspeh ih ne pretvaraju u izvršene harness provere. |

PDF problem u potvrđenom staging korisničkom toku je završen.
**FULL_SERVICE_RECOVERY=NOT_PROVEN** odnosi se na širi, neizvedeni opseg: potpuni
oporavak posle gubitka hosta iz izolovanih DB/file kopija sa obnovom web/auth/
provider okruženja i zaštićenih inputa, povrat bajtova u Storage provider i takav
end-to-end service restore; dugoročni unattended continuity i zasebni production
release/config/scanner/rollback uslovi. To nisu zahtevi za ponovno otvaranje ovog
PDF problema, startup PASS-a ili backup A–D. Završetak redovnog writer posla i
isporuka nisu dokazani samim timer restore-om i ovom UI potvrdom.

[Završni release skup i granice manifesta](evidence/staging-recovery-release-20261021/README.md)
objedinjuju postojeće helper/test/operator/evidence zavisnosti. Svi operativni
blokovi zatvorenih pokušaja su istorijski i ne izvršavaju se iz ovog release pregleda.
Sledeće: UI dorade, zatim konkretan production plan sa tačnim izvršnim manifestom,
razdvojenim config/DB/auth/Storage/scanner ciljevima, rollback-om i zasebnim
odobrenjem. Ovde nema novog operativnog zadatka ili acceptance serije.

UI_PDF_ACCEPTANCE=PASS_USER_CONFIRMED; RELEASE_REVIEW_READY=YES;
NEW_TESTS_RUN=NO; VPS_ACTIONS=NO; BACKUP_ACCEPTANCE_REPEATED=NO;
COMMIT_CREATED=NO; PUSH_PERFORMED=NO; FULL_SERVICE_RECOVERY=NOT_PROVEN.
