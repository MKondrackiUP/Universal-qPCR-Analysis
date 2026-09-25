# Syntetyczne zestawy walidacyjne qPCR

Te pliki służą wyłącznie do technicznego sprawdzenia obliczeń aplikacji; nie przedstawiają eksperymentu biologicznego i nie wolno ich interpretować naukowo ani klinicznie.

## Jak uruchomić

1. W aplikacji wybierz kategorię celu `Inny`, nazwę `Synthetic validation target` i oczekiwany kierunek `Spadek`.
2. Wyłącz moduł Tier, ponieważ zestawy sprawdzają czystą analizę statystyczną qPCR i nie zawierają profilu dowodów.
3. Wczytaj pasujące pliki `*_T0` oraz `*_T1` w formacie CSV albo XLSX.
4. Kliknij **Analizuj pliki** i porównaj tabelę decyzji z `expected-results.json`.

## Zestawy

- `01_clear_directions`: sześć zgodnych spadków oraz sześć zgodnych wzrostów; oczekiwane `W=0`, `p=q=0,03125`.
- `02_edge_cases`: same różnice zerowe, kierunek mieszany `3↓/3↑` z `W=10`, `p=q=1` oraz preparat z tylko dwiema parami.
- `03_fdr_panel`: cztery preparaty z oczekiwanymi p równymi `0,0078125`, `0,03125`, `0,125` i `1`, dającymi q równe `0,03125`, `0,0625`, `0,1666667` i `1`.

Każdy zestaw występuje jako CSV i XLSX, a obie wersje muszą prowadzić do tych samych wyników. Dokładne wartości oczekiwane, offset Qty, liczebności, mediany, W, p, q i kody ocen znajdują się w `expected-results.json`.

Pliki można odtworzyć poleceniem:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\generate_synthetic_qpcr_validation_fixtures.ps1
```
