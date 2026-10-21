# Staging recovery — završni release pregled,21.10.2026.

RELEASE_REVIEW_READY=YES; UI_PDF_ACCEPTANCE=PASS_USER_CONFIRMED.
Ovo je pregledani skup za buduću odluku o commitu/non-force pushu. Ništa nije
stageovano, commitovano ili pushovano; nema izvršnih naloga u ovom dokumentu.

[Finalni manifest](final-manifest.json) opisuje **192 commit putanja**:
četiri evidence stabla, šest povezanih izveštaja/planova, recovery-only deo zajedničkog
roadmapa i ovaj završni review paket. Sam manifest je jedna od putanja; nema
rekurzivnog self-hasha. Svi ostali commit bajtovi imaju SHA-256 i veličinu.
**Predlog: jedan commit**, jer su helper varijante, payloadi, hash vezivanja, fokusirani
testovi i failure/closure istorija međuzavisni. Poruka:
`fix(recovery): restore staging scanner trust and record UI confirmation`.
To ne tvrdi novi auth harness PASS ili production recovery.

## Dokazi i granice

- [Automatski startup PASS19.10](../staging-reboot-recovery-20261019/operator-05-startup-accepted.json)
  ostaje prihvaćen; nema novog reboot-a/startup/backup acceptance-a.
- [Recovery21.10](../staging-reported-pdf-scan-failure-20261020/operator-11-continuity-recovery-result.json):
  COMPLETE, reader ACCEPTED, nezavisni closure PASS;145729 →145730 →145731.
  Producer timer active/enabled, Freshclam/clamd rade u zabeleženom trenutku.
  Ovo nije nova ili trajna runtime health potvrda.
- [Korisnička UI potvrda](../staging-reported-pdf-scan-failure-20261020/user-12-ui-confirmation.json):
  novi proizvod, objava, PDF preuzimanje, QR i očekivani DPP elementi rade.
  USER_CONFIRMED, bez scan-status/Document-ID/checksum ili server-session zaključka.
  PDF problem je zatvoren u potvrđenom toku.
- Istorijski AUTH_GATE/UnsupportedOperation i CONTINUATION_AUTH/timeout ostaju STOP;
  tadašnji scanner/flow NOT_RUN ne postaju FAIL ili PASS usled naknadnog UI uspeha.
- FULL_SERVICE_RECOVERY=NOT_PROVEN: host-loss/izolovani web+auth+provider restore,
  povrat provider bajtova, dugoročni continuity i zasebni production rollout/
  scanner/rollback scope nisu dokazani ovim tokom. To nije otvoren PDF blocker.

## Instalirani bajtovi, lokalni kandidati i istorija

Finalni manifest razdvaja fizičku putanju od identiteta sadržaja i operatorskog
dokaza instalacije. To su istorijski installed/deployed identiteti, bez današnjeg
VPS readback-a ili repina. Accepted build je_tkSUOn0PCoHjpx8V7FVr; build paket se
ne commituje. Installed scanner recovery helper0e3938d0… i raw-TTY helper4da924e0…
sa adapteromd39f3aa4… vezani su za sačuvane operator outpute; pomoćni package JSON
čuva njihove exact pins. Lokalne iste kopije nisu dokaz nove instalacije.

13.10 reboot helper472cb2ed… je lokalni TriggeredBy kandidat koji u tom paketu nije
instaliran.19.10 raw-TTY4da… je tamo bio lokalni kandidat uz istorijski installed303c…;
identični bajtovi su kasnije instalirani u20.10 continuation paketu. Arhivirane
prethodne varijante ostaju odvojene, ne prepisuju se starim očekivanim hashom.

Svi VPS/LOCAL-MAC blokovi zatvorenih pokušaja i njihovih istorijskih manifesti su
**HISTORICAL_NOT_FOR_REPLAY**. Uspešni blok11 se ne ponavlja; blok12 rollback nije
izvršen i nije sadašnja naredna radnja. Commit ne odobrava nijedan operativni blok.
.py source za lock/closure postupke je pregledani payload izvršavan kroz ograničene
operatorske blokove, ne nova aplikacija ili tvrdnja o trajnom service install-u.
Fokusirani lokalni dokazi/PTY, guard i adapter testovi se ponovo koriste po hashovima;
ne dokazuju live systemd/session ponašanje van svojih sačuvanih ograničenja.

