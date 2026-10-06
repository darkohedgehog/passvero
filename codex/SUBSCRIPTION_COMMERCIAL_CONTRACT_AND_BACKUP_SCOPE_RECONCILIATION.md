# Subscription commercial contract and backup scope reconciliation

Datum: 2026-09-30. Status: ugovor potvrđen za implementaciju prve komercijalne cjeline (2026-09-30).
Baza pregleda: `main`, HEAD `2a8faf17489ab3e6072c29e9d801f1671387317e`;
početni worktree i index čisti. Nisu pregledavani živi podaci ni tajne.

Ovaj dokument je autoritativna dopuna za komercijalni opseg. U slučaju neslaganja
zamjenjuje godišnji-only i Stripe smjer iz odjeljaka 24–25
[ranijeg ugovora](../docs/superpowers/specs/2026-08-19-passvero-auth-dashboard-design.md).
[Centralni roadmap](IMPLEMENTATION_ROADMAP.md) vodi nastavak. Prvobitni pregled bio je dokumentacijski. Naknadni zadatak
SUBSCRIPTION_MANUAL_COMMERCIAL_WORKFLOW_STAGING odobrava prvu cjelinu, aditivnu
migraciju i staging deploy; konkretni testni identiteti su zasebno potvrđeni u
[izvještaju implementacije](SUBSCRIPTION_MANUAL_COMMERCIAL_WORKFLOW_STAGING.md).
Production, email podsjetnici, commit i push ostaju izvan odobrenja.

## 1. Potvrđene poslovne odluke

- B2B uplata na račun po ponudi; bez Stripea i kartica.
- Korisnik bira paket i period te podnosi zahtjev. Admin vidi zahtjev, provjerava
  uplatu i eksplicitno aktivira pretplatu. Zahtjev ili poslani email nisu aktivacija.
- Račun se ručno izdaje u Synesisu. Passvero čuva potrebne vanjske reference;
  ne izdaje račune, ne postaje knjigovodstvo i nema Synesis integraciju.
- Aktivacija korisničkog računa/organizacije i plaćene pretplate odvojeni su događaji.
- Trial: tri proizvoda i šest mjeseci po organizaciji. Detalji brojanja/starta potvrđeni su u §3; njihova provedba nije dio prve cjeline.
- Nakon isteka nema uređivanja proizvodnog sadržaja ni novih objava.
- Korisnik i admin vide rok i dobivaju podsjetnike; raspored/primatelji su niže.
- Registracijski CTA vodi na postojeći lokalizovani `/request-access`, bez novog signupa.

Cijene u EUR, bez PDV-a; iznosi su cijena cijelog perioda, ne mjesečna rata:

| Paket | Objavljeni proizvodi | 3 kalendarska mjeseca | 12 kalendarskih mjeseci |
| --- | ---: | ---: | ---: |
| Start | 25 | 147 | 490 |
| Business | 100 | 297 | 990 |
| Pro | 500 | 597 | 1990 |
| Custom | Zasebna ponuda | Zasebna ponuda | Zasebna ponuda |

Jedan `Product` s objavljenom verzijom i novim nacrtom zauzima jedno objavljeno
mjesto. Broj verzija ne povećava broj mjesta. Ukupni sačuvani proizvodi, datoteke
te objavljena mjesta različite su metrike.

## 2. Provjereno početno stanje na navedenom HEAD-u (prije implementacije)

