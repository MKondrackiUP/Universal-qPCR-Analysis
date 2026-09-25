# Universal qPCR Analysis Web 0.22.0

Rewizja paczki GitHub: **2026-09-18**; wersje aplikacji i silnika bez zmian.
Aplikacja działa w przeglądarce; API ma postać modułów JavaScript, bez serwera REST do analiz.
[Instrukcja API](documentation/API_GUIDE_PL.md) · [Obsługa aplikacji](documentation/USER_GUIDE_PL.md)
· [Publikacja na GitHub](GITHUB_SETUP_PL.md). Instalacja zależności npm nie jest potrzebna.


*[English](README.md) · **Polski***

Statyczna, bezkontowa aplikacja do lokalnej analizy qPCR/RT-qPCR T0–T4. Pliki XLSX, CSV i TSV są odczytywane oraz analizowane w pamięci przeglądarki. Hosting udostępnia wyłącznie pliki aplikacji — dane qPCR i generowane raporty DOCX nie są wysyłane na serwer.

Wersja 0.21.0 rozszerza walidację XLSX/CSV/TSV, rozpoznaje UTF-8, UTF-16 i Windows-1250, odrzuca błędne liczby oraz niekompletne identyfikatory i jawnie raportuje braki, zera Qty, powtórzone obserwacje, domyślne Task oraz pominięte kolumny. Interfejs pokazuje gotowość plików, dokładny kod błędu, wiersz i instrukcję naprawy po polsku i angielsku.

Wersja 0.21.1 porządkuje kod bez zmiany wyników naukowych: oddziela dekodowanie CSV/TSV, odczyt XLSX, walidację domenową, elementy DOM i komunikaty błędów. Mapa modułów i zasady bezpiecznych zmian znajdują się w `documentation/ARCHITECTURE.md`.

Wersja 0.21.2 powstała po audycie całej aplikacji. Przywraca renderowanie wykresów pod wdrożoną polityką CSP, ustala separator dziesiętny raz na plik, dzięki czemu angielski separator tysięcy nie jest już czytany jako polski przecinek dziesiętny, daje pierwszeństwo zadeklarowanej kolumnie płci przed prefiksem nazwy próbki, zastępuje wbudowany profil dowodów Tier przykładem syntetycznym, usuwa nieosiągalną ścieżkę serwerową raportu i pokazuje przesunięcie Qty oraz skalę efektu użyte w danym uruchomieniu. Silnik naukowy pozostaje w wersji 1.0.0 i żadne obliczenie nie uległo zmianie; pełna lista znajduje się w `CHANGELOG.md`.

Wersja 0.22.0 dodaje jedną możliwość: zamrożoną tabelę porównawczą używaną przy rekonstrukcji przesiewu można dostarczyć razem z analizą, zamiast mieć ją wbudowaną. Badanie może więc trzymać własny profil dowodów i własny benchmark przy artykule, który je opisuje, a dystrybucja zawiera wyłącznie przykłady syntetyczne. `validation/verify-release.mjs` weryfikuje wydanie od początku do końca na podstawie samego repozytorium, a `validation/verify-study-case.mjs` robi to samo dla zbioru danych trzymanego gdzie indziej.

## Obsługiwane wejścia i walidacja

- XLSX: pierwszy zadeklarowany arkusz, komórki współdzielone i `inlineStr`;
- CSV: przecinek lub średnik, cudzysłowy, CRLF i przecinek dziesiętny przy separatorze średnikowym;
- TSV: separator tabulacji;
- kodowania tekstowe: UTF-8 z BOM lub bez, UTF-16 LE/BE z BOM lub wykryte heurystycznie oraz Windows-1250 jako kontrolowany fallback;
- limit: 5 MB na plik i 100 000 wierszy danych;
- wymagane: preparat, próbka, jeden wspólny Detector/Target, Ct/Cq i Qty/Quantity;
- wartości Ct/Cq, SD i Qty muszą być nieujemne; braki można zapisać jako puste, `NA`, `N/A`, `NaN`, `Undetermined` lub `No Ct`;
- do analizy trafiają wyłącznie wiersze `Task=Unknown`; puste komórki Task są jawnie ustawiane na `Unknown`.
- separator dziesiętny jest ustalany raz na plik na podstawie jednoznacznych przesłanek; zapis taki jak `1,234`, który może oznaczać 1234 albo 1,234, jest odrzucany zamiast zgadywany, gdy plik nie daje innej wskazówki.

## GitHub Pages

1. Wgraj całą zawartość tej paczki do głównego katalogu repozytorium GitHub.
2. W repozytorium otwórz **Settings → Pages**.
3. Wybierz **Deploy from a branch**, gałąź `main` i katalog `/docs`.
4. Po publikacji aplikacja będzie działać także pod adresem projektu, np. `https://uzytkownik.github.io/nazwa-repo/`.

Plik `.nojekyll` znajduje się już w `docs`. Wszystkie odwołania aplikacji są względne, dlatego repozytorium nie musi być publikowane w głównej domenie.

## Serwer bez Dockera

Skopiuj zawartość katalogu `docs` do katalogu WWW serwera Apache, Nginx albo usługi hostingu statycznego. Serwer powinien:

