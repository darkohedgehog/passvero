# CSV import, image upload i DPP presentation — staging UX polish

Datum: 2026-10-04, Europe/Zagreb. Status: LOCAL_PASS; STAGING_DEPLOY_PASS; LIVE_CSV_PASS.
Deployment v1 STOP je istorijski dokaz; v2 uspešno izvršen. Nema commita/pusha ni production pristupa.

## Korisnički dokaz — odvojen od lokalnih i operatorskih provera

Korisnik prodaja@zivic-elektro.com, organizacija „Živić-elektro - staging test“,
prijavio je: kreiran Razdjelni ormar MUT 4, PDF prošao skeniranje, image upload/prikaz,
objava DPP-a i otvaranje QR-a, CSV export rade. Potvrdio je u razgovoru da je pre
ponovnog QR otvaranja kliknuo novu objavu. Ovo dokazuje prijavljeni pozitivan tok;
ne potvrđuje draft-only javnu nepromenljivost, negativne/konkurentne scenarije,
reboot/recovery ili dugotrajan operativni rad.

Read-only browser uvid u već otvoreni staging CSV preview potvrdio je tačnu
organizaciju, proizvod bf43ff39-2e97-497c-b2e0-6530484810db, SKU 05.66.81,
SKU konflikt, isključen red, GTIN podudaranje i 0 odabranih redova. Stari UI nudi
checkbox „kreiranje 0 proizvoda“, ali finalni handler nije izvršen: disabled akcija
je očekivana zaštita. GTIN priznanje ne može ukloniti SKU konflikt. Postojeći servis
odbija konfliktnu selekciju i pri direktnom zahtevu. Nije pronađen kvar handlera za
valjan odabrani red; stvarni novi staging upis naknadno je potvrđen u završnom dokazu ispod.

## Promene i očuvana pravila

- CSV: četiri označena koraka, vidljivi picker/upload icon i naziv datoteke,
  localized mapping labels (technical key samo pomoć), scoped help disclosure,
  razlog uz disabled akciju, odsustvo potvrde „0 proizvoda“, GTIN/SKU objašnjenje,
  progress, svi/partial/zero-success rezultat, postojeći resume i report replay.
- Image: picker button dostupan tastaturom, filename, limiti, izbor odvojen od
  sačuvane draft slike, indeterminate upload/save progress, lokalizovani status/alert.
  Izbor se briše tek posle uspešnog odgovora; neuspeh ga zadržava. Nema lažnog %.
- Public DPP i snapshot preview: isti dekorativni nonfocusable MarketingIcon skup
  uz postojeće sadržajne sekcije, kartice, čitljiva hijerarhija i mobile wrap.
  Nema novih podataka, verified/certified tvrdnji ili izmena značenja statusa.

Create-only, preview, explicit selection, SKU deny, separate GTIN acknowledgement,
tenant authorization, quotas, transactions/idempotence i odsustvo čuvanja raw CSV-a
ostaju u neizmenjenim import API/application/persistence modulima. Image validation,
normalization/versioning/quotas/delivery pipeline nije izmenjen. Public DTO, private
access, publication gate i PDF security moduli nisu izmenjeni. Nema novih dependencies.

Tri postojeće prepreke proverama korigovane su odvojeno od deployed UI ponašanja:
operatorski application_read.ts dobija NODE_ENV=production u već ograničenom child
environment radi Next.js ProcessEnv tipa (ne izvršava se); test očekuje postojeći
završni authority recheck; boundary test prepoznaje postojeća 44 message ključa i
razlikuje legalni ProductDocuments namespace od privatnog ProductDocument modela.
Nema izmene application/public-DPP servisnog ponašanja.

## Lokalne provere

- 74 relevantna application testa PASS: CSV parser/mapping/authorization/selection,
  SKU/GTIN guard, public-DPP DTO/HTTP, product detail, translation preview i list.
- 4 public-DPP boundary testa PASS. npx tsc --noEmit PASS.
- npm run lint: 0 errors, 16 postojećih warnings; nema novih warnings u UI difu.
- PASSVERO_RUNTIME_ENV=staging BETTER_AUTH_URL=https://staging.passvero.eu
  npm run build -- --webpack PASS; build HqpP77R94fR_j4Jo_P_0u, 826 artefakata.
