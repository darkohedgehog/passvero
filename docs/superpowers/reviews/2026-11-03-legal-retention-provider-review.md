# Passvero — pravni pregled, rokovi čuvanja i pružatelji

Datum analize: **3. studenoga 2026.** Lokalni nacrt za pregled prije objave. Nije potvrda potpune usklađenosti niti zamjena za pregled konkretnog ugovora od ovlaštene osobe. Nema commita, pusha, objave, izmjene provider računa, brisanja podataka ili produkcijske promjene.

## 1. Rezultat i granice

Pregledani su postojeći pravni tekstovi i poslovne odluke, aplikacijske kategorije podataka, službeni HR/EU izvori te javni uvjeti pet pružatelja. Lokalne Pravila privatnosti, Uvjeti korištenja i Pravila o kolačićima postoje na HR, SR latinici, EN, DE, SL i PL; dopune zadržavaju postojeći UI. Oznaka cijena bez PDV-a ostaje nepromijenjena iz već odobrene lokalne implementacije.

**Zaključak za objavu: REVIEW_REQUIRED.** Tekst je konkretniji i usklađen s utvrđenim pravilima, ali sam tekst ne dokazuje provedeno brisanje, prihvaćen DPA, dopuštenost svakog međunarodnog prijenosa ili potpunost izvoza. Te razlike nisu razlog za novi sustav ili ponovno testiranje deploymenta. Završne radnje su u §7.

Pružatelj: **Živić-elektro j.d.o.o.**, 204. vukovarske brigade 39, 32000 Vukovar, Hrvatska, OIB **90344764519**, **MBS 030125449**, **Trgovački sud u Osijeku**. Adresu s kućnim brojem 39, MBS i sud potvrdio je vlasnik u ovom razgovoru; broj 30 u ranijem obrazloženju bio je netočan. Kontakt **contact@passvero.eu**, nije oznaka imenovanog DPO-a. Podaci su uneseni u svih šest verzija Uvjeta.

### Potvrđena dostava računa — dopuna vlasnika

- **Korisnici u Hrvatskoj:** eRačun kroz **MER, Elektronički računi d.o.o.**
- **Korisnici izvan Hrvatske:** račun u **PDF formatu** emailom na adresu koju su naveli u podacima za naplatu, preko potvrđenog Hostinger email servisa.
- Time je razjašnjen kanal izdavanja/dostave i konkretan dodatni primatelj računskih podataka. Nije uvedena niti pretpostavljena automatska MER integracija u Passvero aplikaciju. Postojeći Synesis proces ostaje zaseban.
- Država kupca ili naziv MER ne dokazuju sami po sebi ispunjenje fiskalizacijskog uvjeta za poseban rok čuvanja. Za domaći eRačun primjenjuje se #9 kada je uvjet ispunjen; inozemni PDF nije zbog email dostave oslobođen računovodstvene retencije. Nema novog traženja potvrde već navedenih kanala.

### Što je već potvrđeno, a što nije

- **Poslovna politika:** već potvrđeni rokovi u starom nacrtu §12.2–12.4. Ne traži se ponovno isto odobrenje. Povijesni nacrt ostaje sačuvan, ovaj datirani pregled dopunjuje njegove otvorene pravne točke.
- **Operativna provedba:** cjelovit purge naloga, requesta, audita, logova, mailboxa i svih kopija nije potvrđen ovim zadatkom. Istek tokena ili prava pristupa nije brisanje evidencije.
- **Dopuna poslovne odluke 3.11.2026.:** vlasnik je izričito prihvatio ranije prijedloge #14/#16/#18/#25. Sada su potvrđena poslovna politika, unesena i u šest javnih nacrta. To nije potvrda zakonskog minimuma, tehnički provedenog brisanja ili odobrenje brisanja podataka.
- **Zakonski rok:** primjenjuje se na određenu vrstu isprave i događaj. Nije opći rok za sve podatke iste organizacije.

## 2. Uloge i opseg osobnih podataka

