# Instrukcja API — Universal qPCR Analysis 0.22.0

## Jaki interfejs jest dostępny?

Wydanie zawiera aplikację przeglądarkową i API modułów JavaScript (ES modules).
Analiza odbywa się lokalnie. Serwer Node/Nginx podaje pliki aplikacji i `/healthz`;
nie przyjmuje plików qPCR do obliczeń. Nie ma endpointów REST `/analyze`, kont,
tokenów API ani bazy danych. GitHub Pages udostępnia tylko pliki statyczne.

## Uruchomienie aplikacji

W katalogu z `package.json`, używając Node.js 22 lub nowszego:

```sh
npm start
```

Otwórz http://127.0.0.1:8787. Nie trzeba wykonywać `npm install`.
Jeśli PowerShell blokuje `npm.ps1`, używaj `npm.cmd start` i `npm.cmd run ...`.
Najpierw uruchom demonstrację, potem wybierz własne pliki T0 i T1 (opcjonalnie
T2–T4). Ustaw cel analizy, rzeczywiste czasy i jednostkę czasu. Tier włączaj
wyłącznie z profilem dowodów odpowiednim dla badania. Wyniki, raport DOCX i plik
projektu zapisuje się lokalnie. Pełny przebieg: [USER_GUIDE_PL.md](USER_GUIDE_PL.md).

## Gotowy przykład dla Node.js

Z katalogu głównego repozytorium:

```sh
node examples/analyze.mjs
node examples/analyze.mjs pomiary_T0.csv pomiary_T1.csv
```

Bez argumentów przykład analizuje dane syntetyczne i wypisuje JSON na standardowe
wyjście: 6 preparatów i 46 kompletnych par Qty oraz Ct. Z dwoma argumentami czyta
własne CSV, TSV lub XLSX. Błędy wypisuje na standardowe wyjście błędów, z kodem
zakończenia 1 (błędna liczba argumentów: 2).

Przed naukowym użyciem przykładu dostosuj `assay`, `timeValue` i `timeUnit` do
badania: przykład dla własnych danych zakłada T0=0, T1=1 dzień i cel `decrease`.
Nie traktuj tych wartości jako metadanych odczytanych z plików. Tier jest wyłączony.

## Główna funkcja

Import: `docs/local-analysis.js`.

```js
const result = await analyzeWorkbooksLocally({
  selections, assay, timeUnit, profile,
  tierEnabled: false,
  candidateEvidenceFile: null,
  screeningReferenceFile: null,
});
```

| Argument | Znaczenie |
| --- | --- |
| `selections` | 2–5 pozycji `{ term, timeValue, file }`, w kolejności T0, T1, …, T4; `file` jest obiektem `File` |
| `assay` | Metadane: `technology`, `target_category`, `target_name`, `analysis_goal`, `host_species`; wzór w przykładzie |
| `timeUnit` | Jednostka czasu, np. `day` |
| `profile` | Wynik `loadLocalScientificProfile()`; w Node należy dostarczyć czytnik plików, jak w przykładzie |
| `tierEnabled` | Czy obliczać Tier; domyślnie `true`, dlatego dla samego qPCR jawnie ustaw `false` |
| `candidateEvidenceFile` | Opcjonalny `File` z profilem CSV; wzór `docs/candidate-evidence-template.csv` |
| `screeningReferenceFile` | Opcjonalny `File` z benchmarkiem CSV; wzór `docs/screening-reference-template.csv` |

W przeglądarce `loadLocalScientificProfile()` pobiera publiczne pliki konfiguracji
z `./config/` względem strony. Pomiary nie są wysyłane. W Node przykład zastępuje
ten odczyt lokalnym `readFile`.

Funkcja zwraca obietnicę obiektu wynikowego. Najważniejsze pola:

| Pole | Zawartość |
| --- | --- |
| `software` | Wersja i dane cytowania |
| `overview` | Liczba kompletnych par i podsumowanie kontroli integralności |
| `candidates` | Wyniki dla preparatów, efekty, oceny, `tests.quantity_signed_rank` z W, p i q |
| `effect_scaling` | Offset Qty i skala efektu użyte dla tego zbioru |
| `local_execution` | Informacja o lokalnym wykonaniu |

Przy wyłączonym Tier pola Tier są pomijane. Szczegóły obliczeń i ograniczenia:
[SCIENTIFIC_ENGINE_v1.md](SCIENTIFIC_ENGINE_v1.md), [LIMITATIONS.md](LIMITATIONS.md).

## Wejście i błędy

Obsługiwane są CSV, TSV i pierwszy arkusz XLSX. Limit: 5 MB na plik i 100 000
wierszy danych. Wymagane są identyfikatory preparatu i próbki, wspólny Detector/Target,
Ct/Cq oraz Qty/Quantity. Wzór: `docs/qpcr-input-template.csv`. Zachowaj te same
identyfikatory dla par czasowych. Puste komórki i znaczniki braków nie są zerami.

Nieprawidłowe nagłówki, wartości lub niezgodne arkusze powodują odrzucenie obietnicy.
Obsłuż `try/catch` i pokaż `error.message`; `error.details` może zawierać kontekst
pliku lub walidacji. Sprawdzaj też ostrzeżenia o brakach i powtórzeniach.

## API niższego poziomu

`readQpcrInput(bytes, term, filename)` z `docs/xlsx-reader.js` normalizuje plik.
`assertCompatibleWorkbooks(workbooks)` sprawdza zgodność zestawu. Funkcja
`analyzePrimaryQpcr` z `docs/lib/scientific-engine.mjs` przyjmuje znormalizowane
`longRows`, `analysisSpecification`, `tierSpecification` i `assay`.
Wzór użycia znajduje się w `tests/synthetic-validation.test.mjs`. Przy integracji
preferuj główną funkcję, która łączy walidację, profile, kontrasty i metadane.

Raport DOCX można zbudować z wyniku:

```js
import { buildGenericAssessmentReportModel } from '../docs/lib/generic-report-model.mjs';
import { renderGenericAssessmentDocx } from '../docs/lib/docx.mjs';
// Ścieżki importów zakładają skrypt w examples/.
const model = buildGenericAssessmentReportModel(result, { language: 'pl' });
const bytes = renderGenericAssessmentDocx(model); // Uint8Array
```

W Node zapisz `bytes` przez `writeFile`; w przeglądarce użyj `Blob` i pobrania pliku.
Przykłady serializacji projektu i pełny test raportu: `validation/verify-release.mjs`.

## HTTP i wdrożenie

`GET /` zwraca aplikację, `GET /healthz` stan serwera Node/Nginx i wersję.
GitHub Pages nie implementuje dynamicznego `/healthz`. Statyczne zasoby dostępne
są przez GET/HEAD; POST do ścieżki analizy nie jest obsługiwany.
Port Node: 8787; Docker: 8080. Konfiguracja: [SERVER_DEPLOYMENT.md](../SERVER_DEPLOYMENT.md).

## Cytowanie

Użycie naukowe podlega obowiązkowi cytowania z [LICENSE](../LICENSE).
Wzór i przykładowe zdanie do metod: [CITATION_POLICY.md](../CITATION_POLICY.md).