- Whitespace tracked/untracked i cached diff PASS; JSON locale key/placeholder parity PASS.
- Browser skill/plugin absent; korišćen postojeći Chrome kroz CUA dokumentovani
  Playwright API, bez instalacije dependencies. Lokalni server 127.0.0.1:4317,
  stvarne komponente uz sintetički mocked transport i router refresh. Ovo nije
  persistence/live dokaz. Identity/nonblank/console/overlay/interactions provereni.
- Konfliktni SKU + GTIN acknowledgement: row i create ostaju disabled, 0 confirm/
  execute calls, razlog vidljiv, bez checkbox-a za kreiranje 0.
- Valjan red: keyboard picker → header → preview → explicit row → confirmation
  Space → create Enter → success. Jedan confirm; report replay izvršava existing
  execute putanju bez drugog confirm-a. Error → alert → resume → success, isti batch.
  Partial success eksplicitno prikazuje 1 success/1 failed. Posebno GTIN priznanje
  obavezno za matching valid row. Nema backend/persistence bypass-a.
- Image: keyboard picker, filename i unsaved hint, pending disabled controls + progress,
  simulated failure/alert zadržava izbor, success briše izbor. Nema pravog upload-a.
- CSV/image/mapping u HR/SR/EN/DE/SL/PL na 320/375/768/1024/1440 px:
  bez page overflow/missing messages. Wide CSV ostaje u sopstvenom scroll regionu.
  Actual keyboard controls i dostupni accessible names provereni; zasebna sesija
  sa VoiceOver/čitačem ekrana nije izvršena.
- Public DPP i snapshot preview desktop/mobile: dekorativne ikonice i postojeći
  sadržaj bez overlay/console error-a; public 375px bez page overflow.
- Sintetički lokalni deployment/explicit rollback na privremenom filesystemu:
  success i HTTPS failure scenariji vraćaju tačne prethodne artefakte/metadata,
  zadržavaju failed artefakte. Ovo ne dokazuje VPS izvršenje rollbacka.

Screenshotovi i fixture/logs: /private/tmp/passvero-ux-polish/.
[csv konflikt desktop](/private/tmp/passvero-ux-polish/csv-conflict-desktop.jpg),
[csv konflikt mobile](/private/tmp/passvero-ux-polish/csv-conflict-mobile.jpg),
[image pending](/private/tmp/passvero-ux-polish/image-pending-mobile.jpg),
[DPP desktop](/private/tmp/passvero-ux-polish/dpp-desktop.jpg),
[DPP mobile](/private/tmp/passvero-ux-polish/dpp-mobile.jpg).

## Staging deploy i rollback — pripremljeno, još nije izvršeno

Paket je prenet bez sudo u /tmp/passvero-ux-polish-20261004.tar.gz na VPS.
Archive SHA-256 c88aa28532303772102d841e7ffb9696501433aae25b8371deaef411a2f3a60d;
package manifest SHA-256 bf0f7ed265fae86211f6234a362a835b23543998cd1f781c9401aaf0e2e31bd6.
Pregledani source i operator hashes: [odvojeni UX manifest](evidence/ux-polish/source-manifest.json).

Root blok ponovo proverava current build 8QNIYVVZWEsQaCL9uLZ5Q i svih 826
prethodnih artefakata, exact previous reminder deployment manifest, current
canonical metadata, runtime package/dependency hashes, staging DB scope i
reminder disabled/campaigns 0. Menja samo .next/messages i restartuje samo
passvero-staging PM2 aplikaciju passvero-acceptance. Nema DB/storage/updater/producer
mutacije, migracija, scan-a, emailova ili user product izmene.

Prethodne .next/messages ostaju sa suffixom .before-ux-polish-20261004; prethodni
canonical runtime metadata bajtovi čuvaju se u novom root-only deployment direktorijumu.
Aktuelni canonical runtime inventory usklađuje se sa novim UI artefaktom prema
postojećem deployment obrascu. Stari reminder/recovery source/evidence manifesti
ne prepisuju se. Recovery alat i njegov exact pin ostaju sačuvani; eventualni budući
recovery za novi release zahteva standardni exact-artifact review, ne bypass.

