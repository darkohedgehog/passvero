# Objedinjeni staging prijedlog — ODOBREN

Inventar dostavio operator: PASS, writes NONE; passvero_acceptance / 5433 /
/var/lib/postgresql/16/acceptance. Korisnik je potvrdio cijeli prijedlog, točne intervale/limite, enrollment, regulatorni grant i sintetičke acceptance identitete. Ovo odobrenje nije dokaz izvršene promjene. Prije izvršenja obavezna je ponovna provjera inventara i ciljne baze.

## Postojeće organizacije

Konačni testni izuzeci niže vrijede od 2026-09-30T00:00:00Z do
2026-10-31T00:00:00Z, isključivi kraj (Zagreb: 30.09. 02:00 do 31.10. 01:00).
Početak je eksplicitni predloženi datum testne politike, ne tvrdnja o ranijoj
aktivaciji/uplati. enrolledAt/audit bilježe stvarni trenutak operatorovog izvršenja.
Nema automatskog produženja niti triala izvedenog iz createdAt.

| ID / naziv | Inventar | Predloženi prelaz |
| --- | --- | --- |
| 6d686789-6379-4824-ae02-df97043cbbc0 / Živić-elektro - staging test | 0 proizvoda; bez pretplate | Konačan staging izuzetak s limitima Start; bez triala i bez plaćenog perioda |
| bdc5aed5-b05a-42e6-895b-9f2f9f8a79a0 / Passvero Acceptance | 9 proizvoda, 5 mjesta, 9104 B, max 1 PDF/verzija; bez pretplate | Isti konačan staging izuzetak s limitima Start; bez triala i bez plaćenog perioda |
| ffe171d1-b6a6-43d5-83bb-890e2fa23c9f / SYNTHETIC — Subscription commercial acceptance | Start ACTIVE | Evidentirati enrollment bez triala/izuzetka; zadržati postojeći SIMULATED_PAYMENT period 2026-09-30T13:22:05.515Z–2026-12-31T14:22:05.515Z |

Limiti oba izuzetka: 25 zauzetih objavljenih mjesta, 100 sačuvanih proizvoda,
2147483648 B storagea, 10 PDF priloga/verzija. Izuzetak nije kupljen Start paket niti
nova uplata. Po isteku, bez drugog važećeg prava, sadržajne izmjene se zaključavaju;
prijava, dozvoljeni read/export i billing profil ostaju dostupni.
Ne mijenjati članstva postojećih organizacija.

## Zasebna regulatorna ovlast

Dodati PlatformRegulatoryGrant računu zivic.darko79@gmail.com,
User ID 40e51001-912c-4bcf-aa45-d866632aac85. Provjeriti točan ID/email i aktivni verified
identitet prije upisa. Audit mora zabilježiti eksplicitnu operatorsku odluku.
Postojeći billing/read-only grantovi se ne mijenjaju. Račun
prodaja@zivic-elektro.com (cbb590fa-1c67-41bf-883d-c2eb96bf6edb) ne dobiva regulatornu ovlast.

## Postojeći proizvodi

Svih devet ostaje UNRESOLVED (aditivna migracija postavlja default; nema tvrdnje o
potvrđenoj regulatornoj klasifikaciji). Ne klasificirati ih kao VOLUNTARY ili MANDATORY:

- 130a0dca-904f-4761-a041-739572652d17
- 183d8c53-f3ab-4aae-911a-405b166ada31
- 2beb96a0-ac51-43d7-b626-ffcaebe01196
- 2c87a2c7-8d2e-422d-9a20-cb029031d04c
- 45ad6142-69d3-4a46-aeba-9902b3f9c756
- 49b7356c-ce50-4e65-b682-51548bfbf16a
- 5a666fc3-bff4-41d1-8c91-e433f08c4444
- c1c24c7c-334b-48bf-ba34-ac5fb930f1c2
- f050e6a0-5c4d-4451-8c23-8fb87f459f56

Javni komercijalni grace ih generički ne gasi. Publication, malware, integritet i
privatnost ostaju obavezni; UNRESOLVED ne daje pravo uređivanja ili dodatne kvote.
VOLUNTARY klasifikaciju za test javnog isteka primijeniti samo na nove jasno
sintetičke testne proizvode, uz razlog i audit potvrđenog regulatornog operatora.

## Izvršenje nakon potvrde

1. Pinovati pregledani source/artefakt i provjeriti da inventar nije driftovao.
2. Primijeniti aditivne migracije i minimalne runtime ACL-ove; bez pokretanja novog runtimea prije enrollmenta.
3. Atomski/idempotentno upisati odobrene enrollmente/izuzetke i zasebno auditirani regulatorni grant.
4. Deploy i ograničeni sintetički acceptance po glavnom planu. OWNER novih sintetičkih
   organizacija je prodaja@zivic-elektro.com; billing/regulatory operator je potvrđeni Gmail račun.
   Kontrolisani fixture datumi služe samo demonstraciji granica; bez promjene sata,
   prepisivanja starih perioda ili stvarnih uplata. Nove uplate označiti SIMULATED_PAYMENT.
5. Evidentirati točne zadržane fixture ID-jeve i odvojiti lokalni/live dokaz; rollback ne izvršavati radi PASS-a.

Privilegovane korake dostaviti kao potpune VPS TERMINAL / PENDING_OPERATOR_COMMAND blokove.
Ne izvršavati sudo samostalno. Production, podsetnici, automatsko brisanje, commit i push nisu odobreni.