| Područje | Nalaz i posljedica |
| --- | --- |
| `prisma/schema.prisma`, `Plan` | Postoje `monthlyPrice`, `yearlyPrice`, EUR, `maxProducts`, `maxActivePassports`, `maxMembers`, `maxStorageBytes`, `maxMonthlyScans`, `features`. Nullable limit danas znači unlimited/not enforced; ne smije nehotice postati neograničeni Custom. Nema cijene za tromjesečni period. Ne upisivati 147 u monthlyPrice niti iz godišnje cijene računati ponudu. |
| `Subscription` i migracija `20260721190547_add_subscription` | Jedna trenutna projekcija po organizaciji (`organizationId` unique), plan, status, period, provider. `MANUAL` već postoji; sva tri provider-ID/config polja moraju biti null za MANUAL. Reference ponude/računa ne pripadaju tim poljima. |
| Lifecycle CHECK pravila | End >= start; TRIAL/ACTIVE/PAST_DUE nemaju canceledAt; CANCELED/EXPIRED ga zahtijevaju i zabranjuju cancelAtPeriodEnd. Budući servis mora tražiti pozitivan period i poštovati ili zasebno migrirati ovu semantiku; ne poistovjećivati zakazani otkaz i terminalni otkaz. |
| Komercijalna povijest | Postojeća projekcija nije povijest zahtjeva/uplata/ponuda. Potreban je dopunski nepromjenjivi komercijalni zapis i lifecycle zahtjeva, uz postojeći Plan/Subscription; bez paralelnog sustava pretplata. Točan schema diff ide u implementacijski korak. |
| Provedba prava | Pregled `src/application` i `src/infrastructure` ne nalazi Subscription/plan-limit enforcement. Create/publish/import i Public DPP danas ne provjeravaju istek pretplate. Schema default TRIAL nije dokaz aktivnog triala ni seedanih planova. Live redovi/migracije nisu provjereni. |
| Onboarding | [Kontrolirani pristup](CONTROLLED_EARLY_ACCESS_ONBOARDING_STAGING.md): zahtjev → eksplicitno odobrenje → dostava/aktivacija/prijava. Ne koristiti AccessRequest.createdAt, datum odobrenja ili Organization.createdAt kao prešutni početak triala. |
| Billing profil | [Privatni profil](ORGANIZATION_BILLING_PROFILE_IMPLEMENTATION_AND_STAGING_ACCEPTANCE.md), `src/application/billing/contracts.ts`: zasebni podaci za naplatu, CAS revision i audit; nije pretplata ni račun. Promjena profila ne mijenja već prihvaćenu ponudu. |
| Platform Admin | [Read-only pregled](PLATFORM_ADMIN_ORGANIZATIONS_AND_BILLING_OVERVIEW_STAGING.md), `src/application/platform/service.ts`: samo PLATFORM_ORGANIZATIONS_READ. Nije ovlaštenje za uplatu/aktivaciju. |
| Javni prikaz i objava | `public-dpp/get-public-dpp.ts` traži aktivnu organizaciju/proizvod; ARCHIVED passport je NOT_FOUND, WITHDRAWN daje obavijest, ACTIVE traži trenutnu objavljenu verziju. `publish-product/publish-product.ts` čuva staru verziju i zahtijeva ACTIVE postojeći passport. Nema komercijalnog unpublish/release toka. Samo skrivanje QR-a nije oslobađanje mjesta. |
| CSV | [Import](PRODUCT_CATALOG_CSV_IMPORT_STAGING.md): preview/odabir, create-only, 25-redni batch, transakcija i receipt po retku. [Export](PRODUCT_CATALOG_CSV_EXPORT_STAGING.md) izvozi jednu aktualnu verziju; ne obuhvaća cjelovitu povijest, datoteke i sve povezane podatke. Nije potpuna rezervna kopija. |
| Marketing | Hero, pricing CTA i final CTA već koriste getPathname za `/request-access`. Pricing još koristi placeholder ključeve starter/growth/business; nije implementacija ovog cjenika. |

## 3. Potvrđeno — uz preciziranja 2026-09-30

Korisnik je potvrdio ovaj odjeljak i §4 uz preciziranja ispod. Potvrđen ugovor nije dokaz implementacije.

- Trial počinje uspješnom aktivacijom organizacije: tri ukupno kreirana proizvoda,
  uključujući import; arhiviranje ne vraća mjesto. Jedan trial po organizaciji.
- Trial nema produženi javni prikaz. Plaćeni dobrovoljni pasoši ostaju javni još
  šest mjeseci nakon isteka, uz zaključan sadržaj i iste sigurnosne uvjete za assete.
