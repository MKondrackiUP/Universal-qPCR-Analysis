# Wdrożenie serwerowe

## Zalecany wariant

Najbezpieczniejszy wariant to hosting statyczny katalogu `docs`. Serwer nie wykonuje analizy i nie przyjmuje plików użytkownika. Obliczenia, wykresy i DOCX powstają po stronie przeglądarki.

## Wymagania

- dowolny statyczny serwer HTTP;
- HTTPS dla publicznego wdrożenia;
- poprawne typy MIME: `.js` i `.mjs` jako JavaScript, `.json` jako JSON, `.csv` jako tekst CSV;
- brak przepisywania nieistniejących zasobów na `index.html` — aplikacja nie jest routerem SPA;
- katalog `docs/config` oraz `docs/lib` muszą pozostać dostępne pod tą samą ścieżką bazową co `index.html`.

## Nginx/Apache

Zawartość `docs` można skopiować bezpośrednio do skonfigurowanego katalogu `root`/`DocumentRoot`. Plik `nginx.conf` w repozytorium pokazuje zalecane nagłówki bezpieczeństwa. Jeżeli uczelniany reverse proxy dodaje własną politykę CSP, musi dopuścić lokalne skrypty oraz obrazy `data:` i `blob:` używane przez wykresy i pobierane raporty.

## Docker i reverse proxy

Kontener nasłuchuje na porcie 8080. Publiczny reverse proxy powinien zakończyć TLS i przekazać ruch HTTP do kontenera. W tym wydaniu nie ma sesji, cookies, kont, API analitycznego ani wolumenu danych.

## Kontrola po wdrożeniu

1. Otwórz `/healthz` — w Dockerze lub serwerze `serve.mjs` powinien zwrócić wersję `0.22.0` i `browser_memory_only`.
2. Otwórz aplikację i pobierz oba szablony CSV.
3. Wczytaj T0 i T1, sprawdź karty mapowania oraz oba wykresy.
4. Wygeneruj DOCX i potwierdź, że odnośnik ma schemat `blob:`.
5. W narzędziach sieciowych przeglądarki potwierdź brak żądania zawierającego dane wejściowe.

## Logi

Standardowy serwer WWW może rejestrować adres IP, czas i ścieżki pobieranych plików statycznych. Nie powinien rejestrować zawartości XLSX/CSV/TSV, ponieważ przeglądarka ich nie wysyła. Polityka retencji zwykłych logów dostępowych pozostaje po stronie administratora uczelni.
