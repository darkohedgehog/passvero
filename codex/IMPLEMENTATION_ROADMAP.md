# Passvero — stanje implementacije i redosled nastavka

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