- udostępniać `index.html` jako dokument startowy;
- zwracać `.mjs` oraz `.js` jako JavaScript;
- działać przez HTTPS w środowisku publicznym;
- nie dodawać backendowego uploadu plików qPCR.

Do lokalnego podglądu z Node.js 20+:

```bash
npm start
```

Domyślny adres to `http://127.0.0.1:8787`. Zmienne `HOST` i `PORT` pozwalają zmienić nasłuchiwanie.

## Docker

```bash
docker compose up -d --build
```

Aplikacja będzie dostępna pod `http://localhost:8080`, a kontrola stanu pod `/healthz`. Kontener działa bez zapisu, bez dodatkowych uprawnień i jako użytkownik nieuprzywilejowany.

## Prywatność

- brak kont i logowania;
- brak bazy danych;
- brak endpointu uploadu w tym wydaniu oraz brak jakiegokolwiek żądania wychodzącego ze ścieżki analizy — pilnuje tego test;
- wejścia i raporty pozostają w pamięci karty przeglądarki;
- zamknięcie lub przeładowanie karty usuwa bieżący wynik, chyba że użytkownik wcześniej pobierze lokalny plik `.qpcrproj`;
- pełny `.qpcrproj` może zawierać identyfikatory próbek i znormalizowane pomiary, dlatego należy przechowywać go zgodnie z polityką danych badania.

## Ograniczenia

Przed wykorzystaniem wyniku w publikacji przeczytaj `documentation/LIMITATIONS.md`.
Najważniejsze granice obecnej wersji:

- brak normalizacji do genu referencyjnego — walidator wymaga jednego wspólnego Detectora, więc pomocniczy punkt końcowy to ΔCt (T1 − T0) dla jednego celu, a nie ΔΔCt;
- brak korekty wydajności amplifikacji — Qty pochodzi z krzywej wzorcowej aparatu i jest przyjmowane bez zmian;
- `Undetermined` i `No Ct` są traktowane jako brak danych, więc para wypada z analizy kompletnych par;
- przesunięcie Qty i skala efektu są wyprowadzane z całego przesłanego zestawu preparatów, dlatego skalowany efekt, wynik zintegrowany i Tier porównuj wyłącznie w obrębie jednego uruchomienia; aplikacja pokazuje obie wielkości przy wyniku;
- wynik zintegrowany jest przejrzystą sumą addytywną z wagami 1,0, a nie sformalizowaną analizą wielokryterialną; oceny dowodów pochodzą z profilu i nie są przez aplikację weryfikowane;
- Tier oznacza priorytet do dalszej walidacji, nie skuteczność ani klasyfikację kliniczną.

## Licencja i cytowanie

Program jest bezpłatny, również do zastosowań komercyjnych, na własnej
[licencji](LICENSE). **Użycie w pracy naukowej wymaga wskazania użytej aplikacji
i zacytowania jej dokładnej wersji**. Wzór: [CITATION_POLICY.md](CITATION_POLICY.md).
Nie jest to Apache-2.0 ani licencja zatwierdzona przez OSI. Wcześniejsze prawa
do kopii udostępnionych na Apache-2.0 pozostają w mocy.

## Instrukcja i dane testowe

- szybki start: `documentation/USER_GUIDE_PL.md`;
- kompletne reguły oceny: `documentation/ASSESSMENT_RULES_PL.md`;
- trzy syntetyczne zestawy T0/T1 w CSV i XLSX: `docs/examples/synthetic-qpcr-validation`.

Zestawy testowe mają analitycznie ustalone wartości W, p i q zapisane w `expected-results.json`; służą wyłącznie walidacji technicznej i nie przedstawiają danych biologicznych.

Wbudowany profil dowodów Tier w `docs/config` jest równie syntetyczny: pokazuje zakresy ocen i działanie reguł Tier, nie ma znaczenia farmakologicznego i przed interpretacją Tieru należy zastąpić go profilem właściwym dla badania. Przykładowy plik projektu: `docs/examples/synthetic-example-project.qpcrproj`.

## Rozwój i automatyczna kontrola

To repozytorium jest celowo oddzielone od historycznych manuskryptów, danych i analiz pojedynczych chorób lub testów. Zawiera wyłącznie uniwersalną aplikację, wdrożenie oraz jawnie oznaczone dane syntetyczne.

Do pełnej kontroli lokalnej użyj Node.js 20 lub nowszego:

```bash
npm run verify
npm run checksums:verify
```

GitHub Actions powtarza testy na Node 20 i 22 przy każdym pull requeście i pushu do `main`, buduje obraz Docker, uruchamia go i sprawdza, czy `/healthz` zgłasza wersję z `package.json`. Katalog `validation/` zawiera opcjonalne porównanie testu Wilcoxona ze SciPy — SciPy nie jest zależnością i porównanie nie wchodzi do `npm run verify`. Zasady zmian naukowych opisuje [CONTRIBUTING.md](CONTRIBUTING.md), zgłaszanie podatności [SECURITY.md](SECURITY.md), procedurę wydania [RELEASE_PROCESS.md](RELEASE_PROCESS.md), a zasady współpracy [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
