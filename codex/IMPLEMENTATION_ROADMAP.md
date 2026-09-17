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
| Public DPP, Passport/QR | Javni DTO sa allowlistom, lokalizovani objavljeni sadržaj, materijali/CN; stabilan passport/public code i QR artefakti. | Ranija istorijska staging provera Product/QR je zaseban dokaz; nije novi real-data rezultat. Javni dokumenti/slike nisu u trenutnom PublicDpp DTO-u. |
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
| 1. Public DPP dokumenti — nisu implementirani | Posetilac vidi dozvoljene priloge aktuelne objavljene verzije i dobija samo podoban, proveren dokument kroz kontrolisan endpoint; oslanja se na postojeću privatnu validaciju i lifecycle. |
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

## Tačno jedan preporučeni sledeći zadatak

**PUBLIC_DPP_DOCUMENT_PRESENTATION_AND_CONTROLLED_DELIVERY_STAGING**

Ishod: javni posetilac otvara samo izričito javni, podobni PDF vezan za trenutno
objavljenu verziju proizvoda. Opseg: minimalni javni DTO/prikaz i kontrolisana
isporuka preko aplikacije, uz postojeću scan politiku, integritet i privatni storage.

Acceptance kriterijumi za buduće odobrenje:
- prikaz samo javnih priloga aktuelnog aktivnog objavljenog passporta;
- direktni endpoint odbija privatne/draft/nepovezane i nepodobne dokumente;
- CLEAN, policy, svežina, integritet i lifecycle provereni server-side pre bajtova;
- promena publikacije/povlačenje ne ostavlja trajni URL koji zaobilazi proveru;
- lokalni auth/lifecycle testovi i jedan odobren staging UI tok sa tačnim cleanupom.

Nisu u opsegu: javni bucket, trajni signed URL, automatski scan/recovery, slike,
onboarding, nova parser dijagnostika ili production. Ovaj zadatak **nije izvršen**.

Korisnik je potvrdio završetak real-data zadatka. Detaljni završni izveštaj nije
dostupan u pregledanim izvorima, pa konkretni scenariji ostaju nepotvrđeni ovim
dokumentom. Ako postojeći izveštaj naknadno postane dostupan, uključiti njegove
nalaze. Njegovo odsustvo samo po sebi ne zahteva ponovno testiranje niti blokira
sledeći zadatak; konkretan korisnički prijavljen problem rešava se prema svom
uticaju.
