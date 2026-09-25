# Utworzenie repozytorium GitHub

1. Rozpakuj ZIP. Katalog z `README.md`, `package.json` i `docs` jest katalogiem
   głównym repozytorium. Do repozytorium prześlij jego zawartość, łącznie z
   `.github`, `.gitignore`, `.gitattributes` i `docs/.nojekyll`.
2. Na GitHub utwórz puste repozytorium, np. `universal-qpcr-analysis`.
   Nie generuj dodatkowego README ani licencji — paczka zawiera gotowe pliki.
3. Z katalogu paczki wykonaj:

```sh
git init -b main
git add .
git commit -m "Initial release: Universal qPCR Analysis 0.22.0"
git remote add origin https://github.com/TWOJ_LOGIN/universal-qpcr-analysis.git
git push -u origin main
```

Podmień `TWOJ_LOGIN` na swój login lub organizację. Adres w tym przykładzie jest
szablonem komendy, nie adresem istniejącego projektu.

4. W Settings → Pages wybierz Deploy from a branch, `main`, `/docs`.
5. Uruchom lokalnie poniższe kontrole; GitHub Actions również wykona kontrole
   aplikacji i zbuduje kontener po przesłaniu kodu.

```sh
npm run verify
npm run verify:release
npm run checksums:verify
```

6. Dodaj rzeczywisty `repository-code` do `CITATION.cff` i skopiuj ten sam plik
   do `docs/CITATION.cff`. Opcjonalnie dodaj prawdziwy ORCID i afiliację.
   Po zmianach wykonaj `npm run checksums:write`, sprawdź manifest i zapisz commit.
7. Tag `v0.22.0` uruchomi workflow tworzący szkic GitHub Release. Użyj go tylko
   w nowym repozytorium bez takiego tagu; nie nadpisuj wcześniejszego wydania.
   Rewizję paczki 2026-09-18 podaj w opisie wydania.
8. Opcjonalnie archiwizuj wydanie w Zenodo. Wybierz własną licencję z pliku
   LICENSE, nie Apache-2.0. Dopiero po uzyskaniu DOI dodaj go do cytowania.

Nie dołączono pliku `.zenodo.json` z fikcyjnymi identyfikatorami. Brak DOI,
ORCID i afiliacji nie blokuje opublikowania repozytorium. README i instrukcje
nie wymagają tych informacji do uruchomienia programu.

## Zawartość

- `README.md` i `README.pl.md`: opis i szybki start;
- `documentation/USER_GUIDE_PL.md`: instrukcja użytkownika;
- `documentation/API_GUIDE_PL.md`: API i integracja;
- `examples/analyze.mjs`: działający przykład Node.js;
- `LICENSE`, `CITATION.cff`, `CITATION_POLICY.md`: licencja i cytowanie;
- `tests`, `validation`, `.github`: testy i automatyczne kontrole;
- `docs/examples`: wyłącznie dane syntetyczne;
- Dockerfile i konfiguracja serwera: wdrożenie.

Własna licencja dopuszcza bezpłatne używanie, również komercyjne, i wymaga
cytowania w rozpowszechnianych pracach naukowych. Nie cofa praw do wcześniejszych
kopii Apache-2.0. Licencję zastosowano zgodnie z dyspozycją właściciela projektu;
prawa do odrębnie licencjonowanych elementów pozostają bez zmian.