| Obrada | Uloga i osnova | Važna granica |
|---|---|---|
| Pristup, kontakt predstavnika, vlastiti račun i ovlasti | Passvero voditelj; priprema/izvršenje ugovora samo za osobu koja je stranka; za predstavnike pravne osobe primarno opravdani poslovni/sigurnosni interes | Potrebna razmjernost, dokumentirana svrha i mogućnost prigovora; poslovni email i OIB fizičke osobe mogu biti osobni podaci. |
| Ponuda, prihvat, plaćanje, vlastiti račun | Passvero voditelj; ugovor/legitimni interes te zakonska obveza za odgovarajuće evidencije | Nisu svi offer/payment zapisi knjigovodstvene isprave. Synesis je zaseban, lokalni proces bez aplikacijske integracije. |
| Proizvodi, proizvođački kontakti, prijevodi, slike, PDF, DPP verzije | Organizacija određuje svrhu i zakonitost; Passvero u pravilu izvršitelj/podizvršitelj prema stvarnim ulogama | Potreban sadržajan ugovor iz čl. 28. GDPR-a; javna politika nije taj ugovor. Klijent mora imati ovlasti za podatke i objavu. |
| Audit, zaštita od zlouporabe i tehnički zapisi | Vlastita sigurnost/operativna odgovornost te ugovorene upute prema stvarnoj svrsi | Pseudonimni HMAC identifikator nije automatski anoniman; zadržati nužan minimum. |
| Pregled javnog DPP-a | Javna isporuka objavljene verzije i tehnički zahtjev posjetitelja | Javna objava ne ukida GDPR. Preuzete kopije trećih osoba nisu pod potpunom kontrolom Passvera. |
| Turnstile | Cloudflare ima procesorsku i zasebnu voditeljsku svrhu prema svojem Addendumu | Sigurnosno izuzeće za kolačiće nije opće izuzeće od GDPR-a i informiranja. |
| Tehnički alarm operatoru na Telegram | Ograničena operatorska komunikacija; Telegram vlastiti voditelj | Ne pretpostaviti ugovor iz čl. 28., end-to-end šifriranje bot chata ili dopuštenost slanja klijentskih dokumenata. |

Za legitimni interes dovoljno je kratko dokumentirati svrhu, nužnost i balans prava za postojeće obrade, ne graditi novu aplikaciju. ROPA treba opisati stalne SaaS obrade i podizvršitelje; veličina malog društva sama po sebi ne daje opće oslobođenje. DPO/DPIA ne proglašavaju se obveznim niti nepotrebnim bez provjere zakonskih kriterija.

## 3. Tablica rokova čuvanja

**Legenda:** P = vlasnički potvrđena poslovna politika, uključujući dopunu od 3.11.2026.; Z = zakonski minimum uz navedenu klasifikaciju; O = konkretan podatak/provedba otvoreni. Dani su obični dani, mjeseci kalendarski. Rokovi služe pregledu i dopuštenom uklanjanju; ne daju ovlast za zaobilaženje FK, append-only ili pravnih obveza. Zahtjev ispitanika može zahtijevati ranije uklanjanje; cilj nije obvezni minimum osim Z. Zadržavanje izvan osnovnog roka mora imati razlog, opseg, ograničen pristup i sljedeći pregled.