- Privatno čuvanje: 12 mjeseci nakon isteka plaćenog paketa, tri mjeseca nakon triala.
  To su rokovi politike, ne okidači automatskog trajnog brisanja.
- Billing profil ostaje izmjenjiv nakon isteka uz postojeća ovlaštenja; proizvodni
  sadržaj je zaključan. Privatni pregled i raspoloživi izvoz ostaju dostupni tijekom čuvanja.
- Podsjetnici 30/7/1 dan prije isteka te na dan isteka; posebno upozorenje prije
  gašenja javnog prikaza. Preporuka: 30/7/1 dan prije tog gašenja.

| Kvota | Trial | Start | Business | Pro |
| --- | ---: | ---: | ---: | ---: |
| Storage | 100 MiB | 2 GiB | 10 GiB | 50 GiB |
| Ukupni sačuvani Product zapisi (nacrti + objavljeni + arhivirani) | 3 | 100 | 400 | 2000 |
| PDF prilozi po verziji | 5 | 10 | 10 | 10 |

- MiB/GiB su binarne jedinice. Povijesne datoteke ulaze u kvotu; jedan zajednički
  immutable asset unutar organizacije broji se jednom bez obzira na broj veza/verzija.
  Interni backupi i audit ne troše korisničku kvotu. Custom kvote moraju biti eksplicitne.
- Postojeće pojedinačne granice ostaju: PDF 10 MiB; slika JPEG/PNG 8 MiB input/output,
  8192 px po ulaznoj strani, 24 milijuna ulaznih piksela i do 2048 px izlazne strane.
- Obnova prije isteka nastavlja period od postojećeg kraja; nakon isteka počinje
  eksplicitnom aktivacijom. Ne naplaćivati retroaktivni prekid kao aktivni period.
- Upgrade ide po dopunskoj ponudi; preporuka je aktivacija nakon uplate bez pomicanja
  postojećeg kraja, s eksplicitnim iznosom razlike u ponudi (bez skrivenog prorata izračuna).
- Downgrade se ne aktivira dok organizacija ne zadovolji sve kvote manjeg paketa.
  Zahtjev/ponuda mogu postojati; nema brisanja ni trajnog većeg kapaciteta po nižoj cijeni.
  Ako usklađivanje zahtijeva neimplementirani release tok, prikazati taj uvjet.
  Upgrade/downgrade izvršenje nije dio prve implementacijske cjeline.

Regulatorno obavezni DPP traži zasebno definiranu dugoročnu dostupnost. Oznaka koju
korisnik sam odabere ne ukida regulatornu obavezu. Ne primjenjivati automatsko javno
gašenje na obavezni ili nerazjašnjeni slučaj bez zasebno potvrđene politike.
Ovdje se ne utvrđuju sektorski zakonski rokovi niti tvrdi pravna usklađenost.
Automatsko trajno brisanje ostaje isključeno dok ne postoje odgovarajući potpuni
izvoz i provjerena retencijska procedura. Backup retencija nije korisnička retencija.

## 4. Implementacijske odluke i jedan objedinjeni popis potvrda

Odluke potvrđene u jednom prolazu; konkretne live mutacije imaju zasebne granice:

1. **Trial i postojeći staging:** prihvatiti trial i kvote iz §3. Za nove organizacije
   početak bilježiti točno jednom pri uspješnoj aktivaciji; za postojeće napraviti
   eksplicitni operatorski popis prelaska i novi dogovoreni datum, bez nasljeđivanja
   povijesnog createdAt. Organizacijama iznad trial kvota eksplicitno dodijeliti
   vremenski ograničen staging izuzetak ili dogovoreni paket prije enforcementa.
   Neprelazne organizacije se ne zaključavaju tiho; nema trajnog implicitnog bypassa.