Operatorski blok je u razgovoru. Očekuje se deployment PASS, new build, HTTPS 200,
scanner config/PID i qpdf UNCHANGED, reminder off/0. Pri STOP-u nema replay-a;
explicit rollback.py iz ovog paketa čuva failed artefakte i vraća previous UI/metadata.
Rollback je pripremljen/lokalno proveren, VPS rollback nije izvršen.

Posle operator PASS-a: browser reload i live provera novog UI-a u odobrenoj
organizaciji. Kreirati tačno jedan synthetic unpublished CSV draft sa unique SKU,
praznim GTIN-om, bez kopiranja realnog proizvoda. Proveriti preview/selection/
confirmation/result i same-file report replay; drugi preview sa istim synthetic SKU
i različitim content hashom treba da pokaže konflikt bez upisa. Po potrebi image
kontrole proveriti na tom synthetic draftu; ne menjati realni proizvod/sliku/PDF/
publication. Synthetic product/assets/receipts/audit ostaju sačuvani.
Live mutated IDs i screenshots beleže se tek nakon stvarnog rezultata.

## Deploy v1 STOP — RUNTIME_PACKAGE_DRIFT

[Operatorski rezultat](evidence/ux-polish/operator-deployment-stop-v1.json): exit 1
u common.verify, pre deploy.main. Root-only paket jeste raspakovan; .next/messages
nisu zamenjeni, deployment state/archive nisu kreirani i aplikacija nije restartovana.
Rollback nije potreban za ovaj STOP. V1 paket/source manifest se zadržavaju kao dokaz;
ne ponavljati v1 blok i ne zaobilaziti guard.

Lokalni uzrok pogrešnog pina: novi manifest koristi lokalne package/lock hashove
b8e98604501f008c052dcaf7e141c453902fb87c22770938098dc345e720efb0 /
4312618b27164f25b095ffe693410bcb4f84537cf6d30738732fca8192e6a7ae;
prihvaćeni staging deployment ima odvojene runtime hashove
df4c1ac1b1d409c5db06c9614fc2a2cf8c5fe4fb4c6daa13f1ed3b88088ddd6e /
f82a6356bd1201994d00d2032eabc7da5334de234bf36998b00c277e61f29b3c.
Svih 12 lokalnih dependency package.json hashova odgovara prihvaćenim runtime
hashovima. Aktuelni VPS mora read-only potvrditi stare tačne runtime bajtove,
dependency hashove, originalni build/artefakte i odsustvo swap/state tragova.
PENDING_OPERATOR_COMMAND_RUNTIME_PIN_READ_ONLY: blok dostavljen u razgovoru.
Ako se to potvrdi, korigovati samo package metadata pinove u novom versioned paketu,
bez menjanja UI source/build/dependencies ili postojećih v1/recovery dokaza.

## Runtime pin potvrda PASS i odvojeni v2 paket

[Read-only output](evidence/ux-polish/runtime-pin-read-only-result.json)
2026-10-04T10:48:06.122206Z (12:48:06 lokalno): accepted package/lock hashes tačni,
svi 13 runtime fajlova podudarni, originalni build i 826 artefakata neizmenjeni,
bez deployment state/prepared/swap putanja; aplikacija online, HTTPS 200.
PASS_RUNTIME_PIN_CORRECTION_ONLY potvrđuje grešku UX package metadata pina.

V2 zadržava iste application.tar.gz bajtove i UI build HqpP77R94fR_j4Jo_P_0u.
Menjaju se samo dva runtime metadata pina i common.py root state/package putanja
na /var/lib/passvero-ux-polish-20261004-v2; guard/handler/deploy/rollback logika ostaje ista.
V1 paket/operator source/STOP dokazi ostaju sačuvani. Sintetički success/failure
rollback proof i syntax/source/artifact manifest provere za v2 PASS. Nema potrebe
ponavljati neizmenjene aplikacijske/build ili antivirusne/backup/subscription testove.

V2 archive e4f724ee8c64f4d2358ff9f56a57a4a0e36ff21c71ce843a1b2a86119bcf703b;
V2 package manifest f91884488412096c4ce80a303391f0112f24042c3cbeee00ae04c3f39081b9b1.
PENDING_OPERATOR_COMMAND_STAGING_UI_DEPLOY_V2: potpuni blok u razgovoru.
Rollback entrypoint /var/lib/passvero-ux-polish-20261004-v2/rollback.py sa v2 manifest pinom;
staging deployment/live synthetic CSV i dalje NOT_YET_RUN. Bez novih sudo radnji agenta.

