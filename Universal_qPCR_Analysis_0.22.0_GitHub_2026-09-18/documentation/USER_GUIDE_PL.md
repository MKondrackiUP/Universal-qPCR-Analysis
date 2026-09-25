# Universal qPCR Analysis — szybki start

## Do czego służy aplikacja

Aplikacja porównuje sparowane pomiary qPCR lub RT-qPCR między T0 i T1, opcjonalnie rozszerza analizę do T2–T4, wykonuje testy statystyczne i generuje raport DOCX osobno dla każdego preparatu.

Jest to narzędzie badawcze, a nie system diagnostyczny lub kliniczny; wynik opisuje wyłącznie wczytane dane.

## Analiza w pięciu krokach

1. Wybierz technologię, kategorię i nazwę celu oraz oczekiwany kierunek zmiany.
2. Zostaw Tier włączony tylko wtedy, gdy masz właściwy profil dowodów; czysta analiza qPCR działa niezależnie od Tieru.
3. Wczytaj T0 i T1 w formacie XLSX, CSV lub TSV, zachowując identyczne nazwy preparatów i identyfikatory próbek w obu punktach.
4. Kliknij **Analizuj pliki**, a następnie sprawdź mapowanie kolumn, kompletność, efekt Qty, W, p, q, integralność i końcową ocenę.
5. Wygeneruj DOCX oraz zapisz `.qpcrproj`, jeśli chcesz później odtworzyć wynik bez ponownego wczytywania danych.

## Minimalne dane wejściowe

Wymagane są kolumny preparatu, próbki, celu, Ct/Cq oraz Qty/Quantity; `Task` jest opcjonalne i domyślnie przyjmuje `Unknown`.

Każda para jest identyfikowana przez preparat, opcjonalną płeć i identyfikator próbki, dlatego wartości te muszą być zgodne między T0 i T1.

Aplikacja nie wylicza Qty z Ct/Cq, nie imputuje brakujących wartości i odrzuca niejednoznaczne mapowanie kolumn.

## Walidacja plików

- Obsługiwane są XLSX, CSV i TSV do 5 MB oraz maksymalnie 100 000 wierszy danych.
- CSV/TSV może używać UTF-8, UTF-16 LE/BE lub Windows-1250; separator jest wykrywany jako przecinek, średnik albo tabulator.
- Wartości Ct/Cq, SD i Qty muszą być nieujemnymi liczbami. Brak można zapisać jako pustą komórkę, `NA`, `N/A`, `NaN`, `Undetermined` albo `No Ct`.
- Każdy wiersz musi mieć preparat i identyfikator próbki, a jeden plik może zawierać tylko jeden niepusty Detector/Target.
- Do obliczeń przyjmowane są wyłącznie próbki `Task=Unknown`; puste komórki Task są ustawiane na `Unknown` i raportowane.
- Aplikacja zatrzymuje analizę przy błędzie i pokazuje kod, plik, punkt czasu, numery wierszy oraz sposób poprawy.
- Dopuszczalne braki Ct/Qty, Qty równe zero, powtórzone obserwacje, wartości domyślne i pominięte kolumny są widoczne jako ostrzeżenia w interfejsie i DOCX.

## Jak czytać najważniejsze wyniki

- `mediana log10(T1/T0) < 0` oznacza spadek Qty, wartość `> 0` wzrost, a `= 0` brak zmiany.
- `W` i `p` pochodzą z dwustronnego testu rangowanych znaków Wilcoxona, a `q` jest p po korekcie FDR Benjamini–Hochberga.
- Statystyczne potwierdzenie wymaga `q < 0,05`; sam kierunek mediany bez tego progu jest sygnałem opisowym.
- Przy samych różnicach zerowych test nie ma niezerowych par, więc p i q nie mają zastosowania.
- Równa liczba spadków i wzrostów jest prezentowana jako kierunek mieszany, nawet jeżeli mediana minimalnie wskazuje jedną stronę.
- Ct jest kontrolą pomocniczą i samodzielnie nie zmienia oceny opartej na Qty.
- Tier jest osobnym priorytetem walidacyjnym opartym również na profilu dowodów i nie oznacza skuteczności.

## Przykładowe dane

Katalog `examples/synthetic-qpcr-validation` zawiera trzy pary T0/T1 w formatach CSV i XLSX oraz plik z dokładnymi oczekiwanymi wynikami.

Zestawy są syntetyczne i służą do sprawdzania oprogramowania, a nie do niezależnej walidacji biologicznej.

## Prywatność i raport

Interfejs analizuje pliki i tworzy DOCX w pamięci przeglądarki; dane nie są wysyłane ani zapisywane przez serwer aplikacji.

Plik `.qpcrproj` może jednak zawierać identyfikatory i pomiary, więc należy przechowywać go zgodnie z polityką danych badania.