2. **Vrijeme:** kalendarski mjeseci u Europe/Zagreb, očuvan lokalni sat i izvorni dan
   (za izvorni kraj mjeseca ostati na kraju mjeseca), clamp na zadnji dan kraćeg mjeseca.
   Sačuvati anchor radi izbjegavanja drifta. Npr. 31.01.2027 + 3 mjeseca = 30.04.2027;
   + sljedeća 3 = 31.07.2027. DST gap pomaknuti naprijed za gap, overlap uzeti raniji
   instant. Pohraniti UTC instants i zonu/anchor; pravo vrijedi u [start,end), istječe
   točno u end, ne na kraju dodatnog dana. Isto pravilo za javni/privatni rok.
3. **Zahtjevi i ovlasti:** OWNER podnosi komercijalni zahtjev, OWNER/ADMIN vide stanje;
   jedan otvoreni zahtjev po organizaciji, izmjena paketa/perioda eksplicitno zamjenjuje
   prethodni. Samo zasebno dodijeljena platform billing-confirm permisija smije
   potvrditi uplatu; postojeći read-only grant nije dovoljan.
4. **Ponuda, obnova, upgrade/downgrade:** prihvatiti §3; ponuda ima rok valjanosti
   30 kalendarskih dana od datuma izdavanja vanjske ponude (ne od naknadnog unosa), prihvaćenu reviziju i eksplicitnu potvrdu korisnika.
   Uplata nakon isteka ponude zahtijeva novu potvrđenu ponudu prije aktivacije.
   Snapshot uključuje cijenu bez PDV-a, porezni tretman/ukupni iznos iz vanjske ponude,
   EUR, period, kvote, javnu/privatnu retenciju, verziju uvjeta i billing profil.
   Novi cjenik ili profil ne mijenjaju prihvaćene uvjete. Custom koristi isti tok.
5. **Javni prikaz i čuvanje:** prihvatiti §3 za dobrovoljne pasoše i editabilni billing;
   obavezne/nerazjašnjene slučajeve usmjeriti na zaseban ugovor dugoročne dostupnosti,
   bez automatskog gašenja ili brisanja. Potvrditi upozorenje 30/7/1 prije gašenja.
6. **Primatelji podsjetnika:** verificirani aktivni OWNER-i i potvrđena billingEmail
   adresa, uz deduplikaciju adrese. Admin podsjetnici idu eksplicitnoj listi billing
   operatora, ne svim read-only administratorima; lista mora biti zadana pri konfiguraciji.
7. **Oslobađanje objavljenog mjesta:** preporuka za prvi opseg: proizvod s nenultim
   currentPublishedVersionId i dalje zauzima jedno mjesto i kad je arhiviran/povučen.
   Arhiviranje, WITHDRAWN ili gašenje javnog prikaza nisu komercijalni release.
   Zamjena verzije ne troši novo mjesto. Zaseban auditirani release/unpublish tok
   nije dio prvog opsega; ovo izbjegava reinterpretaciju postojećeg lifecyclea.
8. **CSV i konkurencija:** zadržati parcijalni uspjeh po retku; prije potvrde pokazati
   dostupnu kvotu, ali bez obećanja rezervacije. Na iscrpljenoj kvoti zadržati uspješne
   retke i jasno vratiti kvotni ishod preostalih, bez upserta, brisanja ili dupliranja.
   Običan create i import troše istu trial/ukupnu kvotu; nacrt ne troši objavljeno mjesto.

Tehnička pravila koja ne zahtijevaju zasebne poslovne blokade:

- Request idempotency key + unique otvoreni zahtjev/CAS; ponovljen isti payload vraća
  isti ishod, različit payload pod istim ključem je konflikt. Potvrda uplate zaključava
  zahtjev i organizacijsku projekciju; komercijalni zapis, Subscription i audit su atomski.
  Dvije potvrde ne smiju produžiti period dvaput. Vanjske reference su jedinstvene u
  eksplicitnom namespaceu izdavatelja/vrste/godine; ne čuvati pune Synesis payloadove.
- Katalog Plan ostaje izvor aktualne ponude; immutable prihvaćeni snapshot je dokaz
  ugovorenih prava za taj period, a Subscription je jedina trenutna projekcija.
  Nema korištenja mutable cijene plana za rekonstrukciju stare ponude.