| # | Kategorija | Rok i početni događaj | Završna radnja / iznimka | Status i provedba |
|---|---|---|---|---|
| 1 | Pristup bez odluke | Pregled 90 dana od primitka | Zatvoriti zastarjelo i ukloniti suvišni kontakt/payload; aktivna korespondencija samo uz razlog i novi datum | P; pregled nije dokazani automatski purge |
| 2 | Odbijeni pristup | 6 mjeseci od odluke | Minimizirati/nepotrebno ukloniti; minimalni dokaz odluke odvojeno po #10 | P; puna provedba O |
| 3 | Odobreni pristup, redundantni request | 6 mjeseci od završene aktivacije; ako nije aktiviran, pregled do 30 dana od isteka intenta | Sačuvati potrebne approval/activation veze, ukloniti suvišni payload | P; ne ponovno bootstrapirati račun |
| 4 | Profil, vjerodajnice, članstva | Aktivni odnos i dopušten pristup; nepotrebno ukloniti do 30 dana od dovršenog zatvaranja | Odmah opozvati relevantan odobreni pristup; druga članstva, zadnji OWNER i pravni dokazi zasebno | P; nema potvrđenog cjelovitog account-delete toka |
| 5 | Sesije | 30 dana od isteka/opoziva, kasnijeg primjenjivog događaja | Ukloniti nepotrebnu evidenciju; sigurnosni minimum izdvojiti | P; serverska valjanost oko 24 h nije purge |
| 6 | Aktivacija / verifikacija / reset | 30 dana od isteka/potrošnje, kasnijeg zabilježenog završetka | Opozvati mogućnost pristupa kad prestane svrha; token nije potreban trajni dokaz | P; valjanost 72 h / 24 h / 30 min nije retencija |
| 7 | Izmjenjivi billing profil | Do 30 dana od potpunog kraja odnosa, ako nema obnove/obveze | Minimizirati profil; izvorni račun i prihvaćeni snapshot ne prepisivati | P; snapshoti #8–9 zasebni |
| 8 | Knjigovodstvene isprave za dnevnik/glavnu/pomoćne knjige | Najmanje 11 godina od kraja relevantne poslovne godine, osim posebnog fiskalizacijskog pravila | Knjigovođa klasificira izvornike i kopije; zadržati vjerodostojnost | Z, čl. 10. računovodstvenog zakona s izmjenom 151/25; stvarna klasifikacija O |
| 9 | Izvorni izdani/primljeni fiskalizirani eRačuni | Posebno 6 godina od kraja godine izdavanja | Samo ako je provedena zakonska fiskalizacija; običan PDF nije dovoljan | Z, čl. 35. Zakona o fiskalizaciji; Synesis vrstu potvrđuje računovođa |
| 10 | Operativni audit / minimalni proof odluke | 12 mjeseci od događaja | Pregled/minimizacija; prihvat, plaćanje ili regulatorni dokaz ide u vlastitu klasifikaciju, ne produžuje sav audit | P; append-only se ne zaobilazi, provedba O |
| 11 | Delivery/outbox/admin obavijesti | 90 dana od terminalnog ishoda nakon zadnjeg pokušaja | Minimizirati primatelja/payload; DELIVERY_UNKNOWN pregled svakih 30 dana bez automatskog resenda | P; stvarni cleanup O |
| 12 | Abuse bucket | 30 dana od zadnjeg pokušaja | Ukloniti nakon prestanka potrebe; odvojiti opravdani incident proof | P; expiry potvrđen u ranijem inventaru, cleanup O |
| 13 | Web/app/PG/SMTP log | 30 dana od svakog zapisa | Rotacija/minimizacija; ne spremati osjetljivi payload u log | P; stvarna lokalna/provider rotacija O |
| 14 | Izdvojeni dokaz incidenta | Do 6 kalendarskih mjeseci od razrješenja | Samo nužni dokaz; ako spor/obveza traži dulje, obrazloženi hold | P — vlasnik prihvatio 3.11.2026.; nije opći rok logova, provedba O |
| 15 | Telegram tehničke poruke | 90 dana od poruke | Dopušteno ukloniti suvišno; incidente izdvojiti | P; klijentski dokumenti se ne šalju, provider kopije O |
| 16 | Neprihvaćena/istekla ponuda bez drugog događaja | 6 kalendarskih mjeseci od isteka ili izričitog odbijanja | Ostaviti samo minimalni dokaz ako konkretno potreban; pregovori imaju razlog/novi datum | P — vlasnik prihvatio 3.11.2026.; rok valjanosti ponude 30 dana nije rok čuvanja, provedba O |
| 17 | Prihvaćene ponude, ugovor, reference plaćanja | Prema #8/#9 ako su odgovarajuće isprave; inače evidencija potrebna za konkretne ugovorne zahtjeve | Kartirati dokument, dospijeće i relevantnu zastaru s računovođom/pravnikom | O; B2B zastara nije automatski rok brisanja cijelog ugovora |
| 18 | Rutinska podrška / mailbox bez financijskog ili drugog posebnog dokaza | 12 kalendarskih mjeseci od zatvaranja predmeta | Izdvojiti ugovorni, incidentni ili zakonski dokaz u odgovarajuću kategoriju | P — vlasnik prihvatio 3.11.2026.; ne dodavati globalni mailbox purge, provedba O |
| 19 | Privatni proizvodni podaci plaćenog paketa | 12 mjeseci od isteka paketa | Upute organizacije, izvoz i relevantne obveze; brisanje osobnih podataka procjenjuje se zasebno | P; privatni rok nije javni grace niti dokazana automatika |
| 20 | Privatni podaci probnog razdoblja | 3 mjeseca od završetka triala | Kao #19, bez pretvaranja u neograničen hosting | P; provedba O |
| 21 | Javne dobrovoljne objave | Plaćeni paket: još 6 mjeseci od isteka; trial: bez dodatnog razdoblja | Prestanak javnog pristupa nije isto što i privatno brisanje | P; obvezni/nerazjašnjeni sektorski slučaj traži zaseban ugovor/propis |
| 22 | Izvozni radni/dostavni paket | Pristup 7 dana od obavijesti; nepotrebne kopije ukloniti do 30 dana nakon isteka pristupa | Ako pristup nije otvoren, datum uklanjanja odrediti do 30 dana od odluke o neuspjeloj dostavi | P politika; potpuni sigurni izvozni alat NIJE potvrđen; ne tvrditi da CSV pokriva sve |
| 23 | Sigurnosne kopije, verzije, pinovi | Nema potvrđenog najduljeg roka nestanka svakog podatka iz svih kopija | Raniji plan 14 dnevnih / 8 tjednih / 6 mjesečnih nije maksimalna starost podatka; provjeriti stvarno istrošenje relevantnih kopija | P plan; O stvarni krajnji rok. Ne mijenjati popravljen backup ni pinove |
| 24 | Recovery/operativni dokaz | Ranija politika 12 mjeseci od dokaza | Sačuvati samo nužno; bez credentiala ili nepotrebnog korisničkog sadržaja | P; ne izjednačiti s kopijom cijele baze |
| 25 | Dokaz odgovora na GDPR zahtjev | 3 godine od zaključenja predmeta | Minimalni zahtjev, odluka, datumi i dokaz slanja; nema cijelog izvoza ni rutinske kopije osobne iskaznice; ranije uklanjanje kada svrha prestane | P — vlasnik prihvatio 3.11.2026.; nije propisani GDPR rok, provedba O |