## Završni staging dokaz — 2026-10-04

Operatorski v2 output: deployment PASS, build HqpP77R94fR_j4Jo_P_0u,
826 potvrđenih artefakata, HTTPS 200, operatorExit 0. Rollback pripremljen,
nije izvršen. Scanner konfiguracija/PID-ovi i qpdf neizmenjeni; reminder timer
DISABLED_INACTIVE, kampanje 0. Deploy nije imao DB upise, upload, scan ili email.
[Operatorski output](evidence/ux-polish/operator-deployment-v2-result.json).

Odvojena browser provera u odobrenoj organizaciji kreirala je tačno jedan
sintetički nejavni nacrt: SKU UX-CSV-20261004-0c77b9, prazan GTIN,
[proizvod](https://staging.passvero.eu/dashboard/products/d414bbc1-3b97-4773-839d-645be2e9cb97).
Preview → eksplicitan izbor → potvrda → kreiranje tastaturom PASS; rezultat 1/0/0.
Osvеžavanje izvještaja i ponovni preview iste datoteke vraćaju postojeći uspešan
izvještaj bez nove create akcije. Pretraga tačnog SKU-a daje jedan proizvod.
Druga sintetička datoteka sa istim SKU-om: konflikt, red/finalno dugme disabled,
konkretan razlog vidljiv, nema checkbox-a za kreiranje 0 proizvoda. Nacrt je zadržan.
[Live dokaz](evidence/ux-polish/live-ui-csv-result.json).

Na sintetičkom nacrtu image picker tastaturom prikazuje synthetic.png i jasno
nespremljeno stanje; slika nije sačuvana/uploadovana. Pending/error/partial stanja
ostaju lokalni mock dokazi, uspešan realni image/PDF tok je korisnička prijava.
Postojeći realni DPP verzija 3 i njegov preview pregledani su read-only; 17
ukrasnih ikonica uz javne naslove, slika/barkod i kontrolisani PDF link prisutni.
DPP na stvarnoj širini 375 px nema horizontalni overflow. Nema nove objave,
PDF preuzimanja/skeniranja, izmene stvarnog proizvoda ili produkcijskog pristupa.
Šest jezika i responsive matrica potvrđeni lokalno; posebna screen-reader sesija
nije izvršena. Draft-only javna nepromenljivost ostaje korisnički korak 5.

Screenshotovi (lokalni artefakti):

- [Staging CSV uspeh](/private/tmp/passvero-ux-polish/live-csv-success-desktop.jpg)
- [Staging CSV konflikt, mobile](/private/tmp/passvero-ux-polish/live-csv-conflict-mobile.jpg)
- [Staging izbor slike, mobile](/private/tmp/passvero-ux-polish/live-image-selection-mobile.jpg)
- [Staging DPP, mobile](/private/tmp/passvero-ux-polish/live-dpp-mobile.jpg)
- [Staging DPP, desktop](/private/tmp/passvero-ux-polish/live-dpp-desktop.jpg)
- [Staging preview](/private/tmp/passvero-ux-polish/live-preview-desktop.jpg)

Novi release ne menja istorijski recovery pin 8QNIYVVZWEsQaCL9uLZ5Q. Budući
recovery zahteva postojeći tačan release-review postupak; taj alat nije pokretan
u UX celini. Nema commita/pusha. Source hashovi i postojeća recovery evidencija
ostaju sačuvani u odvojenim manifestima.

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

GTIN follow-up provere: 4 public-DPP boundary testa PASS; eslint ciljnog fajla
PASS; staging-configured webpack build PASS; tsc --noEmit nakon builda PASS;
whitespace PASS. Prvi paralelni tsc/build pokušaj imao je race na regenerisanim
.next/types; sekvencijalni tsc posle builda ga je razrešio.
[Odvojeni follow-up manifest](evidence/ux-polish/gtin-notice-followup-manifest.json);
prethodni deployed source manifest nije prepisan novim hashom.

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
