# Stvarni staging unos — spremnost i korisnički acceptance

Datum pregleda: 2026-10-02, Europe/Belgrade. Povezano:
[konačan pregled roadmapa](IMPLEMENTATION_ROADMAP.md#konačan-pregled--stvarni-staging-unos-i-korisnički-acceptance-2026-10-02).
Ovaj dokument je plan, ne izvršeni korisnički acceptance niti odobrenje produkcije.
Poslovne mutacije počinju tek nakon korisnikovog pregleda ovog plana.

## Zaključak i granica dokaza

Ograničen stvarni unos je primeren uz postojeći aktivirani račun, potvrđenu
organizaciju i prava, raspoložive kvote, sačuvane izvorne podatke i fajlove i
prihvaćen rizik gubitka novih staging zapisa. Signature-health uslov za PDF potvrđen je jednim odobrenim recoveryjem 02.10:
tri scheduled prihvaćene objave 87498/87499/87500 i fresh staging reader accepted=true
u 19:55:34.890 UTC. Qpdf listening, HTTPS 200, reminder disabled/inactive i campaigns 0.
Ranije odbijanje 19:20/19:36 UTC je oporavljeno; istorijski uzrok restartova nepoznat.
PDF korak više nije odložen zbog tog uslova, ali stvarni upload/scan/download tek
prolazi korisnik u ovoj sesiji. Opažanje ne garantuje buduću freshness; ako aplikacija
bezbedno odbije scan, prijaviti odstupanje i ne zaobilaziti zaštitu.

Početni branch `main`, HEAD i lokalni `origin/main`:
`703f588f1d6589f3e7b0118d991eab9ca8a35aa0`. Read-only `git ls-remote origin
refs/heads/main` potvrdio je isti udaljeni SHA. Početni worktree/index čisti.
Prvi mrežno ograničeni pokušaj nije razrešio DNS; odobren read-only pokušaj uspeo.
Dokumentacijske izmene ovog pregleda nisu commitovane/pushovane.

Prihvaćeni lokalni testovi/buildovi, live browser/HTTP/operatorski dokazi ostaju
istorijski dokazi za svoj obuhvat. Nisu ponavljani testovi, build, email,
antivirus, backup ili restore. Ceo repo test suite nije proglašen zelenim;
stari izveštaji dokumentuju i pre-existing assertion greške. Današnje Git stanje
je sveže provereno; današnji minimalni VPS rezultat ispod potiče iz korisnikovog
operatorskog outputa, bez tvrdnje o širem runtime inventaru.

Pregledani source potvrđuje server-side entitlement enforcement, šestomesečni
trial od zabeležene aktivacije, shared create/import kvote, immutable publication,
version manufacturer/image veze, private signature-health reader i create-only
import ugovor. Source nije live health dokaz. Raw VPS Git checkout nije identitet
runtimea; poslednji prihvaćeni build `8QNIYVVZWEsQaCL9uLZ5Q` potvrđen je preko
826 executable artefakata u recovery seriji, bez današnjeg redeploya.

## Uslovi i važeći staging izuzeci

Korisnik bira postojeću organizaciju iz UI, ne prema email domenu. Proverava
naziv, ulogu i billing/entitlement prikaz. Preporučeni kandidat je njegova
odobrena `Živić-elektro - staging test`, ako se UI kontekst i kvote podudaraju;
to nije odobrenje promene članstava ili dodeljivanja novih grantova.

| Organizacija | Konačni prihvaćeni izuzetak |
| --- | --- |
| Živić-elektro - staging test — `6d686789-6379-4824-ae02-df97043cbbc0` | Start limiti, bez istorijskog triala ili stvarne uplate |
| Passvero Acceptance — `bdc5aed5-b05a-42e6-895b-9f2f9f8a79a0` | Isti limiti; postojeći sintetički katalog ostaje |

Oba intervala: `[2026-09-30T00:00:00Z, 2026-10-31T00:00:00Z)`, isključivi kraj.
Lokalno Europe/Zagreb/Belgrade: 30.09. 02:00 do 31.10. 01:00. Limiti: 25 zauzetih
objavljenih mesta, 100 sačuvanih proizvoda, 2.147.483.648 B, 10 PDF priloga/verzija.
[Odobren plan](SUBSCRIPTION_ENTITLEMENTS_STAGING_TRANSITION_PROPOSAL.md) i
[završni dokaz izvršenja](SUBSCRIPTION_ENTITLEMENTS_QUOTAS_AND_PLAN_CHANGES_STAGING.md#završni-read-only-inventar--2026-09-30)
potvrđuju prelaz; na datum ovog pregleda interval još traje, ali današnje DB stanje
nije ponovo inventarisano. Izuzetak nije plaćeni period i nema automatsko produženje.

Po isteku bez drugog važećeg prava sadržajne izmene/create/import/upload/publish
su zaključani. Login, dozvoljeni privatni read/export i billing profil ostaju uz
postojeću autorizaciju. Nema automatskog brisanja. Arhiva/povlačenje ne oslobađa
zauzeto objavljeno mesto; istorijski asseti i nerazrešene rezervacije troše storage.
Izuzetak ne stvara plaćeni šestomesečni grace. VOLUNTARY javni rok zavisi od
stvarnog trial/plaćenog pokrića; MANDATORY/UNRESOLVED zahtevaju zasebnu politiku,
bez generičkog komercijalnog gašenja i bez zaobilaženja publication/malware zaštite.

Novi standardni trial: 6 kalendarskih meseci, ukupno 3 kreiranja (uključujući
import), 3 objavljena mesta, 100 MiB, 5 PDF/verzija. Ne izvoditi trial iz createdAt.
Scenario ispod troši 3 kreiranja: jedan proizvod i dva import nacrta. Ako trial
već ima kreiranja, smanjiti import izbor prema UI preostalim mestima; ne proširivati
prava radi testa. Paketi Start/Business/Pro imaju 25/100/500 objavljenih mesta,
100/400/2000 sačuvanih proizvoda, 2/10/50 GiB i 10 PDF/verzija; Custom zahteva
eksplicitne limite. Obnova/upgrade/downgrade se samo pregledaju u ovoj sesiji.

## Automatizacije i zaštita novih podataka

- Reminder timer je prema poslednjem završnom izveštaju DISABLED_INACTIVE,
  enabled campaigns=0; obe odobrene kampanje su disabled i budžeti 2/2 iscrpljeni.
  Četiri SMTP dostave i potvrde prijema, replay bez dodatnih sends, dve stale
  cancellations i jedan timer IDLE ciklus su prihvaćeni. DB receiptConfirmedAt
  ostaje null: korisnička potvrda prijema je zaseban dokaz. Ne očekivati nove
  automatske remindere; delivery UI prikazuje istoriju i transport status.
- Staging backup je jednokratni B2 recovery set `20261001T212354Z`, capture
  `2026-10-01T21:23:54Z` (lokalno 01.10. 23:23:54), prefix
  `passvero-staging-recovery-v1/`. DB + svi tada stvarno zadržani privatni image/PDF
  bajtovi + minimalni non-secret config, B2 download/hash, izolovani PG restore
  i private application read su PASS. Nema automatskog staging rasporeda,
  garantovanog RPO, freshness alarma ili Telegrama.
- **Svaki novi zapis/fajl ili izmena posle capture vremena izvan je zaštite tog
  seta.** Gubitak staginga može izgubiti sav kasniji rad. Čuvati izvorni opis,
  identifikatore, sliku i PDF lokalno; po sesiji sačuvati CSV i acceptance belešku.
  CSV ne pokriva prevode/materijale/asset bajtove/punu istoriju/auth/billing i nije
  zamena za konzistentan DB+Storage backup. Staging ne koristiti kao jedinu kopiju.
- Production daily 02:00 UTC PostgreSQL B2/restic, hourly freshness i Telegram
  ostaju odvojen postojeći sistem. Poslednji pregledani uspešan set
  `20261001T020750Z` je istorijski dokaz, ne novo provereno production izvršenje.
  Production nije pristupan; taj sistem ne štiti nove staging podatke.
- Recovery PASS nije full Supabase provider reupload, pun web/auth session restore
  ili fresh scanner bootstrap. Potrebni su zasebno zaštićeni secret/role bootstrap
  ulazi i reviewed source/build ili retained executable artifact; build hash u
  configu nije binary backup. Ovi limiti ne sprečavaju sadašnji unos uz kopije,
  ali sprečavaju tvrdnju o dugotrajnoj/production recovery spremnosti.

Reference: [reminder final](SUBSCRIPTION_REMINDERS_AND_DELIVERY_STAGING_ACCEPTANCE.md),
[backup final](EXISTING_BACKUP_COVERAGE_AND_STAGING_RECOVERY_COMPLETION.md),
[mašinski recovery rezultat](evidence/backup-recovery/approved-recovery-completion.json).
Ne uključivati timer/kampanje, ne praviti novi backup u ovom pregledu, ne brisati podatke.

## Zadržani acceptance podaci

Ovo su granice ranijih inventara, ne sveže prebrojavanje današnje baze:

- Dve organizacije sa izuzetkom, kontrolisani AccessRequest/aktivacija/članstvo
  i identiteti ostaju; [onboarding report](CONTROLLED_EARLY_ACCESS_ONBOARDING_STAGING.md#real-staging-acceptance-2026-09-22)
  sadrži tačne ID-jeve. Sintetički billing profil `SINTETIČKI BILLING TEST 20260924`
  i njegov audit u Passvero Acceptance ostaju; ne prepisivati ga tuđim podacima.
- Devet pre-entitlement proizvoda zadržano je kao UNRESOLVED, uključujući PVA-001,
  DPP-PDF, manufacturer, GTIN i image v1/v2 fixture, tri CSV nacrta SKU
  `00092101/00092102/00092103` i njihovu istoriju/receipts/audit. Tačni ID-jevi su u
  [odobrenom inventaru](SUBSCRIPTION_ENTITLEMENTS_STAGING_TRANSITION_PROPOSAL.md#postojeći-proizvodi)
  i završnim slice izveštajima. Raw test CSV je ranije uklonjen; receipt nije raw CSV.
- `SYNTHETIC — Subscription commercial acceptance`
  (`ffe171d1-b6a6-43d5-83bb-890e2fa23c9f`) zadržava SIMULATED_PAYMENT period
  `2026-09-30T13:22:05.515Z–2026-12-31T14:22:05.515Z`, bez izvedenog triala/izuzetka.
  [Entitlement inventar](evidence/subscription-entitlements/staging-final-inventory.json)
  beleži 7 novih fixture organizacija/107 proizvoda (101 za blocked downgrade),
  7 novih simulated perioda i jedan upgrade receipt; nije ukupni današnji inventar.
- Reminder organizacije `8c789610-9953-58c8-9cd7-1b5815dd6fd4`,
  `371ef379-7e1f-5775-842f-9eba78838046`, `8504ae2e-059e-5b7d-974d-175e3d3c39c1`
  i kampanje/outbox/attempts/komercijalna istorija ostaju prema reminder reportu.
  Ne birati trial-expired/blocked-downgrade fixture kao organizaciju za realni unos.
- B2 capture: 9 asset referenci = 5 sačuvanih objekata/6.145 B + 4 prihvaćena
  cleanup tombstone-a. Ranije uklonjeni testni bajtovi nisu sačuvani originali i
  nisu obnovljeni. Zadržani v1/v2 image/PDF bajtovi i audit ne brišu se ovim zadatkom.

Stvarne unose označiti prepoznatljivim internim nazivom/SKU i beležiti njihove ID-jeve
odvojeno od fixture-a. Retencija sintetičkih i novih podataka zahteva kasniju odluku,
ne automatski cleanup i ne automatski prelaz u produkciju.

## Jedna korisnička sesija — približno 40 minuta

Pripremiti tačan opis jednog stvarnog proizvoda, potvrđene manufacturer podatke,
postojeći GTIN ako ga proizvod ima (ne izmišljati), odgovarajući CN/godinu ako je
poznat, jednu JPEG/PNG sliku do 8 MiB i odgovarajući validan PDF do 10 MiB.
Koristiti podatke/fajlove za koje korisnik ima ovlašćenje; privatni PDF može ostati
privatan. Dva dodatna create-only CSV reda su nacrti stvarnih proizvoda koje
korisnik namerava sačuvati, ne kopija istog proizvoda radi testa.

Za svako odstupanje prijaviti u ovom razgovoru jedan red:
`korak | lokalno vreme | organizacija | Product/Document/batch ID ako je vidljiv |
očekivano | opaženo | bezbedan screenshot/poruka`. Bez lozinki, tokena, cookies,
activation linkova ili raw privatnih dokumenata. Ako se pokaže pogrešan tenant,
privatan sadržaj javno, download bez dozvole ili izmena javne verzije pre objave,
prekinuti sesiju odmah. Za bezbedno blokiran PDF ili quota poruku odložiti taj korak
i prijaviti; ne zaobilaziti zaštitu. Sledeći koraci zavisni od njega nisu PASS.

| Korak / vreme | Radnja i očekivanje | Korisnik potvrđuje / prijava odstupanja |
| --- | --- | --- |
| 1. Prijava i kontekst — 4 min | Na `https://staging.passvero.eu` prijaviti se postojećim aktiviranim nalogom. Proveriti tačan naziv organizacije, ulogu, aktivan entitlement i slobodna mesta/storage. Nova aktivacija nije deo sesije. | „Ovo je moja odobrena staging organizacija; imam prava za unos/objavu.“ Nema slučajnog rada u synthetic expired/blocked tenant-u. Prijava ovde: korak 1, naziv/poruka; zaustaviti pogrešan kontekst. |
| 2. Jedan proizvod — 7 min | Kreirati draft sa internim nazivom/SKU i javnim opisom, izabrati/dodati manufacturer i eksplicitno primeniti njegov snapshot. Uneti postojeći validan GTIN i poznat CN/godinu; ako nije poznat, ne nagađati. Dodati sliku i sačuvati/reload. | Sačuvani podaci, vodeće nule i slika odgovaraju izvoru; manufacturer nije billing profil. Još nema javne objave. Prijava ovde: korak 2 + Product ID/polje. |
| 3. PDF — 6 min | Posle PASS preflighta uploadovati odgovarajući PDF na draft. UNSCANNED/AVAILABLE ne daje download. Pokrenuti jedan eksplicitni scan, sačekati status; CLEAN/podobnost omogućava autorizovano preuzimanje. Otvoriti preuzeti fajl i uporediti sadržaj sa originalom (SHA-256 ako je lako dostupan). | Ispravan dokument, eksplicitna scan radnja, status i odgovarajući preuzeti bajtovi. Za UNAVAILABLE/PENDING/ERROR ne ponavljati slepo i ne menjati fajl radi bypass-a. Prijava ovde: korak 3 + Document ID/status. |
| 4. Preview i eksplicitna objava — 6 min | Pregledati sve javne podatke/sliku i public/private flag PDF-a. Korisnik izričito potvrđuje „Ovi podaci i javno označeni prilozi namenjeni su javnom prikazu“ i sam klikne objavu. Otvoriti javni link u privatnom/anonimnom prozoru i QR telefonom. | Javni sadržaj je tačan, draft/billing/privatni PDF nisu izloženi, link radi bez prijave; barcode nosi postojeći GTIN. Regulatornu klasifikaciju ne menjati bez zasebno ovlašćenog operatora, razloga i audita. UNRESOLVED nije dokaz regulatorne usklađenosti. Prijava ovde: korak 4 + javni link/vidljiva razlika. Bez potvrde javne namene preskočiti objavu i označiti acceptance delimičnim. |
| 5. Novi draft i izmena — 5 min | Sa objavljene verzije kreirati novi draft, izmeniti jednu javnu tekstualnu vrednost i sačuvati. Ponovo anonimno otvoriti isti javni link. U ovoj sesiji drugi draft može ostati neobjavljen. | Draft ima izmenu, javna v1 i njena slika/manufacturer/PDF veze ostaju nepromenjeni. Tek sledeća zasebna eksplicitna objava menja javnu verziju uz očuvanu istoriju. Prijava ovde: korak 5 + Product ID/stara i nova vrednost. |
| 6. Pretraga i CSV export — 3 min | Pretražiti ime/SKU/GTIN i izvesti filtrirani ili ceo katalog. CSV obuhvata sve rezultate, bira current draft inače publication; promenjeno draft polje ne mora odgovarati javnoj v1. | Pravi proizvod, bez stranog tenant-a. Identifier kolone pri spreadsheet importu postaviti kao Text radi vodećih nula; CSV nije kompletan backup. Prijava ovde: korak 6 + query/broj redova/kolona, bez raw privatnog CSV-a. |
| 7. Mali create-only CSV — 5 min | Pripremiti 2 reda sa novim internim nazivom/SKU; mapirati kolone i otvoriti preview. Proveriti locale, GTIN/CN, ignorisane kolone, kvote i upozorenja. Eksplicitno izabrati samo željene validne redove i potvrditi import. Za conflict upozorenje pregledati i eksplicitno potvrditi postojeće UI pravilo ili isključiti red. | Preview nije kreirao proizvode; finalni izveštaj odgovara izabranim redovima, postojeći proizvodi nisu ažurirani, novi su draft. Ne koristiti export kao obećan full round-trip. Prijava ovde: korak 7 + batch ID/red/outcome. |
| 8. Billing/subscription i Platform Admin — 4 min | Read-only pregledati tenant paket/izuzetak, tačan rok, kvote i billing profil; ne slati offer/payment/renewal forme. Odobren operator zasebno pregleda `/platform/organizations`, detail/billing i relevantan commercial/delivery prikaz. Običan tenant korisnik proverava samo svoj prikaz. | Izuzetak nije uplata, synthetic receipt je označen SIMULATED_PAYMENT, reminder istorija ne znači uključenu automatizaciju. Nedostajući billing profil ne blokira proizvode. Platform deo: PASS ovlašćeni prikaz ili N/A bez granta, ne neuspeh celog tenant acceptancea. Prijava ovde: korak 8 + naziv prikaza/rok/poruka. |

Raniji negativni/concurrency/istek testovi ostaju dokaz; ova sesija ne traži
uplatu, promenu sata, namerno zaražen fajl, čekanje isteka, novo grantovanje,
email dostavu ili testiranje rollbacka. Public PDF pregled je opcionalan ako PDF
nije namenjen javnosti; private download korak i dalje je obavezan za pun PDF PASS.

Završni zapis: organizacija, datum, Product ID/javni link ako objavljen,
Document/batch ID-jevi, osam PASS/FAIL/N/A/ODLOŽENO statusa, potvrda javne namene,
gde su sačuvani izvori/CSV i otvorena odstupanja. Pun acceptance = svi primenljivi
koraci PASS; N/A samo za stvarno neprimenljiv grant/optional identifier/public PDF,
ne prikrivena greška. Ne uklanjati nastale proizvode/fajlove radi „čišćenja“.

## Minimalni aktuelni PDF preflight — operatorski rezultat

**IZVRŠENO — PDF READINESS NIJE POTVRĐENA.** Korisnik je vratio sanitizovan output
sa vremenom 2026-10-02T19:20:58.313732+00:00 (lokalno 02.10. 21:20:58).
Prethodni agentov SSH pokušaj stao je na `sudo: a password is required` pre
izvršenja bloka; ovaj rezultat je iz naknadnog operatorskog izvršenja.

```json
{
  "utcNow": "2026-10-02T19:20:58.313732+00:00",
  "readerExit": 1,
  "reader": {
    "accepted": false
  },
  "units": {
    "passvero-qpdf-broker.socket": {
      "LoadState": "loaded",
      "ActiveState": "active",
      "SubState": "listening",
      "UnitFileState": "enabled"
    },
    "passvero-subscription-reminders.timer": {
      "LoadState": "loaded",
      "ActiveState": "inactive",
      "SubState": "dead",
      "UnitFileState": "disabled"
    }
  },
  "scope": "STAGING_READ_ONLY",
  "scanCalls": 0,
  "emailCalls": 0
}
```

Zaključak: qpdf socket i reminder off stanje odgovaraju očekivanju; private reader
nije prihvatio aktuelni dokaz. Output ne razlikuje odsutan/istekao/nepodoban snapshot,
privatnost/ownership ili drugi reader uslov: **root cause nije utvrđen**. Ne tvrditi
da je clamd stao ili da je recovery potreban samo na osnovu accepted=false.
Raniji PDF/recovery PASS ostaje istorijski dokaz, ali ne dokazuje današnju spremnost.

Blok ispod ostaje zapis izvršene provere, **nije nalog za ponavljanje**.
Ne izvršavati historical recovery/bootstrap komande. Ovo
čita prihvaćeni installed reader kao staging UID i dva konkretna unit statusa;
bez SQL, skeniranja, promena servisa, emaila, produkcije ili pisanja aplikacijskih
podataka. Ne prikuplja env ili raw health snapshot. Očekivanje: reader
`accepted:true`, exit 0; qpdf socket active/listening; reminder timer
inactive/disabled. Tadašnji output je pregledan i PDF korak bio je odložen (superseded recovery PASS-om ispod); samo active clamd
nije freshness dokaz. Ovaj blok ne dokazuje ceo recovery niti garantuje zdravlje
za narednih 45 minuta; stvarni scan/download ponovo primenjuju postojeće gate-ove.

```sh
sudo /usr/bin/python3 -I -B <<'PY'
import datetime, json, os, pathlib, pwd, stat, subprocess

try:
    assert os.geteuid() == 0 and os.uname().nodename == 'srv1834647', 'WRONG_HOST'
    reader = pathlib.Path('/usr/local/libexec/passvero-signature-recovery-v3/reader.cjs')
    for parent in reader.parents:
        item = parent.lstat()
        assert stat.S_ISDIR(item.st_mode) and item.st_uid == 0 and not item.st_mode & 0o022, 'READER_PARENT_CHANGED'
    item = reader.lstat()
    assert stat.S_ISREG(item.st_mode) and item.st_uid == 0 and item.st_nlink == 1 and not item.st_mode & 0o022, 'READER_FILE_CHANGED'
    actor = pwd.getpwnam('passvero-staging')
    assert actor.pw_uid == 1001, 'STAGING_UID_CHANGED'
    result = subprocess.run(
        ['/usr/bin/node', str(reader)], user=actor.pw_uid, group=actor.pw_gid,
        extra_groups=os.getgrouplist(actor.pw_name, actor.pw_gid), cwd='/',
        env={'PATH': '/usr/bin:/bin'}, capture_output=True, text=True, timeout=10)
    value = json.loads(result.stdout)
    assert isinstance(value, dict), 'READER_OUTPUT_INVALID'
    safe = {key: value[key] for key in ('accepted', 'sequence', 'observedAt', 'expiresAt') if key in value}
    units = {}
    for unit in ('passvero-qpdf-broker.socket', 'passvero-subscription-reminders.timer'):
        state = subprocess.run(
            ['/usr/bin/systemctl', 'show', unit, '--no-pager',
             '-p', 'LoadState', '-p', 'ActiveState', '-p', 'SubState', '-p', 'UnitFileState'],
            capture_output=True, text=True, timeout=5, check=True)
        units[unit] = dict(line.split('=', 1) for line in state.stdout.splitlines() if '=' in line)
    print(json.dumps({'utcNow': datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'readerExit': result.returncode, 'reader': safe, 'units': units,
        'scope': 'STAGING_READ_ONLY', 'scanCalls': 0, 'emailCalls': 0}, indent=2))
except Exception as error:
    reason = str(error) if isinstance(error, AssertionError) else type(error).__name__
    print(json.dumps({'preflight': 'STOP', 'reason': reason, 'scope': 'STAGING_READ_ONLY'}))
    raise SystemExit(1)
PY
```

Ako reader odbije ili socket nije listening: ne uploadovati/objavljivati PDF radi
zaobilaženja problema. Jedna sledeća ograničena celina je dijagnoza konkretnog
read-only odbijanja i predlog postojećeg reviewed recovery puta; izvršenje recoveryja
zahteva zasebno odobrenje. Ostatak dozvoljenog staging rada može ostati dostupan.

## Prioritet nastavka i konkretni završni rezultati

| Prioritet | Obavezno / ograničenje | Završni rezultat |
| --- | --- | --- |
| Pre stvarnog unosa | Korisnikov pregled plana; tačan tenant/prava/kvote; izvori izvan staginga i prihvaćena snapshot granica | Potvrđena organizacija, raspoloživa mesta za 1+2 kreiranja, beleška gde su izvori; bez tvrdnje o automatskom backupu |
| Pre punog PDF acceptancea | IDENTIFIED: EVIDENCE_CONTINUITY_REQUIRED → odsutan snapshot → PRIVATE_READ_ENOENT | Zasebno pregledan/odobren postojeći fresh-base recovery uz kompatibilne pinove; aktuelni reader acceptance i scheduled publication potvrđuju spremnost. Bez ponavljanja EICAR/PDF/izolacijskih/resource serija; ostatak staginga nije opšte BLOCKED |
| Tokom evaluacije | Jedna sesija i rešavanje konkretnih prijavljenih odstupanja | Jedan acceptance zapis; svaki primenljiv korak PASS ili jasan preostali problem sa ID-jem, bez ponavljanja nepromenjenih negativnih serija |
| Pre isteka/dužeg staging oslanjanja | Konačni izuzeci do 31.10; novi podaci izvan backupa; reminder off | Pre roka eksplicitna odluka nastaviti sa važećim pravom ili export/zadržavanje; za duži rad zasebno odobrena staging backup/RPO/retention politika i stvarni novi DB+Storage set; ručno praćen rok dok automatizacija nije odobrena |
| Pre produkcije — zasebna faza | Production rollout i komercijalno/regulatorno/retention odobrenje; obnovljivi DB+Storage, secret/build bootstrap; full provider/web/auth/scanner recovery i monitoring | Odobren i prihvaćen production runbook sa konkretnim backup/freshness/restore rezultatima, operativnim vlasnikom i alarmima; postojeći production DB backup sam nije dovoljan |
| Pre produkcije — automatizacija | Odobren recipient/campaign scope i kapacitet, email/delivery UNKNOWN postupak, nenadzirana scanner kontinuitet/restart procedura | Zasebno odobrena aktivacija i operativno prihvaćeni raspored/alarmi/recovery bez duplikata ili fail-open preuzimanja |
| Opcionalno za MVP | Paper QR/fizički uređaji, širi accessibility/locale sweep, veći catalog live UX, XLSX/ERP/analytics/Stripe | Ciljani poboljšani tok kada se pokaže potreba; marketing uskladiti pre novih javnih poziva, bez nove tvrdnje o regulatornoj sertifikaciji |

Live CSV/outbox concurrency, injected faults, live rollback, paper QR i novi
image/PDF grace transport ostaju tačno ograničeni raniji NOT_PROVEN; nisu novi
samostalni obavezni zadaci samo zbog ovog rezimea. Dokazani lokalni negativni
testovi se ponovo koriste. Prioritet menja samo konkretan korisnički problem ili
zahtev zasebne production faze.

Dokumentacijska verifikacija: pregled oba diffa, whitespace i lokalnih linkova;
embedded operatorski Python syntax-proveren lokalno; korisnikov vraćeni output
potvrđuje operatorsko izvršenje na VPS-u bez scan/email poziva.
Aplikacijski testovi/build nisu ponavljani jer source nije menjan. Nema migracija,
deploya, emaila, timera, poslovnih mutacija, brisanja, commita, pusha ili production pristupa.

## Objedinjena read-only reader dijagnoza — VPS TERMINAL

Zadatak: STAGING_SIGNATURE_HEALTH_READER_REJECTION_DIAGNOSIS.
**READER_REJECTION_CAUSE=IDENTIFIED — operatorski output prihvaćen.**
Uvid: 2026-10-02T19:36:49.806809+00:00 (lokalno 21:36:49). Nema pending komande
za ovu dijagnozu. Blok niže je istorija izvršenog uvida, ne nalog za ponavljanje.

Normalizovani lanac: `UPDATER/EVIDENCE_CONTINUITY_REQUIRED → SNAPSHOT_ABSENT →
PRIVATE_READ_ENOENT → accepted=false/exit=1`.

| Granica | Sanitizovan dokaz |
| --- | --- |
| Producer | Timer enabled/active/waiting; service failed/exit=1, invocation 2a2e18f5270f42bab7975c4f34d24086. Tri poslednja journal rezultata UNTRUSTED/EVIDENCE_CONTINUITY_REQUIRED/UPDATER (UTC us 1790969767483918, 1790969783231590, 1790969799412443). |
| Updater kontinuitet | Freshclam active/running, PID 1293, start 01.10. 17:24:26 CEST; konfigurisan updater log 85.261 B/683 split linije, četiri initialization granice. Normalizovani config-read/error-warning/failure/cooldown brojači 0. Aktivni proces i odsustvo log grešaka ne daju izgubljenu validation istoriju. |
| Putanje/config/artefakt | probeVsProducerOutput=true, probeVsProducerSocket=true, producerUnitUsesReviewedConfig=true, producerMatchesRecoveryBundle=true. Producer config root 0600; updater config root 0444, producerHashMatches/directoryMatches/logMatches=true. Raniji ownership problem nije ponovo opažen. |
| Reader | Stvarni installed UID-1001 reader exit=1/accepted=false; SHA-256 877c9bed25e195479d28dcad7e5ff506798a09b6b2edfe93c92691e228f97e62. Source-condition probe PRIVATE_READ_ENOENT. |
| Snapshot/lock | Snapshot ne postoji ni pre ni posle readera; snapshotStableAroundReader=true; lockPresent=false. Schema/sequence/observedAt/expiresAt nisu dostupni jer nema fajla. issuedAt nije source schema v2 polje. |
| Ostalo | Clamd active/running PID 1292; daemon log normalizovani error brojači 0. scope STAGING_READ_ONLY, mutations=false, scanCalls=0, producerCalls=0. |

Tačna reader granica: `lstat(path)` u private read-u (source linija 47) dobija
ENOENT; catch ga normalizuje u HEALTH_UNAVAILABLE, provider work catch vraća null,
a provera odsutnih bytes vraća null (92–95). CLI zato vraća accepted=false/exit=1.
Producer u fazi UPDATER poziva `parseFreshclamEvidence`; ponovna initialization
granica u već initialized streamu odbija EVIDENCE_CONTINUITY_REQUIRED. Isti kod
odbija i up-to-date rezultat bez potvrđene validation istorije; journal ne beleži
prvi konkretan log red koji je bacio izuzetak. Četiri granice i direktni producer
reason dokazuju kontinuitet kao uzrok odbijanja, bez tvrdnje koji je bio prvi
neprihvatljiv red. Producer catch invalidira snapshot umesto objave. Nije dokazan
istorijski operativni uzrok/datum svake initialization granice; ne nagađati reboot,
log rotaciju ili ručnu intervenciju. To nije potrebno za ovaj zaključak.

**Jedna minimalna predložena korekcija:** postojeći explicit fresh-base v3 recovery
sa novim ID-jem, očuvanjem stare istorije i sequence-a, novim verifikovanim CVD
periodom i potvrdom reader/scheduled publication. MUTATION_REQUIRED=YES.
Ne čistiti log/lock, ne resetovati sequence, ne osvežavati snapshot ručno.

**Predlog entry pointa, NE IZVRŠAVATI u ovoj read-only fazi:**

```sh
sudo /usr/bin/python3 -I -B \
  /usr/local/libexec/passvero-signature-recovery-v3/recover.py recover \
  --id "recovery-$(date -u +%Y%m%d%H%M%S)"
```

Preduslov izvršivosti je zaseban pregled postojećih recovery pinova/consumer scope-a
pre odobrene mutacije. Pregledani source `LinuxHost.guard()` pinovao je build
qwLCXFTd9EEGdvqaB9SZS, dok noviji prihvaćeni deploy/recovery evidence beleži
8QNIYVVZWEsQaCL9uLZ5Q. Ovaj uvid nije inventarisao aktuelni installed recover.py
pin ni live BUILD_ID. Zato komanda nije proglašena trenutno izvršivom; promenjen
pin mora dobiti reviewed prilagođavanje, bez uklanjanja/bypass-a guarda i bez
vraćanja aplikacije na stari build radi prolaska. Ovo je jedna priprema postojećeg
recovery puta, ne nova scanner infrastruktura. Sama procedura menja konfiguraciju,
pravi/čuva recovery artefakte, zaustavlja/pokreće postojeće scanner servise i producer
timer; nije read-only. Nijedna od tih radnji nije izvršena u ovoj dijagnozi.

Jedan operatorski uvid: producer timer/service i updater stanje, tri poslednja
normalizovana producer rezultata iz najviše 80 journal zapisa, config/path jednakost,
metadata i ograničene continuity/error opservacije konfigurisanih logova, stvarni
installed reader i zasebna read-only opservacija source uslova kao UID 1001.
Signature baze, env i raw logovi se ne ispisuju niti čitaju radi ovog uvida.
Node schema/branch opservacija preslikava pregledani source; nije novi producer
ili alternativni trust grant. Sinhroni probe ne dokazuje originalni 2s async deadline,
raniju race granu ili dugotrajni in-process monotonic state. Zato OBSERVED_GATES_PASS,
promenjeni snapshot ili nepodudaran artefakt ostavljaju uzrok UNRESOLVED.

Izvori: `signature-health-reader.ts` private read 28–68/provider 92–108;
`malware-scan.ts` trustedProvenance 32–40; `signature-health-producer.ts` failure
invalidation; `signature-health-producer-io.ts` config/input bounds;
[postojeći recovery](DOCUMENT_SIGNATURE_HEALTH_POST_RESTART_RECOVERY.md).
observedAt je source naziv vremena opažanja; issuedAt polje nije u schema v2.
Lock se samo opaža, bez brisanja ili zaključka da prisustvo znači kvar.

Očekivani sanitizovan output: scope STAGING_READ_ONLY/mutations=false/scanCalls=0/
producerCalls=0; units, latestReports, pathMatch, snapshot metadata/vremena,
actualReader i sourceConditionObservation.branch. Vratiti samo taj JSON.
PRIVATE_READ_ENOENT/EACCES, PRIVATE_FILE/PARENT_REJECTED, SNAPSHOT_SCHEMA_REJECTED,
SOCKET_PATH_MISMATCH, DISK_MANIFEST_HASH_MISMATCH ili konkretni provenance gate
mogu identifikovati granicu kada je snapshot stabilan. Relevantni producer reason
zatim objašnjava zašto važeći snapshot nije dostupan; istorijski uzrok se ne nagađa.

Blok je lokalno syntax-proveren (shell/Python/Node) i operator ga je izvršio;
njegov gore sažeti output potvrđuje read-only obuhvat. Bez dijagnostičkog skena,
producer poziva, lock/snapshot promene, restartovanja, bootstrap/recovery, servisne
promene, production pristupa, commita ili pusha. Predloženi recovery nije izvršen.

```sh
sudo /usr/bin/python3 -I -B <<'PY'
import datetime, hashlib, json, os, pathlib, pwd, re, stat, subprocess
P = pathlib.Path
def run(args, **kw):
    return subprocess.run(args, capture_output=True, text=True, timeout=10, **kw)
def meta(path):
    try:
        s = P(path).lstat()
        return {'exists': True, 'uid': s.st_uid, 'gid': s.st_gid, 'mode': oct(stat.S_IMODE(s.st_mode)), 'regular': stat.S_ISREG(s.st_mode), 'bytes': s.st_size, 'links': s.st_nlink, 'inode': s.st_ino, 'mtimeNs': s.st_mtime_ns, 'ctimeNs': s.st_ctime_ns}
    except FileNotFoundError:
        return {'exists': False}
def bounded(path, cap):
    s = P(path).lstat()
    assert stat.S_ISREG(s.st_mode) and s.st_nlink == 1 and s.st_size <= cap, 'INPUT_NOT_BOUNDED_REGULAR'
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
    with os.fdopen(fd, 'rb') as f:
        assert os.fstat(f.fileno()).st_ino == s.st_ino, 'INPUT_CHANGED'
        data = f.read(cap + 1)
    assert len(data) <= cap, 'INPUT_BOUND'
    return data
try:
    assert os.geteuid() == 0 and os.uname().nodename == 'srv1834647', 'WRONG_HOST'
    out = {'scope': 'STAGING_READ_ONLY', 'utcNow': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'mutations': False, 'scanCalls': 0, 'producerCalls': 0}
    out['units'] = {}
    for unit in ('passvero-signature-health.timer', 'passvero-signature-health.service', 'clamav-freshclam.service', 'clamav-daemon.service'):
        r = run(['/usr/bin/systemctl', 'show', unit, '--no-pager', '-p', 'LoadState', '-p', 'ActiveState', '-p', 'SubState', '-p', 'UnitFileState', '-p', 'Result', '-p', 'ExecMainStatus', '-p', 'MainPID', '-p', 'InvocationID', '-p', 'ActiveEnterTimestamp', '-p', 'ExecMainStartTimestamp', '-p', 'ExecMainExitTimestamp'])
        assert r.returncode == 0, 'UNIT_READ_FAILED'
        out['units'][unit] = dict(x.split('=', 1) for x in r.stdout.splitlines() if '=' in x)
    r = run(['/usr/bin/journalctl', '-u', 'passvero-signature-health.service', '-n', '80', '-o', 'json', '--no-pager'])
    reports = []
    for line in r.stdout.splitlines():
        try:
            row = json.loads(line); report = json.loads(row.get('MESSAGE', ''))
            if report.get('result') in ('PUBLISHED', 'UNTRUSTED', 'BUSY', 'OPERATIONAL_FAILURE') and re.fullmatch(r'[A-Z_]+', report.get('phase', '')) and (report.get('reason') is None or re.fullmatch(r'[A-Z_]+', str(report['reason']))):
                reports.append({'journalUtcUs': row.get('__REALTIME_TIMESTAMP'), **{k: report.get(k) for k in ('result', 'reason', 'phase', 'durationMs')}})
        except (ValueError, TypeError, AttributeError):
            pass
    out['producerJournal'] = {'readExit': r.returncode, 'latestReports': reports[-3:], 'boundedEntries': 80}
    configPath = '/etc/passvero-signature-health.json'
    c = json.loads(bounded(configPath, 16384))
    out['configMetadata'] = meta(configPath)
    r = run(['/usr/bin/systemctl', 'show', 'passvero-signature-health.service', '-p', 'ExecStart', '--value'])
    out['producerUnitUsesReviewedConfig'] = r.returncode == 0 and bool(re.search(r'--config\s+/etc/passvero-signature-health\.json(?:\s|;|$)', r.stdout))
    liveProducer = P('/usr/local/libexec/passvero-signature-health.cjs')
    reviewedProducer = P('/usr/local/libexec/passvero-signature-recovery-v3/producer.cjs')
    out['producerMatchesRecoveryBundle'] = hashlib.sha256(bounded(liveProducer, 8388608)).digest() == hashlib.sha256(bounded(reviewedProducer, 8388608)).digest()
    health = '/var/lib/passvero-signature-health/health.json'
    out['pathMatch'] = {'probeVsProducerOutput': c.get('outputPath') == health, 'probeVsProducerSocket': c.get('socketPath') == '/run/clamav/clamd.ctl'}
    out['producerOutputMetadata'] = meta(c['outputPath']) if c.get('outputPath') == health else {'notRead': 'OUTPUT_PATH_MISMATCH'}
    before = meta(health)
    out['snapshotBefore'] = before
    if before.get('regular') and 0 < before['bytes'] <= 16384:
        try:
            h = json.loads(bounded(health, 16384))
            out['snapshotRootFields'] = {k: h.get(k) if type(h.get(k)) is int and 0 <= h[k] <= 9007199254740991 else 'INVALID_OR_ABSENT' for k in ('schemaVersion', 'observationSequence', 'observedAt', 'expiresAt')}
            out['snapshotRootFields']['issuedAtPresent'] = 'issuedAt' in h
            out['snapshotRootFields']['socketMatchesProbe'] = h.get('socketPath') == '/run/clamav/clamd.ctl'
        except (ValueError, AttributeError, AssertionError):
            out['snapshotRootFields'] = {'parse': 'INVALID_OR_CHANGED'}
    out['lockPresent'] = os.path.lexists(health + '.lock')
    out['lockInterpretation'] = 'PRESENCE_ONLY_NOT_A_FAILURE'
    for key in ('updaterLog', 'daemonLog', 'updaterConfig'):
        path = c[key]
        assert path == '/etc/clamav/freshclam.conf' or path.startswith('/var/lib/passvero-signature-trust/') or path.startswith('/var/log/clamav/'), 'INPUT_PATH_OUTSIDE_SCOPE'
        info = meta(path)
        out[key] = info
        if info.get('regular') and info['bytes'] <= (65536 if key == 'updaterConfig' else 1048576):
            data = bounded(path, 65536 if key == 'updaterConfig' else 1048576)
            text = data.decode('utf-8', errors='strict')
            if key == 'updaterConfig':
                info['producerHashMatches'] = hashlib.sha256(data).hexdigest() == c['updaterConfigSha256']
                directives = [x.strip() for x in text.splitlines() if x.strip() and not x.strip().startswith('#')]
                info['directoryMatches'] = any(x == 'DatabaseDirectory ' + c['databaseDirectory'] for x in directives)
                info['logMatches'] = any(x == 'UpdateLogFile ' + c['updaterLog'] for x in directives)
            else:
                info['endsWithNewline'] = text.endswith('\n')
                info['lineCount'] = len(text.split('\n'))
                info['initializationBoundaries'] = len(re.findall(r'^.{24} -> --------------------------------------$', text, re.M))
                info['normalizedErrors'] = {name: len(re.findall(pattern, text, re.I)) for name, pattern in {'CONFIG_READ_ERROR': r"[Cc]an.t open|[Cc]an.t parse|[Cc]onfig.*(?:error|fail)", 'ERROR_WARNING': r'ERROR|WARNING', 'FAILURE': r'failed|failure', 'COOLDOWN': r'cool.down|429|403'}.items()}
                info['continuityObservation'] = 'MULTIPLE_INITIALIZATIONS' if info['initializationBoundaries'] > 1 else 'SINGLE_INITIALIZATION' if info['initializationBoundaries'] == 1 else 'NO_INITIALIZATION_OBSERVED'
        else:
            info['contentRead'] = 'SKIPPED_UNAVAILABLE_OR_BOUND'; info['producerCapExceeded'] = info.get('bytes', 0) > (65536 if key == 'updaterConfig' else 1048576)
    actor = pwd.getpwnam('passvero-staging')
    assert actor.pw_uid == 1001, 'STAGING_UID_CHANGED'
    identity = {'user': actor.pw_uid, 'group': actor.pw_gid, 'extra_groups': os.getgrouplist(actor.pw_name, actor.pw_gid), 'cwd': '/', 'env': {'PATH': '/usr/bin:/bin'}}
    reader = P('/usr/local/libexec/passvero-signature-recovery-v3/reader.cjs')
    for path in [reader, *reader.parents]:
        s = path.lstat()
        assert s.st_uid == 0 and not s.st_mode & 0o022 and (stat.S_ISREG(s.st_mode) if path == reader else stat.S_ISDIR(s.st_mode)), 'READER_ARTIFACT_UNTRUSTED'
    out['readerSha256'] = hashlib.sha256(bounded(reader, 8388608)).hexdigest()
    r = run(['/usr/bin/node', str(reader)], **identity)
    v = json.loads(r.stdout)
    out['actualReader'] = {'exit': r.returncode, **{k: v[k] for k in ('accepted', 'sequence', 'observedAt', 'expiresAt') if k in v}}
    js = r'''
const fs=require('node:fs'),p=require('node:path'),crypto=require('node:crypto');
let fd; const out={branch:null}; function stop(reason){out.branch=reason;throw new Error('NORMALIZED_STOP')}
try {
 const path='/var/lib/passvero-signature-health/health.json';
 for(let d=p.dirname(path);;d=p.dirname(d)){const s=fs.lstatSync(d);if(!s.isDirectory()||s.uid!==0||(s.mode&18))stop('PRIVATE_PARENT_REJECTED');if(d==='/')break}
 const b=fs.lstatSync(path);out.file={inode:b.ino,mtimeNs:String(BigInt(Math.round(b.mtimeMs*1e6)))};
 if(!b.isFile()||b.uid!==0||![384,416].includes(b.mode&511)||b.nlink!==1||b.size<1||b.size>16384)stop('PRIVATE_FILE_REJECTED');
 fd=fs.openSync(path,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW|fs.constants.O_NONBLOCK);
 const a=fs.fstatSync(fd);if(a.ino!==b.ino||a.dev!==b.dev)stop('PRIVATE_FILE_CHANGED');
 const bytes=Buffer.alloc(16385);let n=0,k;while(n<bytes.length&&(k=fs.readSync(fd,bytes,n,bytes.length-n,n)))n+=k;
 for(const s of [fs.fstatSync(fd),fs.lstatSync(path)])if(s.ino!==a.ino||s.dev!==a.dev||s.size!==a.size||s.mtimeMs!==a.mtimeMs||s.ctimeMs!==a.ctimeMs)stop('PRIVATE_FILE_CHANGED');
 if(n!==a.size||n>16384)stop('PRIVATE_FILE_BOUND');
 const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes.subarray(0,n)).trim();let h;try{h=JSON.parse(text)}catch{stop('JSON_INVALID')}
 if(JSON.stringify(h)!==text)stop('NONCANONICAL_JSON');
 const {z}=require('node:module').createRequire('/var/www/passvero-acceptance/package.json')('zod');
 const t=z.number().int().nonnegative().safe(),sha=z.string().regex(/^[a-f0-9]{64}$/),pathSchema=z.string().min(2).max(100).regex(/^\/(?:[A-Za-z0-9_-][A-Za-z0-9_.-]*\/)*[A-Za-z0-9_-][A-Za-z0-9_.-]*$/);
 const schema=z.object({schemaVersion:z.literal(2),status:z.literal('HEALTHY'),socketPath:pathSchema,observedAt:t,expiresAt:t,observationSequence:t,evidence:z.object({updater:z.object({completedAt:t,result:z.enum(['UPDATED','ALREADY_CURRENT'])}).strict(),disk:z.object({components:z.tuple(['main','daily','bytecode'].map(name=>z.object({name:z.literal(name),version:t,sha256:sha}).strict())),manifestSha256:sha}).strict(),daemon:z.object({scanner:z.literal('clamav'),engineVersion:z.string().min(1).max(64).regex(/^[\x21-\x7e]+$/),dailyVersion:t,dailyPublishedAt:t}).strict()}).strict()}).strict();
 const scalar=v=>Number.isSafeInteger(v)&&v>=0?v:'INVALID_OR_ABSENT';out.snapshot={schemaVersion:scalar(h?.schemaVersion),sequence:scalar(h?.observationSequence),observedAt:scalar(h?.observedAt),expiresAt:scalar(h?.expiresAt),issuedAtPresent:Object.hasOwn(h??{},'issuedAt')};
 if(!schema.safeParse(h).success)stop('SNAPSHOT_SCHEMA_REJECTED');
 const now=Date.now(),e=h.evidence;out.snapshot.updaterCompletedAt=e.updater.completedAt;out.evaluatedAt=now;
 if(h.socketPath!=='/run/clamav/clamd.ctl')stop('SOCKET_PATH_MISMATCH');
 if(crypto.createHash('sha256').update(JSON.stringify(e.disk.components)).digest('hex')!==e.disk.manifestSha256)stop('DISK_MANIFEST_HASH_MISMATCH');
 const gates=[['UPDATER_AFTER_OBSERVATION',e.updater.completedAt>h.observedAt],['OBSERVATION_IN_FUTURE',h.observedAt>now],['SNAPSHOT_EXPIRED',now>=h.expiresAt],['INVALID_LIFETIME',h.expiresAt<=h.observedAt],['LIFETIME_OVER_60S',h.expiresAt>h.observedAt+60000],['EXPIRY_OVER_UPDATER_24H',h.expiresAt>e.updater.completedAt+86400000],['UPDATER_STALE_24H',now-e.updater.completedAt>=86400000],['DAILY_TIMESTAMP_IN_FUTURE',e.daemon.dailyPublishedAt>now],['DAILY_VERSION_MISMATCH',e.daemon.dailyVersion!==e.disk.components[1].version]];
 out.failedProvenanceGates=gates.filter(x=>x[1]).map(x=>x[0]);if(out.failedProvenanceGates.length)stop('TRUSTED_PROVENANCE_REJECTED');out.branch='OBSERVED_GATES_PASS';
}catch(e){if(!out.branch)out.branch=['ENOENT','EACCES','EPERM'].includes(e.code)?'PRIVATE_READ_'+e.code:'DIAGNOSTIC_INPUT_UNRESOLVED'}finally{if(fd!==undefined)fs.closeSync(fd)}
console.log(JSON.stringify(out));
'''
    r = run(['/usr/bin/node', '-e', js], **identity)
    out['sourceConditionObservation'] = json.loads(r.stdout) if r.returncode == 0 else {'branch': 'DIAGNOSTIC_FAILED', 'exit': r.returncode}
    out['snapshotAfter'] = meta(health)
    out['snapshotStableAroundReader'] = before == out['snapshotAfter']
    out['interpretation'] = 'SOURCE_CONDITION_OBSERVATION_NOT_HISTORICAL_CAUSE; CHANGED_SNAPSHOT_REQUIRES_CAUTION'
    print(json.dumps(out, indent=2))
except Exception as error:
    print(json.dumps({'diagnosis': 'STOP', 'reason': str(error) if isinstance(error, AssertionError) else type(error).__name__, 'scope': 'STAGING_READ_ONLY', 'mutations': False}))
    raise SystemExit(1)
PY
```

## Signature recovery release alignment — završeno PASS

Operatorski read-only output 2026-10-02T19:48:35.155731Z potvrđuje installed v3
hashove, podudaranje live producera i 826 aktuelnih artefakata za build
8QNIYVVZWEsQaCL9uLZ5Q. Jedina nekompatibilnost je stari release pin:
original STAGING_RELEASE_CHANGED, tačan kandidat PASS_ALL_EXISTING_GUARDS.
Reminder timer DISABLED_INACTIVE, campaigns 0; staging HTTPS 200.
[Izveštaj i reviewed hashovi](DOCUMENT_SIGNATURE_HEALTH_POST_RESTART_RECOVERY.md),
[manifest jedne source pin zamene](evidence/signature-recovery/release-alignment-source-manifest.json).

**RECOVERY_COMPLETE / PASS — operatorski rezultat 2026-10-02.** Jedan attempt
`recovery-20261002-release-8qni-01`, alignment 19:54:01 UTC (21:54:01 lokalno),
recoveryExit=0/RECOVERED. Tri zakazane reader-prihvaćene objave: sequence
87498 → 87499 → 87500, observedAt 19:55:04.010 → 19:55:19.268 → 19:55:34.890 UTC;
expiresAt je svaki put observedAt +60 s. Raspon tri opažanja je 30.880 s.
Završni stvarni reader prihvata sequence 87500. Uspešan postojeći recovery
potvrđuje updater kontinuitet/isti PID i fresh CVD completion prema postojećem
300 s kriterijumu, daemon readiness prema 120 s i scheduled acceptance prema 100 s.
Timer active/waiting; oneshot success/exit 0, inactive/dead je normalno stanje
između objava. Freshclam/clamd active/running, qpdf active/listening; HTTPS 200.
Reminder timer DISABLED_INACTIVE i campaigns 0 pre/posle. Originalni alat,
prethodne baze i evidencija sačuvani prema proceduri; nema drugog pokušaja.
[Sanitizovani operatorski dokaz](evidence/signature-recovery/release-alignment-recovery-result.json).
Ovo je opažanje pri završetku recoveryja, ne trajna freshness garancija.
Reboot/dugotrajan rad ostaju NOT_PROVEN; stvarni PDF acceptance NOT_YET_RUN.

PDF korak može početi u korisničkoj sesiji nakon pregleda plana; stvarni
upload/scan/download ostaje korisnička radnja iz koraka 3, bez nove antivirusne serije.
Ostali uslovi real-data unosa i backup ograničenja ostaju isti. Automatizacije reminder-a
nisu uključene i testni podaci nisu obrisani. Jedini source diff je exact release pin
recovery alata; nema aplikacijskog deploya, commita/pusha ili production promene.

## Korisnički rezultati i UX nastavak — 2026-10-04

Korisnički dokaz (nije nova automatizovana acceptance serija): prodaja@zivic-elektro.com,
Živić-elektro - staging test, Razdjelni ormar MUT 4: kreiranje, PDF skeniranje,
upload/prikaz slike, objava DPP-a/QR i CSV export uspešni prema prijavi korisnika.
Korisnik je potvrdio novu objavu pre QR osvežavanja. Samo draft save → nepromenjena
javna verzija još zahteva zasebnu potvrdu iz koraka 5; ne ponavljati objave realnog
proizvoda radi ove UX celine. Nisu time dokazani negativni/recovery/concurrent tokovi.

SKU 05.66.81 u CSV preview-u već postoji; isključen red i 0 selection su očekivani.
GTIN acknowledgment ne omogućava update niti uklanja SKU konflikt. Za preostali
CSV acceptance odabrati jedan jasno synthetic draft sa unique SKU i praznim GTIN-om,
proći četiri koraka i proveriti rezultat/same-file replay. Ne menjati postojeći realni
proizvod ili njegove fajlove/verzije. Sva sintetička evidencija ostaje sačuvana.

[UX pregled, screenshotovi i provere](CSV_IMPORT_IMAGE_UPLOAD_AND_PRODUCT_PRESENTATION_UX_POLISH.md):
lokalno PASS; staging deploy i live synthetic CSV još čekaju operator output.
Image izbor označava nespremljenu datoteku; upload nastaje tek na Spremi sliku.
Public/preview ikonice ne označavaju regulatornu verifikaciju ili sertifikat.
Postojeće kvote, prava, javna potvrda i staging backup ograničenja ostaju primenljivi.

Deploy UX v1 je stao na RUNTIME_PACKAGE_DRIFT pre UI zamene i app restarta.
Korisnikov proizvod i podaci nisu menjani. Live synthetic CSV acceptance je i dalje
NOT_YET_RUN. Sledi samo read-only potvrda staging runtime pinova; postojeći UI/build
ne zahtevaju novu antivirusnu, backup ili subscription seriju.

Read-only output 2026-10-04 12:48:06 lokalno potvrđuje accepted runtime pinove,
svih 13 runtime fajlova i neizmenjeno originalno izdanje; PASS_RUNTIME_PIN_CORRECTION_ONLY.
V2 paket ispravlja metadata pinove uz identične UI artefakte; v1 dokaz sačuvan.
PENDING_OPERATOR_COMMAND_STAGING_UI_DEPLOY_V2. Novi live UI/CSV upis još nisu dokazani.

## UX završetak — staging deploy i CSV acceptance PASS (2026-10-04)

V2 deploy potvrđen operatorskim outputom: HqpP77R94fR_j4Jo_P_0u, HTTPS 200,
826 artefakata. Reminders disabled/kampanje 0, scanner/qpdf neizmenjeni, rollback
pripremljen/nije izvršen. Raniji pending/v1 STOP zapisi su istorijski.
CSV korak potvrđen novom live proverom: jedan zadržan sintetički draft
UX-CSV-20261004-0c77b9 (d414bbc1-3b97-4773-839d-645be2e9cb97), bez GTIN-a,
preview/izbor/potvrda/rezultat i same-file report replay bez drugog kreiranja.
Isti SKU u drugoj datoteci pravilno blokiran uz vidljiv razlog. Realni proizvod
i fajlovi/verzije nisu menjani. Image keyboard izbor/unsaved stanje live; nije bilo
novog upload-a ili scan-a. Javni DPP/preview read-only i mobile 375 px PASS.
Error/partial/six-language UI ostaju lokalni dokazi; screen-reader sesija nije izvršena.
Nastavak: korisnički korak 5 (draft save bez nove objave → javna verzija nepromenjena),
uz postojeću potvrdu namere javne objave tek kada korisnik želi novu verziju.
[Jedinstveni pregled, screenshotovi i manifest](CSV_IMPORT_IMAGE_UPLOAD_AND_PRODUCT_PRESENTATION_UX_POLISH.md).

## Korisnička potvrda i završna GTIN dorada — 2026-10-04

Korisnik je izričito potvrdio: samo čuvanje drafta bez nove objave ne menja
javnu verziju. Korak 5 je prihvaćen kao korisnički dokaz pozitivnog toka;
negativni/konkurentni/recovery scenariji time nisu dodatno potvrđeni. Screenshot
prikazuje javnu verziju 4; raniji browser dokaz verzije 3 ostaje istorijski.

Na zahtev korisnika uklonjen je samo objašnjavajući pasus ispod GTIN-a u
public-dpp-document.tsx, za sve jezike. Barkod, broj, naslov i ostale sekcije
ostaju isti; objašnjenje u dashboard unosu ostaje dostupno. Nema DTO/promene
podataka ili poslovnih pravila. Ova dodatna source izmena još nije deployovana;
prethodni staging deploy HqpP77R94fR_j4Jo_P_0u i njegov manifest ostaju istorijski
tačni. Nema commita/pusha.

GTIN follow-up deploy odobren: PENDING_OPERATOR_COMMAND. Paket prenet na VPS
/tmp/passvero-gtin-notice-20261004.tar.gz bez sudo; novi build _xSIVqA6vEbfYig6Tcxqj
sa 826 artefakata. Tačan prethodni build HqpP77R94fR_j4Jo_P_0u i manifest
f91884488412096c4ce80a303391f0112f24042c3cbeee00ae04c3f39081b9b1 proveravaju
se pre swapa. Odvojeni operators-gtin source/package/rollback ne prepisuje raniji UX
ili recovery manifest. Lokalni sintetički deploy i eksplicitan rollback (uspeh i
HTTPS failure) PASS; VPS izvršenje još nije dokazano. Nema novih poslovnih upisa.

GTIN follow-up završetak: STAGING_DEPLOY_PASS, operatorExit 0, build
_xSIVqA6vEbfYig6Tcxqj, 826 artefakata, HTTPS 200. Raniji pending zapisi
su istorijski. Svež read-only browser uvid u javni DPP verzija 4 potvrđuje
GTIN naslov, barkod i broj 8606002984588, bez objašnjavajućeg pasusa.
Nema poslovnih upisa/upload/scan/email; scanner/qpdf neizmenjeni, reminders
disabled/kampanje 0. Rollback pripremljen/nije izvršen.
[Odvojeni završni manifest](evidence/ux-polish/gtin-notice-followup-manifest.json)
i [operatorski dokaz](evidence/ux-polish/operator-gtin-deployment-result.json).