**Hold nije opće opravdanje za beskonačno čuvanje.** Pregled najkasnije svakih 30 dana već je poslovno potvrđen. Čuvati samo pogođeni skup, razlog, pravnu osnovu, odgovornu osobu i sljedeći datum. Kada svrha prestane, vratiti ga u odgovarajući raspored.

**Zastara nije retencija.** Čl. 228. ZOO uređuje određene međusobne B2B tražbine s trogodišnjim rokom po isporuci/usluzi. Prekid, zastoj, priznanje duga, spor ili druga vrsta tražbine mijenjaju analizu. Ne koristiti univerzalno „tri/pet godina nakon zatvaranja” za sve podatke. Potvrđeni poslovni rok iz #25 nije zaključak da zakon nalaže upravo taj rok.

**Kopije i oporavak:** ograničiti pristup starijim kopijama; nakon oporavka ponovno primijeniti dokumentirane zahtjeve za uklanjanje/ograničenje prije redovne uporabe. Zabilježiti kada zadnja relevantna kopija istječe; ne obećavati trenutno fizičko uklanjanje iz svih provider kopija.

## 4. Pružatelji i javni ugovori

To su pregledani javni uvjeti, **ne potvrđeno prihvaćeni ugovori konkretnog računa**. Primarne lokacije i uporabu potvrdio je vlasnik. SMTP aplikacijskih i mailbox poruka koristi isti Hostinger servis — stari upit o tome je zatvoren.