Istorijski installed-package manifesti nisu manifest aktivne radne kopije. Posebno,
19.10 installed303c… se proverava prema historical-installed-pre-raw-tty/reboot-reviewed.py,
a trenutni19.10 helper4da… prema local-raw-tty-source-manifest.json. U13.10 arhivi
neizmenjeni helper ulazi dele bajtove s gornjim direktorijumom; hash starog izveštaja
je samo istorijski checkpoint bez zasebno sačuvane report kopije. Finalni manifest
uvek vezuje **stvarne sadašnje commit bajtove**. Nijedan takav istorijski pin se ne
predstavlja kao nesklad instaliranog trenutnog source-a ili menja radi lažnog PASS-a.

## Zajednički roadmap i sačuvani pravni diff

[Precizni HEAD→recovery patch](roadmap-recovery-only.patch) priprema samo append od
`STAGING_FULL_SERVICE_RECOVERY_AND_REBOOT_STARTUP_PLAN` do završnog UI/release statusa.
Ne stageovati ceo worktree roadmap. Manifest beleži početni HEAD, SHA projekcije za
commit, SHA pune radne kopije i opseg worktree redova. Pri budućem stagingovanju
potreban je sadržaj projekcije iz patch-a, uz proveru index bajtova, bez prepisivanja
radne kopije. Patch se ovde samo čita, **ne primenjuje u index ili worktree**.

Odvojeni pravni nacrt i pravne/readiness roadmap dopune ostaju van ovog commita.
Nacrt i početni nerecovery roadmap prefix očuvani su prema početnim hashovima.
Očekivan budući worktree je nečist zbog tih odvojenih celina. Ne čistiti ga.
HEAD grana main ostaje isti; remote se u ovom lokalnom pregledu ne upituje.
Pre budućeg push-a proveriti stvarni udaljeni main; na napredovanje/divergenciju
STOP bez automatskog merge/rebase/reset/force postupka.

## Završni pregled sadržaja

[Sanitizovani review zapis](content-review.json) obuhvata source, source payload-e,
operator outpute i dokumentaciju. Nema runtime kredencijala, tajni, session tokena,
sirovih PDF/image fajlova, dumpova, build paketa ili nepotrebnih korisničkih podataka.
Jedan credential-pattern je sintetički exception sentinel fokusiranog redaction
testa; email-like dodatni nalazi su systemd template unit nazivi. Potreban poznati
operator identitet/actor IDs zadržani su radi auth/ownership dokaza, bez novih podataka.
Binarni fixture-i u privatnom lokalnom direktorijumu i privremeni server paketi nisu
commit putanje. Sačuvani sanitizovani process/unit metadata nisu široki sirovi logovi.

Whitespace pregled je čist za source i dokumentaciju. Četiri istorijska .diff
fajla imaju13 namernih jednobajtnih razmaka: unified-diff oznake praznih context
redova, ne trailing whitespace izvršnog source-a. Tačni redovi su navedeni u
content-review.json; ne trimovati i ne prepisivati njihov istorijski hash.
Budući generički staged whitespace check može označiti te patch-syntax markere;
ovde su izričito pregledani, bez prikrivenog isključivanja provera.

Proverava se samo finalni diff, manifest/hash veze, dokumentacijski linkovi i
whitespace. Nema novih testova, syntax serija, builda, live radnji ili acceptance-a.
Nerešenih commit blockera nema za ovaj tačan skup. Nema odobrenja production-a ili
javne objave pravnog nacrta. Dalji redosled: UI dorade, pa konkretna priprema produkcije.

UI_PDF_ACCEPTANCE=PASS_USER_CONFIRMED; RELEASE_REVIEW_READY=YES;
NEW_TESTS_RUN=NO; VPS_ACTIONS=NO; BACKUP_ACCEPTANCE_REPEATED=NO;
COMMIT_CREATED=NO; PUSH_PERFORMED=NO; FULL_SERVICE_RECOVERY=NOT_PROVEN.