- Svaka zaštićena mutacija svježe provjerava pravo i rok na serveru. Istek ne ovisi
  o cron poslu, prikazanom countdownu ili zakašnjelom ažuriranju statusa.
- Sve putanje pisanja (create/import, sadržaj/GTIN/materijali/prijevodi, draft,
  publish, PDF/slike/veze) koriste zajedničku provjeru. Organizacijski lock ili
  ekvivalentna atomska rezervacija sprječava da dva zahtjeva potroše posljednje mjesto.
  Receipt replay ne troši kvotu ponovo; preview ne piše. Primijeniti postojeći lock
  order dosljedno da se ne uvede deadlock između importa i pojedinačne operacije.
- Upload traži rezervaciju bajtova prije vanjskog I/O-a; neizvjestan upload ostaje
  rezerviran do provjerene reconciliacije. Brojati stvarno zadržane jedinstvene objekte,
  uključujući povijest i siročad dok nisu provjereno uklonjena; ne oslobađati kvotu
  samo odvajanjem linka. PDF attachment limit provjeriti atomski po verziji.
- Podsjetnici: durable unique ključ (organizacija, period/revizija, prag, kanal,
  primatelj), outbox i bounded retry. Ne obećavati exactly-once vanjski email;
  DELIVERY_UNKNOWN ne slati ponovno naslijepo. Obnova poništava zastarjele podsjetnike.
- Isti vremenski javni gate mora obuhvatiti HTML, PDF, slike i cache invalidaciju;
  ni grace period ne zaobilazi malware/private/public authorization.

### Preciziranja implementacije prve cjeline

- Početna kupovina i obnova istog paketa; bez izvršnog upgrade/downgrade toka.
- Ponude i računi nastaju izvan Passvera. Aplikacija evidentira vanjske reference i
  uvjete, OWNER ih prihvaća, zasebno ovlašten operator potvrđuje uplatu.
- Arhiviranje/povlačenje ne oslobađa mjesto. UI prikazuje **zauzeta objavljena mjesta**,
  ne broj trenutno javno dostupnih proizvoda, uz objašnjenje brojanja.
- Prije live mutacije korisnik potvrđuje točan datum/paket/izuzetak svake postojeće
  staging organizacije, identitet billing operatora i admin email listu. Nema pretpostavki.
- Rana obnova istog paketa čuva tekući početak, kraj i prava; budući potvrđeni period
  evidentira se od prethodnog kraja, bez gubitka preostalih dana. Nema dvostrukog produženja.
- Staging acceptance koristi namensku sintetičku organizaciju i SIMULATED_PAYMENT.
- Globalni entitlement enforcement, automatski podsjetnici, javno gašenje, backup/restore
  i trajno brisanje nisu dio prve cjeline. Sam prikaz kvota nije njihova provedba.

## 5. Backblaze: dokumentirani obuhvat i razina dokaza

Izvori: [DR runbook](../docs/superpowers/runbooks/passvero-postgresql-disaster-recovery.md),
[incident/remediation plan](../docs/superpowers/plans/2026-08-24-stage13b-recovery-service-remediation.md),
[završni Stage 13B izvještaj](../docs/superpowers/reviews/2026-08-24-stage13b-auth-foundation-completion.md).
Lokalni repo ne sadrži izvršivi izvor VPS backup/freshness skripti. Putanje navedene
u planu su `/usr/local/sbin/passvero-postgres-backup` i
`/usr/local/sbin/passvero-backup-freshness`; nisu otvarane na VPS-u.