| Pružatelj / namjena / primarna lokacija | Službeni izvor i nalaz | Što treba potvrditi u postojećim dokumentima računa |
|---|---|---|
| Hostinger — VPS/PG, mailbox i SMTP; Njemačka | [DPA](https://www.hostinger.com/legal/dpa), 29.9.2026.; VPS/email uključeni, SCC moduli 2/3; §11 povrat prije prestanka, brisanje 30 dana nakon prestanka uz posebne uvjete usluge. Podizvršitelji u Appendix 3. | Stvarni Hostinger ugovorni subjekt, prihvaćena verzija, podizvršitelji emaila, obavijesti i primjenjivi transfer mehanizam; pravo izvoza prije otkaza. |
| Supabase — privatni PDF/slike Storage, ne aplikacijska DB/Auth; Irska | [DPA](https://supabase.com/legal/customer-resources/data-processing-addendum), v1 1.8.2026.; odabrana regija je primarna obrada, ne EU-only. SCC moduli 2/3. §11.2 povrat zatražiti unutar 30 dana od isteka ugovora, potom brisanje. [Podizvršitelji](https://supabase.com/legal/customer-resources/subprocessor-list), [lokacije/prijenosi](https://supabase.com/legal/privacy-resources/data-residency-and-transfers-faq). | DPA i regija konkretnog računa, podrška/povezani subjekti, pretplata na obavijesti (30 dana najava, 5 dana za prigovor prema javnom tekstu). |
| Backblaze B2/restic — kopije; Amsterdam | [ToS 16.4.2026.](https://www.backblaze.com/company/policy/terms-of-service), aktualni [M2 DPA](https://f001.backblazeb2.com/file/backblaze-policies/Backblaze-DPA-Module-2-C2P-with-Transfer-Terms.docx.pdf) i [M3 DPA](https://f001.backblazeb2.com/file/backblaze-policies/Backblaze-DPA-Module-3-P2P-with-Transfer-Terms.docx.pdf); SCC, povrat/brisanje po prestanku prema izboru uz zakonske iznimke. Nije utvrđen jedan univerzalni broj dana za potpuno brisanje. [Podizvršitelji](https://www.backblaze.com/company/policy/subprocessors). | Primjenjivi modul za vlastite i klijentske podatke, ugovorni račun, regija, lifecycle/verzije/hold, relevantni transferi. Stari DPA iz 2022. nije jedina mjerodavna osnova. |
| Cloudflare Turnstile — sigurnosni challenge | [Posebni Addendum 18.6.2025.](https://www.cloudflare.com/turnstile-privacy-policy/) razlikuje zaštitu stranice kao procesor i unapređenje detekcije kao vlastitu voditeljsku svrhu. [DPA](https://www.cloudflare.com/cloudflare-customer-dpa/) predviđa globalnu obradu i SCC; [podizvršitelji](https://www.cloudflare.com/gdpr/subprocessors/). Nije utvrđen fiksni rok u posebnom Addendumu. | Uvjeti konkretnog widgeta/računa, Enable pre-clearance i clearance_level, stvarni aktivni storage i razmjernost sigurnosne uporabe. Ne izmišljati trajanje cf_clearance. |
| MER, Elektronički računi d.o.o. — dostava domaćih eRačuna | [Službeni Opći uvjeti](https://mer.hr/wp-content/uploads/2026/03/Opci-uvjeti-poslovanja_mer.pdf), doneseni 14.11.2025., razlikuju razmjenu, fiskalizaciju i arhiviranje kao usluge. [Izjava o privatnosti](https://mer.hr/izjava-o-zastiti-podataka/) i [povezani PDF](https://mer.hr/wp-content/uploads/2026/03/Izjava-o-privatnosti-i-sigurnosti-osobnih-podataka.pdf) opisuju podatke računa te obradu po konkretnom ugovoru. | Uporaba je USER_CONFIRMED. Pregledati samo prihvaćeni ugovor/DPA, konkretno ugovorene usluge i dostupnost izvornika; ne pretpostaviti arhivski paket, određeni rok svih kopija, lokaciju ni univerzalnu ulogu izvršitelja. |
| Telegram — statusni alarm operatoru | [Privacy Policy](https://telegram.org/privacy), prikazani zadnji zapis 21.8.2026.; vlastiti voditelj, relevantni međunarodni grupni prijenosi; [Bot Terms](https://telegram.org/tos/bot-developers). Bot chat nije dokazan E2E kanal ni Art.28 odnos za Passvero. | Ograničenje samo na tehničke metapodatke; pravila uklanjanja operatorskih poruka. Ne slati klijentske priloge/credentale ili proširiti uporabu ovim zadatkom. |

Za Hostinger novi podizvršitelji: javni §6.3 predviđa mogućnost otkaza u 10 dana od primitka obavijesti. Cloudflare javni DPA predviđa najmanje 30 dana najave i 10 dana za prigovor; Backblaze aktualni moduli najmanje 30 dana prethodne pisane obavijesti. Potrebno je pratiti stvarno primljene obavijesti, ne računati rok od ovog pregleda.

Ugovorno objavljen SCC mehanizam nije dokaz da je svaki prijenos zakonit. Za konkretni tok utvrditi stranke, uloge, odredišta/pristupe i mjere te procijeniti treba li dodatna procjena prijenosa/zaštita. Lokacija servera, ugovorna jurisdikcija i pristup podrške različite su stvari. Provider rok nakon otkaza usluge nije rok brisanja pojedinog Passvero korisnika.

## 5. Propisi i primjena na nacrt

### Privatnost i kolačići

[GDPR](https://eur-lex.europa.eu/legal-content/HR/TXT/?uri=CELEX:32016R0679), čl. 5/6/12–14/17–22/28/30/32/44 nadalje: ograničenje svrhe i čuvanja, stvarna osnova, razumljivo informiranje, prava, procesorski ugovor i transferi. [EDPB za mala poduzeća](https://www.edpb.europa.eu/sme/learn-the-basics/data-protection-basics_en) i [smjernice o ulogama](https://www.edpb.europa.eu/system/files_en?file=2023-10%2FEDPB_guidelines_202007_controllerprocessor_final_en.pdf) primjenjuju se prema stvarnim činjenicama. [AZOP o politici](https://azop.hr/informiranje-ispitanika-o-obradi-njegovih-osobnih-podataka-politika-privatnosti/) traži određene rokove ili dovoljno razumljive kriterije; politika nije sama pravna osnova.

Rok odgovora na prava je jedan kalendarski mjesec, uz uvjetno produljenje za još dva i obrazloženu obavijest u prvom mjesecu. To nije 30-dnevni interni cleanup. Identitet provjeriti razmjerno, bez lozinki i rutinskog kopiranja osobnih iskaznica. Za podatke klijenta identificirati odgovarajućeg voditelja i pomoći po ugovoru; ne odbiti ispitanika samo zato što nema račun.

Čl. 43(4) [Zakona o elektroničkim komunikacijama NN76/22](https://narodne-novine.nn.hr/clanci/sluzbeni/2022_07_76_1116.html), uz [izmjene NN45/26](https://narodne-novine.nn.hr/clanci/sluzbeni/2026_04_45_523.html), i [AZOP-ove smjernice](https://azop.hr/obrada-osobnih-podataka-kolacici/) razlikuju nužno od uporabe koja zahtijeva prethodnu privolu. Nema novog consent bannera bez konkretne nenamjenske tehnologije. NEXT_LOCALE je isključen; autentikacijska sesija ne postaje marketing cookie zato što je opisana u pravilima. Turnstile aktivni challenge/pre-clearance ostaje konkretan nedovršeni pregled, ne jamstvo odsutnosti cookiesa.

### Računovodstvo i ugovorna odgovornost

Pregledan je [Zakon o računovodstvu NN85/24](https://narodne-novine.nn.hr/clanci/sluzbeni/2024_07_85_1474.html), izmjene [145/24](https://narodne-novine.nn.hr/clanci/sluzbeni/2024_12_145_2372.html), [151/25](https://narodne-novine.nn.hr/clanci/sluzbeni/full/2025_12_151_2254.html) i [59/26](https://narodne-novine.nn.hr/clanci/sluzbeni/full/2026_06_59_727.html), te [Zakon o fiskalizaciji NN89/25](https://narodne-novine.nn.hr/clanci/sluzbeni/2025_06_89_1233.html). Razlika konkretnih kategorija je u #8–9. Dostava domaćih eRačuna kroz MER i inozemnih PDF računa emailom sada je potvrđena. Knjigovođa potvrđuje pripadajuće izvornike, fiskalizaciju i klasifikaciju knjiga/drugih isprava, uključujući Synesis i MER kopije. Ponuda sama po sebi nije nužno ista kategorija.

Čl. 345. [ZOO](https://narodne-novine.nn.hr/clanci/sluzbeni/2005_03_35_707.html) ne dopušta unaprijed isključiti/ograničiti namjeru i krajnju nepažnju; nova izričita rezervacija dodana je u šest Uvjeta. Nije uveden proizvoljan cap odgovornosti niti blanketno isključenje zakonskog povrata/štete. [Izmjene NN69/26](https://narodne-novine.nn.hr/clanci/sluzbeni/2026_06_69_833.html) imaju odgođene odredbe o odgovornosti za neispravan proizvod do 9.12.2026.; one nisu predstavljene kao već važeće 3.11.2026.

### Pružatelj, objava sadržaja i izlazak iz usluge

Čl. 6. [Zakona o elektroničkoj trgovini](https://narodne-novine.nn.hr/clanci/sluzbeni/2003_10_173_2504.html) traži dostupne identifikacijske/kontaktne podatke i jasne cijene. MBS/sud sada su dopunjeni korisnikovom potvrdom. Postojeći iznos u EUR i objašnjenje bez PDV-a ostaju za poslovnu ponudu; ne predstavljaju automatski prihvat ugovora ili stvarni PDV status pojedine transakcije. Provjera punih trgovačkih obveznih podataka (uključujući podatke koje ZTD traži u konkretnoj uporabi) ostaje prije objave; ne izmišljati kapital, članove uprave ili PDV ID.

[DSA](https://eur-lex.europa.eu/eli/reg/2022/2065/oj/eng) i [hrvatski provedbeni zakon NN67/25](https://narodne-novine.nn.hr/clanci/sluzbeni/2025_04_67_857.html): hosting klijentskog javnog sadržaja zahtijeva konkretnu klasifikaciju. Mali poduzetnik nema automatsko izuzeće od svih hosting obveza. Nacrt sada daje postojeći email za prijavu, točnu poveznicu/razlog i mogućnost ljudskog pregleda, ali to nije dokaz potpuno usklađenog čl.16 mehanizma ili automatska odluka da je Passvero „online platforma”. Nije dodan portal ili moderacijski feature.

[Data Act — službeno objašnjenje Komisije](https://digital-strategy.ec.europa.eu/en/factpages/data-act-explained), [sažetak Uredbe 2023/2854](https://eur-lex.europa.eu/EN/legal-content/summary/rules-on-fair-access-to-and-use-of-data-data-act.html): primjenjuje se od 12.9.2025.; za obuhvaćene usluge obrade podataka postoje obvezna pravila promjene pružatelja. Potrebno je utvrditi obuhvat ovog SaaS-a i ugovorni izlazni postupak. Ne koristiti „CSV nije potpun” kao odricanje od obveznih prava. U šest verzija dodana je rezerva tih prava; nije izmišljena funkcija potpunog izvoza. Ukidanje switching naknada od 12.1.2027. je budući datum, ne već važeći događaj ovog pregleda. Prijedlog Digital Omnibus nije korišten kao važeći zakon.

## 6. Što je promijenjeno u šest tekstova

- Uvjeti: MBS i sud; obvezna odgovornost, razmjerne prijave/ljudski pregled i očuvanje obveznih prava pri izvozu/promjeni pružatelja.
- Privatnost: konkretni već potvrđeni operativni rokovi i početni događaji; financijska klasifikacija, SCC informiranje bez EU-only tvrdnje, Storage-only Supabase i stvarna uloga Telegrama.
- Kolačići: postojeći oprezni tekst zadržan; ne dodaje se banner ni neprovjeren rok vanjskog cookieja. UI, price oznaka, rute i funkcionalnost nisu dodatno mijenjani.
- Poslovne rokove #14/#16/#18/#25 vlasnik je prihvatio 3.11.2026. i dodani su u šest javnih nacrta; ostaje izričita razlika između poslovne politike, zakonskog minimuma i nepotvrđene tehničke provedbe.
- Nije odabrana isključiva sudska nadležnost ni mjerodavni jezik, nisu mijenjani pretplatni komercijalni uvjeti, niti dodana privola kao univerzalna osnova.

## 7. Konačne odluke prije objave — jedan pregled, bez novog razvoja

| Nositelj | Konkretno što treba završiti | Zašto / završni rezultat |
|---|---|---|
| Vlasnik + računovođa | Klasificirati stvarne račune/knjige i offer/payment dokaze prema #8/#9/#17; poslovni rokovi #14/#16/#18/#25 već su prihvaćeni i ne traže novo vlasničko odobrenje | Jedan raspored s ispravnim početkom, bez jednog roka za sve financijske podatke |
| Vlasnik/operator | Potvrditi kako se već odobreni rokovi stvarno provode ručno ili postojećim alatima, stvarnu rotaciju i maksimalnu relevantnu backup starost | Javna politika ne smije prikriti neograničenu stvarnu retenciju. Ne pokretati brisanje ni mijenjati backup u ovom zadatku |
| Vlasnik + pregled postojećih account ugovora | Stvarna pravna osoba, prihvaćen DPA/moduli, podizvršitelji i transferi za Hostinger/Supabase/B2/Cloudflare/MER; zadržati Telegram u ograničenoj ulozi | Kratak dovršen popis izvršitelja/transfera. Javna stranica pružatelja nije dokaz prihvaćenog ugovora |
| Vlasnik/operator | Pre-clearance i clearance_level postojećeg widgeta i ponašanje aktivnog izazova | Dovršiti stvarni cookie inventar bez automatskog consent featurea |
| Vlasnik + pravni pregled | Završiti postojeći klijentski Art.28 DPA i potvrditi DSA/Data Act obuhvat, izlazna prava, poslovne uvjete i sve obvezne podatke društva; provjeriti jezičnu ekvivalenciju | Jedan konkretan završni redline/odluka prije objave, ne certifikat potpune usklađenosti |

DPA pregled mora obuhvatiti predmet/trajanje/svrhu, kategorije osoba/podataka, dokumentirane upute, povjerljivost, sigurnost, daljnje izvršitelje, pomoć pri pravima/incidentima, povrat/brisanje i revizije. Ne pretpostaviti da opis u politici ili provider DPA nadomješta ugovor Passvero–klijent.

Za ručni zahtjev koristiti postojeći kontakt i operatora: evidentirati primitak i rok, razmjerno provjeriti identitet, izdvojiti pogođene kategorije i uloge, utvrditi uske iznimke, sigurno predati/ukloniti ono za što postoje ovlasti i provediv postupak te pravodobno odgovoriti i na djelomično odbijanje. Ne obećavati nepostojeći potpuni export ili cjelovit purge. Nove tehničke alate razmatrati samo ako taj konačni pregled pokaže konkretan nepokriven slučaj.