| Razina | Dokaz i ograničenje |
| --- | --- |
| IMPLEMENTED_IN_SCRIPT | Povijesni plan opisuje dump validation, restic offsite i canonical marker. Aktualni instalirani izvor skripte i točan include/exclude skup: NOT_PROVEN lokalno. Nema lokalno pregledane skripte koja kopira Supabase Storage objekte. |
| CONFIGURED | Runbook dokumentira PostgreSQL `passvero`, custom dump + manifest + checksum + table-of-contents u šifrirani Backblaze B2 restic repo. Dnevno 02:00 UTC + do 10 min randomized delay, Persistent; freshness satno, prag 93.600 s (26 h). Retencija 14 daily / 8 weekly / 6 monthly; recovery evidence 12 mjeseci. To je dokumentirana/povijesna konfiguracija, ne aktualna provjera instalacije. |
| RUNTIME_VERIFIED | Povijesno: završni izvještaj 2026-08-24 potvrđuje controlled backup, novi offsite dokaz, pomak markera i recovery freshness PASS. Raniji failure istog datuma nije konačni status incidenta. Današnji runtime 2026-09-30: NOT_PROVEN; timers-enabled nije dokaz uspješnog backupa. |
| RESTORE_VERIFIED | Povijesno: runbook bilježi isolated PostgreSQL 16 restore skupa `20260818T020055Z` iz B2, schema/data/ACL/constraints/indexes/migrations i manifest counts PASS, 1.695,365 s. Nije današnja provjera ni dokaz restorea kasnijih staging tablica/podataka. Restore Supabase datoteka: NOT_PROVEN. |
| NOT_PROVEN | Aktualni raspored/retencija/freshness, obuhvat staging baze i novijih tablica, kopiranje i vraćanje PDF/slika, kopiranje VPS konfiguracije/tajni u B2, cjeloviti oporavak aplikacije i datoteka. |

**Što dump pokriva:** podatke i objekte jedne PostgreSQL baze, indekse, constraints,
migracije te archive-contained ownership/ACL uz prethodno kreirane role.
**Što ne pokriva:** same Supabase PDF/slikovne bajtove. DB storage key/checksum nije
kopija objekta. Pregledani adapteri `src/infrastructure/storage/supabase-document-storage.ts`
i `supabase-image-storage.ts` služe aplikacijskom upload/download toku, ne B2 replikaciji.

**Konfiguracija:** DR runbook eksplicitno isključuje `postgresql.conf`, `pg_hba.conf`,
cluster-global role definitions/passwords i provider/application/backup credentials
iz single-database dumpa. Za njih traži neovisne recovery inpute i deterministički
bootstrap. To nije dokaz da su konfiguracijske datoteke dodatno kopirane u B2.
Pretpostavka „baza i konfiguracija” stoga je potvrđena samo za dokumentirani DB dio.

RPO 24 h i RTO 4 h su dokumentirani ciljevi; mjerenih 28 min 15,365 s odnosi se
na dohvat/restore/validaciju baze, ne cijeli servis ili Storage.

Točno nedostaje za širu tvrdnju: pregled sanitizovanog include/exclude ugovora i
hasha instalirane backup skripte; aktualna timer/retention konfiguracija; svježi
valid-offsite dokaz i rezultat zadnjeg servisa; eksplicitni dokaz obuhvata staginga;
postojanje joba za kopiranje Storage bajtova s konzistentnim DB manifestom; zaseban
manifest konfiguracijskog backupa bez vrijednosti tajni; isolated file restore s
usporedbom veličina/checksuma i DB referenci. Popis objekata ili korisnički dokumenti
nisu potrebni za ovaj zaključak.

Za traženi **dokumentirani** obuhvat VPS uvid nije potreban: nepoznanice su ostavljene
NOT_PROVEN. Zato nije pripremljen ni pokrenut operatorski blok, backup, restore,
restic, purge ili retention promjena. Aktualna operativna provjera bila bi zaseban
uski read-only korak samo ako se traži aktualni runtime odgovor; ne uvjetuje pisanje
komercijalnog ugovora i ne dopušta obećanje pune zaštite datoteka kupcima.

## 6. Nastavak — najviše tri funkcionalne cjeline

1. **Komercijalni tok:** potvrđeni §4, proširenje postojeće Plan/Subscription osnove za
   3/12 mjeseci, zahtjev/ponuda/snapshot, zasebna billing ovlast, eksplicitna aktivacija,
   idempotency/audit i kontrolirani staging prijelaz. Bez kartica i izdavanja računa.
2. **Prava i kvote:** trial i istek, jedinstveno brojanje proizvoda/asseta, svi mutation
   tokovi i CSV konkurencija, public/file gate, obnova i promjena paketa.
3. **Rokovi i operativna spremnost:** prikaz/podsjetnici/outbox, retencijski statusi bez
   trajnog brisanja; prije obećanja punog recoveryja zasebno dokazati DB + Storage
   backup/restore i potpuni izvoz. Ne ponavljati opću infrastrukturnu reviziju.

Prvobitni dokumentacijski pregled: diff/whitespace PASS, bez aplikacijskih testova.
Naknadna implementacija ima zasebne lokalne i staging dokaze u izvještaju implementacije.


## 7. Potvrđeno za drugu cjelinu — prava, kvote i promjene paketa

Potvrda korisnika 2026-09-30: plaćeni downgrade iznad bilo kojeg nižeg limita na
početku sljedećeg perioda dobiva `BLOCKED_REQUIRES_OPERATOR`. Uplata i prihvaćena
ponuda ostaju nepromjenjivi. Stara prava istječu, nova se ne aktiviraju. Nema
automatskog povrata, kredita, pomicanja perioda ili produženja starih prava.
Razrješenje zahtijeva eksplicitnu auditiranu odluku i prihvaćenu dopunsku/zamjensku
ponudu. UI prije prihvata pokazuje prekoračene limite i posljedice. Blokada ne
ukida prijavu, dozvoljeni pregled/izvoz niti izmjene billing profila. Blokirani
period sam ne produžuje javni rok; ranije stečeni plaćeni grace ostaje zaseban.

Regulatorna klasifikacija proizvoda je `VOLUNTARY`, `MANDATORY` ili `UNRESOLVED`.
Novi i postojeći proizvodi bez potvrde imaju `UNRESOLVED`. Samo zaseban eksplicitni
regulatorni grant dopušta promjenu; billing/read-only ovlast nije dovoljna. Svaka
promjena bilježi razlog, prethodnu/novu vrijednost i identitet operatora. Klasifikacija
vrijedi kroz verzije proizvoda, bez prepisivanja povijesnih snapshotova ili cijena.
Samo potvrđeni VOLUNTARY slijedi trial/plaćeni javni rok. MANDATORY/UNRESOLVED
zahtijevaju zasebno razrješenje/ugovor, bez generičkog komercijalnog gašenja.
Klasifikacija ne daje sadržajna prava, kvote ni besplatnu aktivnu pretplatu.
Publication, tenant, malware i integritet provjere ostaju obavezne.

Točni staging prijelazi, novi regulatorni grant i klasifikacije postojećih proizvoda
čekaju jedan objedinjeni prijedlog ID-jeva i korisničko odobrenje. Podsjetnici ostaju
treća cjelina. Production, stvarne uplate i automatsko brisanje nisu odobreni.


## Usklađenje kontroliranog onboardinga — 2026-10-06

Odobreni zahtjev koji kreira novu organizaciju dodjeljuje njenom prvom korisniku
ulogu OWNER. OWNER podnosi zahtjev za pretplatu i prihvaća ponudu prema postojećem
ugovoru; potvrda uplate i aktivacija plaćenog razdoblja ostaju zasebnom billing
operatoru. Ne uvode se dodatni komercijalni grantovi.

Ovo pravilo ne vrijedi za pridruživanje postojećoj organizaciji i ne promovira
postojeće ADMIN članove. Ponovljeno odobravanje/provisioning ne mijenja članstva
i ne stvara dodatni audit. Ranije aktivirani ADMIN podnositelji zadržavaju
postojeći trial; izričito odobrena pojedinačna promjena uloge zaseban je auditirani
operatorski postupak, uz provjeru identiteta, izvornog zahtjeva i odsustva drugog
OWNER-a. Trial, kvote, podaci i plaćena razdoblja tim se postupkom ne mijenjaju.
